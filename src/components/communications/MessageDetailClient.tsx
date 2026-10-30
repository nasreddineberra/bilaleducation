'use client'

import { useState, useMemo } from 'react'
import { Paperclip } from 'lucide-react'
import { SearchField } from '@/components/ui/FloatFields'
import { sanitize } from '@/lib/security/sanitize'
import { ouvrirPieceJointe } from '@/lib/communications/piece-jointe'
import { Puce, type Ton } from '@/components/dashboard/tdb'
import { seanceDeClasse } from '@/components/dashboard/classInfo'
import type { DetailMessage } from '@/lib/communications/donnees'

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = DetailMessage

const TYPE_LABELS: Record<string, string> = {
  all_active: 'Parents (élèves inscrits)',
  all_registered: 'Tous les contacts',
  class: "Parents d'une classe",
  selected: 'Parents choisis',
  staff: 'Équipe',
}

// Statuts reellement produits par l'envoi (actions.ts) : pending (avant envoi),
// sent, failed, skipped (foyer sans adresse : rien tente). `delivered` n'est
// jamais pose par le code — pas d'accuse de reception → on ne l'affiche pas.
const STATUS_BADGE: Record<string, { label: string; ton: Ton }> = {
  pending: { label: 'En attente', ton: 'neutre' },
  sent:    { label: 'Envoyé',     ton: 'ok' },
  failed:  { label: 'Échec',      ton: 'danger' },
  skipped: { label: 'Sans email', ton: 'attente' },
}
const STATUS_FALLBACK = STATUS_BADGE.pending
const STATUS_ORDER = ['sent', 'failed', 'skipped', 'pending']

function formatDate(d: string | null): string {
  if (!d) return '·'
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function MessageDetailClient({ message, parentRecipients, staffRecipients, attachments }: Props) {
  const [search, setSearch] = useState('')
  // Pieces jointes dont la signature a echoue : affichees « indisponible ».
  const [indisponibles, setIndisponibles] = useState<Set<string>>(new Set())

  const allRecipients = useMemo(() => [
    ...parentRecipients.map(r => ({
      name: r.parents ? `${r.parents.tutor1_last_name} ${r.parents.tutor1_first_name}` : '·',
      email: r.email || '·',
      status: r.email_status,
      type: 'parent' as const,
    })),
    ...staffRecipients.map(r => ({
      name: r.profiles ? `${r.profiles.last_name} ${r.profiles.first_name}` : '·',
      email: r.email || '·',
      status: r.email_status,
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

  const cls = message.classe
  // Jour en francais (s'affichait en anglais brut : « monday »).
  const schedule = cls ? seanceDeClasse(cls) : ''

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
    // Historique : titulaires « initial puis remplacant » (decision du 30/10).
    if (cls.titulaires) meta.push({ k: 'Enseignant', v: cls.titulaires })
    if (cls.cotisation) meta.push({ k: 'Cotisation', v: cls.cotisation })
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
          <h2 className="text-sm text-warm-800 font-semibold mt-0.5">{message.title}</h2>
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
              return <Puce key={status} ton={info.ton}>{statusCounts[status]} {info.label}</Puce>
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
              a.file_path && !indisponibles.has(a.id) ? (
                <button
                  key={a.id}
                  type="button"
                  onClick={async () => {
                    if (!(await ouvrirPieceJointe(a.file_path!))) {
                      setIndisponibles(prev => new Set(prev).add(a.id))
                    }
                  }}
                  className="inline-flex items-center gap-2 bg-warm-50 rounded-lg px-3 py-1 text-xs hover:bg-warm-100 transition-colors mr-2"
                >
                  <Paperclip size={12} className="text-warm-700" aria-hidden="true" />
                  <span className="text-[var(--brand-surface)] dark:text-[var(--brand-accent)] font-medium">{a.file_name}</span>
                  {a.file_size && <span className="text-warm-700">{(a.file_size / 1024).toFixed(0)} Ko</span>}
                </button>
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
      <div className="card p-3">
        <div className="encadre-titre h-auto py-1.5 mb-2 justify-between gap-3">
          <h2 className="text-xs font-bold uppercase tracking-widest whitespace-nowrap">
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
          <div className="liste h-[320px] overflow-y-auto list-scroll">
            <table className="w-full text-xs" aria-label="Destinataires">
              <thead className="sticky top-0 z-10">
                <tr className="liste-entete border-b border-[var(--card-border)]">
                  <th scope="col" className="list-th">Nom</th>
                  <th scope="col" className="list-th">Email</th>
                  <th scope="col" className="list-th">Type</th>
                  <th scope="col" className="list-th">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-warm-50">
                {filteredRecipients.map((r, idx) => {
                  const info = STATUS_BADGE[r.status] ?? STATUS_FALLBACK
                  return (
                    <tr key={idx}>
                      <td className="list-td text-warm-700 font-medium">{r.name}</td>
                      <td className="list-td text-warm-700">{r.email}</td>
                      <td className="list-td">
                        <Puce ton={r.type === 'parent' ? 'info' : 'neutre'}>{r.type === 'parent' ? 'Parent' : 'Membre'}</Puce>
                      </td>
                      <td className="list-td">
                        <Puce ton={info.ton}>{info.label}</Puce>
                      </td>
                    </tr>
                  )
                })}
                {filteredRecipients.length === 0 && (
                  <tr className="sans-survol">
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
