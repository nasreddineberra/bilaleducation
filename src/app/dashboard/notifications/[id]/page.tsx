import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import NotificationDetailClient from '@/components/notifications/NotificationDetailClient'

export default async function NotificationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ rid?: string; rt?: string }>
}) {
  const { id } = await params
  const { rid, rt } = await searchParams
  const supabase = await createClient()
  const h = await headers()
  const etablissementId = h.get('x-etablissement-id') ?? ''

  // Message
  const { data: message } = await supabase
    .from('announcements')
    .select('id, title, body_html, content, channel, announcement_type, published_at, sent_at, sender_email, profiles:published_by(first_name, last_name, email)')
    .eq('id', id)
    .eq('etablissement_id', etablissementId)
    .single()

  if (!message) return notFound()

  // Pieces jointes
  const { data: attachments } = await supabase
    .from('announcement_attachments')
    .select('id, file_url, file_name, file_size')
    .eq('announcement_id', id)

  // Marquer comme lu si rid fourni
  if (rid && rt) {
    const table = rt === 'parent' ? 'announcement_recipients' : 'announcement_staff_recipients'
    await supabase
      .from(table)
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', rid)
      .eq('is_read', false)
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <NotificationDetailClient
        message={message as any}
        attachments={(attachments ?? []) as any[]}
      />
    </div>
  )
}
