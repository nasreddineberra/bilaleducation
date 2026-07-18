'use client'

import { useState, useMemo, useCallback, useEffect, useRef, lazy, Suspense } from 'react'
import { Trash2, Pencil, AlertTriangle, MessageSquareText, X } from 'lucide-react'
import { clsx } from 'clsx'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/lib/toast-context'
import PaymentModal from './PaymentModal'
import Tooltip from '@/components/ui/Tooltip'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { FloatInput, FloatSelect, FloatButton, SearchField } from '@/components/ui/FloatFields'

const RichTextEditor = lazy(() => import('@/components/ui/RichTextEditor'))
import { sendRelance, logAttestation, type FinancementCommunication } from '@/app/dashboard/financements/actions'
import { generateAttestationPdfBase64 } from './attestationPdf'
import {
  computeFamilyFinancials, feeStatus, siblingDiscounts, lineTotal,
  type FamilyFinancials,
} from '@/lib/financements/compute'
import type { FeeAdjustment, FeeInstallment, FeeStatus, AdjustmentType } from '@/types/database'

// ─── Types ────────────────────────────────────────────────────────────────────

interface StudentLine {
  id: string
  first_name: string
  last_name: string
  class_name: string
  cotisation_label: string
  class_tooltip: string | null
  cotisation_amount: number
  registration_fee: number
  sibling_discount: number
  total: number
}

interface AdultLine {
  id: string
  tutor_label: string
  class_name: string
  cotisation_label: string
  class_tooltip: string | null
  cotisation_amount: number
  registration_fee: number
  total: number
}

interface ParentOption {
  id: string
  tutor1_last_name: string
  tutor1_first_name: string
  tutor2_last_name: string | null
  tutor2_first_name: string | null
  situation_familiale: string | null
  maxInstallments: number   // 0 = pas de limite d'echeances
  students: StudentLine[]
  adultLines: AdultLine[]
}

const SITUATION_LABELS: Record<string, string> = {
  'mariés': 'Mariés', 'pacsés': 'Pacsés', 'concubinage': 'Concubinage',
  'célibataire': 'Célibataire', 'séparés': 'Séparés', 'divorcés': 'Divorcés',
  'veuf': 'Veuf(ve)', 'autre': 'Autre',
}

interface Props {
  currentYear: { id: string; label: string }
  parents: any[]
  adultEnrollments: any[]
  familyFees: any[]
  communications: any[]
  etablissement: { nom: string; logo_url: string | null; adresse: string | null; telephone: string | null; contact: string | null } | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtEur(n: number) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency', currency: 'EUR',
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(n)
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('fr-FR')
}

const STATUS_LABELS: Record<FeeStatus, string> = {
  pending:  'En attente',
  partial:  'Partiel',
  paid:     'Soldé',
  overpaid: 'Trop perçu',
}

// « Soldé » = couleur positive de l'app (primary/turquoise, comme les cartes
// stat des listes), pas un vert generique. Les autres statuts gardent le code
// feu (gris/orange/rouge).
const STATUS_COLORS: Record<FeeStatus, string> = {
  pending:  'bg-gray-100 text-gray-600',
  partial:  'bg-orange-100 text-orange-800',
  paid:     'bg-primary-50 text-primary-700',
  overpaid: 'bg-red-100 text-red-800',
}

// Pastille + barre de progression du plan de travail.
const STATUS_DOT: Record<FeeStatus, string> = {
  pending:  'bg-warm-300',
  partial:  'bg-orange-400',
  paid:     'bg-primary-500',
  overpaid: 'bg-red-500',
}
const STATUS_BAR: Record<FeeStatus, string> = {
  pending:  'bg-warm-300',
  partial:  'bg-orange-400',
  paid:     'bg-primary-500',
  overpaid: 'bg-red-500',
}

const METHOD_LABELS: Record<string, string> = {
  cash: 'Espèces', check: 'Chèque', card: 'CB', transfer: 'Virement', online: 'En ligne',
}

// Calcul financier d'une famille : le modele vit dans `lib/financements/compute`
// (source unique partagee avec Stats reglements). Ici, seul l'assemblage du
// sous-total a partir des lignes deja totalisees de la famille.
function familyFinancials(parent: ParentOption | null, fee: any): FamilyFinancials {
  const subtotal = parent
    ? parent.students.reduce((a, s) => a + s.total, 0) + parent.adultLines.reduce((a, x) => a + x.total, 0)
    : 0
  return computeFamilyFinancials(subtotal, fee)
}

const DAYS: Record<string, string> = {
  monday: 'Lundi', tuesday: 'Mardi', wednesday: 'Mercredi',
  thursday: 'Jeudi', friday: 'Vendredi', saturday: 'Samedi', sunday: 'Dimanche',
}

// ─── Parse parents ────────────────────────────────────────────────────────────

function buildClassTooltip(cls: any): string | null {
  const day   = cls?.day_of_week ? (DAYS[cls.day_of_week] ?? cls.day_of_week) : null
  const start = cls?.start_time ? cls.start_time.slice(0, 5) : null
  const end   = cls?.end_time   ? cls.end_time.slice(0, 5)   : null
  const mainTeacher = (cls?.class_teachers ?? []).find((t: any) => t.is_main_teacher)
  const teacherName = mainTeacher?.teachers
    ? [mainTeacher.teachers.civilite, mainTeacher.teachers.last_name, mainTeacher.teachers.first_name].filter(Boolean).join(' ')
    : null
  const cotisLabel = cls?.cotisation_types?.label ?? null
  const parts = [
    teacherName,
    cotisLabel,
    cls?.level ? `Niveau ${cls.level}` : null,
    day && start ? `${day} ${start}${end ? `–${end}` : ''}` : day,
  ].filter(Boolean)
  return parts.length ? parts.join(' · ') : null
}

