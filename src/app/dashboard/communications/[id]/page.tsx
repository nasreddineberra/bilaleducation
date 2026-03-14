import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import MessageDetailClient from '@/components/communications/MessageDetailClient'

export default async function MessageDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const h = await headers()
  const etablissementId = h.get('x-etablissement-id') ?? ''

  // Message
  const { data: message } = await supabase
    .from('announcements')
    .select('*, profiles:published_by(first_name, last_name, email), classes:target_class_id(name)')
    .eq('id', id)
    .eq('etablissement_id', etablissementId)
    .single()

  if (!message) return notFound()

  // Destinataires parents
  const { data: parentRecipients } = await supabase
    .from('announcement_recipients')
    .select('id, email, email_status, is_read, parent_id, parents:parent_id(tutor1_last_name, tutor1_first_name)')
    .eq('announcement_id', id)

  // Destinataires staff
  const { data: staffRecipients } = await supabase
    .from('announcement_staff_recipients')
    .select('id, email, email_status, is_read, profile_id, profiles:profile_id(first_name, last_name, role)')
    .eq('announcement_id', id)

  // Pieces jointes
  const { data: attachments } = await supabase
    .from('announcement_attachments')
    .select('id, file_url, file_name, file_size')
    .eq('announcement_id', id)

  return (
    <div className="space-y-4 animate-fade-in">
      <MessageDetailClient
        message={message as any}
        parentRecipients={(parentRecipients ?? []) as any[]}
        staffRecipients={(staffRecipients ?? []) as any[]}
        attachments={(attachments ?? []) as any[]}
      />
    </div>
  )
}
