import { createClient } from '@/lib/supabase/server'
import TeachersClient from '@/components/teachers/TeachersClient'
import { classInfoWithTeacher } from '@/components/dashboard/classInfo'
import { effectiveRole } from '@/lib/auth/effective-role'

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

  // Role du profil connecte : la SUPPRESSION d'un enseignant reste reservee a
  // admin et direction (elle entraine le compte de connexion et les fichiers).
  // La secretaire cree et modifie, elle ne supprime pas.
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profileRow } = user
    ? await supabase.from('profiles').select('role, etablissement_id').eq('id', user.id).maybeSingle()
    : { data: null }
  const canDelete = ['admin', 'direction'].includes(effectiveRole(profileRow) ?? '')

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

  // ── Classe actuelle : affectations de l'ANNEE EN COURS, actives AUJOURD'HUI.
  // L'infobulle reprend le helper partage avec un enseignant vide : inutile de
  // repeter le nom du prof sur sa propre ligne.
  const teacherIds = (teachers ?? []).map(t => t.id)
  const classesByTeacher: Record<string, { name: string; info: string; isSubstitute: boolean }[]> = {}

  if (teacherIds.length > 0) {
    const { data: year } = await supabase
      .from('school_years')
      .select('label')
      .eq('is_current', true)
      .maybeSingle()

    if (year?.label) {
      const { data: assignments } = await supabase
        .from('class_teachers')
        .select('teacher_id, is_main_teacher, effective_from, effective_until, classes!inner(name, level, day_of_week, start_time, end_time, academic_year, cotisation_types(label))')
        .in('teacher_id', teacherIds)
        .eq('classes.academic_year', year.label)

      const d = new Date()
      const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

      for (const a of (assignments ?? []) as any[]) {
        // Affectation cloturee ou pas encore commencee : la classe n'est pas « actuelle ».
        if (a.effective_from && a.effective_from > today) continue
        if (a.effective_until && a.effective_until < today) continue
        const c = a.classes
        if (!c) continue
        ;(classesByTeacher[a.teacher_id] ??= []).push({
          name: c.name,
          info: classInfoWithTeacher(c, ''),
          isSubstitute: !a.is_main_teacher,
        })
      }
    }
  }

  return (
    <TeachersClient
      canDelete={canDelete}
      teachers={teachers ?? []}
      classesByTeacher={classesByTeacher}
      filteredCount={filteredCount ?? 0}
      page={page}
      q={q}
      filter={filter}
      totalCount={totalCount ?? 0}
      totalActive={totalActive ?? 0}
    />
  )
}
