// Donnees de Notifications — LECTURES des pages, deplacees ici pour que
// `NotificationsClient` et `NotificationDetailClient` tirent leurs types de ces
// requetes au lieu de les recopier (sortie des `any`, lot 7).

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

type Client = SupabaseClient<Database>

export type Notification = Awaited<ReturnType<typeof chargerNotifications>>['notifications'][number]
export type NotificationAnnonce = Extract<Notification, { source: 'announcement' }>
export type DetailNotification = NonNullable<Awaited<ReturnType<typeof chargerNotification>>>

const ANNONCE = 'id, title, body_html, content, channel, announcement_type, published_at, sent_at, profiles:published_by(first_name, last_name)' as const

/** Notifications du connecte (equipe ou parent), plus recente en premier. */
export async function chargerNotifications(supabase: Client, userId: string) {
  // Notifications staff (le user est destinataire). Les messages « email seul »
  // (channel = 'email') ne s'affichent pas dans la cloche : jointure inner +
  // filtre sur le canal. Notifications supprimees par le destinataire : masquees,
  // pas effacees (la trace d'envoi de l'expediteur reste intacte).
  const { data: staffNotifs } = await supabase
    .from('announcement_staff_recipients')
    .select(`id, is_read, read_at, created_at, announcements!inner(${ANNONCE})` as const)
    .eq('profile_id', userId)
    .neq('announcements.channel', 'email')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  // Notifications parent (le user est lie a un foyer)
  const { data: parentLink } = await supabase
    .from('parents')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle()

  const [{ data: parentNotifs }, { data: autoNotifs }] = parentLink
    ? await Promise.all([
        supabase
          .from('announcement_recipients')
          .select(`id, is_read, read_at, created_at, announcements:announcement_id(${ANNONCE})` as const)
          .eq('parent_id', parentLink.id)
          .order('created_at', { ascending: false }),
        // Notifications automatiques (absences, retards, paiements, devoirs, seances)
        supabase
          .from('notifications')
          .select('id, type, title, body, is_read, read_at, created_at')
          .eq('parent_id', parentLink.id)
          .order('created_at', { ascending: false }),
      ])
    : [{ data: [] }, { data: [] }]

  const notifications = [
    ...(staffNotifs ?? []).map(n => ({ ...n, source: 'announcement' as const, recipientType: 'staff' as const })),
    ...(parentNotifs ?? []).map(n => ({ ...n, source: 'announcement' as const, recipientType: 'parent' as const })),
    ...(autoNotifs ?? []).map(n => ({ ...n, source: 'auto' as const, recipientType: 'parent' as const })),
  ]
  const temps = (d: string | null) => (d ? new Date(d).getTime() : 0)
  return {
    parentId: parentLink?.id,
    notifications: notifications.sort((a, b) => temps(b.created_at) - temps(a.created_at)),
  }
}

/** Detail d'une annonce recue. `null` si introuvable (ou hors etablissement). */
export async function chargerNotification(supabase: Client, id: string, etablissementId: string) {
  const { data: message } = await supabase
    .from('announcements')
    .select('id, title, body_html, content, channel, announcement_type, published_at, sent_at, sender_email, profiles:published_by(first_name, last_name, email)')
    .eq('id', id)
    .eq('etablissement_id', etablissementId)
    .single()
  if (!message) return null

  // Bucket prive : l'URL est signee au clic, pour 60 s (`ouvrirPieceJointe`),
  // jamais au rendu de la page.
  const { data: attachments } = await supabase
    .from('announcement_attachments')
    .select('id, file_path, file_name, file_size')
    .eq('announcement_id', id)

  return { message, attachments: attachments ?? [] }
}
