import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import AbsencesClient from '@/components/absences/AbsencesClient'
import { AlertTriangle } from 'lucide-react'
import type { Period, Absence } from '@/types/database'
import { effectiveRole } from '@/lib/auth/effective-role'
import { genderFromRelationship } from '@/lib/parents/tutor-gender'

/**
 * FEUILLE D'APPEL — COURS ADULTES.
 *
 * Deux entrées de menu comme les Affectations, mais UN SEUL composant : c'est
 * rigoureusement le même écran, seules la source des participants et la table
 * cible changent (voir l'en-tête de `AbsencesClient`).
 *
 * Cette page fait donc tout le travail de traduction, et le client reste ignorant
 * du modèle adulte : les participants arrivent avec une CLÉ UNIFIÉE
 * `parentId-tutorNumber` dans le champ `student_id`, et les lignes
 * d'`adult_absences` sont normalisées de la même façon.
 */

type ClassRow = {
  id: string
  name: string
  level: string
  day_of_week: string | null
  start_time: string | null
  end_time: string | null
  main_teacher_name: string | null
  main_teacher_civilite: string | null
  cotisation_label: string | null
}

type ParticipantRow = {
  student_id: string
  class_id: string
  first_name: string
  last_name: string
  student_number: string
  gender: string | null
  photo_url: string | null
}

