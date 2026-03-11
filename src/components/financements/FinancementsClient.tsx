'use client'

import { useState, useMemo, useCallback } from 'react'
import { Plus, Trash2, Check, AlertTriangle, CheckCircle2 } from 'lucide-react'
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

interface ParentOption {
  id: string
  tutor1_last_name: string
  tutor1_first_name: string
  students: StudentLine[]
}

interface Props {
  currentYear: { id: string; label: string }
  parents: any[]
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
  pending: 'En attente',
  partial: 'Partiel',
  paid:    'Solde',
  overdue: 'Impaye',
}

const STATUS_COLORS: Record<FeeStatus, string> = {
  pending: 'bg-gray-100 text-gray-700',
  partial: 'bg-amber-100 text-amber-800',
  paid:    'bg-green-100 text-green-800',
  overdue: 'bg-red-100 text-red-800',
}

const METHOD_LABELS: Record<string, string> = {
  cash: 'Especes', check: 'Cheque', card: 'CB', transfer: 'Virement', online: 'En ligne',
}

const DAYS: Record<string, string> = {
  monday: 'Lundi', tuesday: 'Mardi', wednesday: 'Mercredi',
  thursday: 'Jeudi', friday: 'Vendredi', saturday: 'Samedi', sunday: 'Dimanche',
}

// ─── Parse parents ────────────────────────────────────────────────────────────

