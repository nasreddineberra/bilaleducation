'use client'

import Link from 'next/link'
import { clsx } from 'clsx'
import { ArrowLeft, Paperclip, Mail, Users, UserCheck, Globe } from 'lucide-react'

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
  file_url: string
  file_name: string
  file_size: number | null
}

interface Props {
  message: MessageRow
  attachments: Attachment[]
}

const TYPE_LABELS: Record<string, string> = {
  all_active: 'Tous les parents (actifs)',
  all_registered: 'Tous les parents (base)',
  class: 'Parents d\'une classe',
  selected: 'Parents choisis',
  staff: 'Staff interne',
}

function formatDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function NotificationDetailClient({ message, attachments }: Props) {
  return (
    <div className="space-y-5">

      {/* Retour */}
      <Link
        href="/dashboard/notifications"
        className="inline-flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-800 transition-colors"
      >
        <ArrowLeft size={14} /> Retour aux notifications
      </Link>

      {/* Titre */}
      <div className="card p-4">
        <h2 className="text-lg font-bold text-warm-800">{message.title}</h2>
        <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-warm-500">
          <span>{formatDate(message.sent_at ?? message.published_at)}</span>
          {message.profiles && (
            <span>
              de <span className="font-medium text-warm-700">{message.profiles.first_name} {message.profiles.last_name}</span>
            </span>
          )}
          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-warm-100 text-warm-600">
            {TYPE_LABELS[message.announcement_type ?? ''] ?? message.announcement_type}
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
          dangerouslySetInnerHTML={{ __html: message.body_html ?? message.content }}
        />
      </div>

      {/* Pieces jointes */}
      {attachments.length > 0 && (
        <div className="card p-4 space-y-2">
          <h3 className="text-xs font-bold text-warm-500 uppercase tracking-widest">Pieces jointes</h3>
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
    </div>
  )
}
