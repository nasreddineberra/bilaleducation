import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AuditLogsClient from '@/components/audit-logs/AuditLogsClient'

const PAGE_SIZE = 20

export default async function LogsPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string
    user?: string
    entity_type?: string
    action?: string
    date_from?: string
    date_to?: string
  }>
}) {
  const {
    page: pageParam,
    user: userFilter,
    entity_type: entityFilter,
    action: actionFilter,
    date_from: dateFrom,
    date_to: dateTo,
  } = await searchParams

  const page = Math.max(1, parseInt(pageParam ?? '1', 10))
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  const supabase = await createClient()

  // Verifier role
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'direction'].includes(profile.role)) {
    redirect('/dashboard')
  }

  // Utilisateurs distincts ayant des logs
  const { data: logUsers } = await supabase
    .from('audit_logs')
    .select('user_id, user_name, user_email')

  const uniqueUsers = new Map<string, { user_id: string; user_name: string; user_email: string }>()
  for (const row of logUsers ?? []) {
    if (row.user_id && !uniqueUsers.has(row.user_id)) {
      uniqueUsers.set(row.user_id, {
        user_id: row.user_id,
        user_name: row.user_name ?? '',
        user_email: row.user_email ?? '',
      })
    }
  }
  const users = Array.from(uniqueUsers.values()).sort((a, b) =>
    a.user_name.localeCompare(b.user_name)
  )

  // Requete logs avec filtres
  let query = supabase
    .from('audit_logs')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (userFilter) query = query.eq('user_id', userFilter)
  if (entityFilter) query = query.eq('entity_type', entityFilter)
  if (actionFilter) query = query.eq('action', actionFilter)
  if (dateFrom) query = query.gte('created_at', `${dateFrom}T00:00:00`)
  if (dateTo) query = query.lte('created_at', `${dateTo}T23:59:59`)

  // Types d'entites distincts
  const { data: entityTypes } = await supabase
    .from('audit_logs')
    .select('entity_type')

  const uniqueEntityTypes = [...new Set((entityTypes ?? []).map(r => r.entity_type))].sort()

  const { data: logs, count } = await query

  // Roles des utilisateurs
  const userIds = [...new Set((logs ?? []).map(l => l.user_id).filter(Boolean))]
  const userRoles: Record<string, string> = {}
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, role')
      .in('id', userIds)
    for (const p of profiles ?? []) {
      userRoles[p.id] = p.role
    }
  }

  // Noms des enseignants / apprenants concernes par les logs de documents
  const teacherDocIds = new Set<string>()
  const studentDocIds = new Set<string>()
  for (const l of logs ?? []) {
    const d = (l.new_data ?? l.old_data) as Record<string, unknown> | null
    if (!d) continue
    if (l.entity_type === 'teacher_documents' && typeof d.teacher_id === 'string') teacherDocIds.add(d.teacher_id)
    if (l.entity_type === 'student_documents' && typeof d.student_id === 'string') studentDocIds.add(d.student_id)
  }
  const docOwners: Record<string, string> = {}
  if (teacherDocIds.size > 0) {
    const { data } = await supabase.from('teachers').select('id, last_name, first_name').in('id', [...teacherDocIds])
    for (const t of data ?? []) docOwners[t.id] = `${t.last_name ?? ''} ${t.first_name ?? ''}`.trim()
  }
  if (studentDocIds.size > 0) {
    const { data } = await supabase.from('students').select('id, last_name, first_name').in('id', [...studentDocIds])
    for (const s of data ?? []) docOwners[s.id] = `${s.last_name ?? ''} ${s.first_name ?? ''}`.trim()
  }

  return (
    <AuditLogsClient
      logs={logs ?? []}
      totalCount={count ?? 0}
      page={page}
      users={users}
      entityTypes={uniqueEntityTypes}
      userRoles={userRoles}
      docOwners={docOwners}
      filters={{
        user: userFilter ?? '',
        entity_type: entityFilter ?? '',
        action: actionFilter ?? '',
        date_from: dateFrom ?? '',
        date_to: dateTo ?? '',
      }}
    />
  )
}
