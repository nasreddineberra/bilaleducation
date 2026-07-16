'use client'

import { useState, useMemo, useRef, lazy, Suspense } from 'react'
import Link from 'next/link'
import { clsx } from 'clsx'
import { createPortal } from 'react-dom'
import { Paperclip, X, CheckSquare, Square, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/lib/toast-context'
import type { UserRole } from '@/types/database'
import { FloatInput, FloatSelect, FloatButton, SearchField } from '@/components/ui/FloatFields'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { sanitize } from '@/lib/security/sanitize'
import { sendParentMessage } from '@/app/dashboard/communications/actions'

const RichTextEditor = lazy(() => import('@/components/ui/RichTextEditor'))

const BUCKET = 'communication-attachments'
const MAX_ATTACHMENTS_BYTES = 1024 * 1024   // 1 Mo, tous fichiers confondus

// ─── Types ────────────────────────────────────────────────────────────────────

type ClassRow = {
  id: string; name: string; level: string
  day_of_week: string | null; start_time: string | null; end_time: string | null
  main_teacher_name: string | null; main_teacher_civilite: string | null
  cotisation_label: string | null
  is_adult: boolean
}

type ParentRow = {
  id: string
  tutor1_last_name: string; tutor1_first_name: string; tutor1_email: string | null
  tutor2_last_name: string | null; tutor2_first_name: string | null; tutor2_email: string | null
}

/** tutorNumber null = on sert le foyer ; 1|2 = classe adulte, seul ce tuteur. */
type Participant = { parentId: string; tutorNumber: number | null }

type TargetType = 'all_active' | 'all_registered' | 'class' | 'selected'

interface Props {
  role: string
  classes: ClassRow[]
  parents: ParentRow[]
  classParticipants: Record<string, Participant[]>
  /** Parents d'eleves inscrits cette annee : vivier de « Parents choisis ». */
  enrolledParentIds: string[]
  etablissementId: string
  smtpConfigured: boolean
  contact: string | null
  /** Annee scolaire en cours : nomme le ciblage « Parents {annee} ». */
  yearLabel: string | null
  /** Signature auto (Cordialement + coordonnees) pre-remplie dans le corps, editable. */
  signatureHtml: string
}

// ─── Permissions par rôle ────────────────────────────────────────────────────

// Miroir de PARENT_COMM_ROLES / ALL_REGISTERED_ROLES (actions.ts), qui font foi.
// Ici c'est du confort d'affichage : la garde reelle est cote serveur et en RLS.
const TARGET_PERMISSIONS: Record<TargetType, UserRole[]> = {
  all_active:     ['admin', 'direction', 'secretaire', 'responsable_pedagogique'],
  all_registered: ['admin', 'direction', 'secretaire'],
  class:          ['admin', 'direction', 'secretaire', 'responsable_pedagogique'],
  selected:       ['admin', 'direction', 'secretaire', 'responsable_pedagogique'],
}

// `all_active` porte l'annee en cours → libelles construits a la volee.
function targetLabels(yearLabel: string | null): Record<TargetType, string> {
  return {
    all_active:     yearLabel ? `Parents ${yearLabel}` : 'Parents (élèves inscrits)',
    all_registered: 'Tous les contacts',
    class:          "Parents d'une classe",
    selected:       'Parents choisis',
  }
}

const TARGET_HINTS: Record<TargetType, string> = {
  all_active:     "Toutes les familles dont un élève est inscrit cette année, participants des cours adultes compris.",
  all_registered: "Toute la base, anciennes familles et non-inscrits compris. À utiliser avec discernement.",
  class:          "Les familles d'une classe. Pour un cours adulte, ses participants.",
  selected:       'Une sélection manuelle, parmi les familles inscrites cette année.',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function householdEmails(p: ParentRow): string[] {
  return [p.tutor1_email, p.tutor2_email].filter((e): e is string => !!e)
}

function getParentLabel(parent: ParentRow): string {
  let label = `${parent.tutor1_last_name} ${parent.tutor1_first_name}`
  if (parent.tutor2_last_name) label += ` / ${parent.tutor2_last_name} ${parent.tutor2_first_name}`
  return label
}

/** Modale portee dans <body> : une modale `fixed` doit sortir de tout ancetre
 *  transforme (`animate-fade-in` garde un transform → deviendrait le conteneur). */
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  if (typeof document === 'undefined') return null
  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-warm-100">
          <h2 className="text-xs font-bold text-warm-500 uppercase tracking-widest">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="text-warm-400 hover:text-warm-600 rounded p-1 focus:outline-none focus:ring-2 focus:ring-primary-400"
          >
            <X size={16} />
          </button>
        </div>
        <div className="p-4 overflow-y-auto list-scroll min-h-0">{children}</div>
      </div>
    </div>,
    document.body,
  )
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function NewMessageClient({
  role, classes, parents, classParticipants, enrolledParentIds, etablissementId, smtpConfigured, contact, yearLabel,
  signatureHtml,
}: Props) {
  const toast = useToast()
  const TARGET_LABELS = useMemo(() => targetLabels(yearLabel), [yearLabel])
  const [targetType, setTargetType] = useState<TargetType | null>(null)
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null)
  const [selectedParentIds, setSelectedParentIds] = useState<Set<string>>(new Set())
  const [subject, setSubject] = useState('')
  // Corps pre-rempli avec la signature (editable) : on redige au-dessus.
  const [bodyHtml, setBodyHtml] = useState(signatureHtml)
  const [attachments, setAttachments] = useState<File[]>([])
  const [sending, setSending] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [showRecipients, setShowRecipients] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [parentSearch, setParentSearch] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const parentById = useMemo(() => new Map(parents.map(p => [p.id, p])), [parents])
  const enrolledSet = useMemo(() => new Set(enrolledParentIds), [enrolledParentIds])

  const allowedTargets = useMemo(
    () => (['all_active', 'class', 'selected', 'all_registered'] as TargetType[])
      .filter(t => TARGET_PERMISSIONS[t].includes(role as UserRole)),
    [role],
  )

  // Vivier de « Parents choisis » : les inscrits de l'annee. Pour toucher les
  // anciennes familles, il faut « Tous les parents enregistrés ».
  const selectableParents = useMemo(
    () => parents.filter(p => enrolledSet.has(p.id)),
    [parents, enrolledSet],
  )

  const filteredParents = useMemo(() => {
    if (!parentSearch.trim()) return selectableParents
    const q = parentSearch.toLowerCase()
    return selectableParents.filter(p =>
      `${p.tutor1_last_name} ${p.tutor1_first_name} ${p.tutor2_last_name ?? ''} ${p.tutor2_first_name ?? ''}`
        .toLowerCase().includes(q)
    )
  }, [selectableParents, parentSearch])

  // ─── Destinataires ─────────────────────────────────────────────────────────
  // Reproduit la resolution serveur (actions.ts) : seule une classe ADULTE sert
  // le tuteur inscrit ; partout ailleurs on sert le foyer.
  type Recipient = { parent: ParentRow; emails: string[] }

  const recipients = useMemo<Recipient[]>(() => {
    const build = (p: ParentRow, tutorNumber: number | null): Recipient => {
      if (tutorNumber === null) return { parent: p, emails: householdEmails(p) }
      const email = tutorNumber === 1 ? p.tutor1_email : p.tutor2_email
      return { parent: p, emails: email ? [email] : [] }
    }

    if (targetType === 'class' && selectedClassId) {
      return (classParticipants[selectedClassId] ?? [])
        .map(part => {
          const p = parentById.get(part.parentId)
          return p ? build(p, part.tutorNumber) : null
        })
        .filter((r): r is Recipient => !!r)
    }

    if (targetType === 'all_active') {
      return parents.filter(p => enrolledSet.has(p.id)).map(p => build(p, null))
    }

    if (targetType === 'all_registered') {
      return parents.map(p => build(p, null))
    }

    if (targetType === 'selected') {
      return parents.filter(p => selectedParentIds.has(p.id)).map(p => build(p, null))
    }

    return []
  }, [targetType, selectedClassId, classParticipants, parentById, parents, enrolledSet, selectedParentIds])

  const withoutEmail = useMemo(() => recipients.filter(r => r.emails.length === 0), [recipients])
  const emailCount = useMemo(
    () => new Set(recipients.flatMap(r => r.emails)).size,
    [recipients],
  )

  const selectedClass = classes.find(c => c.id === selectedClassId) ?? null
  const isAdultTarget = targetType === 'class' && !!selectedClass?.is_adult
  const unitLabel = isAdultTarget ? 'participant' : 'foyer'

  // ─── Pre-requis ────────────────────────────────────────────────────────────
  const blockingReason = !smtpConfigured
    ? "La messagerie de l'établissement n'est pas configurée : aucun email ne peut partir."
    : !contact?.trim()
      ? "L'email de contact de l'établissement n'est pas renseigné : les familles ne pourraient pas répondre."
      : null

  const targetReady = targetType && (
    targetType === 'all_active' ||
    targetType === 'all_registered' ||
    (targetType === 'class' && selectedClassId) ||
    (targetType === 'selected' && selectedParentIds.size > 0)
  )

  const canSend = !blockingReason && !!subject.trim() && !!bodyHtml.trim() && !!targetReady && emailCount > 0

  const toggleParent = (id: string) => {
    setSelectedParentIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const deselectAllFiltered = () => {
    setSelectedParentIds(prev => {
      const next = new Set(prev)
      filteredParents.forEach(p => next.delete(p.id))
      return next
    })
  }

  // Plafond garde ici ET cote serveur ET dans Storage : les PJ sont reellement
  // attachees au mail, un envoi trop lourd serait rejete.
  const handleFileAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const added = e.target.files ? Array.from(e.target.files) : []
    e.target.value = ''
    if (added.length === 0) return

    setAttachments(prev => {
      const next = [...prev, ...added]
      if (next.reduce((sum, f) => sum + f.size, 0) > MAX_ATTACHMENTS_BYTES) {
        toast.error('Les pièces jointes ne peuvent pas dépasser 1 Mo au total.')
        return prev
      }
      return next
    })
  }

  const removeAttachment = (idx: number) => setAttachments(prev => prev.filter((_, i) => i !== idx))

  // ─── Envoi ─────────────────────────────────────────────────────────────────
  // La resolution des destinataires, la garde de role et l'email vivent cote
  // serveur : ici on depose les PJ et on rend compte du resultat.
  const handleSend = async () => {
    setConfirmOpen(false)
    if (!canSend || !targetType) return
    setSending(true)

    const uploadedPaths: string[] = []

    try {
      const supabase = createClient()

      const uploaded: { path: string; name: string; size: number }[] = []
      for (const file of attachments) {
        const ext = file.name.split('.').pop()
        const path = `${etablissementId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
        const { error: uploadErr } = await supabase.storage.from(BUCKET).upload(path, file)
        if (uploadErr) throw new Error(`Envoi impossible de ${file.name} : ${uploadErr.message}`)
        uploadedPaths.push(path)
        uploaded.push({ path, name: file.name, size: file.size })
      }

      const result = await sendParentMessage({
        targetType,
        classId:     selectedClassId,
        parentIds:   [...selectedParentIds],
        subject,
        bodyHtml,
        attachments: uploaded,
      })

      if (result.error) {
        // Le message n'est pas parti : ne pas laisser les PJ orphelines.
        if (uploadedPaths.length > 0) await supabase.storage.from(BUCKET).remove(uploadedPaths)
        toast.error(result.error)
        return
      }

      // Rendre compte de ce qui s'est reellement passe, sans arrondir.
      const details: string[] = []
      if (result.failed)       details.push(`${result.failed} échec(s)`)
      if (result.withoutEmail) details.push(`${result.withoutEmail} sans adresse email`)

      const base = `${result.sent} email(s) envoyé(s) sur ${result.households} foyer(s).`
      if (details.length > 0) toast.error(`${base} ${details.join(', ')}.`)
      else                    toast.success(base)

      setSubject('')
      setBodyHtml('')
      setAttachments([])
      setTargetType(null)
      setSelectedClassId(null)
      setSelectedParentIds(new Set())
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
          <div className="card p-4">
            <FloatInput
              label="Objet"
              required
              aria-required="true"
              type="text"
              value={subject}
              onChange={e => setSubject(e.target.value)}
            />
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
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-xs text-primary-700 hover:underline font-medium rounded px-1 focus:outline-none focus:ring-2 focus:ring-primary-400"
              >
                Ajouter un document
              </button>
              <input ref={fileInputRef} type="file" multiple onChange={handleFileAdd} className="hidden" />
            </div>

            {attachments.length === 0 ? (
              <p className="text-xs text-warm-400">Aucune pièce jointe · 1 Mo au total maximum.</p>
            ) : (
              <ul className="space-y-1">
                {attachments.map((file, idx) => (
                  <li key={idx} className="flex items-center gap-2 bg-warm-50 rounded-lg px-3 py-1.5 text-xs">
                    <Paperclip size={12} className="text-warm-400 shrink-0" />
                    <span className="text-warm-700 flex-1 truncate">{file.name}</span>
                    <span className="text-warm-400">{(file.size / 1024).toFixed(0)} Ko</span>
                    <button
                      type="button"
                      onClick={() => removeAttachment(idx)}
                      aria-label={`Retirer ${file.name}`}
                      className="text-warm-400 hover:text-red-500 rounded focus:outline-none focus:ring-2 focus:ring-primary-400"
                    >
                      <X size={12} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex items-center justify-end gap-3">
            <FloatButton
              variant="secondary"
              type="button"
              onClick={() => setShowPreview(true)}
              disabled={!bodyHtml.trim()}
            >
              Aperçu
            </FloatButton>
            <FloatButton
              variant="submit"
              type="button"
              onClick={() => setConfirmOpen(true)}
              disabled={!canSend}
              loading={sending}
            >
              Envoyer
            </FloatButton>
          </div>
        </div>

        {/* ─── Destinataires ───────────────────────────────────────────────── */}
        <aside className="w-[340px] shrink-0 sticky top-0 space-y-3">
          <div className="card p-4 space-y-3">
            <h2 className="text-xs font-bold text-warm-500 uppercase tracking-widest">Destinataires</h2>

            {/* Seuls les ciblages autorises sont proposes : on ne montre pas ce
                qui est interdit. */}
            <div className="flex flex-col gap-1.5">
              {allowedTargets.map(tt => {
                const active = targetType === tt
                return (
                  <button
                    key={tt}
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      setTargetType(active ? null : tt)
                      setSelectedClassId(null)
                      setSelectedParentIds(new Set())
                    }}
                    className={clsx(
                      'text-left px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors focus:outline-none focus:ring-2 focus:ring-primary-400',
                      active
                        ? 'border-primary-300 bg-primary-50 text-primary-700'
                        : 'border-warm-200 text-warm-600 bg-white hover:bg-warm-50',
                    )}
                  >
                    {TARGET_LABELS[tt]}
                  </button>
                )
              })}
            </div>

            {targetType && (
              <p className="text-xs text-warm-400">{TARGET_HINTS[targetType]}</p>
            )}

            {targetType === 'class' && (
              <div className="space-y-1.5">
                <FloatSelect
                  label="Classe"
                  required
                  aria-required="true"
                  value={selectedClassId ?? ''}
                  onChange={e => setSelectedClassId(e.target.value || null)}
                >
                  <option value="" disabled hidden></option>
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </FloatSelect>
                {selectedClass && (
                  <dl className="text-xs space-y-0.5">
                    <div className="flex gap-1.5">
                      <dt className="text-warm-400 shrink-0">Enseignant</dt>
                      <dd className="text-warm-600 truncate">
                        {selectedClass.main_teacher_name
                          ? [selectedClass.main_teacher_civilite, selectedClass.main_teacher_name].filter(Boolean).join(' ')
                          : 'Non affecté'}
                      </dd>
                    </div>
                    <div className="flex gap-1.5">
                      <dt className="text-warm-400 shrink-0">Cotisation</dt>
                      <dd className="text-warm-600 truncate">{selectedClass.cotisation_label ?? 'Non renseignée'}</dd>
                    </div>
                    <div className="flex gap-1.5">
                      <dt className="text-warm-400 shrink-0">Horaire</dt>
                      <dd className="text-warm-600 truncate">
                        {selectedClass.day_of_week && selectedClass.start_time && selectedClass.end_time
                          ? `${selectedClass.day_of_week} ${selectedClass.start_time.slice(0, 5)}–${selectedClass.end_time.slice(0, 5)}`
                          : 'Non renseigné'}
                      </dd>
                    </div>
                  </dl>
                )}
              </div>
            )}

            {targetType === 'selected' && (
              <div className="space-y-2">
                {/* Pas de « Tout sélectionner » : tout le monde, c'est le
                    ciblage « Parents {annee} », pas une selection manuelle. */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={deselectAllFiltered}
                    disabled={selectedParentIds.size === 0}
                    className="text-xs text-warm-500 hover:underline rounded whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-primary-400 disabled:opacity-40 disabled:no-underline disabled:cursor-not-allowed"
                  >
                    Tout désélectionner
                  </button>
                  <SearchField
                    value={parentSearch}
                    onChange={setParentSearch}
                    placeholder="Rechercher…"
                    ariaLabel="Rechercher une famille"
                    className="flex-1 min-w-0"
                  />
                </div>

                {/* Hauteur fixe = 10 lignes : le panneau ne saute pas au filtrage.
                    Au-dela, la liste defile en interne (200-300 familles). */}
                <ul className="h-[290px] overflow-y-auto list-scroll border border-warm-100 rounded-lg divide-y divide-warm-50">
                  {filteredParents.map(p => {
                    const selected = selectedParentIds.has(p.id)
                    const emails = householdEmails(p)
                    return (
                      <li key={p.id}>
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={selected}
                          onClick={() => toggleParent(p.id)}
                          className={clsx(
                            'flex items-center gap-2 w-full px-2 py-1.5 text-left text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-400',
                            selected ? 'bg-primary-50' : 'hover:bg-warm-50',
                          )}
                        >
                          {selected
                            ? <CheckSquare size={14} className="text-primary-600 shrink-0" />
                            : <Square size={14} className="text-warm-300 shrink-0" />}
                          <span className={clsx('font-medium truncate', selected ? 'text-primary-700' : 'text-warm-700')}>
                            {getParentLabel(p)}
                          </span>
                          {emails.length === 0 && (
                            <span className="ml-auto text-amber-600 shrink-0">Sans email</span>
                          )}
                        </button>
                      </li>
                    )
                  })}
                  {filteredParents.length === 0 && (
                    <li className="text-xs text-warm-400 italic px-3 py-2">Aucune famille trouvée.</li>
                  )}
                </ul>
                <p className="text-xs text-warm-500">{selectedParentIds.size} famille(s) sélectionnée(s)</p>
              </div>
            )}
          </div>

          {/* Recapitulatif : des chiffres lisibles, pas un mur d'adresses. */}
          {targetReady && (
            <div className="card p-4 space-y-2" aria-live="polite">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-warm-700 tabular-nums">{recipients.length}</span>
                <span className="text-xs text-warm-500">
                  {unitLabel}{recipients.length > 1 ? 's' : ''} ciblé{recipients.length > 1 ? 's' : ''}
                </span>
              </div>
              <p className="text-xs text-warm-500">
                {emailCount} email{emailCount > 1 ? 's' : ''} · un envoi par {unitLabel}
              </p>

              {withoutEmail.length > 0 && (
                <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5 space-y-1">
                  <p className="font-semibold">
                    {withoutEmail.length} sans adresse email · ne recevra rien
                  </p>
                  <ul className="space-y-0.5">
                    {withoutEmail.slice(0, 5).map(r => (
                      <li key={r.parent.id} className="truncate">{getParentLabel(r.parent)}</li>
                    ))}
                    {withoutEmail.length > 5 && <li>et {withoutEmail.length - 5} autre(s)</li>}
                  </ul>
                </div>
              )}

              {recipients.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowRecipients(true)}
                  className="text-xs text-primary-700 hover:underline rounded focus:outline-none focus:ring-2 focus:ring-primary-400"
                >
                  Voir le détail
                </button>
              )}
            </div>
          )}
        </aside>
      </div>

      {/* ─── Aperçu ─────────────────────────────────────────────────────────── */}
      {showPreview && (
        <Modal title="Aperçu du message" onClose={() => setShowPreview(false)}>
          <p className="text-sm font-medium text-warm-700 mb-2">Objet : {subject || '(sans objet)'}</p>
          <hr className="my-2 border-warm-100" />
          <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: sanitize(bodyHtml) }} />
          {contact && (
            <p className="text-xs text-warm-400 mt-4 pt-3 border-t border-warm-100">
              Les familles répondront à {contact}.
            </p>
          )}
        </Modal>
      )}

      {/* ─── Détail des destinataires ───────────────────────────────────────── */}
      {showRecipients && (
        <Modal title={`Destinataires (${recipients.length})`} onClose={() => setShowRecipients(false)}>
          <ul className="divide-y divide-warm-50">
            {recipients.map(r => (
              <li key={`${r.parent.id}-${r.emails.join('')}`} className="flex items-center gap-2 py-1.5 text-xs">
                <span className="font-medium text-warm-700 flex-1 truncate">{getParentLabel(r.parent)}</span>
                {r.emails.length > 0
                  ? <span className="text-warm-400 truncate max-w-[280px]">{r.emails.join(', ')}</span>
                  : <span className="text-amber-600 shrink-0">Sans adresse email</span>}
              </li>
            ))}
          </ul>
        </Modal>
      )}

      {/* ─── Confirmation ───────────────────────────────────────────────────── */}
      {/* Un envoi est irreversible : on recapitule avant, comme pour toute
          action destructrice du projet. */}
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
          <p><span className="text-warm-400">Cible :</span> {targetType ? TARGET_LABELS[targetType] : ''}{selectedClass ? ` · ${selectedClass.name}` : ''}</p>
          <p>
            <span className="text-warm-400">Envoi à :</span>{' '}
            <strong className="text-warm-700">{recipients.length} {unitLabel}{recipients.length > 1 ? 's' : ''}</strong>
            {' '}({emailCount} email{emailCount > 1 ? 's' : ''})
          </p>
          {attachments.length > 0 && (
            <p><span className="text-warm-400">Pièces jointes :</span> {attachments.map(a => a.name).join(', ')}</p>
          )}
          {withoutEmail.length > 0 && (
            <p className="text-amber-700">{withoutEmail.length} destinataire(s) sans adresse email ne recevront rien.</p>
          )}
          {targetType === 'all_registered' && (
            <p className="text-amber-700">Ce ciblage inclut les familles non inscrites cette année.</p>
          )}
        </div>
      </ConfirmModal>
    </div>
  )
}
