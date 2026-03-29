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
    .select('*', { count: 'exact' })
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
  ] = await Promise.all([
    studentsQuery,
    supabase.from('etablissements').select('max_students').single(),
    supabase.from('students').select('*', { count: 'exact', head: true }),
    supabase.from('students').select('*', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('students').select('*', { count: 'exact', head: true }).is('parent_id', null),
  ])

  return (
    <StudentsClient
      students={students ?? []}
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