function parseParents(raw: any[]): ParentOption[] {
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

      // Tooltip classe : jour · horaires · prof principal
      const day   = cls?.day_of_week ? (DAYS[cls.day_of_week] ?? cls.day_of_week) : null
      const start = cls?.start_time ? cls.start_time.slice(0, 5) : null
      const end   = cls?.end_time   ? cls.end_time.slice(0, 5)   : null
      const mainTeacher = (cls?.class_teachers ?? []).find((t: any) => t.is_main_teacher)
      const teacherName = mainTeacher?.teachers
        ? [mainTeacher.teachers.civilite, mainTeacher.teachers.last_name, mainTeacher.teachers.first_name].filter(Boolean).join(' ')
        : null
      const tooltipParts = [
        day && start ? `${day} ${start}${end ? `–${end}` : ''}` : day,
        teacherName,
      ].filter(Boolean)
      const class_tooltip = tooltipParts.length ? tooltipParts.join('\n') : null

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
    return {
      id: p.id,
      tutor1_last_name: p.tutor1_last_name,
      tutor1_first_name: p.tutor1_first_name,
      students,
    }
  })
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function FinancementsClient({ currentYear, parents: rawParents, familyFees: initialFees }: Props) {
  const supabase = createClient()

  const parentOptions = useMemo(() => parseParents(rawParents), [rawParents])

  const [selectedParentId, setSelectedParentId] = useState<string>('')
  const [familyFees, setFamilyFees]             = useState<any[]>(initialFees)
  const [saving, setSaving]                     = useState(false)
  const [error, setError]                       = useState<string | null>(null)
  const [success, setSuccess]                   = useState<string | null>(null)
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)

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

  const subtotal = selectedParent
    ? selectedParent.students.reduce((acc, s) => acc + s.total, 0)
    : 0

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
    totalDue <= 0    ? 'paid'
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
    if (!currentFee) return
    const updatedPayments = [...payments, newPayment]
    const newTotalPaid = updatedPayments.reduce((s, p) => s + p.amount_paid, 0)
    const due = currentFee.total_due
    let status: FeeStatus = 'pending'
    if (newTotalPaid >= due) status = 'paid'
    else if (newTotalPaid > 0) status = 'partial'

    await supabase.from('family_fees').update({ status }).eq('id', currentFee.id)

    setFamilyFees(prev => prev.map(f =>
      f.id === currentFee.id
        ? { ...f, status, fee_installments: [...(f.fee_installments ?? []), newPayment] }
        : f
    ))
    setPaymentModalOpen(false)
    setSuccess('Paiement enregistre.')
  }

  const removePayment = async (payment: FeeInstallment) => {
    if (!currentFee) return
    setSaving(true)
    setError(null)
    try {
      const { error: err } = await supabase.from('fee_installments').delete().eq('id', payment.id)
      if (err) throw err

      const remaining2 = payments.filter(p => p.id !== payment.id)
      const newTotalPaid = remaining2.reduce((s, p) => s + p.amount_paid, 0)
      const due = currentFee.total_due
      let status: FeeStatus = 'pending'
      if (newTotalPaid >= due && due > 0) status = 'paid'
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

      {/* En-tete */}
      <div>
        <h1 className="text-xl font-bold text-secondary-800">Financements</h1>
        <p className="text-sm text-warm-500 mt-0.5">
          Annee scolaire : <span className="font-medium text-secondary-700">{currentYear.label}</span>
        </p>
      </div>

      {/* Select responsable + statut */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row sm:items-end gap-3">
          <div className="flex-1 space-y-1">
            <label className="text-xs font-semibold text-warm-500 uppercase tracking-wide">Responsable</label>
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
              <option value="">— Choisir un responsable —</option>
              {parentOptions.map(p => (
                <option key={p.id} value={p.id}>
                  {p.tutor1_last_name.toUpperCase()} {p.tutor1_first_name} ({p.students.length} eleve{p.students.length > 1 ? 's' : ''})
                </option>
              ))}
            </select>
          </div>
          {selectedParent && (
            <div className="flex items-center gap-4">
              <span className={clsx('px-3 py-1.5 rounded-full text-xs font-semibold', STATUS_COLORS[derivedStatus])}>
                {STATUS_LABELS[derivedStatus]}
              </span>
              <div className="text-sm text-secondary-700">
                <span className="font-semibold">{fmtEur(totalPaid)}</span>
                <span className="text-warm-400"> / {fmtEur(totalDue)}</span>
                {remaining > 0 && (
                  <span className="ml-2 text-amber-600 font-medium">Reste : {fmtEur(remaining)}</span>
                )}
              </div>
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

      {selectedParent && (
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

            {/* Total dû */}
            <div className="card p-4 bg-secondary-50 border-2 border-secondary-200">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-secondary-700">TOTAL DU</span>
                <div className="text-right">
                  {adjustmentsTotal !== 0 && (
                    <span className="text-sm text-warm-500 mr-1">
                      {fmtEur(subtotal)} {adjustmentsTotal < 0 ? '-' : '+'} {fmtEur(Math.abs(adjustmentsTotal))} =
                    </span>
                  )}
                  <span className="text-lg font-bold text-secondary-800">{fmtEur(totalDue)}</span>
                </div>
              </div>
            </div>

          </div>

          {/* ── Colonne droite : Paiements ── */}
          <div className="card overflow-hidden flex flex-col">
            <div className="px-4 py-2.5 bg-warm-50/60 border-b border-warm-100 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-warm-500 uppercase tracking-widest">Paiements</h3>
                {payments.length > 0 && (
                  <p className="text-xs text-warm-500 mt-0.5">
                    Paye : <span className="font-semibold text-secondary-700">{fmtEur(totalPaid)}</span>
                    {remaining > 0 && <span className="ml-2 text-amber-600">Reste : {fmtEur(remaining)}</span>}
                  </p>
                )}
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
                    <th className="px-3 py-2 w-10"></th>
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
                        <td className="px-3 py-2">
                          <button
                            onClick={() => removePayment(p)}
                            disabled={saving}
                            className="p-1 text-warm-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="Supprimer"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-warm-50/60">
                    <td colSpan={2} className="px-3 py-2.5 text-sm font-semibold text-secondary-700 text-right">Total paye</td>
                    <td className="px-3 py-2.5 text-sm font-bold text-secondary-800 text-right tabular-nums">{fmtEur(totalPaid)}</td>
                    <td colSpan={4}></td>
                  </tr>
                  {remaining > 0 && (
                    <tr className="bg-amber-50/60">
                      <td colSpan={2} className="px-3 py-2 text-sm font-semibold text-amber-700 text-right">Reste a payer</td>
                      <td className="px-3 py-2 text-sm font-bold text-amber-700 text-right tabular-nums">{fmtEur(remaining)}</td>
                      <td colSpan={4}></td>
                    </tr>
                  )}
                </tfoot>
              </table>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center py-12 text-center gap-2">
                <AlertTriangle size={24} className="text-warm-300" />
                <p className="text-sm text-warm-400">Aucun paiement enregistre.</p>
                {totalDue > 0 && (
                  <p className="text-xs text-warm-400">Cliquez sur &quot;+ Paiement&quot; pour enregistrer un reglement.</p>
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
      )}

      {/* Modale paiement */}
      {paymentModalOpen && selectedParent && (
        <PaymentModal
          familyFeeId={currentFee?.id ?? null}
          parentId={selectedParentId}
          schoolYearId={currentYear.id}
          subtotal={subtotal}
          totalDue={totalDue}
          remaining={remaining}
          paymentNumber={payments.length + 1}
          onEnsureFamilyFee={ensureFamilyFee}
          onClose={() => setPaymentModalOpen(false)}
          onSaved={handlePaymentSaved}
        />
      )}
    </div>
  )
}
