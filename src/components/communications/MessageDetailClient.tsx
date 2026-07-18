'use client'

import { useState, useMemo } from 'react'
import { clsx } from 'clsx'
import { Paperclip, Mail, CheckCircle, XCircle, Clock } from 'lucide-react'
import { SearchField } from '@/components/ui/FloatFields'
import { sanitize } from '@/lib/security/sanitize'

// ─── Types ────────────────────────────────────────────────────────────────────

type MessageRow = {
  id: string; title: string; body_html: string | null; content: string
  announcement_type: string | null; channel: string | null
  recipient_count: number | null; published_at: string | null; sent_at: string | null
  sender_email: string | null
  profiles: { first_name: string; last_name: string; email: string } | null
  classes: {
    name: string
    day_of_week: string | null; start_time: string | null; end_time: string | null
    cotisation_types: { label: string | null } | null
  } | null
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
  id: string; file_name: string; file_size: number | null
  /** URL signee generee a la consultation (bucket prive). Null si illisible. */
  url: string | null
}

interface Props {
  message: MessageRow
  classTeacher: { name: string; civilite: string | null } | null
  parentRecipients: ParentRecipient[]
  staffRecipients: StaffRecipient[]
  attachments: Attachment[]
}

const TYPE_LABELS: Record<string, string> = {
  all_active: 'Parents (élèves inscrits)',
  all_registered: 'Tous les contacts',
  class: "Parents d'une classe",
  selected: 'Parents choisis',
  staff: 'Staff interne',
}

// Statuts reellement produits par l'envoi (actions.ts) : pending (avant envoi),
// sent, failed, skipped (foyer sans adresse : rien tente). `delivered` n'est
// jamais pose par le code — pas d'accuse de reception → on ne l'affiche pas.
const STATUS_BADGE: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: 'En attente', color: 'bg-warm-100 text-warm-700',   icon: Clock },
  sent:    { label: 'Envoyé',     color: 'bg-green-100 text-green-700', icon: CheckCircle },
  failed:  { label: 'Échec',      color: 'bg-red-100 text-red-700',     icon: XCircle },
  skipped: { label: 'Sans email', color: 'bg-amber-100 text-amber-700', icon: Mail },
}
const STATUS_FALLBACK = STATUS_BADGE.pending
const STATUS_ORDER = ['sent', 'failed', 'skipped', 'pending']

