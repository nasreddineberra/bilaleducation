import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
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

  // Annee en cours : nomme le ciblage « Parents {annee} » (aligne sur l'historique).
  const { data: currentYear } = await supabase
    .from('school_years')
    .select('label')
    .eq('etablissement_id', etablissementId)
    .eq('is_current', true)
    .maybeSingle()

  // Pieces jointes. Le bucket est prive : on signe a la consultation plutot que
  // de stocker une URL publique (meme regle que Communications / justificatifs).
  const { data: attachments } = await supabase
    .from('announcement_attachments')
    .select('id, file_path, file_name, file_size')
    .eq('announcement_id', id)

  const signedAttachments = await Promise.all(
    ((attachments ?? []) as any[]).map(async a => {
      const { data: signed } = await supabase.storage
        .from('communication-attachments')
        .createSignedUrl(a.file_path, 3600)
      return { id: a.id, file_name: a.file_name, file_size: a.file_size, url: signed?.signedUrl ?? null }
    })
  )

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

      {/* Retour : motif commun aux fiches, rendu au niveau page (comme
          communications/[id], classes/[id], annee-scolaire/[id]). */}
      <Link
        href="/dashboard/notifications"
        className="inline-flex items-center gap-1.5 text-sm text-warm-700 hover:text-secondary-700 transition-colors"
      >
        <ChevronLeft size={15} />
        Retour aux notifications
      </Link>

      <NotificationDetailClient
        message={message as any}
        attachments={signedAttachments}
        yearLabel={currentYear?.label ?? null}
      />
    </div>
  )
}
