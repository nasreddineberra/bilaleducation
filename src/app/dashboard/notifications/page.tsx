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
  // On cherche si le profile est lié à un parent via parent_user_id
  const { data: parentLink } = await supabase
    .from('parents')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle()

  let parentNotifs: any[] = []
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
  }

  // Fusionner et trier
  const allNotifs = [
    ...(staffNotifs ?? []).map((n: any) => ({ ...n, recipientType: 'staff' as const })),
    ...parentNotifs.map((n: any) => ({ ...n, recipientType: 'parent' as const })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  return (
    <div className="space-y-4 animate-fade-in">
      <NotificationsClient notifications={allNotifs} role={role} />
    </div>
  )
}
