import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import BulletinsClient from '@/components/bulletins/BulletinsClient'
import { AlertTriangle } from 'lucide-react'
import type { Period, EvalTypeConfig, UniteEnseignement, CoursModule, Cours } from '@/types/database'

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
  is_adult: boolean
}

type EvaluationRow = {
  id: string
  class_id: string
  period_id: string | null
  cours_id: string | null
  eval_kind: string | null
  max_score: number | null
  coefficient: number
  evaluation_date: string | null
  display_module_id: string | null
  display_ue_id: string | null
  sort_order: number | null
}

type StudentRow = {
  student_id: string
  class_id: string
  first_name: string
  last_name: string
  student_number: string
  date_of_birth: string | null
  photo_url: string | null
}

type GradeRow = {
  id: string
  student_id: string
  evaluation_id: string
  score: number | null
  comment: string | null
  is_absent: boolean
}

type AbsenceRow = {
  student_id: string
  absence_type: 'absence' | 'retard'
  is_justified: boolean
  period_id: string
}

type EtablissementInfo = {
  nom: string
  adresse: string | null
  telephone: string | null
  logo_url: string | null
}

export default async function BulletinsPage() {
  const supabase        = await createClient()
  const h               = await headers()
  const etablissementId = h.get('x-etablissement-id') ?? ''

  // 1. Profil courant
  const { data: { user } } = await supabase.auth.getUser()
  const userId = user?.id ?? ''

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single()

  const role = profile?.role ?? 'enseignant'

  // 2. Année scolaire + périodes + types d'évaluation
  const { data: schoolYear } = await supabase
    .from('school_years')
    .select('id, label, periods(*), eval_type_configs(*)')
    .eq('is_current', true)
    .single() as { data: ({ id: string; label: string; periods: Period[]; eval_type_configs: EvalTypeConfig[] }) | null }

  const periods         = (schoolYear?.periods ?? []).sort((a, b) => a.order_index - b.order_index)
  const evalTypeConfigs = schoolYear?.eval_type_configs ?? []
  const schoolYearId    = schoolYear?.id ?? null
  const yearLabel       = schoolYear?.label ?? null

  // 3. Classes (filtrées selon le rôle)
  let classes: ClassRow[] = []

  if (['admin', 'direction', 'responsable_pedagogique'].includes(role)) {
    const query = supabase
      .from('classes')
      .select('id, name, level, day_of_week, start_time, end_time, cotisation_types(label, is_adult)')
      .order('name')
    if (yearLabel) query.eq('academic_year', yearLabel)
    const { data } = await query
    classes = (data ?? []).map((c: any) => ({ ...c, main_teacher_name: null, main_teacher_civilite: null, cotisation_label: c.cotisation_types?.label ?? null, is_adult: c.cotisation_types?.is_adult ?? false })) as ClassRow[]

  } else if (role === 'enseignant') {
    const { data: teacher } = await supabase
      .from('teachers')
      .select('id')
      .eq('user_id', userId)
      .single()

    if (teacher) {
      const { data: assignments } = await supabase
        .from('class_teachers')
        .select('class_id')
        .eq('teacher_id', teacher.id)
        .eq('is_main_teacher', true)

      const classIds = (assignments ?? []).map((a: { class_id: string }) => a.class_id)
      if (classIds.length > 0) {
        const query = supabase
          .from('classes')
          .select('id, name, level, day_of_week, start_time, end_time, cotisation_types(label, is_adult)')
          .in('id', classIds)
          .order('name')
        if (yearLabel) query.eq('academic_year', yearLabel)
        const { data } = await query
        classes = (data ?? []).map((c: any) => ({ ...c, main_teacher_name: null, main_teacher_civilite: null, cotisation_label: c.cotisation_types?.label ?? null, is_adult: c.cotisation_types?.is_adult ?? false })) as ClassRow[]
      }
    }
  }

  if (classes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center animate-fade-in">
        <AlertTriangle size={36} className="text-warm-400" />
        <p className="text-sm text-warm-500">Aucune classe disponible.</p>
      </div>
    )
  }

  // 3b. Professeur principal de chaque classe
  if (classes.length > 0) {
    type CTRow = { class_id: string; teachers: { civilite: string | null; first_name: string; last_name: string } | null }
    const { data: mainTeacherRows } = await supabase
      .from('class_teachers')
      .select('class_id, teachers(civilite, first_name, last_name)')
      .eq('is_main_teacher', true)
      .in('class_id', classes.map(c => c.id)) as { data: CTRow[] | null }

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

  const classIds = classes.map(c => c.id)

  // 4. Référentiel des cours
  const [{ data: ues }, { data: modules }, { data: cours }] = await Promise.all([
    supabase.from('unites_enseignement').select('*').order('order_index').order('nom_fr'),
    supabase.from('cours_modules').select('*').order('order_index').order('nom_fr'),
    supabase.from('cours').select('*').order('order_index').order('nom_fr'),
  ])

  // 5. Évaluations pour toutes les classes
  let evaluations: EvaluationRow[] = []
  if (classIds.length > 0) {
    const { data } = await supabase
      .from('evaluations')
      .select('id, class_id, period_id, cours_id, eval_kind, max_score, coefficient, evaluation_date, display_module_id, display_ue_id, sort_order')
      .eq('etablissement_id', etablissementId)
      .in('class_id', classIds)
      .not('cours_id', 'is', null)
    evaluations = (data ?? []) as EvaluationRow[]
  }

  // Séparer classes élèves / classes adultes (selon cotisation.is_adult)
  const studentClassIds = classes.filter(c => !c.is_adult).map(c => c.id)
  const adultClassIds   = classes.filter(c =>  c.is_adult).map(c => c.id)
  const adultClassSet   = new Set(adultClassIds)

  // 6. Participants (actifs) : élèves (enrollments) + tuteurs adultes (parent_class_enrollments)
  // Clé participant unifiée : uuid élève, ou « parentId-tutorNumber » pour un adulte.
  const students: StudentRow[] = []

  if (studentClassIds.length > 0) {
    const { data: enrollments } = await supabase
      .from('enrollments')
      .select('student_id, class_id, students(id, first_name, last_name, student_number, date_of_birth, photo_url)')
      .in('class_id', studentClassIds)
      .eq('status', 'active')

    students.push(...((enrollments ?? []) as any[])
      .filter(e => e.students)
      .map(e => ({
        student_id:     e.student_id,
        class_id:       e.class_id,
        first_name:     e.students.first_name,
        last_name:      e.students.last_name,
        student_number: e.students.student_number,
        date_of_birth:  e.students.date_of_birth ?? null,
        photo_url:      e.students.photo_url ?? null,
      })))
  }

  if (adultClassIds.length > 0) {
    const { data: adultEnr } = await supabase
      .from('parent_class_enrollments')
      .select('parent_id, class_id, tutor_number, parents(tutor1_first_name, tutor1_last_name, tutor2_first_name, tutor2_last_name)')
      .in('class_id', adultClassIds)
      .eq('status', 'active')

    students.push(...((adultEnr ?? []) as any[])
      .filter(e => e.parents)
      .map(e => {
        const p     = e.parents
        const first = e.tutor_number === 1 ? p.tutor1_first_name : p.tutor2_first_name
        const last  = e.tutor_number === 1 ? p.tutor1_last_name  : p.tutor2_last_name
        return {
          student_id:     `${e.parent_id}-${e.tutor_number}`,
          class_id:       e.class_id,
          first_name:     first ?? '',
          last_name:      last ?? '',
          student_number: '',
          date_of_birth:  null,
          photo_url:      null,
        }
      }))
  }

  students.sort((a, b) =>
    a.last_name.localeCompare(b.last_name) || a.first_name.localeCompare(b.first_name)
  )

  // 7. Notes existantes : grades (élèves) + adult_grades (adultes), clé participant unifiée
  const grades: GradeRow[] = []
  const studentEvalIds = evaluations.filter(e => !adultClassSet.has(e.class_id)).map(e => e.id)
  const adultEvalIds   = evaluations.filter(e =>  adultClassSet.has(e.class_id)).map(e => e.id)

  if (studentEvalIds.length > 0) {
    const { data } = await supabase
      .from('grades')
      .select('id, student_id, evaluation_id, score, comment, is_absent')
      .in('evaluation_id', studentEvalIds)
    grades.push(...((data ?? []) as GradeRow[]))
  }
  if (adultEvalIds.length > 0) {
    const { data } = await supabase
      .from('adult_grades')
      .select('parent_id, tutor_number, evaluation_id, score, comment, is_absent')
      .in('evaluation_id', adultEvalIds)
    grades.push(...((data ?? []) as any[]).map(g => ({
      id:            '',
      student_id:    `${g.parent_id}-${g.tutor_number}`,
      evaluation_id: g.evaluation_id,
      score:         g.score,
      comment:       g.comment,
      is_absent:     g.is_absent,
    })))
  }

  // 8. Absences (comptage par élève/période) — flux élève uniquement (pas d'absences adultes)
  let absences: AbsenceRow[] = []
  if (studentClassIds.length > 0) {
    const { data } = await supabase
      .from('absences')
      .select('student_id, absence_type, is_justified, period_id')
      .eq('etablissement_id', etablissementId)
      .in('class_id', studentClassIds)
    absences = (data ?? []) as AbsenceRow[]
  }

  // 9. Archives de bulletins existantes : bulletin_archives (élèves) + adult_bulletin_archives (adultes)
  type ArchiveRow = { id: string; student_id: string; class_id: string; period_id: string; file_url: string; archived_at: string }
  const archives: ArchiveRow[] = []
  if (studentClassIds.length > 0) {
    const { data } = await supabase
      .from('bulletin_archives')
      .select('id, student_id, class_id, period_id, file_url, archived_at')
      .in('class_id', studentClassIds)
    archives.push(...((data ?? []) as ArchiveRow[]))
  }
  if (adultClassIds.length > 0) {
    const { data } = await supabase
      .from('adult_bulletin_archives')
      .select('id, parent_id, tutor_number, class_id, period_id, file_url, archived_at')
      .in('class_id', adultClassIds)
    archives.push(...((data ?? []) as any[]).map(a => ({
      id: a.id, student_id: `${a.parent_id}-${a.tutor_number}`,
      class_id: a.class_id, period_id: a.period_id, file_url: a.file_url, archived_at: a.archived_at,
    })))
  }

  // 10. Appréciations : bulletin_appreciations (élèves) + adult_bulletin_appreciations (adultes)
  type AppreciationRow = { id: string; student_id: string; class_id: string; period_id: string; appreciation: string }
  const appreciations: AppreciationRow[] = []
  if (studentClassIds.length > 0) {
    const { data } = await supabase
      .from('bulletin_appreciations')
      .select('id, student_id, class_id, period_id, appreciation')
      .in('class_id', studentClassIds)
    appreciations.push(...((data ?? []) as AppreciationRow[]))
  }
  if (adultClassIds.length > 0) {
    const { data } = await supabase
      .from('adult_bulletin_appreciations')
      .select('id, parent_id, tutor_number, class_id, period_id, appreciation')
      .in('class_id', adultClassIds)
    appreciations.push(...((data ?? []) as any[]).map(a => ({
      id: a.id, student_id: `${a.parent_id}-${a.tutor_number}`,
      class_id: a.class_id, period_id: a.period_id, appreciation: a.appreciation,
    })))
  }

  // 11. Order configs (gabarit) pour chaque classe/période
  type OrderConfigRow = { class_id: string; period_id: string; ue_order: string[]; module_order: Record<string, string[]> }
  let orderConfigs: OrderConfigRow[] = []
  if (classIds.length > 0) {
    const { data } = await supabase
      .from('evaluation_order_config')
      .select('class_id, period_id, ue_order, module_order')
      .in('class_id', classIds)
    orderConfigs = (data ?? []) as OrderConfigRow[]
  }

  // 12. Infos établissement
  const { data: etab } = await supabase
    .from('etablissements')
    .select('nom, adresse, telephone, logo_url')
    .single()

  const etablissement: EtablissementInfo = {
    nom:       etab?.nom ?? '',
    adresse:   etab?.adresse ?? null,
    telephone: etab?.telephone ?? null,
    logo_url:  etab?.logo_url ?? null,
  }

  return (
    <div className="h-full animate-fade-in">
      <BulletinsClient
        classes={classes}
        periods={periods}
        evalTypeConfigs={evalTypeConfigs}
        ues={(ues ?? []) as UniteEnseignement[]}
        modules={(modules ?? []) as CoursModule[]}
        cours={(cours ?? []) as Cours[]}
        evaluations={evaluations}
        students={students}
        grades={grades}
        absences={absences}
        etablissement={etablissement}
        yearLabel={yearLabel}
        etablissementId={etablissementId}
        initialArchives={archives}
        initialAppreciations={appreciations}
        orderConfigs={orderConfigs}
      />
    </div>
  )
}
