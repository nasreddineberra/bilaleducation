import { createClient } from '@/lib/supabase/server'
import StudentsClient from '@/components/students/StudentsClient'
import { classInfoOf } from '@/components/dashboard/classInfo'

const PAGE_SIZE = 20
// Sentinelle pour un `.in()` sur un ensemble vide (sinon PostgREST renvoie tout).
const NONE = '00000000-0000-0000-0000-000000000000'

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; filter?: string }>
}) {
  const { page: pageParam, q = '', filter = '' } = await searchParams
  const page = Math.max(1, parseInt(pageParam ?? '1', 10))
  const from = (page - 1) * PAGE_SIZE
  const to   = from + PAGE_SIZE - 1

  const supabase = await createClient()

  // ── 1. Contexte de l'année + ensembles globaux (compteurs ET filtres) ──────
  const [{ data: curYear }, { data: currentPeriods }, { data: activeRows }] = await Promise.all([
    supabase.from('school_years').select('label').eq('is_current', true).maybeSingle(),
    supabase.from('periods').select('id, school_years!inner(is_current)').eq('school_years.is_current', true),
    supabase.from('students').select('id').eq('is_active', true),
  ])
  const yearLabel = curYear?.label ?? null
  const periodIds = (currentPeriods ?? []).map((p) => p.id)
  const activeIds = new Set((activeRows ?? []).map((r) => r.id))

  // Élèves ACTIFS affectés à une classe de l'année en cours.
  let assignedIds = new Set<string>()
  if (yearLabel) {
    const { data } = await supabase
      .from('enrollments')
      .select('student_id, classes!inner(academic_year)')
      .eq('status', 'active')
      .eq('classes.academic_year', yearLabel)
    assignedIds = new Set((data ?? []).map((e: { student_id: string }) => e.student_id))
  }
  const unassignedIds = [...activeIds].filter((id) => !assignedIds.has(id))

  // Élèves ACTIFS avec au moins une alerte de discipline sur l'année en cours.
  const flaggedIds = new Set<string>()
  if (periodIds.length) {
    const [{ data: absAll }, { data: warnAll }] = await Promise.all([
      supabase.from('absences').select('student_id').in('period_id', periodIds),
      supabase.from('student_warnings').select('student_id').in('period_id', periodIds),
    ])
    for (const r of [...(absAll ?? []), ...(warnAll ?? [])] as { student_id: string }[]) {
      if (activeIds.has(r.student_id)) flaggedIds.add(r.student_id)
    }
  }

  // ── 2. Liste paginée ──────────────────────────────────────────────────────
  let studentsQuery = supabase
    .from('students')
    .select('*, enrollments(status, classes(name, level, day_of_week, start_time, end_time, cotisation_types(label), class_teachers(is_main_teacher, effective_from, effective_until, teachers(civilite, first_name, last_name))))', { count: 'exact' })
    .order('last_name')
    .order('first_name')
    .range(from, to)

  if (q.trim()) {
    studentsQuery = studentsQuery.or(
      `last_name.ilike.%${q.trim()}%,first_name.ilike.%${q.trim()}%,student_number.ilike.%${q.trim()}%`
    )
  }

  if (filter === 'active')     studentsQuery = studentsQuery.eq('is_active', true)
  if (filter === 'no_parent')  studentsQuery = studentsQuery.is('parent_id', null)
  if (filter === 'unassigned') studentsQuery = studentsQuery.in('id', unassignedIds.length ? unassignedIds : [NONE])
  if (filter === 'discipline') studentsQuery = studentsQuery.in('id', flaggedIds.size ? [...flaggedIds] : [NONE])

  const [
    { data: students, count: filteredCount },
    { data: etablissement },
    { count: totalAll },
    { count: totalNoParent },
  ] = await Promise.all([
    studentsQuery,
    supabase.from('etablissements').select('max_students').single(),
    supabase.from('students').select('*', { count: 'exact', head: true }),
    supabase.from('students').select('*', { count: 'exact', head: true }).is('parent_id', null),
  ])

  // Discipline détaillée : uniquement pour les élèves actifs de la page affichée.
  const pageActiveIds = (students ?? []).filter((s) => s.is_active).map((s) => s.id)
  const disciplineMap = new Map<string, { absences: number; retards: number; avertissements: number }>()

  if (pageActiveIds.length) {
    let absQ = supabase.from('absences').select('student_id, absence_type').in('student_id', pageActiveIds)
    let warnQ = supabase.from('student_warnings').select('student_id').in('student_id', pageActiveIds)
    if (periodIds.length) {
      absQ = absQ.in('period_id', periodIds)
      warnQ = warnQ.in('period_id', periodIds)
    }
    const [{ data: absData }, { data: warnData }] = await Promise.all([absQ, warnQ])

    for (const id of pageActiveIds) disciplineMap.set(id, { absences: 0, retards: 0, avertissements: 0 })
    for (const a of (absData ?? []) as { student_id: string; absence_type: string }[]) {
      const d = disciplineMap.get(a.student_id)
      if (!d) continue
      if (a.absence_type === 'retard') d.retards++
      else d.absences++
    }
    for (const w of (warnData ?? []) as { student_id: string }[]) {
      const d = disciplineMap.get(w.student_id)
      if (d) d.avertissements++
    }
  }

  // Rattacher la classe active + la discipline (actifs uniquement) à chaque élève.
  // Le libellé de classe passe par le helper PARTAGÉ `classInfoOf` (un seul format
  // dans l'app, et le jour est traduit — l'ancienne copie locale affichait « monday »).
  const studentsWithClass = (students ?? []).map((s) => {
    const { enrollments, ...rest } = s as typeof s & {
      enrollments?: { status: string; classes?: any | null }[]
    }
    const active = Array.isArray(enrollments)
      ? enrollments.find((e) => e.status === 'active')
      : null
    return {
      ...rest,
      class_name:    active?.classes?.name ?? null,
      class_tooltip: active?.classes ? (classInfoOf(active.classes) || null) : null,
      discipline: rest.is_active ? (disciplineMap.get(rest.id) ?? { absences: 0, retards: 0, avertissements: 0 }) : null,
    }
  })

  return (
    <StudentsClient
      students={studentsWithClass}
      filteredCount={filteredCount ?? 0}
      page={page}
      q={q}
      filter={filter}
      totalAll={totalAll ?? 0}
      totalActive={activeIds.size}
      totalNoParent={totalNoParent ?? 0}
      totalUnassigned={unassignedIds.length}
      totalDiscipline={flaggedIds.size}
      maxStudents={etablissement?.max_students ?? null}
    />
  )
}
