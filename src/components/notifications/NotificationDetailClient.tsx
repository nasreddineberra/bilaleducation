'use client'

import { useState } from 'react'
import { clsx } from 'clsx'
import { Paperclip } from 'lucide-react'
import { sanitize } from '@/lib/security/sanitize'
import { ouvrirPieceJointe } from '@/lib/communications/piece-jointe'
import { Puce } from '@/components/dashboard/tdb'
import type { DetailNotification } from '@/lib/communications/notifications'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  message: DetailNotification['message']
  attachments: DetailNotification['attachments']
  /** Annee en cours : nomme le ciblage « Parents {annee} » (aligne sur l'historique). */
  yearLabel: string | null
}

const TYPE_LABELS: Record<string, string> = {
  all_active: 'Parents (élèves inscrits)',
  all_registered: 'Tous les contacts',
  class: "Parents d'une classe",
  selected: 'Parents choisis',
  staff: 'Équipe',
}

function formatDate(d: string | null): string {
  if (!d) return '·'
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function NotificationDetailClient({ message, attachments, yearLabel }: Props) {
  // Pieces jointes dont la signature a echoue : grisees.
  const [indisponibles, setIndisponibles] = useState<Set<string>>(new Set())
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
          <Puce ton="neutre">{typeLabel}</Puce>
          <Puce ton="info">
            {message.channel === 'both' ? 'Email + Notification' : message.channel === 'notification' ? 'Notification' : 'Email'}
          </Puce>
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
            {attachments.map(a => {
              const lisible = !!a.file_path && !indisponibles.has(a.id)
              return (
                <button
                  key={a.id}
                  type="button"
                  disabled={!lisible}
                  onClick={async () => {
                    if (!(await ouvrirPieceJointe(a.file_path!))) {
                      setIndisponibles(prev => new Set(prev).add(a.id))
                    }
                  }}
                  className={clsx(
                    'w-full text-left flex items-center gap-2 bg-warm-50 rounded-lg px-3 py-1.5 text-xs transition-colors',
                    lisible ? 'hover:bg-warm-100' : 'text-warm-400 pointer-events-none',
                  )}
                >
                  <Paperclip size={12} className="text-warm-700" aria-hidden="true" />
                  <span className={clsx('font-medium flex-1', lisible ? 'text-[var(--brand-surface)] dark:text-[var(--brand-accent)]' : 'text-warm-400')}>{a.file_name}</span>
                  {a.file_size && <span className="text-warm-700">{(a.file_size / 1024).toFixed(0)} Ko</span>}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