export default async function AbsencesAdultesPage() {
  const supabase        = await createClient()
  const h               = await headers()
  const etablissementId = h.get('x-etablissement-id') ?? ''

  const { data: { user } } = await supabase.auth.getUser()
  const userId = user?.id ?? ''

  const { data: profile } = await supabase
    .from('profiles').select('role, etablissement_id').eq('id', userId).single()
  const role = effectiveRole(profile) ?? 'enseignant'

  const { data: schoolYear } = await supabase
    .from('school_years')
    .select('id, label, vacations, jours_feries, periods(*)')
    .eq('is_current', true)
    .single() as { data: ({ id: string; label: string; vacations: unknown; jours_feries: unknown; periods: Period[] }) | null }

  const periods      = (schoolYear?.periods ?? []).sort((a, b) => a.order_index - b.order_index)
  const schoolYearId = schoolYear?.id ?? null
  const yearLabel    = schoolYear?.label ?? null

  // ── Classes ADULTES de l'année, filtrées selon le rôle ──
  let classes: ClassRow[] = []
  const construire = (data: any[]) => data
    .filter((c: any) => c.cotisation_types?.is_adult)
    .map((c: any) => ({
      ...c, main_teacher_name: null, main_teacher_civilite: null,
      cotisation_label: c.cotisation_types?.label ?? null,
    })) as ClassRow[]

  if (['admin', 'direction', 'responsable_pedagogique', 'secretaire'].includes(role)) {
    const query = supabase
      .from('classes')
      .select('id, name, level, day_of_week, start_time, end_time, cotisation_types(label, is_adult)')
      .order('name')
    if (yearLabel) query.eq('academic_year', yearLabel)
    const { data } = await query
    classes = construire(data ?? [])

  } else if (role === 'enseignant') {
    const { data: teacher } = await supabase
      .from('teachers').select('id').eq('user_id', userId).single()

    if (teacher) {
      const { data: assignments } = await supabase
        .from('class_teachers').select('class_id')
        .eq('teacher_id', teacher.id).eq('is_main_teacher', true)

      const classIds = (assignments ?? []).map((a: { class_id: string }) => a.class_id)
      if (classIds.length > 0) {
        const query = supabase
          .from('classes')
          .select('id, name, level, day_of_week, start_time, end_time, cotisation_types(label, is_adult)')
          .in('id', classIds).order('name')
        if (yearLabel) query.eq('academic_year', yearLabel)
        const { data } = await query
        classes = construire(data ?? [])
      }
    }
  }

  if (classes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center animate-fade-in">
        <AlertTriangle size={36} className="text-warm-700" />
        <p className="text-sm text-warm-700">Aucun cours adultes cette année.</p>
      </div>
    )
  }

  // Professeur principal de chaque classe (avec civilité)
  {
    type CTRow = { class_id: string; teachers: { civilite: string | null; first_name: string; last_name: string } | null }
    const { data: mainTeacherRows } = await supabase
      .from('class_teachers')
      .select('class_id, teachers(civilite, first_name, last_name)')
      .eq('is_main_teacher', true)
      .in('class_id', classes.map(c => c.id)) as { data: CTRow[] | null }

    const teacherMap = new Map(
      (mainTeacherRows ?? []).map(ct => [
        ct.class_id,
        ct.teachers ? { name: `${ct.teachers.last_name} ${ct.teachers.first_name}`, civilite: ct.teachers.civilite } : null,
      ])
    )
    classes = classes.map(c => {
      const t = teacherMap.get(c.id)
      return { ...c, main_teacher_name: t?.name ?? null, main_teacher_civilite: t?.civilite ?? null }
    })
  }

  const classIds = classes.map(c => c.id)

  // ── Participants : les TUTEURS inscrits ──
  let participants: ParticipantRow[] = []
  {
    const { data: pce } = await supabase
      .from('parent_class_enrollments')
      .select('parent_id, tutor_number, class_id, parents:parent_id(tutor1_last_name, tutor1_first_name, tutor1_relationship, tutor2_last_name, tutor2_first_name, tutor2_relationship)')
      .in('class_id', classIds)
      .eq('status', 'active')

    participants = ((pce ?? []) as any[])
      .filter(e => e.parents)
      .map(e => {
        const t2 = e.tutor_number === 2
        return {
          // CLÉ UNIFIÉE. Le client ne connaît que ce champ ; il le reconvertit en
          // `parent_id` + `tutor_number` au moment d'écrire.
          student_id: `${e.parent_id}-${e.tutor_number}`,
          class_id:   e.class_id,
          first_name: t2 ? e.parents.tutor2_first_name : e.parents.tutor1_first_name,
          last_name:  t2 ? e.parents.tutor2_last_name  : e.parents.tutor1_last_name,
          // Un adulte n'a pas de matricule : le champ existe, il reste vide, comme
          // sur le bulletin adulte où le matricule est masqué.
          student_number: '',
          gender:     genderFromRelationship(t2 ? e.parents.tutor2_relationship : e.parents.tutor1_relationship),
          photo_url:  null,
        }
      })
      .filter(p => p.last_name)
      .sort((a, b) =>
        a.last_name.localeCompare(b.last_name) || a.first_name.localeCompare(b.first_name)
      )
  }

  // ── Assiduité existante, normalisée sur la clé unifiée ──
  let absences: Absence[] = []
  if (classIds.length > 0) {
    const { data } = await supabase
      .from('adult_absences')
      .select('*')
      .eq('etablissement_id', etablissementId)
      .in('class_id', classIds)
    absences = ((data ?? []) as any[]).map(r => ({
      ...r, student_id: `${r.parent_id}-${r.tutor_number}`,
    })) as Absence[]
  }

  const { data: etablissement } = await supabase
    .from('etablissements')
    .select('nom, adresse, telephone, logo_url')
    .eq('id', etablissementId)
    .single()

  return (
    <div className="h-full animate-fade-in">
      <AbsencesClient
        classes={classes}
        periods={periods}
        vacations={(schoolYear?.vacations as never[]) ?? []}
        feries={(schoolYear?.jours_feries as never[]) ?? []}
        students={participants}
        initialAbsences={absences}
        etablissementId={etablissementId}
        schoolYearId={schoolYearId}
        etablissement={etablissement ? { nom: etablissement.nom, adresse: etablissement.adresse, telephone: etablissement.telephone, logo_url: etablissement.logo_url } : null}
        yearLabel={yearLabel}
        role={role}
        mode="adults"
      />
    </div>
  )
}
