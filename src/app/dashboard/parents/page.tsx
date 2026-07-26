import { createClient } from '@/lib/supabase/server'
import ParentsClient from '@/components/parents/ParentsClient'

const PAGE_SIZE = 20
// Sentinelle pour un `.in()` sur un ensemble vide (sinon PostgREST renvoie tout).
const NONE = '00000000-0000-0000-0000-000000000000'

export default async function ParentsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; filter?: string }>
}) {
  const { page: pageParam, q = '', filter = '' } = await searchParams
  const page = Math.max(1, parseInt(pageParam ?? '1', 10))
  const from = (page - 1) * PAGE_SIZE
  const to   = from + PAGE_SIZE - 1

  const supabase = await createClient()

  // ── Tuteurs inscrits aux cours adultes MAIS sans classe de l'année en cours ──
  // L'unité est le TUTEUR (clé `parentId-tutorNumber`), comme le compteur
  // « inscrits aux cours » : un foyer peut avoir 2 tuteurs inscrits.
  const [{ data: curYear }, { data: flagRows }] = await Promise.all([
    supabase.from('school_years').select('label').eq('is_current', true).maybeSingle(),
    supabase.from('parents').select('id, tutor1_adult_courses, tutor2_adult_courses'),
  ])
  const yearLabel = curYear?.label ?? null

  const flaggedKeys = new Set<string>()
  for (const p of (flagRows ?? []) as { id: string; tutor1_adult_courses: boolean | null; tutor2_adult_courses: boolean | null }[]) {
    if (p.tutor1_adult_courses) flaggedKeys.add(`${p.id}-1`)
    if (p.tutor2_adult_courses) flaggedKeys.add(`${p.id}-2`)
  }

  let assignedKeys = new Set<string>()
  if (yearLabel) {
    const { data } = await supabase
      .from('parent_class_enrollments')
      .select('parent_id, tutor_number, classes!inner(academic_year)')
      .eq('status', 'active')
      .eq('classes.academic_year', yearLabel)
    assignedKeys = new Set(
      (data ?? []).map((e: { parent_id: string; tutor_number: number }) => `${e.parent_id}-${e.tutor_number}`)
    )
  }
  const unassignedKeys = [...flaggedKeys].filter((k) => !assignedKeys.has(k))
  // Foyers concernés (pour le filtre de la liste, qui affiche des foyers).
  const unassignedParentIds = [...new Set(unassignedKeys.map((k) => k.slice(0, k.lastIndexOf('-'))))]

  let parentsQuery = supabase
    .from('parents')
    .select('*', { count: 'exact' })
    .order('tutor1_last_name')
    .order('tutor1_first_name')
    .order('tutor2_last_name', { nullsFirst: false })
    .order('tutor2_first_name', { nullsFirst: false })
    .range(from, to)

  if (q.trim()) {
    parentsQuery = parentsQuery.or(
      `tutor1_last_name.ilike.%${q.trim()}%,tutor1_first_name.ilike.%${q.trim()}%,tutor2_last_name.ilike.%${q.trim()}%,tutor2_first_name.ilike.%${q.trim()}%`
    )
  }

  if (filter === 'adult_courses') {
    parentsQuery = parentsQuery.or('tutor1_adult_courses.eq.true,tutor2_adult_courses.eq.true')
  }
  if (filter === 'unassigned') {
    parentsQuery = parentsQuery.in('id', unassignedParentIds.length ? unassignedParentIds : [NONE])
  }

  const [
    { data: parents, count: filteredCount },
    { count: totalAll },
    { count: totalAdultCourses1 },
    { count: totalAdultCourses2 },
  ] = await Promise.all([
    parentsQuery,
    supabase.from('parents').select('*', { count: 'exact', head: true }),
    supabase.from('parents').select('*', { count: 'exact', head: true }).eq('tutor1_adult_courses', true),
    supabase.from('parents').select('*', { count: 'exact', head: true }).eq('tutor2_adult_courses', true),
  ])

  const currentParentIds = (parents ?? []).map(p => p.id)
  const { data: studentLinks } = currentParentIds.length > 0
    ? await supabase
        .from('students')
        .select('parent_id, is_active, has_pai')
        .in('parent_id', currentParentIds)
    : { data: [] }

  const parentsWithChildren = new Set(
    (studentLinks ?? []).map(s => s.parent_id as string)
  )
  const parentsWithPAI = new Set(
    (studentLinks ?? []).filter(s => s.has_pai).map(s => s.parent_id as string)
  )

  return (
    <ParentsClient
      parents={parents ?? []}
      filteredCount={filteredCount ?? 0}
      page={page}
      q={q}
      filter={filter}
      totalAll={totalAll ?? 0}
      totalAdultCourses={(totalAdultCourses1 ?? 0) + (totalAdultCourses2 ?? 0)}
      totalUnassigned={unassignedKeys.length}
      parentsWithChildren={parentsWithChildren}
      parentsWithPAI={parentsWithPAI}
    />
  )
}
