import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import NotificationDetailClient from '@/components/notifications/NotificationDetailClient'
import RafraichirBadge from '@/components/notifications/RafraichirBadge'

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

  // Pieces jointes. Le bucket est prive : l'URL est signee au clic, pour 60 s
  // (`ouvrirPieceJointe`), jamais au rendu de la page.
  const { data: attachments } = await supabase
    .from('announcement_attachments')
    .select('id, file_path, file_name, file_size')
    .eq('announcement_id', id)

  const piecesJointes = ((attachments ?? []) as any[]).map(a => ({
    id: a.id, file_name: a.file_name, file_size: a.file_size, file_path: a.file_path ?? null,
  }))

  // Marquer comme lu si rid fourni. `.select('id')` dit si une ligne a
  // reellement basculé : c'est ce qui déclenche (une seule fois) le recalcul
  // du badge de la cloche, rendu par le layout.
  let vientDEtreMarquee = false
  if (rid && rt) {
    const table = rt === 'parent' ? 'announcement_recipients' : 'announcement_staff_recipients'
    const { data: marquees } = await supabase
      .from(table)
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', rid)
      .eq('is_read', false)
      .select('id')
    vientDEtreMarquee = (marquees?.length ?? 0) > 0
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

      <RafraichirBadge actif={vientDEtreMarquee} />

      <NotificationDetailClient
        message={message as any}
        attachments={piecesJointes}
        yearLabel={currentYear?.label ?? null}
      />
    </div>
  )
}
