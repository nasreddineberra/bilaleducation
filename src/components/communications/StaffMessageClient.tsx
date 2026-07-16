'use client'

import { useState, useMemo, useRef, lazy, Suspense } from 'react'
import Link from 'next/link'
import { clsx } from 'clsx'
import { createPortal } from 'react-dom'
import { Paperclip, X, CheckSquare, Square, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/lib/toast-context'
import { FloatInput, FloatButton, SearchField } from '@/components/ui/FloatFields'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { sanitize } from '@/lib/security/sanitize'
import { sendStaffMessage, type StaffChannel } from '@/app/dashboard/communications/staff-actions'

const RichTextEditor = lazy(() => import('@/components/ui/RichTextEditor'))

const BUCKET = 'communication-attachments'
const MAX_ATTACHMENTS_BYTES = 1024 * 1024

type StaffMember = { id: string; email: string | null; first_name: string; last_name: string; role: string }

interface Props {
  role: string
  staffMembers: StaffMember[]
  etablissementId: string
  smtpConfigured: boolean
  /** Signature auto (Cordialement + coordonnees) pre-remplie dans le corps, editable. */
  signatureHtml: string
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  direction: 'Direction',
  responsable_pedagogique: 'Resp. pédagogique',
  enseignant: 'Enseignant',
  secretaire: 'Secrétaire',
  comptable: 'Comptable',
}

// Memes couleurs que la colonne « Role » de la liste des utilisateurs.
const ROLE_COLORS: Record<string, string> = {
  super_admin:             'bg-violet-100 text-violet-700',
  admin:                   'bg-red-100 text-red-700',
  direction:               'bg-secondary-100 text-secondary-700',
  comptable:               'bg-amber-100 text-amber-700',
  responsable_pedagogique: 'bg-purple-100 text-purple-700',
  enseignant:              'bg-primary-100 text-primary-700',
  secretaire:              'bg-blue-100 text-blue-700',
  parent:                  'bg-warm-100 text-warm-600',
}
const roleColor = (r: string) => ROLE_COLORS[r] ?? 'bg-warm-100 text-warm-500'

// Meme ordre hierarchique que la liste des utilisateurs : role puis NOM Prenom.
const ROLE_ORDER: Record<string, number> = {
  super_admin: 0, admin: 1, direction: 2, comptable: 3,
  responsable_pedagogique: 4, enseignant: 5, secretaire: 6, parent: 7,
}
function byRoleThenName(a: StaffMember, b: StaffMember): number {
  const r = (ROLE_ORDER[a.role] ?? 99) - (ROLE_ORDER[b.role] ?? 99)
  if (r !== 0) return r
  const ln = a.last_name.localeCompare(b.last_name, 'fr', { sensitivity: 'base' })
  if (ln !== 0) return ln
  return a.first_name.localeCompare(b.first_name, 'fr', { sensitivity: 'base' })
}

const CHANNELS: { value: StaffChannel; label: string }[] = [
  { value: 'email',        label: 'Email' },
  { value: 'notification', label: 'Notification' },
  { value: 'both',         label: 'Les deux' },
]

function fullName(m: StaffMember): string {
  return `${m.last_name} ${m.first_name}`   // NOM Prenom
}

// Normalisation insensible casse + accents (NFD), comme le reste de l'app.
const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

/** Modale portee dans <body> : sort de tout ancetre transforme (animate-fade-in). */
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  if (typeof document === 'undefined') return null
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        role="dialog" aria-modal="true" aria-label={title}
        className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-warm-100">
          <h2 className="text-xs font-bold text-warm-500 uppercase tracking-widest">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Fermer"
            className="text-warm-400 hover:text-warm-600 rounded p-1 focus:outline-none focus:ring-2 focus:ring-primary-400">
            <X size={16} />
          </button>
        </div>
        <div className="p-4 overflow-y-auto list-scroll min-h-0">{children}</div>
      </div>
    </div>,
    document.body,
  )
}

