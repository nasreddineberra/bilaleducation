import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import GradesClient from '@/components/grades/GradesClient'
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

type EvalOrderConfig = {
  class_id: string
  period_id: string
  ue_order: string[]
  module_order: Record<string, string[]>
}

type StudentRow = {
  student_id: string
  class_id: string
  first_name: string
  last_name: string
  student_number: string
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

export default async function GradesPage() {
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
  let teacherId: string | null = null

  if (['admin', 'direction', 'responsable_pedagogique'].includes(role)) {
    const query = supabase
      .from('classes')
      .select('id, name, level, day_of_week, start_time, end_time, cotisation_types(label)')
      .order('name')
    if (yearLabel) query.eq('academic_year', yearLabel)
    const { data } = await query
    classes = (data ?? []).map((c: any) => ({ ...c, main_teacher_name: null, main_teacher_civilite: null, cotisation_label: c.cotisation_types?.label ?? null })) as ClassRow[]

  } else if (role === 'enseignant') {
    const { data: teacher } = await supabase
      .from('teachers')
      .select('id')
      .eq('user_id', userId)
      .single()
    teacherId = teacher?.id ?? null

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
          .select('id, name, level, day_of_week, start_time, end_time, cotisation_types(label)')
          .in('id', classIds)
          .order('name')
        if (yearLabel) query.eq('academic_year', yearLabel)
        const { data } = await query
        classes = (data ?? []).map((c: any) => ({ ...c, main_teacher_name: null, main_teacher_civilite: null, cotisation_label: c.cotisation_types?.label ?? null })) as ClassRow[]
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

  // 4b. Configs d'ordre d'affichage (UEs et modules)
  const { data: evalOrderConfigs } = classIds.length > 0
    ? await supabase
        .from('evaluation_order_config')
        .select('class_id, period_id, ue_order, module_order')
        .in('class_id', classIds)
    : { data: [] as EvalOrderConfig[] }

  // 5. Évaluations (gabarit) pour toutes les classes accessibles
  let evaluations: EvaluationRow[] = []
  if (classIds.length > 0) {
    const { data, error } = await supabase
      .from('evaluations')
      .select('id, class_id, period_id, cours_id, eval_kind, max_score, coefficient, evaluation_date, display_module_id, display_ue_id, sort_order')
      .eq('etablissement_id', etablissementId)
      .in('class_id', classIds)
      .not('cours_id', 'is', null)
      .order('sort_order')
    if (!error) {
      evaluations = data as EvaluationRow[]
    } else {
      // Fallback sans les champs display/sort_order si migration non jouée
      const { data: data2 } = await supabase
        .from('evaluations')
        .select('id, class_id, period_id, cours_id, eval_kind, max_score, coefficient, evaluation_date')
        .eq('etablissement_id', etablissementId)
        .in('class_id', classIds)
        .not('cours_id', 'is', null)
      evaluations = ((data2 ?? []) as any[]).map(e => ({
        ...e, display_module_id: null, display_ue_id: null, sort_order: null,
      }))
    }
  }

  // 6. Élèves inscrits (actifs) pour toutes les classes
  let students: StudentRow[] = []
  if (classIds.length > 0) {
    const { data: enrollments } = await supabase
      .from('enrollments')
      .select('student_id, class_id, students(id, first_name, last_name, student_number, photo_url)')
      .in('class_id', classIds)
      .eq('status', 'active')

    students = ((enrollments ?? []) as any[])
      .filter(e => e.students)
      .map(e => ({
        student_id:     e.student_id,
        class_id:       e.class_id,
        first_name:     e.students.first_name,
        last_name:      e.students.last_name,
        student_number: e.students.student_number,
        photo_url:      e.students.photo_url ?? null,
      }))
      .sort((a, b) =>
        a.last_name.localeCompare(b.last_name) || a.first_name.localeCompare(b.first_name)
      )
  }

  // 7. Notes existantes pour toutes ces évaluations
  let grades: GradeRow[] = []
  const evalIds = evaluations.map(e => e.id)
  if (evalIds.length > 0) {
    const { data } = await supabase
      .from('grades')
      .select('id, student_id, evaluation_id, score, comment, is_absent')
      .in('evaluation_id', evalIds)
    grades = (data ?? []) as GradeRow[]
  }

  // 8. Archives de bulletins (pour bloquer la modification des notes)
  type ArchiveRow = { class_id: string; period_id: string }
  let bulletinArchives: ArchiveRow[] = []
  if (classIds.length > 0) {
    const { data } = await supabase
      .from('bulletin_archives')
      .select('class_id, period_id')
      .in('class_id', classIds)
    bulletinArchives = (data ?? []) as ArchiveRow[]
  }

  return (
    <div className="h-full animate-fade-in">
      <GradesClient
        classes={classes}
        periods={periods}
        evalTypeConfigs={evalTypeConfigs}
        ues={(ues ?? []) as UniteEnseignement[]}
        modules={(modules ?? []) as CoursModule[]}
        cours={(cours ?? []) as Cours[]}
        evaluations={evaluations}
        evalOrderConfigs={(evalOrderConfigs ?? []) as EvalOrderConfig[]}
        students={students}
        initialGrades={grades}
        etablissementId={etablissementId}
        schoolYearId={schoolYearId}
        teacherId={teacherId}
        bulletinArchives={bulletinArchives}
      />
    </div>
  )
}
