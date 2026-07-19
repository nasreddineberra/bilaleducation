'use client'

import { clsx } from 'clsx'
import { Paperclip } from 'lucide-react'
import { sanitize } from '@/lib/security/sanitize'

// ─── Types ────────────────────────────────────────────────────────────────────

type MessageRow = {
  id: string
  title: string
  body_html: string | null
  content: string
  channel: string | null
  announcement_type: string | null
  published_at: string | null
  sent_at: string | null
  sender_email: string | null
  profiles: { first_name: string; last_name: string; email: string } | null
}

type Attachment = {
  id: string
  file_name: string
  file_size: number | null
  /** URL signee generee a la consultation (bucket prive). Null si illisible. */
  url: string | null
}

interface Props {
  message: MessageRow
  attachments: Attachment[]
  /** Annee en cours : nomme le ciblage « Parents {annee} » (aligne sur l'historique). */
  yearLabel: string | null
}

const TYPE_LABELS: Record<string, string> = {
  all_active: 'Parents (élèves inscrits)',
  all_registered: 'Tous les contacts',
  class: "Parents d'une classe",
  selected: 'Parents choisis',
  staff: 'Staff interne',
}

function formatDate(d: string | null): string {
  if (!d) return '·'
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function NotificationDetailClient({ message, attachments, yearLabel }: Props) {
  // « Parents {annee} » si une annee est en cours, sinon repli (aligne sur l'historique).
  const typeLabel = message.announcement_type === 'all_active'
    ? (yearLabel ? `Parents ${yearLabel}` : TYPE_LABELS.all_active)
    : (TYPE_LABELS[message.announcement_type ?? ''] ?? message.announcement_type)

  return (
    <div className="space-y-5">

      {/* Titre */}
      <div className="card p-4">
        <h2 className="text-lg font-bold text-warm-800">{message.title}</h2>
        <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-warm-700">
          <span>{formatDate(message.sent_at ?? message.published_at)}</span>
          {message.profiles && (
            <span>
              de <span className="font-medium text-warm-700">{message.profiles.last_name} {message.profiles.first_name}</span>
            </span>
          )}
          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-warm-100 text-warm-700">
            {typeLabel}
          </span>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-blue-50 text-blue-600">
            {message.channel === 'both' ? 'Email + Notification' : message.channel === 'notification' ? 'Notification' : 'Email'}
          </span>
        </div>
      </div>

      {/* Corps du message */}
      <div className="card p-4 space-y-2">
        <div
          className="prose prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: sanitize(message.body_html ?? message.content) }}
        />
      </div>

      {/* Pieces jointes */}
      {attachments.length > 0 && (
        <div className="card p-4 space-y-2">
          <h3 className="stat-label">Pièces jointes</h3>
          <div className="space-y-1">
            {attachments.map(a => (
              <a
                key={a.id}
                href={a.url ?? undefined}
                target="_blank"
                rel="noopener noreferrer"
                aria-disabled={!a.url}
                className={clsx(
                  'flex items-center gap-2 bg-warm-50 rounded-lg px-3 py-1.5 text-xs transition-colors',
                  a.url ? 'hover:bg-warm-100' : 'opacity-50 pointer-events-none',
                )}
              >
                <Paperclip size={12} className="text-warm-700" />
                <span className="text-primary-600 font-medium flex-1">{a.file_name}</span>
                {a.file_size && <span className="text-warm-700">{(a.file_size / 1024).toFixed(0)} Ko</span>}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
