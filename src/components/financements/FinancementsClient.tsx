'use client'

import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { Plus, Trash2, Pencil, AlertTriangle, CheckCircle2, MessageSquareText } from 'lucide-react'
import { clsx } from 'clsx'
import { createClient } from '@/lib/supabase/client'
import PaymentModal from './PaymentModal'
import Tooltip from '@/components/ui/Tooltip'
import { FloatInput, FloatButton, SearchField } from '@/components/ui/FloatFields'
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
  pending:  'bg-gray-100 text-gray-600',
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

export default function FinancementsClient({ currentYear, parents: rawParents, adultEnrollments, familyFees: initialFees, initialParentId }: Props & { initialParentId?: string }) {
  const supabase = createClient()

  const parentOptions = useMemo(() => parseParents(rawParents, adultEnrollments), [rawParents, adultEnrollments])

  const [selectedParentId, setSelectedParentId] = useState<string>(initialParentId ?? '')

  // Combobox parent
  const initParent = initialParentId ? parentOptions.find(p => p.id === initialParentId) : null
  const initLabel  = initParent
    ? `${initParent.tutor1_last_name.toUpperCase()} ${initParent.tutor1_first_name}${initParent.tutor2_last_name && initParent.tutor2_first_name ? ` | ${initParent.tutor2_last_name.toUpperCase()} ${initParent.tutor2_first_name}` : ''}`
    : ''
  const [parentSearch,   setParentSearch]   = useState(initLabel)
  const [parentDropOpen, setParentDropOpen] = useState(false)
  const parentDropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (parentDropRef.current && !parentDropRef.current.contains(e.target as Node)) {
        setParentDropOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])
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

  const filteredParents = useMemo(() => {
    const q = parentSearch.trim().toLowerCase()
    if (!q) return parentOptions
    return parentOptions.filter(p => {
      const t1 = `${p.tutor1_last_name} ${p.tutor1_first_name}`.toLowerCase()
      const t2 = p.tutor2_last_name && p.tutor2_first_name
        ? `${p.tutor2_last_name} ${p.tutor2_first_name}`.toLowerCase()
        : ''
      return t1.includes(q) || t2.includes(q)
    })
  }, [parentOptions, parentSearch])

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
  const totalDue = subtotal

  const payments: FeeInstallment[] = (currentFee?.fee_installments ?? [])
    .sort((a: FeeInstallment, b: FeeInstallment) =>
      new Date(a.paid_date ?? a.created_at).getTime() - new Date(b.paid_date ?? b.created_at).getTime()
    )
  const totalPaid = payments.reduce((acc, p) => acc + p.amount_paid, 0)
  const netPercu = totalPaid + adjustmentsTotal // paiements - |réductions|
  const remaining = totalDue - netPercu

  const derivedStatus: FeeStatus =
    netPercu > totalDue && totalDue > 0 ? 'overpaid'
    : totalDue <= 0    ? 'paid'
    : netPercu >= totalDue ? 'paid'
    : netPercu > 0  ? 'partial'
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
    const rawAmount = parseFloat(adjForm.amount)
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
          adjustment_type: adjForm.type,
          label,
          amount,
        })
        .select()
        .single()
      if (err) throw err

      const newAdjTotal = adjustmentsTotal + amount
      await supabase.from('family_fees').update({ adjustments_total: newAdjTotal, total_due: subtotal }).eq('id', feeId)

      setFamilyFees(prev => prev.map(f =>
        f.id === feeId
          ? { ...f, adjustments_total: newAdjTotal, total_due: subtotal, fee_adjustments: [...(f.fee_adjustments ?? []), data] }
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
      await supabase.from('family_fees').update({ adjustments_total: newAdjTotal, total_due: subtotal }).eq('id', currentFee.id)
      setFamilyFees(prev => prev.map(f =>
        f.id === currentFee.id
          ? { ...f, adjustments_total: newAdjTotal, total_due: subtotal, fee_adjustments: (f.fee_adjustments ?? []).filter((a: any) => a.id !== adj.id) }
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

      {/* Combobox parent */}
      <div className="card p-3">
        <div ref={parentDropRef} className="relative w-fit">
          <div className="text-xs font-semibold text-warm-500 uppercase tracking-wide mb-1">
            Parents / Tuteurs légaux
          </div>
          <SearchField
            value={parentSearch}
            onChange={v => {
              setParentSearch(v)
              setParentDropOpen(true)
              if (!v) { setSelectedParentId('') }
            }}
            onFocus={() => setParentDropOpen(true)}
            placeholder="Rechercher un parent…"
            className="w-[400px]"
          />
          {parentDropOpen && (
            <div className="absolute z-20 top-full mt-1 w-full bg-white border border-warm-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
              {filteredParents.length === 0 ? (
                <div className="px-3 py-2 text-sm text-warm-400">Aucun résultat</div>
              ) : filteredParents.map(p => {
                const t1 = `${p.tutor1_last_name.toUpperCase()} ${p.tutor1_first_name}`
                const t2 = p.tutor2_last_name && p.tutor2_first_name
                  ? ` | ${p.tutor2_last_name.toUpperCase()} ${p.tutor2_first_name}`
                  : ''
                const label = `${t1}${t2}`
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setSelectedParentId(p.id)
                      setParentSearch(label)
                      setParentDropOpen(false)
                      setError(null)
                      setSuccess(null)
                      setAddingAdjustment(false)
                    }}
                    className={clsx(
                      'w-full text-left px-3 py-2 text-sm hover:bg-warm-50 transition-colors',
                      selectedParentId === p.id && 'bg-primary-50 text-primary-700 font-medium',
                    )}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          )}
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

      {!selectedParent && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 animate-pulse">
          {/* Skeleton colonne gauche */}
          <div className="card overflow-hidden">
            <div className="px-4 py-2.5 bg-warm-50/60 border-b border-warm-100">
              <div className="h-3 w-40 bg-warm-200 rounded-full" />
            </div>
            <div className="p-4 space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex gap-3">
                  <div className="h-4 bg-warm-100 rounded-full flex-1" />
                  <div className="h-4 bg-warm-100 rounded-full w-20" />
                  <div className="h-4 bg-warm-100 rounded-full w-16" />
                  <div className="h-4 bg-warm-100 rounded-full w-16" />
                </div>
              ))}
              <div className="pt-2 border-t border-warm-100 flex justify-end">
                <div className="h-4 w-24 bg-warm-200 rounded-full" />
              </div>
            </div>
          </div>
          {/* Skeleton colonne droite */}
          <div className="space-y-3">
            <div className="card overflow-hidden">
              <div className="px-4 py-2.5 bg-warm-50/60 border-b border-warm-100 flex items-center justify-between">
                <div className="h-3 w-24 bg-warm-200 rounded-full" />
                <div className="h-7 w-20 bg-warm-100 rounded-lg" />
              </div>
              <div className="p-4 flex flex-col items-center gap-3 py-12">
                <div className="h-6 w-6 bg-warm-200 rounded-full" />
                <div className="h-3 w-40 bg-warm-100 rounded-full" />
              </div>
            </div>
            <div className="card overflow-hidden">
              <div className="px-4 py-2.5 bg-warm-50/60 border-b border-warm-100 flex items-center justify-between">
                <div className="h-3 w-36 bg-warm-200 rounded-full" />
                <div className="h-7 w-20 bg-warm-100 rounded-lg" />
              </div>
              <div className="px-4 py-6 flex justify-center">
                <div className="h-3 w-48 bg-warm-100 rounded-full" />
              </div>
            </div>
          </div>
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
                        {s.class_tooltip ? (
                          <Tooltip content={s.class_tooltip}>
                            <span className="cursor-default underline decoration-dotted underline-offset-2">
                              {s.class_name}
                            </span>
                          </Tooltip>
                        ) : (
                          <span className="cursor-default">{s.class_name}</span>
                        )}
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
                            {a.class_tooltip ? (
                              <Tooltip content={a.class_tooltip}>
                                <span className="cursor-default underline decoration-dotted underline-offset-2">
                                  {a.class_name}
                                </span>
                              </Tooltip>
                            ) : (
                              <span className="cursor-default">{a.class_name}</span>
                            )}
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

          </div>

          {/* ── Colonne droite : Paiements ── */}
          <div className="space-y-3">
          <div className={clsx('card overflow-hidden flex flex-col border-2', {
            'border-green-200 bg-green-50/30': derivedStatus === 'paid',
            'border-orange-200 bg-orange-50/30': derivedStatus === 'partial',
            'border-gray-200 bg-gray-50/30': derivedStatus === 'pending',
            'border-red-200 bg-red-50/30': derivedStatus === 'overpaid',
          })}>
            <div className={clsx('px-4 py-2.5 border-b flex items-center justify-between', {
              'bg-green-50/60 border-green-100': derivedStatus === 'paid',
              'bg-orange-50/60 border-orange-100': derivedStatus === 'partial',
              'bg-gray-50/60 border-gray-100': derivedStatus === 'pending',
              'bg-red-50/60 border-red-100': derivedStatus === 'overpaid',
            })}>
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold text-warm-500 uppercase tracking-widest">Paiements</h3>
                <span className={clsx('px-2 py-0.5 rounded-full text-[10px] font-semibold', STATUS_COLORS[derivedStatus])}>
                  {STATUS_LABELS[derivedStatus]}
                </span>
              </div>
              <FloatButton
                variant="submit"
                type="button"
                onClick={() => { setPaymentModalOpen(true); setError(null); setSuccess(null) }}
                disabled={totalDue <= 0}
              >
                <Plus size={14} /> Ajouter
              </FloatButton>
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
                            <Tooltip content={p.notes}>
                              <span className="inline-flex text-warm-400 hover:text-secondary-600 cursor-help">
                                <MessageSquareText size={14} />
                              </span>
                            </Tooltip>
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
                              <Tooltip content="Modifier">
                                <button
                                  onClick={() => { setEditingPayment(p); setPaymentModalOpen(true); setError(null); setSuccess(null) }}
                                  disabled={saving}
                                  className="p-1 text-warm-400 hover:text-primary-500 hover:bg-primary-50 rounded-lg transition-colors"
                                >
                                  <Pencil size={14} />
                                </button>
                              </Tooltip>
                              <Tooltip content="Supprimer">
                                <button
                                  onClick={() => removePayment(p)}
                                  disabled={saving}
                                  className="p-1 text-warm-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </Tooltip>
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
                <AlertTriangle size={24} className={derivedStatus === 'pending' ? 'text-red-500' : 'text-warm-300'} />
                <p className={clsx('text-sm', derivedStatus === 'pending' ? 'text-red-500 font-medium' : 'text-warm-400')}>Aucun paiement enregistré.</p>
                {totalDue > 0 && (
                  <p className="text-xs text-warm-400">Cliquez sur &quot;+ Ajouter&quot; pour enregistrer un règlement.</p>
                )}
                {totalDue <= 0 && (
                  <p className="text-xs text-amber-600 flex items-center gap-1">
                    <AlertTriangle size={12} /> Completez d&apos;abord le recapitulatif pour calculer le total du.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Réductions & Avoirs */}
          <div className="card overflow-hidden">
            <div className="px-4 py-2.5 bg-warm-50/60 border-b border-warm-100 flex items-center justify-between">
              <h3 className="text-xs font-bold text-warm-500 uppercase tracking-widest">Réductions & Avoirs</h3>
              {!addingAdjustment && (
                <FloatButton
                  variant="submit"
                  type="button"
                  onClick={() => { setAddingAdjustment(true); setError(null); setSuccess(null) }}
                >
                  <Plus size={13} /> Ajouter
                </FloatButton>
              )}
            </div>

            {addingAdjustment && (
              <div className="p-3 border-b border-warm-100 bg-primary-50/20 space-y-2">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <FloatInput
                    label="Date"
                    type="date"
                    value={adjForm.date}
                    onChange={e => setAdjForm(f => ({ ...f, date: e.target.value }))}
                    compact
                  />
                  <FloatSelect
                    label="Type"
                    value={adjForm.type}
                    onChange={e => setAdjForm(f => ({ ...f, type: e.target.value as AdjustmentType }))}
                    compact
                  >
                    <option value="reduction">Réduction</option>
                    <option value="avoir">Avoir</option>
                    <option value="remboursement">Remboursement</option>
                  </FloatSelect>
                  <div className="sm:col-span-2">
                    <FloatInput
                      label="Motif"
                      type="text"
                      placeholder="Famille nombreuse..."
                      value={adjForm.label}
                      onChange={e => setAdjForm(f => ({ ...f, label: e.target.value }))}
                      compact
                    />
                  </div>
                </div>
                <div className="flex items-end gap-2">
                  <div className="w-36">
                    <FloatInput
                      label="Montant (EUR)"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="50"
                      value={adjForm.amount}
                      onChange={e => setAdjForm(f => ({ ...f, amount: e.target.value }))}
                      compact
                    />
                  </div>
                  <FloatButton variant="submit" type="button" onClick={addAdjustment} disabled={saving}>Valider</FloatButton>
                  <FloatButton variant="secondary" type="button" onClick={() => setAddingAdjustment(false)} disabled={saving}>Annuler</FloatButton>
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
                          a.adjustment_type === 'reduction' ? 'bg-blue-50 text-blue-700' : a.adjustment_type === 'remboursement' ? 'bg-orange-50 text-orange-700' : 'bg-purple-50 text-purple-700'
                        )}>
                          {a.adjustment_type === 'reduction' ? 'Réduction' : a.adjustment_type === 'remboursement' ? 'Remboursement' : 'Avoir'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-sm text-secondary-700">{a.label}</td>
                      <td className="px-3 py-2 text-sm font-medium text-green-600 text-right tabular-nums">{fmtEur(Math.abs(a.amount))}</td>
                      <td className="px-3 py-2">
                        <Tooltip content="Supprimer">
                          <button onClick={() => removeAdjustment(a)} disabled={saving} className="p-1 text-warm-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                            <Trash2 size={14} />
                          </button>
                        </Tooltip>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-warm-50/60">
                    <td colSpan={3} className="px-3 py-2 text-sm font-semibold text-secondary-700 text-right">Total réductions</td>
                    <td className="px-3 py-2 text-sm font-bold text-green-700 text-right tabular-nums">{fmtEur(Math.abs(adjustmentsTotal))}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            ) : !addingAdjustment && (
              <div className="px-4 py-6 text-center space-y-1">
                <p className="text-sm text-warm-400">Aucune réduction ni avoir.</p>
                <p className="text-xs text-warm-400">Cliquez sur &quot;+ Ajouter&quot; pour enregistrer une réduction ou un avoir.</p>
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
              <span className="text-lg font-bold text-secondary-800">{fmtEur(totalDue)}</span>
            </div>
          </div>
          <div className="card p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-secondary-700">{`TOTAL PER\u00C7U`}</span>
              <div className="text-right">
                {adjustmentsTotal !== 0 && (
                  <span className="text-xs text-warm-500 mr-1">
                    {fmtEur(totalPaid)} - {fmtEur(Math.abs(adjustmentsTotal))} =
                  </span>
                )}
                <span className="text-lg font-bold text-secondary-800">{fmtEur(netPercu)}</span>
              </div>
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
