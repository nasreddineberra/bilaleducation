'use client'

import { useState, useMemo, useRef, lazy, Suspense } from 'react'
import Link from 'next/link'
import { clsx } from 'clsx'
import { Paperclip, X, CheckSquare, Square, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/lib/toast-context'
import { FloatInput, FloatButton, SearchField } from '@/components/ui/FloatFields'
import ConfirmModal from '@/components/ui/ConfirmModal'
import FormModal from '@/components/ui/FormModal'
import { sanitize } from '@/lib/security/sanitize'
import { sendStaffMessage, type StaffChannel } from '@/app/dashboard/communications/staff-actions'
import { libelleRole, tonRole } from '@/lib/auth/role-labels'
import FiltreSwitch from '@/components/ui/FiltreSwitch'
import { Puce } from '@/components/dashboard/tdb'
import { pluriel } from '@/lib/texte/pluriel'

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


// Libelles des CHIPS de filtre = groupe/service (plusieurs personnes possibles),
// distincts du role d'un membre (badge, au singulier). Repli sur ROLE_LABELS.
const CHIP_LABELS: Record<string, string> = {
  enseignant: 'Enseignants',
  comptable: 'Comptabilité',
  secretaire: 'Secrétariat',
}
const chipLabel = (r: string) => CHIP_LABELS[r] ?? libelleRole(r, 'court')


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
  return (
    <FormModal
      title={title}
      onClose={onClose}
      maxWidth="max-w-2xl"
      footer={<>
        <div className="flex-1" />
        <FloatButton variant="secondary" type="button" onClick={onClose}>Fermer</FloatButton>
      </>}
    >
      {children}
    </FormModal>
  )
}

