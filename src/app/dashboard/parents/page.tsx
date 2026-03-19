import { createClient } from '@/lib/supabase/server'
import ParentsClient from '@/components/parents/ParentsClient'

const PAGE_SIZE = 20

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
      parentsWithChildren={parentsWithChildren}
      parentsWithPAI={parentsWithPAI}
    />
  )
}