function formatDate(d: string | null): string {
  if (!d) return '·'
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function MessageDetailClient({ message, classTeacher, parentRecipients, staffRecipients, attachments }: Props) {
  const [search, setSearch] = useState('')

  const allRecipients = useMemo(() => [
    ...parentRecipients.map(r => ({
      name: r.parents ? `${r.parents.tutor1_last_name} ${r.parents.tutor1_first_name}` : '·',
      email: r.email || '·',
      status: r.email_status ?? 'pending',
      type: 'parent' as const,
    })),
    ...staffRecipients.map(r => ({
      name: r.profiles ? `${r.profiles.last_name} ${r.profiles.first_name}` : '·',
      email: r.email || '·',
      status: r.email_status ?? 'pending',
      type: 'staff' as const,
    })),
  ], [parentRecipients, staffRecipients])

  // Compteurs derives des statuts REELLEMENT presents : un statut inconnu (ex.
  // `skipped`) n'est plus oublie.
  const statusCounts = allRecipients.reduce<Record<string, number>>((acc, r) => {
    const key = STATUS_BADGE[r.status] ? r.status : 'pending'
    acc[key] = (acc[key] ?? 0) + 1
    return acc
  }, {})
  const orderedStatuses = STATUS_ORDER.filter(s => statusCounts[s] > 0)

  const filteredRecipients = useMemo(() => {
    if (!search.trim()) return allRecipients
    const q = search.toLowerCase()
    return allRecipients.filter(r => `${r.name} ${r.email}`.toLowerCase().includes(q))
  }, [allRecipients, search])

  const cls = message.classes
  const schedule = cls?.day_of_week && cls.start_time && cls.end_time
    ? `${cls.day_of_week} ${cls.start_time.slice(0, 5)}–${cls.end_time.slice(0, 5)}`
    : null
  const teacherLabel = classTeacher
    ? [classTeacher.civilite, classTeacher.name].filter(Boolean).join(' ')
    : null

  // Ligne de meta compacte : « clef valeur » separes par des points.
  const meta: { k: string; v: string }[] = [
    { k: 'Type', v: TYPE_LABELS[message.announcement_type ?? ''] ?? (message.announcement_type ?? '·') },
    { k: 'Envoyé le', v: formatDate(message.sent_at ?? message.published_at) },
    {
      k: 'Expéditeur',
      v: message.profiles ? `${message.profiles.last_name} ${message.profiles.first_name}` : '·',
    },
  ]
  if (cls) {
    meta.push({ k: 'Classe', v: cls.name })
    if (teacherLabel) meta.push({ k: 'Enseignant', v: teacherLabel })
    if (cls.cotisation_types?.label) meta.push({ k: 'Cotisation', v: cls.cotisation_types.label })
    if (schedule) meta.push({ k: 'Horaire', v: schedule })
  }

  return (
    <div className="space-y-3">

      {/* Meta compacte + compteurs sur une carte. Chaque champ a un label
          (capitales) au-dessus de sa valeur pour rester lisible malgre la densite.
          L'objet est le 1er champ, en pleine largeur (c'est l'identite du message). */}
      <div className="card p-3 space-y-2">
        <div>
          <p className="text-[10px] font-bold text-warm-700 uppercase tracking-widest">Objet</p>
          <h1 className="text-sm text-warm-800 font-semibold mt-0.5">{message.title}</h1>
        </div>
        <dl className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-x-4 gap-y-2 pt-2 border-t border-warm-100">
          {meta.map(({ k, v }) => (
            <div key={k} className="min-w-0">
              <dt className="text-[10px] font-bold text-warm-700 uppercase tracking-widest">{k}</dt>
              <dd className="text-xs text-warm-700 font-medium truncate mt-0.5">{v}</dd>
            </div>
          ))}
        </dl>
        {orderedStatuses.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-2 border-t border-warm-100">
            {orderedStatuses.map(status => {
              const info = STATUS_BADGE[status]
              const Icon = info.icon
              return (
                <span key={status} className={clsx('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold', info.color)}>
                  <Icon size={11} aria-hidden="true" /> {statusCounts[status]} {info.label}
                </span>
              )
            })}
          </div>
        )}
      </div>

      {/* Corps + pieces jointes */}
      <div className="card p-3 space-y-2">
        <p className="text-[10px] font-bold text-warm-700 uppercase tracking-widest">Message</p>
        <div
          className="prose prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: sanitize(message.body_html ?? message.content) }}
        />
        {attachments.length > 0 && (
          <div className="pt-2 border-t border-warm-100 space-y-1">
            {attachments.map(a => (
              a.url ? (
                <a
                  key={a.id}
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-warm-50 rounded-lg px-3 py-1 text-xs hover:bg-warm-100 transition-colors mr-2"
                >
                  <Paperclip size={12} className="text-warm-700" aria-hidden="true" />
                  <span className="text-primary-700 font-medium">{a.file_name}</span>
                  {a.file_size && <span className="text-warm-700">{(a.file_size / 1024).toFixed(0)} Ko</span>}
                </a>
              ) : (
                <span key={a.id} className="inline-flex items-center gap-2 bg-warm-50 rounded-lg px-3 py-1 text-xs mr-2">
                  <Paperclip size={12} className="text-warm-700" aria-hidden="true" />
                  <span className="text-warm-700">{a.file_name}</span>
                  <span className="text-warm-700 italic">indisponible</span>
                </span>
              )
            ))}
          </div>
        )}
      </div>

      {/* Destinataires : encadre a hauteur figee, recherche, defilement interne */}
      <div className="card p-0 overflow-hidden">
        <div className="px-3 py-2 border-b border-warm-100 bg-warm-50 flex items-center justify-between gap-3">
          <h2 className="text-xs font-bold text-warm-700 uppercase tracking-widest whitespace-nowrap">
            Destinataires ({allRecipients.length})
          </h2>
          {allRecipients.length > 0 && (
            <SearchField
              value={search}
              onChange={setSearch}
              placeholder="Rechercher…"
              ariaLabel="Rechercher un destinataire"
              className="w-56"
            />
          )}
        </div>

        {allRecipients.length === 0 ? (
          <p className="text-xs text-warm-700 italic px-3 py-3">Aucun destinataire enregistré.</p>
        ) : (
          // Hauteur figee (~8 lignes + entete) : la liste defile en interne, la
          // page ne s'allonge pas quel que soit le nombre de destinataires.
          <div className="h-[320px] overflow-y-auto list-scroll">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-white shadow-[0_1px_0_rgb(0_0_0/0.05)]">
                <tr>
                  <th scope="col" className="list-th">Nom</th>
                  <th scope="col" className="list-th">Email</th>
                  <th scope="col" className="list-th">Type</th>
                  <th scope="col" className="list-th">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-warm-50">
                {filteredRecipients.map((r, idx) => {
                  const info = STATUS_BADGE[r.status] ?? STATUS_FALLBACK
                  const Icon = info.icon
                  return (
                    <tr key={idx} className="hover:bg-warm-50">
                      <td className="list-td text-warm-700 font-medium">{r.name}</td>
                      <td className="list-td text-warm-700">{r.email}</td>
                      <td className="list-td">
                        <span className={clsx(
                          'px-1.5 py-0.5 rounded text-[10px] font-bold uppercase',
                          r.type === 'parent' ? 'bg-blue-50 text-blue-600' : 'bg-warm-100 text-warm-700'
                        )}>
                          {r.type === 'parent' ? 'Parent' : 'Staff'}
                        </span>
                      </td>
                      <td className="list-td">
                        <span className={clsx('inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold', info.color)}>
                          <Icon size={10} aria-hidden="true" /> {info.label}
                        </span>
                      </td>
                    </tr>
                  )
                })}
                {filteredRecipients.length === 0 && (
                  <tr>
                    <td colSpan={4} className="list-td text-warm-700 italic">Aucun destinataire trouvé.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