export default function StaffMessageClient({ staffMembers, etablissementId, smtpConfigured, signatureHtml }: Props) {
  const toast = useToast()
  // « Les deux » par defaut (choix utilisateur, 21/09) : un message interne doit
  // atteindre le destinataire meme s'il n'ouvre pas l'application ce jour-la, et
  // la cloche garde la trace consultable. Consequence assumee : une ecole sans
  // messagerie configuree voit d'emblee la banniere de blocage — c'est coherent,
  // la messagerie est un prerequis d'ouverture.
  const [channel, setChannel] = useState<StaffChannel>('both')
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

  // Destinataires = union des roles coches + des membres coches individuellement.
  const recipients = useMemo(() => {
    const chosen = new Map<string, StaffMember>()
    const add = (m: StaffMember) => chosen.set(m.id, m)
    staffMembers.filter(m => selectedRoles.has(m.role)).forEach(add)
    staffMembers.filter(m => selectedIds.has(m.id)).forEach(add)
    return [...chosen.values()]
  }, [selectedRoles, selectedIds, staffMembers])

  const recipientIds = useMemo(() => new Set(recipients.map(r => r.id)), [recipients])
  const withoutEmail = useMemo(() => recipients.filter(r => !r.email), [recipients])

  const wantsEmail = channel === 'email' || channel === 'both'
  const blockingReason = wantsEmail && !smtpConfigured
    ? "La messagerie n'est pas configurée : l'envoi par email est impossible. Choisissez le canal Notification ou configurez la messagerie."
    : null

  const canSend = !blockingReason && !!subject.trim() && !!bodyHtml.trim() && recipients.length > 0

  const toggleRole = (r: string) => {
    setSelectedRoles(prev => {
      const next = new Set(prev)
      if (next.has(r)) next.delete(r); else next.add(r)
      return next
    })
  }
  const toggleMember = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }
  // « Tous » = tous les roles coches / decoches d'un clic.
  const allRolesSelected = availableRoles.length > 0 && availableRoles.every(r => selectedRoles.has(r))
  const toggleAllRoles = () => setSelectedRoles(allRolesSelected ? new Set() : new Set(availableRoles))

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
        group:      null,
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
      if (result.notified) parts.push(pluriel(result.notified, 'notifié'))
      if (wantsEmail)      parts.push(pluriel(result.sent, 'email envoyé', 'emails envoyés'))
      const base = parts.join(' · ') || 'Message enregistré.'
      const cause = result.firstError ? ` Cause : ${result.firstError}` : ''
      if (result.failed) toast.error(`${base} · ${pluriel(result.failed, 'échec')}.${cause}`)
      else               toast.success(base)

      setSubject(''); setBodyHtml(signatureHtml); setAttachments([])
      setSelectedRoles(new Set()); setSelectedIds(new Set())
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
          <div className="card p-4 [--encadre-pad:1rem] space-y-2">
            <h2 className="encadre-titre text-xs font-bold uppercase tracking-widest">Canal</h2>
            <FiltreSwitch
              ariaLabel="Canal d'envoi"
              actif={channel}
              onChange={v => setChannel(v as StaffChannel)}
              options={CHANNELS.map(c => ({ valeur: c.value, libelle: c.label }))}
            />
          </div>

          <div className="card p-4">
            <FloatInput label="Objet" required aria-required="true" type="text" value={subject} onChange={e => setSubject(e.target.value)} />
          </div>

          <div className="card p-4 [--encadre-pad:1rem] space-y-2">
            <h2 className="encadre-titre text-xs font-bold uppercase tracking-widest">Message</h2>
            <Suspense fallback={<div className="h-48 bg-warm-50 rounded-lg animate-pulse" />}>
              <RichTextEditor content={bodyHtml} onChange={setBodyHtml} />
            </Suspense>
          </div>

          <div className="card p-4 [--encadre-pad:1rem] space-y-2">
            <div className="encadre-titre justify-between gap-2">
              <h2 className="text-xs font-bold uppercase tracking-widest">
                Pièces jointes
                {attachments.length > 0 && (
                  <span className="ml-2 font-normal normal-case tracking-normal text-warm-700">
                    {(attachmentsSize / 1024).toFixed(0)} Ko sur 1024 Ko
                  </span>
                )}
              </h2>
              <FloatButton variant="secondary" size="mini" type="button" onClick={() => fileInputRef.current?.click()}>
                Ajouter un document
              </FloatButton>
              <input ref={fileInputRef} type="file" multiple onChange={handleFileAdd} className="hidden" />
            </div>
            {attachments.length === 0 ? (
              <p className="text-xs text-warm-700">
                Aucune pièce jointe · 1 Mo au total maximum{!wantsEmail && ' · envoyées seulement par email'}.
              </p>
            ) : (
              <ul className="space-y-1">
                {attachments.map((file, idx) => (
                  <li key={idx} className="flex items-center gap-2 bg-warm-50 rounded-lg px-3 py-1.5 text-xs">
                    <Paperclip size={12} className="text-warm-700 shrink-0" />
                    <span className="text-warm-700 flex-1 truncate">{file.name}</span>
                    <span className="text-warm-700">{(file.size / 1024).toFixed(0)} Ko</span>
                    <button type="button" onClick={() => removeAttachment(idx)} aria-label={`Retirer ${file.name}`}
                      className="text-warm-700 hover:text-red-700 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-focus)]">
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
          <div className="card p-4 [--encadre-pad:1rem] space-y-3">
            <h2 className="encadre-titre text-xs font-bold uppercase tracking-widest">Destinataires</h2>

            {/* Un seul niveau : on coche des roles. « Tous » = tout cocher/decocher. */}
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                aria-pressed={allRolesSelected}
                onClick={toggleAllRoles}
                className={clsx(
                  'px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-focus)]',
                  allRolesSelected
                    ? 'border-[var(--brand-surface)] bg-[var(--brand-surface)] text-white dark:border-[var(--brand-accent)] dark:bg-[var(--brand-accent)] dark:text-[var(--brand-surface-2)]'
                    : 'border-warm-300 text-secondary-700 bg-white hover:bg-warm-100',
                )}
              >
                Tous
              </button>
              {availableRoles.map(r => (
                <button
                  key={r}
                  type="button"
                  aria-pressed={selectedRoles.has(r)}
                  onClick={() => toggleRole(r)}
                  className={clsx(
                    'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-focus)]',
                    selectedRoles.has(r)
                      ? 'border-[var(--brand-line)] bg-[var(--brand-tint)] text-[var(--brand-surface)] dark:text-[var(--brand-accent)]'
                      : 'border-warm-200 text-warm-700 bg-white hover:bg-warm-100',
                  )}
                >
                  {/* Chip = groupe/service (le badge d'un membre garde son role au singulier). */}
                  {chipLabel(r)}
                </button>
              ))}
            </div>

            {/* Individuel */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => { setSelectedRoles(new Set()); setSelectedIds(new Set()) }}
                  disabled={recipients.length === 0}
                  className="text-xs text-warm-700 hover:underline rounded whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-focus)] disabled:opacity-40 disabled:no-underline disabled:cursor-not-allowed"
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
                          'flex items-center gap-2 w-full px-2 py-1.5 text-left text-xs transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--brand-focus)]',
                          selected ? 'bg-[var(--brand-tint)]' : 'hover:bg-warm-100',
                        )}
                      >
                        {selected ? <CheckSquare size={14} className="text-[var(--brand-surface)] dark:text-[var(--brand-accent)] shrink-0" /> : <Square size={14} className="text-warm-700 shrink-0" />}
                        <span className={clsx('font-medium truncate', selected ? 'text-[var(--brand-surface)] dark:text-[var(--brand-accent)]' : 'text-warm-700')}>{fullName(s)}</span>
                        <span className="ml-auto shrink-0"><Puce ton={tonRole(s.role)}>{libelleRole(s.role, 'court')}</Puce></span>
                        {!s.email && <span className="text-amber-700 shrink-0">Sans email</span>}
                      </button>
                    </li>
                  )
                })}
                {filteredStaff.length === 0 && <li className="text-xs text-warm-700 italic px-3 py-2">Aucun membre trouvé.</li>}
              </ul>
            </div>
          </div>

          {recipients.length > 0 && (
            <div className="card p-4 space-y-2" aria-live="polite">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-warm-700 tabular-nums">{recipients.length}</span>
                <span className="text-xs text-warm-700">destinataire{recipients.length > 1 ? 's' : ''}</span>
              </div>
              {wantsEmail && withoutEmail.length > 0 && (
                <p className="text-xs text-amber-700">{withoutEmail.length} sans adresse email (pas d'envoi mail)</p>
              )}
              <button type="button" onClick={() => setShowRecipients(true)}
                className="text-xs font-medium text-[var(--brand-surface)] dark:text-[var(--brand-accent)] hover:underline rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-focus)]">
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
          <div className="liste">
            <table className="w-full text-xs" aria-label="Destinataires">
              <thead>
                <tr className="liste-entete border-b border-[var(--card-border)]">
                  <th scope="col" className="list-th text-left">Nom</th>
                  <th scope="col" className="list-th text-left">Rôle</th>
                  <th scope="col" className="list-th text-left">Email</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-warm-50">
                {[...recipients].sort(byRoleThenName).map(r => (
                  <tr key={r.id}>
                    <td className="list-td font-medium text-secondary-800">{fullName(r)}</td>
                    <td className="list-td"><Puce ton={tonRole(r.role)}>{libelleRole(r.role, 'court')}</Puce></td>
                    <td className="list-td">
                      {r.email
                        ? <span className="text-warm-700">{r.email}</span>
                        : <span className="text-amber-700">Sans email</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
        <div className="space-y-1.5 text-xs text-warm-700">
          <p><span className="text-warm-700">Objet :</span> <strong className="text-warm-700">{subject}</strong></p>
          <p><span className="text-warm-700">Canal :</span> {CHANNELS.find(c => c.value === channel)?.label}</p>
          <p><span className="text-warm-700">Destinataires :</span> <strong className="text-warm-700">{recipients.length}</strong></p>
          {attachments.length > 0 && wantsEmail && (
            <p><span className="text-warm-700">Pièces jointes :</span> {attachments.map(a => a.name).join(', ')}</p>
          )}
          {wantsEmail && withoutEmail.length > 0 && (
            <p className="text-amber-700">{pluriel(withoutEmail.length, 'destinataire')} sans email {withoutEmail.length > 1 ? 'ne recevront' : 'ne recevra'} pas le mail.</p>
          )}
        </div>
      </ConfirmModal>
    </div>
  )
}
