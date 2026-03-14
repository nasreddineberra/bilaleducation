'use client'

import Link from 'next/link'
import { clsx } from 'clsx'
import { ArrowLeft, Paperclip, Mail, Users, UserCheck, Globe, CheckCircle, XCircle, Clock } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type MessageRow = {
  id: string; title: string; body_html: string | null; content: string
  announcement_type: string | null; channel: string | null
  recipient_count: number | null; published_at: string | null; sent_at: string | null
  sender_email: string | null
  profiles: { first_name: string; last_name: string; email: string } | null
  classes: { name: string } | null
}

type ParentRecipient = {
  id: string; email: string | null; email_status: string | null; is_read: boolean
  parents: { tutor1_last_name: string; tutor1_first_name: string } | null
}

type StaffRecipient = {
  id: string; email: string | null; email_status: string | null; is_read: boolean
  profiles: { first_name: string; last_name: string; role: string } | null
}

type Attachment = {
  id: string; file_url: string; file_name: string; file_size: number | null
}

interface Props {
  message: MessageRow
  parentRecipients: ParentRecipient[]
  staffRecipients: StaffRecipient[]
  attachments: Attachment[]
}

const TYPE_LABELS: Record<string, string> = {
  all_active: 'Tous les parents (actifs)',
  all_registered: 'Tous les parents (base)',
  class: 'Parents d\'une classe',
  selected: 'Parents choisis',
  staff: 'Staff interne',
}

const STATUS_BADGE: Record<string, { label: string; color: string; icon: any }> = {
  pending:   { label: 'En attente',  color: 'bg-amber-100 text-amber-700',  icon: Clock },
  sent:      { label: 'Envoye',      color: 'bg-blue-100 text-blue-700',    icon: Mail },
  delivered: { label: 'Recu',        color: 'bg-green-100 text-green-700',  icon: CheckCircle },
  failed:    { label: 'Echec',       color: 'bg-red-100 text-red-700',      icon: XCircle },
}

function formatDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function MessageDetailClient({ message, parentRecipients, staffRecipients, attachments }: Props) {
  const allRecipients = [
    ...parentRecipients.map(r => ({
      name: r.parents ? `${r.parents.tutor1_last_name} ${r.parents.tutor1_first_name}` : '—',
      email: r.email ?? '—',
      status: r.email_status ?? 'pending',
      type: 'parent' as const,
    })),
    ...staffRecipients.map(r => ({
      name: r.profiles ? `${r.profiles.last_name} ${r.profiles.first_name}` : '—',
      email: r.email ?? '—',
      status: r.email_status ?? 'pending',
      type: 'staff' as const,
    })),
  ]

  const statusCounts = {
    pending: allRecipients.filter(r => r.status === 'pending').length,
    sent: allRecipients.filter(r => r.status === 'sent').length,
    delivered: allRecipients.filter(r => r.status === 'delivered').length,
    failed: allRecipients.filter(r => r.status === 'failed').length,
  }

  return (
    <div className="space-y-5">

      {/* Metadonnees */}
      <div className="card p-4 space-y-2">
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <span className="font-bold text-warm-500 uppercase tracking-widest">Type</span>
            <p className="text-warm-700 mt-0.5">{TYPE_LABELS[message.announcement_type ?? ''] ?? message.announcement_type}</p>
          </div>
          <div>
            <span className="font-bold text-warm-500 uppercase tracking-widest">Canal</span>
            <p className="text-warm-700 mt-0.5">{message.channel === 'both' ? 'Email + Notification' : message.channel === 'notification' ? 'Notification' : 'Email'}</p>
          </div>
          <div>
            <span className="font-bold text-warm-500 uppercase tracking-widest">Date d'envoi</span>
            <p className="text-warm-700 mt-0.5">{formatDate(message.sent_at ?? message.published_at)}</p>
          </div>
          <div>
            <span className="font-bold text-warm-500 uppercase tracking-widest">Expediteur</span>
            <p className="text-warm-700 mt-0.5">
              {message.profiles ? `${message.profiles.first_name} ${message.profiles.last_name}` : '—'}
              {message.sender_email && <span className="text-warm-400 ml-1">({message.sender_email})</span>}
            </p>
          </div>
          {message.classes?.name && (
            <div>
              <span className="font-bold text-warm-500 uppercase tracking-widest">Classe</span>
              <p className="text-warm-700 mt-0.5">{message.classes.name}</p>
            </div>
          )}
        </div>
      </div>

      {/* Compteurs statut */}
      <div className="flex gap-2">
        {Object.entries(statusCounts).filter(([, count]) => count > 0).map(([status, count]) => {
          const info = STATUS_BADGE[status]
          const Icon = info.icon
          return (
            <span key={status} className={clsx('inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold', info.color)}>
              <Icon size={12} /> {count} {info.label}
            </span>
          )
        })}
      </div>

      {/* Corps du message */}
      <div className="card p-4 space-y-2">
        <h2 className="text-xs font-bold text-warm-500 uppercase tracking-widest">Contenu du message</h2>
        <div
          className="prose prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: message.body_html ?? message.content }}
        />
      </div>

      {/* Pieces jointes */}
      {attachments.length > 0 && (
        <div className="card p-4 space-y-2">
          <h2 className="text-xs font-bold text-warm-500 uppercase tracking-widest">Pieces jointes</h2>
          <div className="space-y-1">
            {attachments.map(a => (
              <a
                key={a.id}
                href={a.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 bg-warm-50 rounded-lg px-3 py-1.5 text-xs hover:bg-warm-100 transition-colors"
              >
                <Paperclip size={12} className="text-warm-400" />
                <span className="text-primary-600 font-medium flex-1">{a.file_name}</span>
                {a.file_size && <span className="text-warm-400">{(a.file_size / 1024).toFixed(0)} Ko</span>}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Liste des destinataires */}
      <div className="card overflow-hidden">
        <div className="px-4 py-2 border-b border-warm-100 bg-warm-50">
          <h2 className="text-xs font-bold text-warm-500 uppercase tracking-widest">
            Destinataires ({allRecipients.length})
          </h2>
        </div>
        {allRecipients.length === 0 ? (
          <p className="text-sm text-warm-400 italic px-4 py-4">Aucun destinataire enregistre.</p>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-warm-50">
                <th className="px-3 py-1.5 text-left font-bold text-warm-500">Nom</th>
                <th className="px-3 py-1.5 text-left font-bold text-warm-500">Email</th>
                <th className="px-3 py-1.5 text-left font-bold text-warm-500">Type</th>
                <th className="px-3 py-1.5 text-left font-bold text-warm-500">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-warm-50">
              {allRecipients.map((r, idx) => {
                const info = STATUS_BADGE[r.status] ?? STATUS_BADGE.pending
                const Icon = info.icon
                return (
                  <tr key={idx} className="hover:bg-warm-50">
                    <td className="px-3 py-1.5 text-warm-700 font-medium">{r.name}</td>
                    <td className="px-3 py-1.5 text-warm-500">{r.email}</td>
                    <td className="px-3 py-1.5">
                      <span className={clsx(
                        'px-1.5 py-0.5 rounded text-[10px] font-bold uppercase',
                        r.type === 'parent' ? 'bg-blue-50 text-blue-600' : 'bg-warm-100 text-warm-600'
                      )}>
                        {r.type === 'parent' ? 'Parent' : 'Staff'}
                      </span>
                    </td>
                    <td className="px-3 py-1.5">
                      <span className={clsx('inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold', info.color)}>
                        <Icon size={10} /> {info.label}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