function parseParents(raw: any[], adultEnrollments: any[]): ParentOption[] {
  // Grouper les inscriptions adultes par parent_id
  const adultByParent: Record<string, any[]> = {}
  for (const ae of adultEnrollments) {
    const pid = ae.parent_id
    if (!adultByParent[pid]) adultByParent[pid] = []
    adultByParent[pid].push(ae)
  }

  return raw.map(p => {
    const studentsRaw = p.students ?? []

    // Remise fratrie : regle portee par le helper partage (source unique).
    const discounts = siblingDiscounts(
      studentsRaw.map((s: any) => (s.enrollments ?? [])[0]?.classes?.cotisation_types)
    )

    const students: StudentLine[] = studentsRaw.map((s: any, i: number) => {
      const enrollment = (s.enrollments ?? [])[0]
      const cls = enrollment?.classes
      const ct = cls?.cotisation_types
      const discount = discounts[i]

      const cotisation = ct?.amount ?? 0
      const regFee = ct?.registration_fee ?? 0

      const class_tooltip = buildClassTooltip(cls)

      return {
        id: s.id,
        first_name: s.first_name,
        last_name: s.last_name,
        class_name: cls?.name ?? '·',
        cotisation_label: ct?.label ?? '',
        class_tooltip,
        cotisation_amount: cotisation,
        registration_fee: regFee,
        sibling_discount: discount,
        total: lineTotal(ct, discount),
      }
    })
    // Lignes adultes
    const parentAdultEnrollments = adultByParent[p.id] ?? []
    const adultLines: AdultLine[] = parentAdultEnrollments.map((ae: any) => {
      const cls = ae.classes
      const ct  = cls?.cotisation_types
      const cotisation = ct?.amount ?? 0
      const regFee     = ct?.registration_fee ?? 0
      const tLast  = ae.tutor_number === 1 ? p.tutor1_last_name : (p.tutor2_last_name ?? '')
      const tFirst = ae.tutor_number === 1 ? p.tutor1_first_name : (p.tutor2_first_name ?? '')
      const tutorName = `${tLast.toUpperCase()} ${tFirst}`.trim()
      return {
        id: `adult-${ae.parent_id}-${ae.tutor_number}-${cls?.id}`,
        tutor_label: tutorName,
        class_name: cls?.name ?? '·',
        cotisation_label: ct?.label ?? '',
        class_tooltip: buildClassTooltip(cls),
        cotisation_amount: cotisation,
        registration_fee: regFee,
        total: cotisation + regFee,
      }
    })

    // Max effectif d'echeances = le PLUS GRAND max_installments parmi les types de
    // cotisation de la famille (eleves + adultes). 0/absent = pas de limite pour ce
    // type. Si aucun type n'a de max defini → 0 (pas de badge, on ne limite rien).
    const allMax = [
      ...studentsRaw.map((s: any) => s.enrollments?.[0]?.classes?.cotisation_types?.max_installments),
      ...parentAdultEnrollments.map((ae: any) => ae.classes?.cotisation_types?.max_installments),
    ].filter((m: any): m is number => typeof m === 'number' && m > 0)
    const maxInstallments = allMax.length ? Math.max(...allMax) : 0

    return {
      id: p.id,
      tutor1_last_name: p.tutor1_last_name,
      tutor1_first_name: p.tutor1_first_name,
      tutor2_last_name: p.tutor2_last_name ?? null,
      tutor2_first_name: p.tutor2_first_name ?? null,
      situation_familiale: p.situation_familiale ?? null,
      maxInstallments,
      students,
      adultLines,
    }
  })
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function FinancementsClient({ currentYear, parents: rawParents, adultEnrollments, familyFees: initialFees, communications: initialComms, etablissement, initialParentId }: Props & { initialParentId?: string }) {
  const supabase = createClient()
  const toast = useToast()

  const parentOptions = useMemo(() => parseParents(rawParents, adultEnrollments), [rawParents, adultEnrollments])

  const [selectedParentId, setSelectedParentId] = useState<string>(initialParentId ?? '')

  // Plan de travail : recherche + filtre de statut de la liste des familles.
  const [parentSearch,  setParentSearch]  = useState('')
  const [statusFilter,  setStatusFilter]  = useState<FeeStatus | null>(null)
  const [familyFees, setFamilyFees]             = useState<any[]>(initialFees)
  const familyFeesRef = useRef(familyFees)
  familyFeesRef.current = familyFees
  const [saving, setSaving]                     = useState(false)
  const [error, setError]                       = useState<string | null>(null)
  const [success, setSuccess]                   = useState<string | null>(null)
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [editingPayment, setEditingPayment]     = useState<FeeInstallment | null>(null)
  const [deletePaymentTarget, setDeletePaymentTarget] = useState<FeeInstallment | null>(null)
  const [deleteAdjTarget, setDeleteAdjTarget] = useState<FeeAdjustment | null>(null)
  // Communication comptable (relance)
  const [communications, setCommunications] = useState<FinancementCommunication[]>(initialComms)
  const [relanceOpen, setRelanceOpen] = useState(false)
  const [relanceSubject, setRelanceSubject] = useState('')
  const [relanceBody, setRelanceBody] = useState('')
  const [relanceSending, setRelanceSending] = useState(false)
  // Attestation (generee + ouverte pour impression, non envoyee par email)
  const [attestSending, setAttestSending] = useState(false)

  // Messages remontes en toast (plus de banniere qui pousse le contenu).
  useEffect(() => {
    if (!success) return
    toast.success(success)
    setSuccess(null)
  }, [success, toast])

  useEffect(() => {
    if (!error) return
    toast.error(error)
    setError(null)
  }, [error, toast])

  // Ajustements
  const [addingAdjustment, setAddingAdjustment] = useState(false)
  const [adjForm, setAdjForm] = useState({
    type: '' as AdjustmentType | '',
    label: '',
    amount: '',
    date: new Date().toISOString().slice(0, 10),
  })

  // ── Données dérivées ─────────────────────────────────────────────────────

  const selectedParent = parentOptions.find(p => p.id === selectedParentId)

  // ── Plan de travail : stats par famille, KPI, liste filtree/triee ──────────
  const familyStats = useMemo(
    () => parentOptions.map(p => {
      const fee = familyFees.find((f: any) => f.parent_id === p.id) ?? null
      return { parent: p, ...familyFinancials(p, fee) }
    }),
    [parentOptions, familyFees],
  )

  const kpi = useMemo(() => {
    let billed = 0, collected = 0, outstanding = 0, overpaid = 0
    const counts: Record<FeeStatus, number> = { pending: 0, partial: 0, paid: 0, overpaid: 0 }
    for (const f of familyStats) {
      billed      += f.totalDue
      collected   += Math.max(0, f.netPercu)      // encaisse = cash recu (trop-percu inclus)
      outstanding += Math.max(0, f.remaining)     // reste du (plancher a 0)
      overpaid    += Math.max(0, -f.remaining)    // trop-percu = perceu au-dela du du
      counts[f.status]++
    }
    return { billed, collected, outstanding, overpaid, counts }
  }, [familyStats])

  const worklist = useMemo(() => {
    const q = parentSearch.trim().toLowerCase()
    return familyStats
      .filter(f => !statusFilter || f.status === statusFilter)
      .filter(f => {
        if (!q) return true
        const p = f.parent
        const t1 = `${p.tutor1_last_name} ${p.tutor1_first_name}`.toLowerCase()
        const t2 = p.tutor2_last_name && p.tutor2_first_name ? `${p.tutor2_last_name} ${p.tutor2_first_name}`.toLowerCase() : ''
        return t1.includes(q) || t2.includes(q)
      })
      .sort((a, b) =>
        a.parent.tutor1_last_name.localeCompare(b.parent.tutor1_last_name, 'fr', { sensitivity: 'base' }) ||
        a.parent.tutor1_first_name.localeCompare(b.parent.tutor1_first_name, 'fr', { sensitivity: 'base' }))
  }, [familyStats, statusFilter, parentSearch])

  // ── Detail de la famille selectionnee (meme calcul via le helper) ──────────
  const currentFee = familyFees.find((f: any) => f.parent_id === selectedParentId) ?? null
  const sel = familyFinancials(selectedParent ?? null, currentFee)
  const { subtotal, totalDue, adjustmentsTotal, totalPaid, netPercu, remaining, status: derivedStatus } = sel

  const adjustments: FeeAdjustment[] = (currentFee?.fee_adjustments ?? [])
    .sort((a: FeeAdjustment, b: FeeAdjustment) =>
      new Date(a.adjustment_date).getTime() - new Date(b.adjustment_date).getTime()
    )
  const payments: FeeInstallment[] = (currentFee?.fee_installments ?? [])
    .sort((a: FeeInstallment, b: FeeInstallment) =>
      new Date(a.paid_date ?? a.created_at).getTime() - new Date(b.paid_date ?? b.created_at).getTime()
    )

  // Communications comptables de la famille selectionnee (deja triees serveur : recent d'abord).
  const familyComms = useMemo(
    () => communications.filter(c => c.parent_id === selectedParentId),
    [communications, selectedParentId],
  )

  // ── Créer/récupérer le family_fee ────────────────────────────────────────

  const ensureFamilyFee = useCallback(async (): Promise<string | null> => {
    if (currentFee) return currentFee.id
    if (!selectedParentId) return null

    setSaving(true)
    setError(null)
    try {
      const { data, error: err } = await supabase
        .from('family_fees')
        .insert({
          parent_id:         selectedParentId,
          school_year_id:    currentYear.id,
          subtotal,
          adjustments_total: 0,
          total_due:         subtotal,
          num_installments:  1,
          status:            'pending',
        })
        .select('*, fee_adjustments(*), fee_installments(*)')
        .single()
      if (err) throw err
      setFamilyFees(prev => [...prev, data])
      return data.id
    } catch (e: any) {
      setError(e.message ?? 'Erreur lors de la création du dossier.')
      return null
    } finally {
      setSaving(false)
    }
  }, [currentFee, selectedParentId, currentYear.id, subtotal, supabase])

  // ── Ajustements ──────────────────────────────────────────────────────────

  const addAdjustment = async () => {
    const label = adjForm.label.trim()
    const rawAmount = parseFloat(adjForm.amount)
    if (!adjForm.type) { setError('Le type est obligatoire.'); return }
    if (!label) { setError('Le motif est obligatoire.'); return }
    if (isNaN(rawAmount) || rawAmount <= 0) { setError('Le montant doit être supérieur à 0.'); return }
    const amount = -Math.abs(rawAmount)

    const feeId = await ensureFamilyFee()
    if (!feeId) return

    setSaving(true)
    setError(null)
    try {
      const { data, error: err } = await supabase
        .from('fee_adjustments')
        .insert({
          family_fee_id:   feeId,
          adjustment_date: adjForm.date,
          adjustment_type: adjForm.type as AdjustmentType,
          label,
          amount,
        })
        .select()
        .single()
      if (err) throw err

      const newAdjTotal = adjustmentsTotal + amount
      const newDue = subtotal + newAdjTotal   // les ajustements reduisent le du
      const newStatus = feeStatus(totalPaid, newDue)
      await supabase.from('family_fees').update({ adjustments_total: newAdjTotal, total_due: newDue, status: newStatus }).eq('id', feeId)

      setFamilyFees(prev => prev.map(f =>
        f.id === feeId
          ? { ...f, adjustments_total: newAdjTotal, total_due: newDue, status: newStatus, fee_adjustments: [...(f.fee_adjustments ?? []), data] }
          : f
      ))
      setAddingAdjustment(false)
      setAdjForm({ type: '', label: '', amount: '', date: new Date().toISOString().slice(0, 10) })
      setSuccess('Ajustement enregistré.')
    } catch (e: any) {
      setError(e.message ?? 'Erreur.')
    } finally {
      setSaving(false)
    }
  }

  const removeAdjustment = async (adj: FeeAdjustment) => {
    setDeleteAdjTarget(null)
    if (!currentFee) return
    setSaving(true)
    setError(null)
    try {
      const { error: err } = await supabase.from('fee_adjustments').delete().eq('id', adj.id)
      if (err) throw err
      const newAdjTotal = adjustmentsTotal - adj.amount
      const newDue = subtotal + newAdjTotal
      const newStatus = feeStatus(totalPaid, newDue)
      await supabase.from('family_fees').update({ adjustments_total: newAdjTotal, total_due: newDue, status: newStatus }).eq('id', currentFee.id)
      setFamilyFees(prev => prev.map(f =>
        f.id === currentFee.id
          ? { ...f, adjustments_total: newAdjTotal, total_due: newDue, status: newStatus, fee_adjustments: (f.fee_adjustments ?? []).filter((a: any) => a.id !== adj.id) }
          : f
      ))
      setSuccess('Ajustement supprime.')
    } catch (e: any) {
      setError(e.message ?? 'Erreur.')
    } finally {
      setSaving(false)
    }
  }

  // ── Paiement enregistré ──────────────────────────────────────────────────

  const handlePaymentSaved = async (newPayment: FeeInstallment) => {
    const isEdit = !!editingPayment
    setPaymentModalOpen(false)
    setEditingPayment(null)

    const feeId = newPayment.family_fee_id

    // Trouver le fee dans l'état le plus récent (ref évite les closures obsolètes)
    const fee = familyFeesRef.current.find(f => f.id === feeId)
    const existingInstallments: FeeInstallment[] = fee?.fee_installments ?? []
    const updatedInstallments = isEdit
      ? existingInstallments.map(p => p.id === newPayment.id ? newPayment : p)
      : [...existingInstallments, newPayment]
    const totalPaid = updatedInstallments.reduce((s, p: any) => s + (p.amount_paid ?? 0), 0)
    const due = fee?.total_due ?? 0
    const status = feeStatus(totalPaid, due)

    // Mettre à jour l'état local
    setFamilyFees(prev => prev.map(f =>
      f.id === feeId
        ? { ...f, status, fee_installments: updatedInstallments }
        : f
    ))
    setSuccess(isEdit ? 'Paiement modifie.' : 'Paiement enregistre.')

    // Mettre à jour le statut en DB
    try {
      await supabase.from('family_fees').update({ status }).eq('id', feeId)
    } catch (err) {
      console.error('[FinancementsClient] Erreur mise à jour statut DB:', err)
    }
  }

  const removePayment = async (payment: FeeInstallment) => {
    setDeletePaymentTarget(null)
    if (!currentFee) return
    setSaving(true)
    setError(null)
    try {
      const { error: err } = await supabase.from('fee_installments').delete().eq('id', payment.id)
      if (err) throw err

      const remaining2 = payments.filter(p => p.id !== payment.id)
      const newTotalPaid = remaining2.reduce((s, p) => s + p.amount_paid, 0)
      const due = currentFee.total_due
      const status = feeStatus(newTotalPaid, due)

      await supabase.from('family_fees').update({ status }).eq('id', currentFee.id)

      setFamilyFees(prev => prev.map(f =>
        f.id === currentFee.id
          ? { ...f, status, fee_installments: (f.fee_installments ?? []).filter((p: any) => p.id !== payment.id) }
          : f
      ))
      setSuccess('Paiement supprime.')
    } catch (e: any) {
      setError(e.message ?? 'Erreur.')
    } finally {
      setSaving(false)
    }
  }

  // ── Relance d'impayes ─────────────────────────────────────────────────────
  const openRelance = () => {
    if (!selectedParent) return
    // Pluriel selon le nombre de cotisations du recap (lignes eleves + adultes).
    const nbCotis = selectedParent.students.length + selectedParent.adultLines.length
    const plural  = nbCotis > 1
    const cotisWord = plural ? 'cotisations' : 'cotisation'
    const laLes     = plural ? 'les' : 'la'
    setRelanceSubject(`Rappel de paiement · ${cotisWord} ${currentYear.label}`)
    // Corps en HTML (editeur riche) : montant du en gras + signature editable en fin.
    const sig = ['Cordialement,', etablissement?.nom, etablissement?.adresse,
      etablissement?.telephone ? `Tél : ${etablissement.telephone}` : null, etablissement?.contact]
      .filter(Boolean).join('<br>')
    setRelanceBody(
      `<p>Madame, Monsieur,</p>` +
      `<p>Sauf erreur de notre part, il reste <strong>${fmtEur(Math.max(0, remaining))}</strong> à régler sur ${laLes} ${cotisWord} ${currentYear.label} ` +
      `(${fmtEur(totalDue)} au total, dont ${fmtEur(netPercu)} déjà réglés).</p>` +
      `<p>Nous vous remercions de bien vouloir régulariser votre situation. Pour toute difficulté, n'hésitez pas à nous contacter.</p>` +
      `<p></p>` +
      `<p>${sig}</p>`
    )
    setRelanceOpen(true)
  }

  const submitRelance = async () => {
    if (!selectedParent) return
    setRelanceSending(true)
    const res = await sendRelance({
      parentId:     selectedParent.id,
      schoolYearId: currentYear.id,
      subject:      relanceSubject,
      body:         relanceBody,
    })
    setRelanceSending(false)
    if (res.error) { toast.error(res.error); return }
    if (res.communication) setCommunications(prev => [res.communication!, ...prev])
    setRelanceOpen(false)
    toast.success('Relance envoyée.')
  }

  // ── Attestation de paiement ────────────────────────────────────────────────
  const nbCotisWord = selectedParent
    ? (selectedParent.students.length + selectedParent.adultLines.length > 1 ? 'cotisations' : 'cotisation')
    : 'cotisation'

  // Le foyer : tuteur 1 (+ tuteur 2 si present).
  const foyerTutorNames = (): string[] => {
    if (!selectedParent) return []
    const names = [`${selectedParent.tutor1_last_name.toUpperCase()} ${selectedParent.tutor1_first_name}`]
    if (selectedParent.tutor2_last_name) names.push(`${selectedParent.tutor2_last_name.toUpperCase()} ${selectedParent.tutor2_first_name}`)
    return names
  }

  const buildAttestationBase64 = async (tutorNames: string[]): Promise<string> => {
    const p = selectedParent!
    const lines = [
      ...p.students.map(s => ({ nom: `${s.last_name.toUpperCase()} ${s.first_name}`, detail: s.class_name, montant: s.total })),
      ...p.adultLines.map(a => ({ nom: a.tutor_label, detail: a.class_name, montant: a.total })),
    ]
    return generateAttestationPdfBase64({
      etablissementNom:       etablissement?.nom ?? 'Établissement',
      etablissementLogo:      etablissement?.logo_url ?? null,
      etablissementAdresse:   etablissement?.adresse ?? null,
      etablissementTelephone: etablissement?.telephone ?? null,
      tutorNames,
      yearLabel:  currentYear.label,
      lines,
      reduction:  Math.abs(adjustmentsTotal),
      total:      totalDue,
      dateStr:    new Date().toLocaleDateString('fr-FR'),
    })
  }

  // Genere le PDF pour le FOYER, l'ouvre dans un nouvel onglet (imprimable) et trace la delivrance.
  const issueAttestation = async () => {
    if (!selectedParent) return
    const tutorNames = foyerTutorNames()

    // Ouvrir l'onglet MAINTENANT (dans le geste utilisateur), sinon le navigateur
    // bloque le popup une fois qu'on a « await » la generation du PDF.
    const win = window.open('', '_blank')

    setAttestSending(true)
    try {
      const base64 = await buildAttestationBase64(tutorNames)
      const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0))
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }))
      if (win) win.location.href = url
      else window.open(url, '_blank')
      setTimeout(() => URL.revokeObjectURL(url), 60000)

      const res = await logAttestation({
        parentId:     selectedParent.id,
        schoolYearId: currentYear.id,
        subject:      `Attestation de paiement · ${nbCotisWord} ${currentYear.label}`,
        recipients:   tutorNames.join(', '),
      })
      if (res.error) { toast.error(res.error); return }
      if (res.communication) setCommunications(prev => [res.communication!, ...prev])
      toast.success('Attestation ouverte pour impression.')
    } catch (e: any) {
      toast.error(e.message ?? "Erreur lors de la génération de l'attestation.")
    } finally {
      setAttestSending(false)
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col gap-3">

      {/* ── Bandeau trésorerie + filtres de statut (cliquables) ── */}
      <div className={clsx('grid grid-cols-2 gap-2', kpi.counts.overpaid > 0 ? 'lg:grid-cols-7' : 'lg:grid-cols-6')}>
        <div className="card px-3 py-2">
          <p className="stat-label">Facturé</p>
          <p className="text-lg font-bold text-secondary-800 tabular-nums">{fmtEur(kpi.billed)}</p>
        </div>
        <div className="card px-3 py-2">
          <p className="stat-label">Encaissé</p>
          <p className="text-lg font-bold text-primary-600 tabular-nums">{fmtEur(kpi.collected)}</p>
        </div>
        <div className="card px-3 py-2">
          <p className="stat-label">Reste à encaisser</p>
          <p className="text-lg font-bold text-orange-700 tabular-nums">{fmtEur(kpi.outstanding)}</p>
        </div>
        {(([['pending', 'En attente'], ['partial', 'Partiel'], ['paid', 'Soldé']]) as [FeeStatus, string][]).map(([st, label]) => {
          const active = statusFilter === st
          return (
            <button
              key={st}
              type="button"
              aria-pressed={active}
              onClick={() => setStatusFilter(active ? null : st)}
              className={clsx(
                'card px-3 py-2 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400',
                active ? 'ring-2 ring-primary-400' : 'hover:bg-warm-50',
              )}
            >
              <p className="stat-label flex items-center gap-1">
                <span className={clsx('w-2 h-2 rounded-full', STATUS_DOT[st])} aria-hidden="true" /> {label}
              </p>
              <p className="text-lg font-bold text-secondary-800 tabular-nums">{kpi.counts[st]}</p>
            </button>
          )
        })}
        {kpi.counts.overpaid > 0 && (
          <button
            type="button"
            aria-pressed={statusFilter === 'overpaid'}
            onClick={() => setStatusFilter(statusFilter === 'overpaid' ? null : 'overpaid')}
            className={clsx(
              'card px-3 py-2 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400',
              statusFilter === 'overpaid' ? 'ring-2 ring-red-400' : 'hover:bg-warm-50',
            )}
          >
            <p className="stat-label flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-500" aria-hidden="true" /> Trop perçu
            </p>
            <p className="text-lg font-bold text-red-600 tabular-nums flex items-baseline justify-between gap-2">
              <span>{kpi.counts.overpaid}</span>
              <span>{fmtEur(kpi.overpaid)}</span>
            </p>
          </button>
        )}
      </div>

      {/* ── Plan de travail : liste des familles + détail ── */}
      <div className="flex-1 min-h-0 flex gap-4">

        {/* Liste des familles — largeur = celle de la ligne de filtres (w-fit) */}
        <aside className="w-fit shrink-0 card p-0 flex flex-col overflow-hidden">
          <div className="p-2 border-b border-warm-100 space-y-2">
            <SearchField
              value={parentSearch}
              onChange={setParentSearch}
              placeholder="Rechercher une famille…"
              ariaLabel="Rechercher une famille"
              className="w-full"
            />
            {/* Filtre de statut (synchronise avec les compteurs du bandeau).
                Le filtre « Trop perçu » (rouge) n'apparait que s'il en existe. */}
            <div className="flex flex-nowrap gap-1" role="group" aria-label="Filtrer par statut">
              {(([
                [null, 'Tous'], ['pending', 'En attente'], ['partial', 'Partiels'], ['paid', 'Soldés'],
                ...(kpi.counts.overpaid > 0 ? [['overpaid', 'Trop perçu']] : []),
              ]) as [FeeStatus | null, string][]).map(([st, label]) => {
                const active = statusFilter === st
                const isOver = st === 'overpaid'
                return (
                  <button
                    key={label}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setStatusFilter(st)}
                    className={clsx(
                      'px-2 py-0.5 rounded-full text-[11px] font-medium border transition-colors whitespace-nowrap shrink-0 focus:outline-none focus-visible:ring-2',
                      isOver ? 'focus-visible:ring-red-400' : 'focus-visible:ring-primary-400',
                      isOver
                        ? (active ? 'border-red-300 bg-red-100 text-red-700' : 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100')
                        : (active ? 'border-primary-300 bg-primary-50 text-primary-700' : 'border-warm-200 text-warm-700 bg-white hover:bg-warm-50'),
                    )}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>
          <ul className="flex-1 overflow-y-auto list-scroll divide-y divide-warm-50" aria-label="Familles">
            {worklist.length === 0 ? (
              <li className="px-3 py-3 text-xs text-warm-700 italic">Aucune famille.</li>
            ) : worklist.map(f => {
              const p = f.parent
              const name = `${p.tutor1_last_name.toUpperCase()} ${p.tutor1_first_name}`
              const active = selectedParentId === p.id
              const pct = f.totalDue > 0 ? Math.min(100, Math.round((f.netPercu / f.totalDue) * 100)) : (f.status === 'paid' ? 100 : 0)
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    aria-pressed={active}
                    onClick={() => { setSelectedParentId(p.id); setError(null); setSuccess(null); setAddingAdjustment(false) }}
                    className={clsx(
                      'w-full text-left px-3 py-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-400',
                      active ? 'bg-primary-50' : 'hover:bg-warm-50',
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className={clsx('w-2 h-2 rounded-full shrink-0', STATUS_DOT[f.status])} aria-hidden="true" />
                      <span className={clsx('text-xs font-medium truncate flex-1', active ? 'text-primary-700' : 'text-secondary-700')}>{name}</span>
                      <span className={clsx('text-xs tabular-nums whitespace-nowrap', f.status === 'overpaid' ? 'text-red-600 font-medium' : 'text-warm-700')}>
                        {f.status === 'paid' ? 'Soldé'
                          : f.status === 'overpaid' ? `+ ${fmtEur(Math.abs(f.remaining))}`
                          : fmtEur(Math.max(0, f.remaining))}
                      </span>
                    </div>
                    <div className="mt-1 h-1 rounded-full bg-warm-100 overflow-hidden">
                      <div className={clsx('h-full rounded-full', STATUS_BAR[f.status])} style={{ width: `${pct}%` }} />
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        </aside>

        {/* Détail de la famille sélectionnée */}
        <div className="flex-1 min-w-0 overflow-y-auto list-scroll space-y-3">

      {!selectedParent && (
        <div className="h-full flex flex-col items-center justify-center gap-2 text-center py-20">
          <p className="text-sm text-warm-700">Sélectionnez une famille dans la liste pour gérer son règlement.</p>
          <p className="text-xs text-warm-700">Filtrez par statut avec les compteurs ci-dessus.</p>
        </div>
      )}

      {selectedParent && (<>
        {/* En-tete : quelle famille (calque de la fiche parent) */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs flex-shrink-0 select-none bg-warm-100 text-warm-700 ring-1 ring-warm-200">
            {`${(selectedParent.tutor1_last_name[0] ?? '').toUpperCase()}${(selectedParent.tutor1_first_name[0] ?? '').toUpperCase()}`}
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-bold text-secondary-800 leading-tight truncate">
              {selectedParent.tutor1_last_name.toUpperCase()} {selectedParent.tutor1_first_name}
              {selectedParent.tutor2_last_name && (
                <span className="text-warm-700 font-medium"> &amp; {selectedParent.tutor2_last_name.toUpperCase()} {selectedParent.tutor2_first_name}</span>
              )}
            </h1>
            <div className="flex items-center gap-2 text-xs mt-0.5 flex-wrap">
              {selectedParent.situation_familiale
                ? <span className="text-warm-700">{SITUATION_LABELS[selectedParent.situation_familiale] ?? selectedParent.situation_familiale}</span>
                : <span className="text-warm-700 italic">Situation non renseignée</span>}
              <span className={clsx('font-bold uppercase text-[10px] px-2 py-0.5 rounded-full', STATUS_COLORS[derivedStatus])}>
                {STATUS_LABELS[derivedStatus]}
              </span>
            </div>
          </div>

          {/* Actions comptable (cablees au lot 2 : attestation + relance) */}
          <div className="ml-auto flex items-center gap-2 shrink-0">
            {(derivedStatus === 'pending' || derivedStatus === 'partial') && totalDue > 0 && (
              <FloatButton type="button" variant="secondary" onClick={openRelance}>Relancer</FloatButton>
            )}
            {derivedStatus === 'paid' && totalDue > 0 && (
              <FloatButton type="button" variant="submit" onClick={issueAttestation} loading={attestSending}>Attestation</FloatButton>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 items-start">

          {/* ── Colonne gauche ── */}
          <div className="space-y-4">

            {/* Récapitulatif famille */}
            <div className="card overflow-hidden">
              <div className="px-4 h-9 bg-warm-50/60 border-b border-warm-100 flex items-center">
                <h3 className="text-xs font-bold text-warm-700 uppercase tracking-widest">Récapitulatif famille</h3>
              </div>
              <table className="w-full text-left" aria-label="Récapitulatif famille">
                <thead>
                  <tr className="border-b border-warm-100 bg-warm-50/30">
                    <th className="px-2 py-1.5 text-xs font-semibold text-warm-700 uppercase tracking-wider">Élève</th>
                    <th className="px-2 py-1.5 text-xs font-semibold text-warm-700 uppercase tracking-wider">Classe</th>
                    <th className="px-2 py-1.5 text-xs font-semibold text-warm-700 uppercase tracking-wider text-right">Cotisation</th>
                    <th className="px-2 py-1.5 text-xs font-semibold text-warm-700 uppercase tracking-wider text-right">Frais</th>
                    <th className="px-2 py-1.5 text-xs font-semibold text-warm-700 uppercase tracking-wider text-right">Réduc.</th>
                    <th className="px-2 py-1.5 text-xs font-semibold text-warm-700 uppercase tracking-wider text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedParent.students.map(s => (
                    <tr key={s.id} className="border-b border-warm-50">
                      <td className="px-2 py-1.5 text-xs font-medium text-secondary-800 whitespace-nowrap">{s.last_name.toUpperCase()} {s.first_name}</td>
                      <td className="px-2 py-1.5 text-xs text-secondary-600">
                        {s.class_tooltip ? (
                          <Tooltip content={<span className="whitespace-nowrap">{s.class_tooltip}</span>} maxWidth="max-w-none">
                            <span className="cursor-default underline decoration-dotted underline-offset-2">
                              {s.class_name}
                            </span>
                          </Tooltip>
                        ) : (
                          <span className="cursor-default">{s.class_name}</span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-xs text-secondary-700 text-right tabular-nums">{fmtEur(s.cotisation_amount)}</td>
                      <td className="px-2 py-1.5 text-xs text-secondary-700 text-right tabular-nums">
                        {s.registration_fee > 0 ? fmtEur(s.registration_fee) : <span className="text-warm-700">·</span>}
                      </td>
                      <td className="px-2 py-1.5 text-xs text-right tabular-nums">
                        {s.sibling_discount > 0
                          ? <span className="text-primary-600">-{fmtEur(s.sibling_discount)}</span>
                          : <span className="text-warm-700">·</span>}
                      </td>
                      <td className="px-2 py-1.5 text-xs font-semibold text-secondary-800 text-right tabular-nums">{fmtEur(s.total)}</td>
                    </tr>
                  ))}
                  {selectedParent.adultLines.length > 0 && (
                    <>
                      <tr className="bg-violet-50/40 border-b border-warm-100">
                        <td colSpan={6} className="px-2 py-1.5 text-[10px] font-bold text-violet-500 uppercase tracking-widest">Cours adultes</td>
                      </tr>
                      {selectedParent.adultLines.map(a => (
                        <tr key={a.id} className="border-b border-warm-50">
                          <td className="px-2 py-1.5 text-xs font-medium text-secondary-800 whitespace-nowrap">{a.tutor_label}</td>
                          <td className="px-2 py-1.5 text-xs text-secondary-600">
                            {a.class_tooltip ? (
                              <Tooltip content={<span className="whitespace-nowrap">{a.class_tooltip}</span>} maxWidth="max-w-none">
                                <span className="cursor-default underline decoration-dotted underline-offset-2">
                                  {a.class_name}
                                </span>
                              </Tooltip>
                            ) : (
                              <span className="cursor-default">{a.class_name}</span>
                            )}
                          </td>
                          <td className="px-2 py-1.5 text-xs text-secondary-700 text-right tabular-nums">{fmtEur(a.cotisation_amount)}</td>
                          <td className="px-2 py-1.5 text-xs text-secondary-700 text-right tabular-nums">
                            {a.registration_fee > 0 ? fmtEur(a.registration_fee) : <span className="text-warm-700">·</span>}
                          </td>
                          <td className="px-2 py-1.5 text-xs text-right tabular-nums"><span className="text-warm-700">·</span></td>
                          <td className="px-2 py-1.5 text-xs font-semibold text-secondary-800 text-right tabular-nums">{fmtEur(a.total)}</td>
                        </tr>
                      ))}
                    </>
                  )}
                </tbody>
                <tfoot>
                  <tr className="bg-warm-50/60">
                    <td colSpan={3} className="px-3 py-2.5 text-xs text-warm-700 text-left">
                      {selectedParent.maxInstallments > 0 && `Échéances max : ${selectedParent.maxInstallments}`}
                    </td>
                    <td colSpan={2} className="px-3 py-2.5 text-sm font-semibold text-secondary-700 text-right">Total cotisations</td>
                    <td className="px-3 py-2.5 text-sm font-bold text-secondary-800 text-right tabular-nums">{fmtEur(subtotal)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Communication comptable — historique des envois (relance / attestation) */}
            <div className="card overflow-hidden">
              <div className="px-4 h-9 bg-warm-50/60 border-b border-warm-100 flex items-center">
                <h3 className="text-xs font-bold text-warm-700 uppercase tracking-widest">Communication comptable</h3>
              </div>
              {familyComms.length === 0 ? (
                <div className="px-4 py-3 text-center">
                  <p className="text-sm text-warm-700">Aucune communication.</p>
                </div>
              ) : (
                <ul className="divide-y divide-warm-50" aria-label="Communications comptables">
                  {familyComms.map(c => (
                    <li key={c.id} className="px-3 py-1.5 flex items-center gap-2 text-xs">
                      <span className="text-warm-700 whitespace-nowrap tabular-nums">{fmtDate(c.sent_at)}</span>
                      <span className={clsx('px-1.5 py-0.5 rounded-full text-[10px] font-semibold uppercase shrink-0',
                        c.type === 'relance' ? 'bg-orange-50 text-orange-700' : 'bg-primary-50 text-primary-700')}>
                        {c.type === 'relance' ? 'Relance' : 'Attestation'}
                      </span>
                      <span className="flex-1 truncate text-secondary-700">{c.subject}</span>
                      {c.status === 'failed' && <span className="text-red-500 shrink-0">Échec</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>

          </div>

          {/* ── Colonne droite : Paiements ── */}
          <div className="space-y-3">
          <div className="card overflow-hidden">
            <div className="px-4 h-9 bg-warm-50/60 border-b border-warm-100 relative flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold text-warm-700 uppercase tracking-widest">Paiements</h3>
                {selectedParent.maxInstallments > 0 && payments.length > 0 && (
                  <Tooltip content={<span className="whitespace-nowrap">{payments.length} échéance{payments.length > 1 ? 's' : ''} enregistrée{payments.length > 1 ? 's' : ''} sur {selectedParent.maxInstallments} autorisée{selectedParent.maxInstallments > 1 ? 's' : ''} · maximum des types de cotisation de la famille</span>} maxWidth="max-w-none">
                    <span className={clsx('px-1.5 py-0.5 rounded-full text-[10px] font-semibold tabular-nums cursor-default',
                      payments.length > selectedParent.maxInstallments ? 'bg-orange-100 text-orange-700' : 'bg-primary-50 text-primary-700')}>
                      {payments.length} échéance{payments.length > 1 ? 's' : ''} / {selectedParent.maxInstallments}
                    </span>
                  </Tooltip>
                )}
              </div>
              {payments.length > 0 && (
                <span className="absolute left-1/2 -translate-x-1/2 text-xs font-semibold text-secondary-700 tabular-nums">
                  Total : {fmtEur(totalPaid)}
                </span>
              )}
              <FloatButton
                variant="submit"
                type="button"
                onClick={() => { setPaymentModalOpen(true); setError(null); setSuccess(null) }}
                disabled={totalDue <= 0}
                className="!py-1 !px-2.5 !text-xs"
              >
                Ajouter
              </FloatButton>
            </div>

            {payments.length > 0 ? (
              <table className="w-full text-left" aria-label="Paiements enregistrés">
                <thead>
                  <tr className="border-b border-warm-100 bg-warm-50/30">
                    <th className="px-2 py-1.5 text-xs font-semibold text-warm-700 uppercase tracking-wider text-center w-8">#</th>
                    <th className="px-2 py-1.5 text-xs font-semibold text-warm-700 uppercase tracking-wider">Date</th>
                    <th className="px-2 py-1.5 text-xs font-semibold text-warm-700 uppercase tracking-wider text-right">Montant</th>
                    <th className="px-2 py-1.5 text-xs font-semibold text-warm-700 uppercase tracking-wider">Moyen</th>
                    <th className="px-2 py-1.5 text-xs font-semibold text-warm-700 uppercase tracking-wider">Référence</th>
                    <th className="px-2 py-1.5 text-xs font-semibold text-warm-700 uppercase tracking-wider">N° Reçu</th>
                    <th className="px-1 py-2 w-6"></th>
                    <th className="px-1 py-2 w-14"></th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p, idx) => {
                    const ref = p.payment_reference as any
                    // La colonne « Moyen » donne deja le contexte : pas de prefixe.
                    let refLabel = ''
                    if (ref?.check_number) refLabel = ref.check_number
                    else if (ref?.transaction_id) refLabel = ref.transaction_id
                    else if (ref?.reference) refLabel = ref.reference
                    return (
                      <tr key={p.id} className="border-b border-warm-50 hover:bg-warm-50/40">
                        <td className={clsx('px-2 py-1.5 text-xs text-center tabular-nums',
                          selectedParent.maxInstallments > 0 && idx + 1 > selectedParent.maxInstallments ? 'text-orange-600 font-bold' : 'text-warm-700')}>
                          {idx + 1}
                        </td>
                        <td className="px-2 py-1.5 text-xs text-secondary-700">{p.paid_date ? fmtDate(p.paid_date) : '·'}</td>
                        <td className="px-2 py-1.5 text-xs font-semibold text-secondary-800 text-right tabular-nums">{fmtEur(p.amount_paid)}</td>
                        <td className="px-2 py-1.5 text-xs text-secondary-600">{p.payment_method ? (METHOD_LABELS[p.payment_method] ?? p.payment_method) : '·'}</td>
                        <td className="px-2 py-1.5 text-xs text-secondary-500 font-mono">
                          {refLabel ? (
                            <Tooltip content={<span className="whitespace-nowrap">{refLabel}</span>} maxWidth="max-w-none">
                              <span className="block max-w-[90px] truncate cursor-default">{refLabel}</span>
                            </Tooltip>
                          ) : <span className="text-warm-700">·</span>}
                        </td>
                        <td className="px-2 py-1.5 text-xs text-secondary-500 whitespace-nowrap">{p.receipt_number || <span className="text-warm-700">·</span>}</td>
                        <td className="px-2 py-1.5 text-center">
                          {p.notes && (
                            <Tooltip content={p.notes}>
                              <span className="inline-flex text-warm-700 hover:text-secondary-600 cursor-help">
                                <MessageSquareText size={14} />
                              </span>
                            </Tooltip>
                          )}
                        </td>
                        <td className="px-2 py-1.5">
                          <span className="flex items-center gap-1">
                            <Tooltip content="Modifier">
                              <button
                                type="button"
                                aria-label="Modifier le paiement"
                                onClick={() => { setEditingPayment(p); setPaymentModalOpen(true); setError(null); setSuccess(null) }}
                                disabled={saving}
                                className="p-1 text-warm-700 hover:text-primary-500 hover:bg-primary-50 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                              >
                                <Pencil size={14} aria-hidden="true" />
                              </button>
                            </Tooltip>
                            <Tooltip content="Supprimer">
                              <button
                                type="button"
                                aria-label="Supprimer le paiement"
                                onClick={() => setDeletePaymentTarget(p)}
                                disabled={saving}
                                className="p-1 text-warm-700 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                              >
                                <Trash2 size={14} aria-hidden="true" />
                              </button>
                            </Tooltip>
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            ) : (
              <div className="flex flex-col items-center justify-center py-3 text-center gap-1">
                <AlertTriangle size={20} className={derivedStatus === 'pending' ? 'text-red-500' : 'text-warm-700'} aria-hidden="true" />
                <p className={clsx('text-sm', derivedStatus === 'pending' ? 'text-red-500 font-medium' : 'text-warm-700')}>Aucun paiement enregistré.</p>
                {totalDue <= 0 && (
                  <p className="text-xs text-amber-600 flex items-center gap-1">
                    <AlertTriangle size={12} aria-hidden="true" /> Complétez d&apos;abord le récapitulatif pour calculer le total dû.
                  </p>
                )}
              </div>
            )}

          {/* Réductions & Avoirs — meme carte que Paiements (section separee) */}
            <div className="px-4 h-9 mt-2 bg-warm-50/60 border-y border-warm-100 relative flex items-center justify-between">
              <h3 className="text-xs font-bold text-warm-700 uppercase tracking-widest">Réductions & Avoirs</h3>
              {adjustmentsTotal !== 0 && (
                <span className="absolute left-1/2 -translate-x-1/2 text-xs font-semibold text-secondary-700 tabular-nums">
                  Total : {fmtEur(Math.abs(adjustmentsTotal))}
                </span>
              )}
              <FloatButton
                variant="submit"
                type="button"
                onClick={() => {
                  setAdjForm({ type: '', label: '', amount: '', date: new Date().toISOString().slice(0, 10) })
                  setAddingAdjustment(true); setError(null); setSuccess(null)
                }}
                className="!py-1 !px-2.5 !text-xs"
              >
                Ajouter
              </FloatButton>
            </div>

            {adjustments.length > 0 ? (
              <table className="w-full text-left" aria-label="Réductions et avoirs">
                <thead>
                  <tr className="border-b border-warm-100 bg-warm-50/30">
                    <th className="px-2 py-1.5 text-xs font-semibold text-warm-700 uppercase tracking-wider">Date</th>
                    <th className="px-2 py-1.5 text-xs font-semibold text-warm-700 uppercase tracking-wider">Type</th>
                    <th className="px-2 py-1.5 text-xs font-semibold text-warm-700 uppercase tracking-wider">Motif</th>
                    <th className="px-2 py-1.5 text-xs font-semibold text-warm-700 uppercase tracking-wider text-right">Montant</th>
                    <th className="px-3 py-2 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {adjustments.map(a => (
                    <tr key={a.id} className="border-b border-warm-50">
                      <td className="px-2 py-1.5 text-xs text-secondary-600">{fmtDate(a.adjustment_date)}</td>
                      <td className="px-2 py-1.5">
                        <span className={clsx('px-2 py-0.5 rounded-full text-xs font-medium',
                          a.adjustment_type === 'reduction' ? 'bg-blue-50 text-blue-700' : a.adjustment_type === 'remboursement' ? 'bg-orange-50 text-orange-700' : 'bg-purple-50 text-purple-700'
                        )}>
                          {a.adjustment_type === 'reduction' ? 'Réduction' : a.adjustment_type === 'remboursement' ? 'Remboursement' : 'Avoir'}
                        </span>
                      </td>
                      <td className="px-2 py-1.5 text-xs text-secondary-700">{a.label}</td>
                      <td className="px-2 py-1.5 text-xs font-medium text-warm-700 text-right tabular-nums">- {fmtEur(Math.abs(a.amount))}</td>
                      <td className="px-2 py-1.5">
                        <Tooltip content="Supprimer">
                          <button type="button" aria-label="Supprimer la réduction" onClick={() => setDeleteAdjTarget(a)} disabled={saving} className="p-1 text-warm-700 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400">
                            <Trash2 size={14} aria-hidden="true" />
                          </button>
                        </Tooltip>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : !addingAdjustment && (
              <div className="px-4 py-3 text-center">
                <p className="text-sm text-warm-700">Aucune réduction ni avoir.</p>
              </div>
            )}
          </div>

          </div>

        </div>

        {/* Totaux en bas de page */}
        <div className="grid grid-cols-3 gap-3">
          <div className="card p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-secondary-700">{'TOTAL D\u00DB'}</span>
              <div className="text-right">
                {adjustmentsTotal !== 0 && (
                  <span className="text-xs text-warm-700 mr-1">
                    {fmtEur(subtotal)} - {fmtEur(Math.abs(adjustmentsTotal))} =
                  </span>
                )}
                <span className="text-base font-bold text-secondary-800 tabular-nums">{fmtEur(totalDue)}</span>
              </div>
            </div>
          </div>
          <div className="card p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-secondary-700">{'TOTAL PER\u00C7U'}</span>
              <span className="text-base font-bold text-secondary-800 tabular-nums">{fmtEur(netPercu)}</span>
            </div>
          </div>
          <div className="card p-3">
            <div className="flex items-center justify-between">
              <span className={clsx('text-xs font-semibold', derivedStatus === 'overpaid' ? 'text-red-600' : 'text-secondary-700')}>
                {derivedStatus === 'overpaid' ? 'TROP PERÇU' : 'RESTE'}
              </span>
              <span className={clsx('text-base font-bold tabular-nums',
                derivedStatus === 'overpaid' ? 'text-red-600' : remaining > 0 ? 'text-orange-700' : 'text-primary-600')}>
                {derivedStatus === 'overpaid' ? fmtEur(Math.abs(remaining)) : fmtEur(Math.max(0, remaining))}
              </span>
            </div>
          </div>
        </div>
      </>)}

        </div>{/* detail pane */}
      </div>{/* flex worklist + detail */}

      {/* Modale paiement */}
      {paymentModalOpen && selectedParent && (
        <PaymentModal
          familyFeeId={currentFee?.id ?? null}
          parentId={selectedParentId}
          schoolYearId={currentYear.id}
          subtotal={subtotal}
          totalDue={totalDue}
          remaining={editingPayment ? remaining + editingPayment.amount_paid : remaining}
          paymentNumber={editingPayment ? editingPayment.installment_number : payments.length + 1}
          editingPayment={editingPayment}
          onEnsureFamilyFee={ensureFamilyFee}
          onClose={() => { setPaymentModalOpen(false); setEditingPayment(null) }}
          onSaved={handlePaymentSaved}
        />
      )}

      {/* Modale de relance d'impayes (modele pre-rempli, editable).
          Fermeture X / Annuler uniquement (pas de fond ni Echap : evite la perte de saisie). */}
      {relanceOpen && selectedParent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div role="dialog" aria-modal="true" aria-labelledby="relance-modal-title" className="bg-white rounded-2xl shadow-2xl w-full max-w-lg animate-fade-in">
            <div className="flex items-center justify-between px-5 py-4 border-b border-warm-100">
              <div>
                <h2 id="relance-modal-title" className="text-base font-bold text-secondary-800">Relance d'impayé</h2>
                <p className="text-xs text-warm-700 mt-0.5">
                  Aux deux tuteurs du foyer · {selectedParent.tutor1_last_name.toUpperCase()} {selectedParent.tutor1_first_name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRelanceOpen(false)}
                aria-label="Fermer"
                className="p-1.5 text-warm-700 hover:text-secondary-700 hover:bg-warm-100 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <FloatInput
                label="Objet"
                type="text"
                required
                aria-required="true"
                value={relanceSubject}
                onChange={e => setRelanceSubject(e.target.value)}
              />
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-warm-700 uppercase tracking-widest">Message</label>
                <Suspense fallback={<div className="h-48 bg-warm-50 rounded-lg animate-pulse" />}>
                  <RichTextEditor content={relanceBody} onChange={setRelanceBody} />
                </Suspense>
              </div>
              <div className="flex items-center justify-end gap-2">
                <FloatButton variant="secondary" type="button" onClick={() => setRelanceOpen(false)} disabled={relanceSending}>Annuler</FloatButton>
                <FloatButton
                  variant="submit"
                  type="button"
                  onClick={submitRelance}
                  loading={relanceSending}
                  disabled={relanceSending || !relanceSubject.trim() || !relanceBody.trim()}
                >
                  Envoyer
                </FloatButton>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation de suppression d'un paiement */}
      <ConfirmModal
        open={!!deletePaymentTarget}
        title="Supprimer ce paiement ?"
        confirmLabel="Supprimer"
        cancelLabel="Annuler"
        variant="danger"
        confirmColor="red"
        onConfirm={() => deletePaymentTarget && removePayment(deletePaymentTarget)}
        onCancel={() => setDeletePaymentTarget(null)}
      >
        {deletePaymentTarget && (
          <p className="text-xs text-warm-700">
            {deletePaymentTarget.paid_date ? fmtDate(deletePaymentTarget.paid_date) : '·'}
            {' · '}<strong className="text-warm-700">{fmtEur(deletePaymentTarget.amount_paid)}</strong>
            {deletePaymentTarget.payment_method && ` · ${METHOD_LABELS[deletePaymentTarget.payment_method] ?? deletePaymentTarget.payment_method}`}
            {deletePaymentTarget.receipt_number && ` · ${deletePaymentTarget.receipt_number}`}
          </p>
        )}
      </ConfirmModal>

      {/* Confirmation de suppression d'une reduction / avoir */}
      <ConfirmModal
        open={!!deleteAdjTarget}
        title="Supprimer cette ligne comptable ?"
        confirmLabel="Supprimer"
        cancelLabel="Annuler"
        variant="danger"
        confirmColor="red"
        onConfirm={() => deleteAdjTarget && removeAdjustment(deleteAdjTarget)}
        onCancel={() => setDeleteAdjTarget(null)}
      >
        {deleteAdjTarget && (
          <p className="text-xs text-warm-700">
            {deleteAdjTarget.adjustment_type === 'reduction' ? 'Réduction' : deleteAdjTarget.adjustment_type === 'remboursement' ? 'Remboursement' : 'Avoir'}
            {' · '}{deleteAdjTarget.label}{' · '}<strong className="text-warm-700">{fmtEur(Math.abs(deleteAdjTarget.amount))}</strong>
          </p>
        )}
      </ConfirmModal>

      {/* Modale reduction / avoir — meme facture que la modale paiement.
          Fermeture X / Annuler uniquement (pas de fond ni Echap : evite la perte de saisie). */}
      {addingAdjustment && selectedParent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div role="dialog" aria-modal="true" aria-labelledby="adj-modal-title" className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-fade-in">
            <div className="flex items-center justify-between px-5 py-4 border-b border-warm-100">
              <h2 id="adj-modal-title" className="text-base font-bold text-secondary-800">Réduction ou avoir</h2>
              <button
                type="button"
                onClick={() => setAddingAdjustment(false)}
                aria-label="Fermer"
                className="p-1.5 text-warm-700 hover:text-secondary-700 hover:bg-warm-100 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <FloatInput
                  label="Date"
                  type="date"
                  required
                  aria-required="true"
                  value={adjForm.date}
                  onChange={e => setAdjForm(f => ({ ...f, date: e.target.value }))}
                />
                <FloatSelect
                  label="Type"
                  required
                  aria-required="true"
                  value={adjForm.type}
                  onChange={e => setAdjForm(f => ({ ...f, type: e.target.value as AdjustmentType }))}
                >
                  <option value="" disabled hidden></option>
                  <option value="reduction">Réduction</option>
                  <option value="avoir">Avoir</option>
                  <option value="remboursement">Remboursement</option>
                </FloatSelect>
              </div>
              <FloatInput
                label="Motif"
                type="text"
                required
                aria-required="true"
                placeholder="Famille nombreuse..."
                value={adjForm.label}
                onChange={e => setAdjForm(f => ({ ...f, label: e.target.value }))}
              />
              <FloatInput
                label="Montant (€)"
                type="number"
                required
                aria-required="true"
                min="0"
                step="any"
                placeholder="50"
                value={adjForm.amount}
                onChange={e => setAdjForm(f => ({ ...f, amount: e.target.value }))}
              />

              <div className="flex items-center gap-2 pt-1">
                <span className="text-xs text-red-400"><span className="font-semibold">*</span> obligatoire</span>
                <div className="flex-1" />
                <FloatButton variant="secondary" type="button" onClick={() => setAddingAdjustment(false)} disabled={saving}>Annuler</FloatButton>
                <FloatButton
                  variant="submit"
                  type="button"
                  onClick={addAdjustment}
                  disabled={saving || !adjForm.type || !adjForm.label.trim() || !(parseFloat(adjForm.amount) > 0) || !adjForm.date}
                >
                  Valider
                </FloatButton>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
