'use client'

import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { Plus, Trash2, Pencil, Check, AlertTriangle, CheckCircle2, MessageSquareText } from 'lucide-react'
import { clsx } from 'clsx'
import { createClient } from '@/lib/supabase/client'
import PaymentModal from './PaymentModal'
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
  students: StudentLine[]
  adultLines: AdultLine[]
}

interface Props {
  currentYear: { id: string; label: string }
  parents: any[]
  adultEnrollments: any[]
  familyFees: any[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtEur(n: number) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency', currency: 'EUR',
    minimumFractionDigits: 0, maximumFractionDigits: 2,
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

const STATUS_COLORS: Record<FeeStatus, string> = {
  pending:  'bg-amber-100 text-amber-800',
  partial:  'bg-orange-100 text-orange-800',
  paid:     'bg-green-100 text-green-800',
  overpaid: 'bg-red-100 text-red-800',
}

const METHOD_LABELS: Record<string, string> = {
  cash: 'Especes', check: 'Cheque', card: 'CB', transfer: 'Virement', online: 'En ligne',
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

    // Pré-calcul : nombre d'enfants par cotisation_type_id (pour règle même type)
    const countByType: Record<string, number> = {}
    for (const s of studentsRaw) {
      const ct = (s.enrollments ?? [])[0]?.classes?.cotisation_types
      if (ct?.id) countByType[ct.id] = (countByType[ct.id] ?? 0) + 1
    }

    // Compteurs d'index pour chaque type (pour savoir si c'est le 1er, 2e... du type)
    const indexByType: Record<string, number> = {}
    let globalIndex = 0

    const students: StudentLine[] = studentsRaw.map((s: any) => {
      const enrollment = (s.enrollments ?? [])[0]
      const cls = enrollment?.classes
      const ct = cls?.cotisation_types
      const ctId = ct?.id ?? ''
      const sameTypeOnly: boolean = ct?.sibling_discount_same_type ?? false

      // Index de cet enfant dans son groupe (même type ou global)
      let discount = 0
      if (ct?.sibling_discount > 0) {
        if (sameTypeOnly) {
          // Réduction uniquement si un autre enfant du même type précède
          const typeIdx = indexByType[ctId] ?? 0
          if (typeIdx > 0) discount = ct.sibling_discount
          indexByType[ctId] = typeIdx + 1
        } else {
          // Tous types confondus : réduction dès le 2e enfant global
          if (globalIndex > 0) discount = ct.sibling_discount
        }
      } else {
        // Pas de remise configurée — on incrémente quand même les compteurs
        if (sameTypeOnly) {
          indexByType[ctId] = (indexByType[ctId] ?? 0) + 1
        }
      }
      globalIndex++

      const cotisation = ct?.amount ?? 0
      const regFee = ct?.registration_fee ?? 0

      const class_tooltip = buildClassTooltip(cls)

      return {
        id: s.id,
        first_name: s.first_name,
        last_name: s.last_name,
        class_name: cls?.name ?? '—',
        cotisation_label: ct?.label ?? '',
        class_tooltip,
        cotisation_amount: cotisation,
        registration_fee: regFee,
        sibling_discount: discount,
        total: cotisation + regFee - discount,
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
        class_name: cls?.name ?? '—',
        cotisation_label: ct?.label ?? '',
        class_tooltip: buildClassTooltip(cls),
        cotisation_amount: cotisation,
        registration_fee: regFee,
        total: cotisation + regFee,
      }
    })

    return {
      id: p.id,
      tutor1_last_name: p.tutor1_last_name,
      tutor1_first_name: p.tutor1_first_name,
      tutor2_last_name: p.tutor2_last_name ?? null,
      tutor2_first_name: p.tutor2_first_name ?? null,
      students,
      adultLines,
    }
  })
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function FinancementsClient({ currentYear, parents: rawParents, adultEnrollments, familyFees: initialFees }: Props) {
  const supabase = createClient()

  const parentOptions = useMemo(() => parseParents(rawParents, adultEnrollments), [rawParents, adultEnrollments])

  const [selectedParentId, setSelectedParentId] = useState<string>('')
  const [familyFees, setFamilyFees]             = useState<any[]>(initialFees)
  const familyFeesRef = useRef(familyFees)
  familyFeesRef.current = familyFees
  const [saving, setSaving]                     = useState(false)
  const [error, setError]                       = useState<string | null>(null)
  const [success, setSuccess]                   = useState<string | null>(null)
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [editingPayment, setEditingPayment]     = useState<FeeInstallment | null>(null)
  const [deleteStep, setDeleteStep]   = useState<{ id: string; step: 1 | 2 } | null>(null)

  // Auto-dismiss notifications
  useEffect(() => {
    if (!success) return
    const t = setTimeout(() => setSuccess(null), 4000)
    return () => clearTimeout(t)
  }, [success])

  useEffect(() => {
    if (!error) return
    const t = setTimeout(() => setError(null), 6000)
    return () => clearTimeout(t)
  }, [error])

  // Ajustements
  const [addingAdjustment, setAddingAdjustment] = useState(false)
  const [adjForm, setAdjForm] = useState({
    type: 'reduction' as AdjustmentType,
    label: '',
    amount: '',
    date: new Date().toISOString().slice(0, 10),
  })

  // ── Données dérivées ─────────────────────────────────────────────────────

  const selectedParent = parentOptions.find(p => p.id === selectedParentId)

  const currentFee = familyFees.find((f: any) => f.parent_id === selectedParentId) ?? null

  const studentsSubtotal = selectedParent
    ? selectedParent.students.reduce((acc, s) => acc + s.total, 0)
    : 0
  const adultsSubtotal = selectedParent
    ? selectedParent.adultLines.reduce((acc, a) => acc + a.total, 0)
    : 0
  const subtotal = studentsSubtotal + adultsSubtotal

  const adjustments: FeeAdjustment[] = (currentFee?.fee_adjustments ?? [])
    .sort((a: FeeAdjustment, b: FeeAdjustment) =>
      new Date(a.adjustment_date).getTime() - new Date(b.adjustment_date).getTime()
    )
  const adjustmentsTotal = adjustments.reduce((acc, a) => acc + a.amount, 0)
  const totalDue = subtotal + adjustmentsTotal

  const payments: FeeInstallment[] = (currentFee?.fee_installments ?? [])
    .sort((a: FeeInstallment, b: FeeInstallment) =>
      new Date(a.paid_date ?? a.created_at).getTime() - new Date(b.paid_date ?? b.created_at).getTime()
    )
  const totalPaid = payments.reduce((acc, p) => acc + p.amount_paid, 0)
  const remaining = totalDue - totalPaid

  const derivedStatus: FeeStatus =
    totalPaid > totalDue && totalDue > 0 ? 'overpaid'
    : totalDue <= 0    ? 'paid'
    : totalPaid >= totalDue ? 'paid'
    : totalPaid > 0  ? 'partial'
    : 'pending'

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
      setError(e.message ?? 'Erreur lors de la creation du dossier.')
      return null
    } finally {
      setSaving(false)
    }
  }, [currentFee, selectedParentId, currentYear.id, subtotal, supabase])

  // ── Ajustements ──────────────────────────────────────────────────────────

  const addAdjustment = async () => {
    const label = adjForm.label.trim()
    const amount = parseFloat(adjForm.amount)
    if (!label) { setError('Le motif est obligatoire.'); return }
    if (isNaN(amount) || amount >= 0) { setError('Le montant doit etre negatif (ex: -50).'); return }

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
          adjustment_type: adjForm.type,
          label,
          amount,
        })
        .select()
        .single()
      if (err) throw err

      const newAdjTotal = adjustmentsTotal + amount
      const newTotalDue = subtotal + newAdjTotal
      await supabase.from('family_fees').update({ adjustments_total: newAdjTotal, total_due: newTotalDue }).eq('id', feeId)

      setFamilyFees(prev => prev.map(f =>
        f.id === feeId
          ? { ...f, adjustments_total: newAdjTotal, total_due: newTotalDue, fee_adjustments: [...(f.fee_adjustments ?? []), data] }
          : f
      ))
      setAddingAdjustment(false)
      setAdjForm({ type: 'reduction', label: '', amount: '', date: new Date().toISOString().slice(0, 10) })
      setSuccess('Ajustement enregistre.')
    } catch (e: any) {
      setError(e.message ?? 'Erreur.')
    } finally {
      setSaving(false)
    }
  }

  const removeAdjustment = async (adj: FeeAdjustment) => {
    if (!currentFee) return
    setSaving(true)
    setError(null)
    try {
      const { error: err } = await supabase.from('fee_adjustments').delete().eq('id', adj.id)
      if (err) throw err
      const newAdjTotal = adjustmentsTotal - adj.amount
      const newTotalDue = subtotal + newAdjTotal
      await supabase.from('family_fees').update({ adjustments_total: newAdjTotal, total_due: newTotalDue }).eq('id', currentFee.id)
      setFamilyFees(prev => prev.map(f =>
        f.id === currentFee.id
          ? { ...f, adjustments_total: newAdjTotal, total_due: newTotalDue, fee_adjustments: (f.fee_adjustments ?? []).filter((a: any) => a.id !== adj.id) }
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
    let status: FeeStatus = 'pending'
    if (totalPaid > due && due > 0) status = 'overpaid'
    else if (totalPaid >= due && due > 0) status = 'paid'
    else if (totalPaid > 0) status = 'partial'

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
    } catch {
      // ignoré — le statut sera corrigé au prochain chargement
    }
  }

  const removePayment = async (payment: FeeInstallment) => {
    if (!currentFee) return
    if (!deleteStep || deleteStep.id !== payment.id) {
      setDeleteStep({ id: payment.id, step: 1 })
      return
    }
    if (deleteStep.step === 1) {
      setDeleteStep({ id: payment.id, step: 2 })
      return
    }
    setDeleteStep(null)
    setSaving(true)
    setError(null)
    try {
      const { error: err } = await supabase.from('fee_installments').delete().eq('id', payment.id)
      if (err) throw err

      const remaining2 = payments.filter(p => p.id !== payment.id)
      const newTotalPaid = remaining2.reduce((s, p) => s + p.amount_paid, 0)
      const due = currentFee.total_due
      let status: FeeStatus = 'pending'
      if (newTotalPaid > due && due > 0) status = 'overpaid'
      else if (newTotalPaid >= due && due > 0) status = 'paid'
      else if (newTotalPaid > 0) status = 'partial'

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

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">

      {/* Select parent + statut */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row sm:items-end gap-3">
          <div className="flex-1 space-y-1">
            <label className="text-xs font-semibold text-warm-500 uppercase tracking-wide">Parents / Tuteurs legaux</label>
            <select
              value={selectedParentId}
              onChange={e => {
                setSelectedParentId(e.target.value)
                setError(null)
                setSuccess(null)
                setAddingAdjustment(false)
              }}
              className="input text-sm"
            >
              <option value="">— Choisir un parent / tuteur —</option>
              {parentOptions.map(p => {
                const t1 = `${p.tutor1_last_name.toUpperCase()} ${p.tutor1_first_name}`
                const t2 = p.tutor2_last_name && p.tutor2_first_name
                  ? ` | ${p.tutor2_last_name.toUpperCase()} ${p.tutor2_first_name}`
                  : ''
                return (
                  <option key={p.id} value={p.id}>
                    {t1}{t2}
                  </option>
                )
              })}
            </select>
          </div>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{error}</div>
      )}
      {success && (
        <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
          <CheckCircle2 size={16} /> {success}
        </div>
      )}

      {selectedParent && (<>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">

          {/* ── Colonne gauche ── */}
          <div className="space-y-4">

            {/* Récapitulatif famille */}
            <div className="card overflow-hidden">
              <div className="px-4 py-2.5 bg-warm-50/60 border-b border-warm-100">
                <h3 className="text-xs font-bold text-warm-500 uppercase tracking-widest">Recapitulatif famille</h3>
              </div>
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-warm-100 bg-warm-50/30">
                    <th className="px-3 py-2 text-xs font-semibold text-warm-500 uppercase tracking-wider">Eleve</th>
                    <th className="px-3 py-2 text-xs font-semibold text-warm-500 uppercase tracking-wider">Classe</th>
                    <th className="px-3 py-2 text-xs font-semibold text-warm-500 uppercase tracking-wider text-right">Cotisation</th>
                    <th className="px-3 py-2 text-xs font-semibold text-warm-500 uppercase tracking-wider text-right">Frais</th>
                    <th className="px-3 py-2 text-xs font-semibold text-warm-500 uppercase tracking-wider text-right">Reduc.</th>
                    <th className="px-3 py-2 text-xs font-semibold text-warm-500 uppercase tracking-wider text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedParent.students.map(s => (
                    <tr key={s.id} className="border-b border-warm-50">
                      <td className="px-3 py-2 text-sm font-medium text-secondary-800">{s.last_name.toUpperCase()} {s.first_name}</td>
                      <td className="px-3 py-2 text-sm text-secondary-600">
                        <span
                          title={s.class_tooltip ?? undefined}
                          className={clsx('cursor-default', s.class_tooltip && 'underline decoration-dotted underline-offset-2')}
                        >
                          {s.class_name}
                        </span>
                        {s.cotisation_label && (
                          <span className="ml-1.5 text-[10px] font-medium bg-warm-100 text-warm-600 px-1.5 py-0.5 rounded-full">
                            {s.cotisation_label}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-sm text-secondary-700 text-right tabular-nums">{fmtEur(s.cotisation_amount)}</td>
                      <td className="px-3 py-2 text-sm text-secondary-700 text-right tabular-nums">
                        {s.registration_fee > 0 ? fmtEur(s.registration_fee) : <span className="text-warm-300">—</span>}
                      </td>
                      <td className="px-3 py-2 text-sm text-right tabular-nums">
                        {s.sibling_discount > 0
                          ? <span className="text-green-600">-{fmtEur(s.sibling_discount)}</span>
                          : <span className="text-warm-300">—</span>}
                      </td>
                      <td className="px-3 py-2 text-sm font-semibold text-secondary-800 text-right tabular-nums">{fmtEur(s.total)}</td>
                    </tr>
                  ))}
                  {selectedParent.adultLines.length > 0 && (
                    <>
                      <tr className="bg-violet-50/40 border-b border-warm-100">
                        <td colSpan={6} className="px-3 py-1.5 text-[10px] font-bold text-violet-500 uppercase tracking-widest">Cours adultes</td>
                      </tr>
                      {selectedParent.adultLines.map(a => (
                        <tr key={a.id} className="border-b border-warm-50">
                          <td className="px-3 py-2 text-sm font-medium text-secondary-800">{a.tutor_label}</td>
                          <td className="px-3 py-2 text-sm text-secondary-600">
                            <span
                              title={a.class_tooltip ?? undefined}
                              className={clsx('cursor-default', a.class_tooltip && 'underline decoration-dotted underline-offset-2')}
                            >
                              {a.class_name}
                            </span>
                            {a.cotisation_label && (
                              <span className="ml-1.5 text-[10px] font-medium bg-violet-100 text-violet-600 px-1.5 py-0.5 rounded-full">
                                {a.cotisation_label}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-sm text-secondary-700 text-right tabular-nums">{fmtEur(a.cotisation_amount)}</td>
                          <td className="px-3 py-2 text-sm text-secondary-700 text-right tabular-nums">
                            {a.registration_fee > 0 ? fmtEur(a.registration_fee) : <span className="text-warm-300">—</span>}
                          </td>
                          <td className="px-3 py-2 text-sm text-right tabular-nums"><span className="text-warm-300">—</span></td>
                          <td className="px-3 py-2 text-sm font-semibold text-secondary-800 text-right tabular-nums">{fmtEur(a.total)}</td>
                        </tr>
                      ))}
                    </>
                  )}
                </tbody>
                <tfoot>
                  <tr className="bg-warm-50/60">
                    <td colSpan={5} className="px-3 py-2.5 text-sm font-semibold text-secondary-700 text-right">Sous-total</td>
                    <td className="px-3 py-2.5 text-sm font-bold text-secondary-800 text-right tabular-nums">{fmtEur(subtotal)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Réductions & Avoirs */}
            <div className="card overflow-hidden">
              <div className="px-4 py-2.5 bg-warm-50/60 border-b border-warm-100 flex items-center justify-between">
                <h3 className="text-xs font-bold text-warm-500 uppercase tracking-widest">Reductions & Avoirs</h3>
                {!addingAdjustment && (
                  <button
                    onClick={() => { setAddingAdjustment(true); setError(null); setSuccess(null) }}
                    className="text-xs text-primary-600 hover:text-primary-800 font-medium flex items-center gap-1"
                  >
                    <Plus size={13} /> Ajouter
                  </button>
                )}
              </div>

              {addingAdjustment && (
                <div className="p-3 border-b border-warm-100 bg-primary-50/20 space-y-2">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div>
                      <label className="text-xs font-medium text-warm-500 mb-0.5 block">Date</label>
                      <input type="date" value={adjForm.date} onChange={e => setAdjForm(f => ({ ...f, date: e.target.value }))} className="input text-sm" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-warm-500 mb-0.5 block">Type</label>
                      <select value={adjForm.type} onChange={e => setAdjForm(f => ({ ...f, type: e.target.value as AdjustmentType }))} className="input text-sm">
                        <option value="reduction">Reduction</option>
                        <option value="avoir">Avoir</option>
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-xs font-medium text-warm-500 mb-0.5 block">Motif</label>
                      <input type="text" placeholder="Famille nombreuse..." value={adjForm.label} onChange={e => setAdjForm(f => ({ ...f, label: e.target.value }))} className="input text-sm" />
                    </div>
                  </div>
                  <div className="flex items-end gap-2">
                    <div className="w-36">
                      <label className="text-xs font-medium text-warm-500 mb-0.5 block">Montant (negatif)</label>
                      <div className="relative">
                        <input type="number" max="0" step="0.01" placeholder="-50" value={adjForm.amount} onChange={e => setAdjForm(f => ({ ...f, amount: e.target.value }))} className="input text-sm pr-8" />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-warm-400">EUR</span>
                      </div>
                    </div>
                    <button onClick={addAdjustment} disabled={saving} className="btn btn-primary text-sm flex items-center gap-1">
                      <Check size={14} /> Valider
                    </button>
                    <button onClick={() => setAddingAdjustment(false)} disabled={saving} className="btn btn-secondary text-sm">Annuler</button>
                  </div>
                </div>
              )}

              {adjustments.length > 0 ? (
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-warm-100 bg-warm-50/30">
                      <th className="px-3 py-2 text-xs font-semibold text-warm-500 uppercase tracking-wider">Date</th>
                      <th className="px-3 py-2 text-xs font-semibold text-warm-500 uppercase tracking-wider">Type</th>
                      <th className="px-3 py-2 text-xs font-semibold text-warm-500 uppercase tracking-wider">Motif</th>
                      <th className="px-3 py-2 text-xs font-semibold text-warm-500 uppercase tracking-wider text-right">Montant</th>
                      <th className="px-3 py-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {adjustments.map(a => (
                      <tr key={a.id} className="border-b border-warm-50">
                        <td className="px-3 py-2 text-sm text-secondary-600">{fmtDate(a.adjustment_date)}</td>
                        <td className="px-3 py-2">
                          <span className={clsx('px-2 py-0.5 rounded-full text-xs font-medium',
                            a.adjustment_type === 'reduction' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'
                          )}>
                            {a.adjustment_type === 'reduction' ? 'Reduction' : 'Avoir'}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-sm text-secondary-700">{a.label}</td>
                        <td className="px-3 py-2 text-sm font-medium text-green-600 text-right tabular-nums">{fmtEur(a.amount)}</td>
                        <td className="px-3 py-2">
                          <button onClick={() => removeAdjustment(a)} disabled={saving} className="p-1 text-warm-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Supprimer">
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-warm-50/60">
                      <td colSpan={3} className="px-3 py-2 text-sm font-semibold text-secondary-700 text-right">Total reductions</td>
                      <td className="px-3 py-2 text-sm font-bold text-green-700 text-right tabular-nums">{fmtEur(adjustmentsTotal)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              ) : !addingAdjustment && (
                <div className="px-4 py-6 text-center text-sm text-warm-400">Aucune reduction ni avoir.</div>
              )}
            </div>

          </div>

          {/* ── Colonne droite : Paiements ── */}
          <div className="space-y-3">
          <div className={clsx('card overflow-hidden flex flex-col border-2', {
            'border-green-200 bg-green-50/30': derivedStatus === 'paid',
            'border-orange-200 bg-orange-50/30': derivedStatus === 'partial',
            'border-amber-200 bg-amber-50/30': derivedStatus === 'pending',
            'border-red-200 bg-red-50/30': derivedStatus === 'overpaid',
          })}>
            <div className={clsx('px-4 py-2.5 border-b flex items-center justify-between', {
              'bg-green-50/60 border-green-100': derivedStatus === 'paid',
              'bg-orange-50/60 border-orange-100': derivedStatus === 'partial',
              'bg-amber-50/60 border-amber-100': derivedStatus === 'pending',
              'bg-red-50/60 border-red-100': derivedStatus === 'overpaid',
            })}>
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold text-warm-500 uppercase tracking-widest">Paiements</h3>
                <span className={clsx('px-2 py-0.5 rounded-full text-[10px] font-semibold', STATUS_COLORS[derivedStatus])}>
                  {STATUS_LABELS[derivedStatus]}
                </span>
              </div>
              <button
                onClick={() => { setPaymentModalOpen(true); setError(null); setSuccess(null) }}
                disabled={totalDue <= 0}
                className="btn btn-primary text-sm flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus size={14} /> Paiement
              </button>
            </div>

            {payments.length > 0 ? (
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-warm-100 bg-warm-50/30">
                    <th className="px-3 py-2 text-xs font-semibold text-warm-500 uppercase tracking-wider text-center w-8">#</th>
                    <th className="px-3 py-2 text-xs font-semibold text-warm-500 uppercase tracking-wider">Date</th>
                    <th className="px-3 py-2 text-xs font-semibold text-warm-500 uppercase tracking-wider text-right">Montant</th>
                    <th className="px-3 py-2 text-xs font-semibold text-warm-500 uppercase tracking-wider">Moyen</th>
                    <th className="px-3 py-2 text-xs font-semibold text-warm-500 uppercase tracking-wider">Reference</th>
                    <th className="px-3 py-2 text-xs font-semibold text-warm-500 uppercase tracking-wider">N° Recu</th>
                    <th className="px-3 py-2 w-8"></th>
                    <th className="px-3 py-2 w-16"></th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p, idx) => {
                    const ref = p.payment_reference as any
                    let refLabel = ''
                    if (ref?.check_number) refLabel = `CHQ ${ref.check_number}`
                    else if (ref?.transaction_id) refLabel = `TXN ${ref.transaction_id}`
                    else if (ref?.reference) refLabel = ref.reference
                    return (
                      <tr key={p.id} className="border-b border-warm-50 hover:bg-warm-50/40">
                        <td className="px-3 py-2 text-sm text-warm-400 text-center">{idx + 1}</td>
                        <td className="px-3 py-2 text-sm text-secondary-700">{p.paid_date ? fmtDate(p.paid_date) : '—'}</td>
                        <td className="px-3 py-2 text-sm font-semibold text-secondary-800 text-right tabular-nums">{fmtEur(p.amount_paid)}</td>
                        <td className="px-3 py-2 text-sm text-secondary-600">{p.payment_method ? (METHOD_LABELS[p.payment_method] ?? p.payment_method) : '—'}</td>
                        <td className="px-3 py-2 text-xs text-secondary-500 font-mono">{refLabel || <span className="text-warm-300">—</span>}</td>
                        <td className="px-3 py-2 text-xs text-secondary-500">{p.receipt_number || <span className="text-warm-300">—</span>}</td>
                        <td className="px-3 py-2 text-center">
                          {p.notes && (
                            <span title={p.notes} className="inline-flex text-warm-400 hover:text-secondary-600 cursor-help">
                              <MessageSquareText size={14} />
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {deleteStep?.id === p.id ? (
                            <span className="flex items-center gap-1">
                              <button
                                onClick={() => removePayment(p)}
                                disabled={saving}
                                className={`text-[11px] font-medium border rounded px-1.5 py-0.5 transition-colors ${
                                  deleteStep.step === 1
                                    ? 'text-orange-600 bg-orange-50 hover:bg-orange-100 border-orange-200'
                                    : 'text-red-600 bg-red-50 hover:bg-red-100 border-red-200'
                                }`}
                              >
                                {deleteStep.step === 1 ? 'Supprimer ?' : 'Confirmer'}
                              </button>
                              <button
                                onClick={() => setDeleteStep(null)}
                                disabled={saving}
                                className="text-[11px] font-medium text-warm-500 hover:text-secondary-700 hover:bg-warm-100 rounded px-1.5 py-0.5 transition-colors"
                              >
                                Annuler
                              </button>
                            </span>
                          ) : (
                            <span className="flex items-center gap-1">
                              <button
                                onClick={() => { setEditingPayment(p); setPaymentModalOpen(true); setError(null); setSuccess(null) }}
                                disabled={saving}
                                className="p-1 text-warm-400 hover:text-primary-500 hover:bg-primary-50 rounded-lg transition-colors"
                                title="Modifier"
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                onClick={() => removePayment(p)}
                                disabled={saving}
                                className="p-1 text-warm-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                title="Supprimer"
                              >
                                <Trash2 size={14} />
                              </button>
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center py-12 text-center gap-2">
                <AlertTriangle size={24} className="text-warm-300" />
                <p className="text-sm text-warm-400">Aucun paiement enregistré.</p>
                {totalDue > 0 && (
                  <p className="text-xs text-warm-400">Cliquez sur &quot;+ Paiement&quot; pour enregistrer un règlement.</p>
                )}
                {totalDue <= 0 && (
                  <p className="text-xs text-amber-600 flex items-center gap-1">
                    <AlertTriangle size={12} /> Completez d&apos;abord le recapitulatif pour calculer le total du.
                  </p>
                )}
              </div>
            )}
          </div>

          </div>

        </div>

        {/* Totaux en bas de page */}
        <div className="grid grid-cols-2 gap-3">
          <div className="card p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-secondary-700">{`TOTAL D\u00DB`}</span>
              <div className="text-right">
                {adjustmentsTotal !== 0 && (
                  <span className="text-xs text-warm-500 mr-1">
                    {fmtEur(subtotal)} {adjustmentsTotal < 0 ? '-' : '+'} {fmtEur(Math.abs(adjustmentsTotal))} =
                  </span>
                )}
                <span className="text-lg font-bold text-secondary-800">{fmtEur(totalDue)}</span>
              </div>
            </div>
          </div>
          <div className="card p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-secondary-700">{`TOTAL PER\u00C7U`}</span>
              <span className="text-lg font-bold text-secondary-800">{fmtEur(totalPaid)}</span>
            </div>
          </div>
        </div>
      </>)}

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
    </div>
  )
}
