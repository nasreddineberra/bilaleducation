'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { FloatInput, FloatSelect, FloatButton } from '@/components/ui/FloatFields'
import type { FeeInstallment, FeePaymentMethod, PaymentReference } from '@/types/database'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  familyFeeId:         string | null
  parentId:            string
  schoolYearId:        string
  subtotal:            number
  totalDue:            number
  remaining:           number
  paymentNumber:       number
  editingPayment?:     FeeInstallment | null
  onEnsureFamilyFee:   () => Promise<string | null>
  onClose:             () => void
  onSaved:             (payment: FeeInstallment) => void
}

const METHODS: { value: FeePaymentMethod; label: string }[] = [
  { value: 'cash',     label: 'Especes'  },
  { value: 'check',    label: 'Cheque'   },
  { value: 'card',     label: 'CB'       },
  { value: 'transfer', label: 'Virement' },
  { value: 'online',   label: 'En ligne' },
]

function fmtEur(n: number) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency', currency: 'EUR',
    minimumFractionDigits: 0, maximumFractionDigits: 2,
  }).format(n)
}

function getReceiptPrefix() {
  const now = new Date()
  return `REC-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
}

// ─── Composant ────────────────────────────────────────────────────────────────

export default function PaymentModal({
  familyFeeId, parentId, schoolYearId,
  subtotal, totalDue, remaining, paymentNumber,
  editingPayment,
  onEnsureFamilyFee, onClose, onSaved,
}: Props) {
  const supabase = createClient()
  const isEdit = !!editingPayment
  const ep = editingPayment
  const epRef = (ep?.payment_reference ?? {}) as PaymentReference

  const initAmount      = String(ep ? ep.amount_paid : remaining)
  const initMethod      = ep?.payment_method ?? ''
  const initPaidDate    = ep?.paid_date ?? new Date().toISOString().slice(0, 10)
  const initReceipt     = ep?.receipt_number ?? ''
  const initNotes       = ep?.notes ?? ''
  const initCheckNumber = epRef.check_number ?? ''
  const initBank        = epRef.bank ?? ''
  const initTxId        = epRef.transaction_id ?? ''
  const initTransferRef = epRef.reference ?? ''

  const [amount,       setAmount]       = useState(initAmount)
  const [method,       setMethod]       = useState<FeePaymentMethod | ''>(initMethod)
  const [paidDate,     setPaidDate]     = useState(initPaidDate)
  const [receipt,      setReceipt]      = useState(initReceipt)
  const [notes,        setNotes]        = useState(initNotes)
  const [saving,       setSaving]       = useState(false)
  const [error,        setError]        = useState<string | null>(null)

  // Champs spécifiques par méthode
  const [checkNumber,   setCheckNumber]   = useState(initCheckNumber)
  const [bank,          setBank]          = useState(initBank)
  const [transactionId, setTransactionId] = useState(initTxId)
  const [transferRef,   setTransferRef]   = useState(initTransferRef)

  // Génération séquentielle du N° reçu en mode création
  useEffect(() => {
    if (isEdit) return
    const prefix = getReceiptPrefix()
    supabase
      .from('fee_installments')
      .select('receipt_number')
      .like('receipt_number', `${prefix}-%`)
      .order('receipt_number', { ascending: false })
      .limit(1)
      .then(({ data }) => {
        let next = 1
        if (data && data.length > 0 && data[0].receipt_number) {
          const parts = (data[0].receipt_number as string).split('-')
          const last = parseInt(parts[parts.length - 1], 10)
          if (!isNaN(last)) next = last + 1
        }
        setReceipt(`${prefix}-${String(next).padStart(3, '0')}`)
      })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const methodFieldOk =
    method === 'check'    ? !!checkNumber.trim() && !!bank.trim() :
    method === 'card'     ? !!transactionId.trim() :
    method === 'transfer' ? !!transferRef.trim() : true

  const canSubmit = !!amount && parseFloat(amount) > 0 && !!paidDate && !!method && methodFieldOk

  const hasChanges = !isEdit || (
    amount !== initAmount ||
    method !== initMethod ||
    paidDate !== initPaidDate ||
    receipt !== initReceipt ||
    notes !== initNotes ||
    checkNumber !== initCheckNumber ||
    bank !== initBank ||
    transactionId !== initTxId ||
    transferRef !== initTransferRef
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const parsedAmount = parseFloat(amount)
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Le montant doit etre positif.')
      return
    }
    if (!method) {
      setError('Le mode de paiement est obligatoire.')
      return
    }
    const safeMethod = method as FeePaymentMethod
    if (safeMethod === 'check' && !checkNumber.trim()) {
      setError('Le numero de cheque est obligatoire.')
      return
    }
    if (safeMethod === 'check' && !bank.trim()) {
      setError('La banque est obligatoire.')
      return
    }
    if (safeMethod === 'card' && !transactionId.trim()) {
      setError('Le numero de transaction est obligatoire.')
      return
    }
    if (safeMethod === 'transfer' && !transferRef.trim()) {
      setError('La reference de virement est obligatoire.')
      return
    }

    // Construire la référence selon la méthode
    const reference: PaymentReference = {}
    if (safeMethod === 'check') {
      reference.check_number = checkNumber.trim()
      if (bank.trim()) reference.bank = bank.trim()
    } else if (safeMethod === 'card' && transactionId.trim()) {
      reference.transaction_id = transactionId.trim()
    } else if (safeMethod === 'transfer' && transferRef.trim()) {
      reference.reference = transferRef.trim()
    }

    setSaving(true)
    setError(null)
    try {
      if (isEdit && ep) {
        // Mode édition : update
        const { data, error: err } = await supabase
          .from('fee_installments')
          .update({
            amount_due:         parsedAmount,
            amount_paid:        parsedAmount,
            due_date:           paidDate,
            paid_date:          paidDate,
            payment_method:     safeMethod,
            payment_reference:  Object.keys(reference).length ? reference : null,
            receipt_number:     receipt.trim() || null,
            notes:              notes.trim() || null,
          })
          .eq('id', ep.id)
          .select()
          .single()
        if (err) throw err
        setSaving(false)
        onSaved(data as FeeInstallment)
      } else {
        // Mode création : insert
        const feeId = familyFeeId ?? await onEnsureFamilyFee()
        if (!feeId) { setSaving(false); return }

        const { data, error: err } = await supabase
          .from('fee_installments')
          .insert({
            family_fee_id:      feeId,
            installment_number: paymentNumber,
            due_date:           paidDate,
            amount_due:         parsedAmount,
            amount_paid:        parsedAmount,
            paid_date:          paidDate,
            payment_method:     safeMethod,
            payment_reference:  Object.keys(reference).length ? reference : null,
            receipt_number:     receipt.trim() || null,
            status:             'paid',
            notes:              notes.trim() || null,
          })
          .select()
          .single()
        if (err) throw err

        // Notification parent (fire-and-forget)
        fetch('/api/notifications/payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ parent_id: parentId, amount: parsedAmount, method: safeMethod, receipt: receipt.trim() || null, paid_date: paidDate }),
        }).catch(() => {})

        setSaving(false)
        onSaved(data as FeeInstallment)
      }
    } catch (e: any) {
      setError(e.message ?? 'Erreur lors de l\'enregistrement.')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-fade-in">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-warm-100">
          <div>
            <h2 className="text-base font-bold text-secondary-800">
              {isEdit ? 'Modifier le paiement' : 'Enregistrer un paiement'}
            </h2>
            <p className="text-xs text-warm-500 mt-0.5">
              Total du : {fmtEur(totalDue)}
              {remaining < totalDue && remaining > 0 && ` · Reste : ${fmtEur(remaining)}`}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 text-warm-400 hover:text-secondary-700 hover:bg-warm-100 rounded-lg transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">{error}</div>
          )}

          {/* Montant + Date */}
          <div className="grid grid-cols-2 gap-3">
            <FloatInput
              label="Montant (EUR)"
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              required
              autoFocus
            />
            <FloatInput
              label="Date"
              type="date"
              value={paidDate}
              onChange={e => setPaidDate(e.target.value)}
              required
            />
          </div>

          {/* Mode de paiement */}
          <div>
            <label className="block text-xs font-semibold text-warm-500 uppercase tracking-wide mb-2">
              Mode de paiement <span className="text-red-400">*</span>
            </label>
            <div className="grid grid-cols-5 gap-1.5">
              {METHODS.map(m => {
                const isOnline   = m.value === 'online'
                const isSelected = method === m.value
                return (
                  <button
                    key={m.value}
                    type="button"
                    disabled={isOnline}
                    onClick={() => !isOnline && setMethod(m.value)}
                    title={isOnline ? 'Bientot disponible' : undefined}
                    className={[
                      'relative px-2 py-2 rounded-lg border text-xs font-medium transition-colors text-center',
                      isOnline   ? 'opacity-40 cursor-not-allowed border-warm-200 text-warm-400 bg-warm-50' : '',
                      !isOnline && isSelected  ? 'border-primary-400 bg-primary-50 text-primary-700' : '',
                      !isOnline && !isSelected ? 'border-warm-200 hover:bg-warm-100 text-secondary-600' : '',
                    ].join(' ')}
                  >
                    {m.label}
                    {isOnline && (
                      <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 bg-warm-400 text-white text-[9px] px-1 rounded-full whitespace-nowrap">
                        bientot
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Champs dynamiques selon méthode */}
          {method === 'check' && (
            <div className="grid grid-cols-2 gap-3 p-3 bg-blue-50/40 rounded-xl border border-blue-100">
              <FloatInput
                label="N° chèque"
                type="text"
                placeholder="78542"
                value={checkNumber}
                onChange={e => setCheckNumber(e.target.value.replace(/\D/g, ''))}
                required
              />
              <FloatInput
                label="Banque"
                type="text"
                placeholder="BNP Paribas..."
                value={bank}
                onChange={e => setBank(e.target.value.replace(/[^A-Za-zÀ-ÿ\s]/g, '').toUpperCase())}
                required
              />
            </div>
          )}

          {method === 'card' && (
            <div className="p-3 bg-blue-50/40 rounded-xl border border-blue-100">
              <FloatInput
                label="N° transaction"
                type="text"
                placeholder="TXN-9A3F21..."
                value={transactionId}
                onChange={e => setTransactionId(e.target.value)}
                required
              />
            </div>
          )}

          {method === 'transfer' && (
            <div className="p-3 bg-blue-50/40 rounded-xl border border-blue-100">
              <FloatInput
                label="Référence virement"
                type="text"
                placeholder="VIR-20251103..."
                value={transferRef}
                onChange={e => setTransferRef(e.target.value)}
                required
              />
            </div>
          )}

          {/* N° reçu + Notes */}
          <div className="grid grid-cols-2 gap-3">
            <FloatInput
              label="N° reçu"
              type="text"
              value={receipt}
              onChange={e => setReceipt(e.target.value)}
            />
            <FloatInput
              label="Notes"
              type="text"
              placeholder="Remarque..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-1">
            <span className="text-xs text-red-400"><span className="font-semibold">*</span> obligatoire</span>
            <div className="flex-1" />
            <FloatButton type="button" variant="secondary" onClick={onClose} disabled={saving}>
              Annuler
            </FloatButton>
            <FloatButton type="submit" variant={isEdit ? 'edit' : 'submit'} disabled={saving || !canSubmit || !hasChanges}>
              {isEdit ? 'Modifier' : 'Valider'}
            </FloatButton>
          </div>

        </form>
      </div>
    </div>
  )
}
