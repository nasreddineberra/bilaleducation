import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import NewMessageClient from '@/components/communications/NewMessageClient'

// Communication aux parents = voix de l'etablissement. L'enseignant ne communique
// que les devoirs (cahier de texte) ; le comptable passe par Financements.
const PARENT_COMM_ROLES = ['admin', 'direction', 'secretaire', 'responsable_pedagogique']

export default async function NewMessagePage() {
  const supabase = await createClient()
  const h = await headers()
  const etablissementId = h.get('x-etablissement-id') ?? ''

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .single()

  const role = profile?.role ?? ''
  if (!PARENT_COMM_ROLES.includes(role)) redirect('/dashboard/communications')

  // Annee scolaire en cours
  const { data: schoolYear } = await supabase
    .from('school_years')
    .select('id, label')
    .eq('is_current', true)
    .single()

  const yearLabel = schoolYear?.label ?? null

  // ─── Classes de l'annee ────────────────────────────────────────────────────
  type ClassRow = {
    id: string; name: string; level: string
    day_of_week: string | null; start_time: string | null; end_time: string | null
    main_teacher_name: string | null; main_teacher_civilite: string | null
    cotisation_label: string | null
  }

  const classQuery = supabase
    .from('classes')
    .select('id, name, level, day_of_week, start_time, end_time, cotisation_types(label)')
    .order('name')
  if (yearLabel) classQuery.eq('academic_year', yearLabel)

  const { data: classData } = await classQuery
  let classes = (classData ?? []).map((c: any) => ({
    ...c,
    main_teacher_name: null,
    main_teacher_civilite: null,
    cotisation_label: c.cotisation_types?.label ?? null,
  })) as ClassRow[]

  const classIds = classes.map(c => c.id)

  // Professeur principal de chaque classe
  if (classIds.length > 0) {
    type CTRow = { class_id: string; teachers: { civilite: string | null; first_name: string; last_name: string } | null }
    const { data: mainTeacherRows } = await supabase
      .from('class_teachers')
      .select('class_id, teachers(civilite, first_name, last_name)')
      .eq('is_main_teacher', true)
      .in('class_id', classIds) as { data: CTRow[] | null }

    const teacherMap = new Map(
      (mainTeacherRows ?? []).map(ct => [
        ct.class_id,
        ct.teachers
          ? { name: `${ct.teachers.first_name} ${ct.teachers.last_name}`, civilite: ct.teachers.civilite }
          : null,
      ])
    )
    classes = classes.map(c => {
      const t = teacherMap.get(c.id)
      return { ...c, main_teacher_name: t?.name ?? null, main_teacher_civilite: t?.civilite ?? null }
    })
  }

  // ─── Parents ───────────────────────────────────────────────────────────────
  // Liste complete : seul « Tous les parents enregistres » atteint les non-inscrits.
  type ParentRow = {
    id: string
    tutor1_last_name: string; tutor1_first_name: string; tutor1_email: string | null
    tutor2_last_name: string | null; tutor2_first_name: string | null; tutor2_email: string | null
  }

  const { data: parentData } = await supabase
    .from('parents')
    .select('id, tutor1_last_name, tutor1_first_name, tutor1_email, tutor2_last_name, tutor2_first_name, tutor2_email')
    .order('tutor1_last_name')
  const parents = (parentData ?? []) as ParentRow[]

  // ─── Mapping classe → parents ──────────────────────────────────────────────
  // Une classe adulte n'a pas d'eleves : ses participants sont les tuteurs
  // inscrits (parent_class_enrollments). Sans eux, une classe adulte afficherait
  // « aucun destinataire » alors que l'envoi, lui, fonctionne.
  const classParentMap: Record<string, string[]> = {}
  const enrolledParentIds = new Set<string>()

  if (classIds.length > 0) {
    const [{ data: enrollments }, { data: adultEnrollments }] = await Promise.all([
      supabase
        .from('enrollments')
        .select('class_id, students(parent_id)')
        .in('class_id', classIds)
        .eq('status', 'active'),
      supabase
        .from('parent_class_enrollments')
        .select('class_id, parent_id')
        .in('class_id', classIds)
        .eq('status', 'active'),
    ])

    const map: Record<string, Set<string>> = {}
    const add = (classId: string, parentId?: string | null) => {
      if (!parentId) return
      if (!map[classId]) map[classId] = new Set()
      map[classId].add(parentId)
      enrolledParentIds.add(parentId)
    }

    for (const e of ((enrollments ?? []) as any[])) add(e.class_id, e.students?.parent_id)
    for (const a of ((adultEnrollments ?? []) as any[])) add(a.class_id, a.parent_id)

    for (const [cid, pids] of Object.entries(map)) classParentMap[cid] = [...pids]
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <NewMessageClient
        role={role}
        classes={classes}
        parents={parents}
        classParentMap={classParentMap}
        enrolledParentIds={[...enrolledParentIds]}
        etablissementId={etablissementId}
      />
    </div>
  )
}