export default function StaffMessageClient({ role, staffMembers, etablissementId, smtpConfigured, signatureHtml }: Props) {
  const toast = useToast()
  const [channel, setChannel] = useState<StaffChannel>('notification')
  const [group, setGroup] = useState<'all' | 'staff' | 'teachers' | null>(null)
  const [selectedRoles, setSelectedRoles] = useState<Set<string>>(new Set())
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [subject, setSubject] = useState('')
  // Corps pre-rempli avec la signature (editable) : on redige au-dessus.
  const [bodyHtml, setBodyHtml] = useState(signatureHtml)
  const [attachments, setAttachments] = useState<File[]>([])
  const [sending, setSending] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [showRecipients, setShowRecipients] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [staffSearch, setStaffSearch] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const availableRoles = useMemo(
    () => [...new Set(staffMembers.map(s => s.role))].sort(),
    [staffMembers],
  )

  // Trie une fois par role (hierarchie) puis NOM Prenom, comme la liste utilisateurs.
  const sortedStaff = useMemo(() => [...staffMembers].sort(byRoleThenName), [staffMembers])

  // Recherche sur le NOM Prenom uniquement (comme « Parents choisis »). Inclure
  // l'email/le role diluait : domaine commun + roles repetes → une chaine courte
  // matchait presque tout le monde.
  const filteredStaff = useMemo(() => {
    if (!staffSearch.trim()) return sortedStaff
    const q = norm(staffSearch)
    return sortedStaff.filter(s => norm(`${s.last_name} ${s.first_name}`).includes(q))
  }, [sortedStaff, staffSearch])

  // Resolution des destinataires : reproduit exactement l'union du serveur.
  const recipients = useMemo(() => {
    const chosen = new Map<string, StaffMember>()
    const add = (m: StaffMember) => chosen.set(m.id, m)
    if (group === 'all') {
      staffMembers.forEach(add)
    } else {
      if (group === 'staff')    staffMembers.filter(m => m.role !== 'enseignant').forEach(add)
      if (group === 'teachers') staffMembers.filter(m => m.role === 'enseignant').forEach(add)
      staffMembers.filter(m => selectedRoles.has(m.role)).forEach(add)
      staffMembers.filter(m => selectedIds.has(m.id)).forEach(add)
    }
    return [...chosen.values()]
  }, [group, selectedRoles, selectedIds, staffMembers])

  const recipientIds = useMemo(() => new Set(recipients.map(r => r.id)), [recipients])
  const withoutEmail = useMemo(() => recipients.filter(r => !r.email), [recipients])

  const wantsEmail = channel === 'email' || channel === 'both'
  const blockingReason = wantsEmail && !smtpConfigured
    ? "La messagerie n'est pas configurée : l'envoi par email est impossible. Choisissez le canal Notification ou configurez la messagerie."
    : null

  const canSend = !blockingReason && !!subject.trim() && !!bodyHtml.trim() && recipients.length > 0

  const toggleRole = (r: string) => {
    setGroup(null)
    setSelectedRoles(prev => {
      const next = new Set(prev)
      next.has(r) ? next.delete(r) : next.add(r)
      return next
    })
  }
  const toggleMember = (id: string) => {
    setGroup(null)
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }
  const toggleGroup = (g: 'all' | 'staff' | 'teachers') => {
    setSelectedRoles(new Set())
    setSelectedIds(new Set())
    setGroup(prev => prev === g ? null : g)
  }

  const handleFileAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const added = e.target.files ? Array.from(e.target.files) : []
    e.target.value = ''
    if (added.length === 0) return
    setAttachments(prev => {
      const next = [...prev, ...added]
      if (next.reduce((s, f) => s + f.size, 0) > MAX_ATTACHMENTS_BYTES) {
        toast.error('Les pièces jointes ne peuvent pas dépasser 1 Mo au total.')
        return prev
      }
      return next
    })
  }
  const removeAttachment = (idx: number) => setAttachments(prev => prev.filter((_, i) => i !== idx))

  const handleSend = async () => {
    setConfirmOpen(false)
    if (!canSend) return
    setSending(true)
    const uploadedPaths: string[] = []
    try {
      const supabase = createClient()
      const uploaded: { path: string; name: string; size: number }[] = []
      // On ne depose les PJ que si un email part (sinon inutile).
      if (wantsEmail) {
        for (const file of attachments) {
          const ext = file.name.split('.').pop()
          const path = `${etablissementId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
          const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file)
          if (upErr) throw new Error(`Envoi impossible de ${file.name} : ${upErr.message}`)
          uploadedPaths.push(path)
          uploaded.push({ path, name: file.name, size: file.size })
        }
      }

      const result = await sendStaffMessage({
        channel,
        group,
        roles:      [...selectedRoles],
        profileIds: [...selectedIds],
        subject,
        bodyHtml,
        attachments: uploaded,
      })

      if (result.error) {
        if (uploadedPaths.length > 0) await supabase.storage.from(BUCKET).remove(uploadedPaths)
        toast.error(result.error)
        return
      }

      const parts: string[] = []
      if (result.notified) parts.push(`${result.notified} notifié(s)`)
      if (wantsEmail)      parts.push(`${result.sent} email(s) envoyé(s)`)
      const base = parts.join(' · ') || 'Message enregistré.'
      if (result.failed) toast.error(`${base} · ${result.failed} échec(s).`)
      else               toast.success(base)

      setSubject(''); setBodyHtml(''); setAttachments([])
      setGroup(null); setSelectedRoles(new Set()); setSelectedIds(new Set())
    } catch (err: any) {
      toast.error(err.message ?? "Erreur lors de l'envoi")
    } finally {
      setSending(false)
    }
  }

  const attachmentsSize = attachments.reduce((s, f) => s + f.size, 0)

  return (
    <div className="space-y-3">

      {blockingReason && (
        <div role="alert" className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <AlertTriangle size={14} className="shrink-0" />
          <span className="flex-1">{blockingReason}</span>
          <Link href="/dashboard/etablissement" className="font-semibold underline hover:no-underline whitespace-nowrap">
            Paramètres → Établissement
          </Link>
        </div>
      )}

      <div className="flex gap-4 items-start">

        {/* ─── Composition ─────────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-3">
          <div className="card p-4 space-y-2">
            <h2 className="text-xs font-bold text-warm-500 uppercase tracking-widest">Canal</h2>
            <div className="flex gap-2" role="group" aria-label="Canal d'envoi">
              {CHANNELS.map(({ value, label }) => {
                const active = channel === value
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setChannel(value)}
                    className={clsx(
                      'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400',
                      active ? 'border-primary-300 bg-primary-50 text-primary-700' : 'border-warm-200 text-warm-600 bg-white hover:bg-warm-50',
                    )}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="card p-4">
            <FloatInput label="Objet" required aria-required="true" type="text" value={subject} onChange={e => setSubject(e.target.value)} />
          </div>

          <div className="card p-4 space-y-2">
            <h2 className="text-xs font-bold text-warm-500 uppercase tracking-widest">Message</h2>
            <Suspense fallback={<div className="h-48 bg-warm-50 rounded-lg animate-pulse" />}>
              <RichTextEditor content={bodyHtml} onChange={setBodyHtml} />
            </Suspense>
          </div>

          <div className="card p-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xs font-bold text-warm-500 uppercase tracking-widest">
                Pièces jointes
                {attachments.length > 0 && (
                  <span className="ml-2 font-normal normal-case tracking-normal text-warm-400">
                    {(attachmentsSize / 1024).toFixed(0)} Ko sur 1024 Ko
                  </span>
                )}
              </h2>
              <button type="button" onClick={() => fileInputRef.current?.click()}
                className="text-xs text-primary-700 hover:underline font-medium rounded px-1 focus:outline-none focus:ring-2 focus:ring-primary-400">
                Ajouter un document
              </button>
              <input ref={fileInputRef} type="file" multiple onChange={handleFileAdd} className="hidden" />
            </div>
            {attachments.length === 0 ? (
              <p className="text-xs text-warm-400">
                Aucune pièce jointe · 1 Mo au total maximum{!wantsEmail && ' · envoyées seulement par email'}.
              </p>
            ) : (
              <ul className="space-y-1">
                {attachments.map((file, idx) => (
                  <li key={idx} className="flex items-center gap-2 bg-warm-50 rounded-lg px-3 py-1.5 text-xs">
                    <Paperclip size={12} className="text-warm-400 shrink-0" />
                    <span className="text-warm-700 flex-1 truncate">{file.name}</span>
                    <span className="text-warm-400">{(file.size / 1024).toFixed(0)} Ko</span>
                    <button type="button" onClick={() => removeAttachment(idx)} aria-label={`Retirer ${file.name}`}
                      className="text-warm-400 hover:text-red-500 rounded focus:outline-none focus:ring-2 focus:ring-primary-400">
                      <X size={12} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex items-center justify-end gap-3">
            <FloatButton variant="secondary" type="button" onClick={() => setShowPreview(true)} disabled={!bodyHtml.trim()}>
              Aperçu
            </FloatButton>
            <FloatButton variant="submit" type="button" onClick={() => setConfirmOpen(true)} disabled={!canSend} loading={sending}>
              Envoyer
            </FloatButton>
          </div>
        </div>

        {/* ─── Destinataires ───────────────────────────────────────────────── */}
        <aside className="w-[340px] shrink-0 sticky top-0 space-y-3">
          <div className="card p-4 space-y-3">
            <h2 className="text-xs font-bold text-warm-500 uppercase tracking-widest">Destinataires</h2>

            {/* Raccourcis : un clic = tout le groupe, sans cocher un par un. */}
            <div className="flex flex-wrap gap-1.5">
              {([['all', 'Tous'], ['staff', 'Staff'], ['teachers', 'Enseignants']] as const).map(([g, label]) => (
                <button
                  key={g}
                  type="button"
                  aria-pressed={group === g}
                  onClick={() => toggleGroup(g)}
                  className={clsx(
                    'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400',
                    group === g ? 'border-primary-300 bg-primary-50 text-primary-700' : 'border-warm-200 text-warm-600 bg-white hover:bg-warm-50',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Par role */}
            <div className="flex flex-wrap gap-1.5">
              {availableRoles.map(r => (
                <button
                  key={r}
                  type="button"
                  aria-pressed={selectedRoles.has(r)}
                  onClick={() => toggleRole(r)}
                  className={clsx(
                    'px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400',
                    selectedRoles.has(r) ? 'border-primary-300 bg-primary-50 text-primary-700' : 'border-warm-200 text-warm-500 bg-white hover:bg-warm-50',
                  )}
                >
                  {ROLE_LABELS[r] ?? r}
                </button>
              ))}
            </div>

            {/* Individuel */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => { setGroup(null); setSelectedRoles(new Set()); setSelectedIds(new Set()) }}
                  disabled={recipients.length === 0}
                  className="text-xs text-warm-500 hover:underline rounded whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-primary-400 disabled:opacity-40 disabled:no-underline disabled:cursor-not-allowed"
                >
                  Tout désélectionner
                </button>
                <SearchField value={staffSearch} onChange={setStaffSearch} placeholder="Rechercher…" ariaLabel="Rechercher un membre" className="flex-1 min-w-0" />
              </div>
              <ul className="h-[290px] overflow-y-auto list-scroll border border-warm-100 rounded-lg divide-y divide-warm-50">
                {filteredStaff.map(s => {
                  const selected = recipientIds.has(s.id)
                  return (
                    <li key={s.id}>
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={selected}
                        onClick={() => toggleMember(s.id)}
                        className={clsx(
                          'flex items-center gap-2 w-full px-2 py-1.5 text-left text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-400',
                          selected ? 'bg-primary-50' : 'hover:bg-warm-50',
                        )}
                      >
                        {selected ? <CheckSquare size={14} className="text-primary-600 shrink-0" /> : <Square size={14} className="text-warm-300 shrink-0" />}
                        <span className={clsx('font-medium truncate', selected ? 'text-primary-700' : 'text-warm-700')}>{fullName(s)}</span>
                        <span className={clsx('ml-auto px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0', roleColor(s.role))}>{ROLE_LABELS[s.role] ?? s.role}</span>
                        {!s.email && <span className="text-amber-600 shrink-0">Sans email</span>}
                      </button>
                    </li>
                  )
                })}
                {filteredStaff.length === 0 && <li className="text-xs text-warm-400 italic px-3 py-2">Aucun membre trouvé.</li>}
              </ul>
            </div>
          </div>

          {recipients.length > 0 && (
            <div className="card p-4 space-y-2" aria-live="polite">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-warm-700 tabular-nums">{recipients.length}</span>
                <span className="text-xs text-warm-500">destinataire{recipients.length > 1 ? 's' : ''}</span>
              </div>
              {wantsEmail && withoutEmail.length > 0 && (
                <p className="text-xs text-amber-700">{withoutEmail.length} sans adresse email (pas d'envoi mail)</p>
              )}
              <button type="button" onClick={() => setShowRecipients(true)}
                className="text-xs text-primary-700 hover:underline rounded focus:outline-none focus:ring-2 focus:ring-primary-400">
                Voir le détail
              </button>
            </div>
          )}
        </aside>
      </div>

      {/* Aperçu */}
      {showPreview && (
        <Modal title="Aperçu du message" onClose={() => setShowPreview(false)}>
          <p className="text-sm font-medium text-warm-700 mb-2">Objet : {subject || '(sans objet)'}</p>
          <hr className="my-2 border-warm-100" />
          <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: sanitize(bodyHtml) }} />
        </Modal>
      )}

      {/* Détail destinataires */}
      {showRecipients && (
        <Modal title={`Destinataires (${recipients.length})`} onClose={() => setShowRecipients(false)}>
          <ul className="divide-y divide-warm-50">
            {[...recipients].sort(byRoleThenName).map(r => (
              <li key={r.id} className="flex items-center gap-2 py-1.5 text-xs">
                <span className="font-medium text-warm-700 flex-1 truncate">{fullName(r)}</span>
                <span className={clsx('px-1.5 py-0.5 rounded text-[10px] font-medium', roleColor(r.role))}>{ROLE_LABELS[r.role] ?? r.role}</span>
                {r.email
                  ? <span className="text-warm-400 truncate max-w-[220px]">{r.email}</span>
                  : <span className="text-amber-600 shrink-0">Sans email</span>}
              </li>
            ))}
          </ul>
        </Modal>
      )}

      {/* Confirmation */}
      <ConfirmModal
        open={confirmOpen}
        title="Envoyer ce message ?"
        confirmLabel="Envoyer"
        cancelLabel="Annuler"
        variant="warning"
        confirmColor="amber"
        onConfirm={handleSend}
        onCancel={() => setConfirmOpen(false)}
      >
        <div className="space-y-1.5 text-xs text-warm-600">
          <p><span className="text-warm-400">Objet :</span> <strong className="text-warm-700">{subject}</strong></p>
          <p><span className="text-warm-400">Canal :</span> {CHANNELS.find(c => c.value === channel)?.label}</p>
          <p><span className="text-warm-400">Destinataires :</span> <strong className="text-warm-700">{recipients.length}</strong></p>
          {attachments.length > 0 && wantsEmail && (
            <p><span className="text-warm-400">Pièces jointes :</span> {attachments.map(a => a.name).join(', ')}</p>
          )}
          {wantsEmail && withoutEmail.length > 0 && (
            <p className="text-amber-700">{withoutEmail.length} destinataire(s) sans email ne recevront pas le mail.</p>
          )}
        </div>
      </ConfirmModal>
    </div>
  )
}
