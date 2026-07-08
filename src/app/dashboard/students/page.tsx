import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import StudentsClient from '@/components/students/StudentsClient'

export const metadata: Metadata = {
  title: 'Élèves',
}

const PAGE_SIZE = 20

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

  let studentsQuery = supabase
    .from('students')
    .select('*, enrollments(status, classes(name, level, day_of_week, start_time, end_time, cotisation_types(label), class_teachers(is_main_teacher, effective_until, teachers(civilite, first_name, last_name))))', { count: 'exact' })
    .order('last_name')
    .order('first_name')
    .range(from, to)

  if (q.trim()) {
    studentsQuery = studentsQuery.or(
      `last_name.ilike.%${q.trim()}%,first_name.ilike.%${q.trim()}%,student_number.ilike.%${q.trim()}%`
    )
  }

  if (filter === 'active') studentsQuery = studentsQuery.eq('is_active', true)
  if (filter === 'no_parent') studentsQuery = studentsQuery.is('parent_id', null)

  const [
    { data: students, count: filteredCount },
    { data: etablissement },
    { count: totalAll },
    { count: totalActive },
    { count: totalNoParent },
    { data: currentPeriods },
  ] = await Promise.all([
    studentsQuery,
    supabase.from('etablissements').select('max_students').single(),
    supabase.from('students').select('*', { count: 'exact', head: true }),
    supabase.from('students').select('*', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('students').select('*', { count: 'exact', head: true }).is('parent_id', null),
    supabase.from('periods').select('id, school_years!inner(is_current)').eq('school_years.is_current', true),
  ])

  // Discipline (annee en cours) : uniquement pour les eleves actifs de la page
  const periodIds = (currentPeriods ?? []).map((p) => p.id)
  const activeIds = (students ?? []).filter((s) => s.is_active).map((s) => s.id)
  const disciplineMap = new Map<string, { absences: number; retards: number; avertissements: number }>()

  if (activeIds.length) {
    let absQ = supabase.from('absences').select('student_id, absence_type').in('student_id', activeIds)
    let warnQ = supabase.from('student_warnings').select('student_id').in('student_id', activeIds)
    if (periodIds.length) {
      absQ = absQ.in('period_id', periodIds)
      warnQ = warnQ.in('period_id', periodIds)
    }
    const [{ data: absData }, { data: warnData }] = await Promise.all([absQ, warnQ])

    for (const id of activeIds) disciplineMap.set(id, { absences: 0, retards: 0, avertissements: 0 })
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

  // Tooltip classe : « Prof principal · Cotisation · Niveau · Jour HH:MM–HH:MM » (parties présentes)
  const buildClassTooltip = (c: any): string => {
    const parts: string[] = []
    const ct = Array.isArray(c?.class_teachers)
      ? c.class_teachers.find((x: any) => x.is_main_teacher && !x.effective_until)
      : null
    const t = ct?.teachers
    if (t) parts.push(`${t.civilite ? t.civilite + ' ' : ''}${t.last_name} ${t.first_name}`.trim())
    if (c?.cotisation_types?.label) parts.push(c.cotisation_types.label)
    if (c?.level) parts.push(c.level)
    if (c?.day_of_week && c?.start_time && c?.end_time) {
      parts.push(`${c.day_of_week} ${String(c.start_time).slice(0, 5)}–${String(c.end_time).slice(0, 5)}`)
    } else if (c?.day_of_week) {
      parts.push(c.day_of_week)
    }
    return parts.join(' · ')
  }

  // Rattacher la classe active + la discipline (actifs uniquement) à chaque élève
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
      class_tooltip: active?.classes ? (buildClassTooltip(active.classes) || null) : null,
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
      totalActive={totalActive ?? 0}
      totalNoParent={totalNoParent ?? 0}
      maxStudents={etablissement?.max_students ?? null}
    />
  )
}
