import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import NotificationsClient from '@/components/notifications/NotificationsClient'

export default async function NotificationsPage() {
  const supabase = await createClient()
  const h = await headers()
  const etablissementId = h.get('x-etablissement-id') ?? ''

  const { data: { user } } = await supabase.auth.getUser()
  const userId = user?.id ?? ''

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single()

  const role = profile?.role ?? 'enseignant'

  // Notifications staff (le user est destinataire)
  const { data: staffNotifs } = await supabase
    .from('announcement_staff_recipients')
    .select(`
      id, is_read, read_at, created_at,
      announcements:announcement_id(
        id, title, body_html, content, channel,
        announcement_type, published_at, sent_at,
        profiles:published_by(first_name, last_name)
      )
    `)
    .eq('profile_id', userId)
    .order('created_at', { ascending: false })

  // Notifications parent (le user est lié à un parent)
  const { data: parentLink } = await supabase
    .from('parents')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle()

  let parentNotifs: any[] = []
  let pushNotifs: any[] = []

  if (parentLink) {
    const { data } = await supabase
      .from('announcement_recipients')
      .select(`
        id, is_read, read_at, created_at,
        announcements:announcement_id(
          id, title, body_html, content, channel,
          announcement_type, published_at, sent_at,
          profiles:published_by(first_name, last_name)
        )
      `)
      .eq('parent_id', parentLink.id)
      .order('created_at', { ascending: false })

    parentNotifs = data ?? []

    // Notifications automatiques (absences, retards, paiements)
    const { data: autoNotifs } = await supabase
      .from('notifications')
      .select('id, type, title, body, metadata, is_read, read_at, created_at')
      .eq('parent_id', parentLink.id)
      .order('created_at', { ascending: false })

    pushNotifs = autoNotifs ?? []
  }

  // Fusionner et trier
  const allNotifs = [
    ...(staffNotifs ?? []).map((n: any) => ({ ...n, source: 'announcement' as const, recipientType: 'staff' as const })),
    ...parentNotifs.map((n: any) => ({ ...n, source: 'announcement' as const, recipientType: 'parent' as const })),
    ...pushNotifs.map((n: any) => ({ ...n, source: 'auto' as const, recipientType: 'parent' as const })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  return (
    <div className="space-y-4 animate-fade-in">
      <NotificationsClient notifications={allNotifs} role={role} parentId={parentLink?.id} />
    </div>
  )
}
