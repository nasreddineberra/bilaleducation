import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import EvaluationsClient from '@/components/evaluations/EvaluationsClient'
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

export default async function EvaluationsPage() {
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

  // 2. Année scolaire courante + périodes + eval_type_configs
  const { data: schoolYear } = await supabase
    .from('school_years')
    .select('id, label, periods(*), eval_type_configs(*)')
    .eq('is_current', true)
    .single() as { data: (
      { id: string; label: string; periods: Period[]; eval_type_configs: EvalTypeConfig[] }
    ) | null }

  const periods         = (schoolYear?.periods ?? []).sort((a, b) => a.order_index - b.order_index)
  const evalTypeConfigs = (schoolYear?.eval_type_configs ?? []).filter(c => c.is_active)
  const schoolYearId    = schoolYear?.id ?? null
  const yearLabel       = schoolYear?.label ?? null

  // 3. Classes (filtrées selon le rôle)
  let classes: ClassRow[] = []

  if (['admin', 'direction', 'responsable_pedagogique'].includes(role)) {
    const query = supabase
      .from('classes')
      .select('id, name, level, day_of_week, start_time, end_time')
      .order('name')
    if (yearLabel) query.eq('academic_year', yearLabel)
    const { data } = await query
    classes = (data ?? []).map((c: any) => ({ ...c, main_teacher_name: null, main_teacher_civilite: null })) as ClassRow[]

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
          .select('id, name, level, day_of_week, start_time, end_time')
          .in('id', classIds)
          .order('name')
        if (yearLabel) query.eq('academic_year', yearLabel)
        const { data } = await query
        classes = (data ?? []).map((c: any) => ({ ...c, main_teacher_name: null, main_teacher_civilite: null })) as ClassRow[]
      }
    }
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

  // 4. Référentiel des cours
  const [{ data: ues }, { data: modules }, { data: cours }] = await Promise.all([
    supabase.from('unites_enseignement').select('*').order('order_index').order('nom_fr'),
    supabase.from('cours_modules').select('*').order('order_index').order('nom_fr'),
    supabase.from('cours').select('*').order('order_index').order('nom_fr'),
  ])

  // 4b. Configs d'ordre d'affichage par classe × période
  type EvalOrderConfig = {
    class_id:     string
    period_id:    string
    ue_order:     string[]
    module_order: Record<string, string[]>
  }
  const classIds = classes.map(c => c.id)
  const { data: evalOrderConfigs } = classIds.length > 0
    ? await supabase
        .from('evaluation_order_config')
        .select('class_id, period_id, ue_order, module_order')
        .in('class_id', classIds)
    : { data: [] as EvalOrderConfig[] }

  // 5. Évaluations existantes (nouveau système : avec cours_id)
  // On tente d'abord avec les champs display (après migration add-display-grouping)
  // puis on bascule sur un select minimal si la migration n'est pas encore jouée
  let evaluations: EvaluationRow[] | null = null
  {
    const { data, error } = await supabase
      .from('evaluations')
      .select('id, class_id, period_id, cours_id, eval_kind, max_score, coefficient, evaluation_date, display_module_id, display_ue_id, sort_order')
      .eq('etablissement_id', etablissementId)
      .not('cours_id', 'is', null)
      .order('sort_order')
    if (!error) {
      evaluations = data as EvaluationRow[]
    } else {
      // Migration non encore exécutée — chargement sans les champs display/sort_order
      const { data: data2 } = await supabase
        .from('evaluations')
        .select('id, class_id, period_id, cours_id, eval_kind, max_score, coefficient, evaluation_date')
        .eq('etablissement_id', etablissementId)
        .not('cours_id', 'is', null)
      evaluations = ((data2 ?? []) as Omit<EvaluationRow, 'display_module_id' | 'display_ue_id' | 'sort_order'>[])
        .map(e => ({ ...e, display_module_id: null, display_ue_id: null, sort_order: null }))
    }
  }

  return (
    <div className="h-full animate-fade-in">
      <EvaluationsClient
        classes={classes}
        periods={periods}
        evalTypeConfigs={evalTypeConfigs}
        ues={(ues ?? []) as UniteEnseignement[]}
        modules={(modules ?? []) as CoursModule[]}
        cours={(cours ?? []) as Cours[]}
        initialEvaluations={(evaluations ?? []) as EvaluationRow[]}
        evalOrderConfigs={(evalOrderConfigs ?? []) as EvalOrderConfig[]}
        etablissementId={etablissementId}
        schoolYearId={schoolYearId}
      />
    </div>
  )
}
