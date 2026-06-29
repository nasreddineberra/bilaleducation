import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import TeachersClient from '@/components/teachers/TeachersClient'

export const metadata: Metadata = {
  title: 'Enseignants',
}

const PAGE_SIZE = 20

export default async function TeachersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; filter?: string }>
}) {
  const { page: pageParam, q = '', filter = '' } = await searchParams
  const page = Math.max(1, parseInt(pageParam ?? '1', 10))
  const from = (page - 1) * PAGE_SIZE
  const to   = from + PAGE_SIZE - 1

  const supabase = await createClient()

  let teachersQuery = supabase
    .from('teachers')
    .select('*', { count: 'exact' })
    .order('last_name')
    .order('first_name')
    .range(from, to)

  if (q.trim()) {
    teachersQuery = teachersQuery.or(
      `last_name.ilike.%${q.trim()}%,first_name.ilike.%${q.trim()}%,email.ilike.%${q.trim()}%,employee_number.ilike.%${q.trim()}%`
    )
  }

  if (filter === 'active') teachersQuery = teachersQuery.eq('is_active', true)

  const [
    { data: teachers, count: filteredCount },
    { count: totalCount },
    { count: totalActive },
  ] = await Promise.all([
    teachersQuery,
    supabase.from('teachers').select('*', { count: 'exact', head: true }),
    supabase.from('teachers').select('*', { count: 'exact', head: true }).eq('is_active', true),
  ])

  return (
    <TeachersClient
      teachers={teachers ?? []}
      filteredCount={filteredCount ?? 0}
      page={page}
      q={q}
      filter={filter}
      totalCount={totalCount ?? 0}
      totalActive={totalActive ?? 0}
    />
  )
}
