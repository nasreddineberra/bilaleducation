'use client'

import { useState } from 'react'
import { X, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
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

function genReceiptNumber() {
  const now = new Date()
  const yymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
  const rand = String(Math.floor(Math.random() * 900) + 100)
  return `REC-${yymm}-${rand}`
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

  const [amount,       setAmount]       = useState(String(ep ? ep.amount_paid : (remaining > 0 ? remaining : totalDue)))
  const [method,       setMethod]       = useState<FeePaymentMethod>(ep?.payment_method ?? 'cash')
  const [paidDate,     setPaidDate]     = useState(ep?.paid_date ?? new Date().toISOString().slice(0, 10))
  const [receipt,      setReceipt]      = useState(ep?.receipt_number ?? genReceiptNumber())
  const [notes,        setNotes]        = useState(ep?.notes ?? '')
  const [saving,       setSaving]       = useState(false)
  const [error,        setError]        = useState<string | null>(null)

  // Champs spécifiques par méthode
  const [checkNumber,   setCheckNumber]   = useState(epRef.check_number ?? '')
  const [bank,          setBank]          = useState(epRef.bank ?? '')
  const [transactionId, setTransactionId] = useState(epRef.transaction_id ?? '')
  const [transferRef,   setTransferRef]   = useState(epRef.reference ?? '')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const parsedAmount = parseFloat(amount)
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Le montant doit etre positif.')
      return
    }
    if (method === 'check' && !checkNumber.trim()) {
      setError('Le numero de cheque est obligatoire.')
      return
    }

    // Construire la référence selon la méthode
    const reference: PaymentReference = {}
    if (method === 'check') {
      reference.check_number = checkNumber.trim()
      if (bank.trim()) reference.bank = bank.trim()
    } else if (method === 'card' && transactionId.trim()) {
      reference.transaction_id = transactionId.trim()
    } else if (method === 'transfer' && transferRef.trim()) {
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
            payment_method:     method,
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
            payment_method:     method,
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
          body: JSON.stringify({ parent_id: parentId, amount: parsedAmount, method, receipt: receipt.trim() || null, paid_date: paidDate }),
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
            <div>
              <label className="block text-xs font-semibold text-warm-500 uppercase tracking-wide mb-1">
                Montant <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className="input text-sm pr-8"
                  autoFocus
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-warm-400">EUR</span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-warm-500 uppercase tracking-wide mb-1">
                Date <span className="text-red-400">*</span>
              </label>
              <input
                type="date"
                value={paidDate}
                onChange={e => setPaidDate(e.target.value)}
                className="input text-sm"
              />
            </div>
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
              <div>
                <label className="block text-xs font-semibold text-warm-500 uppercase tracking-wide mb-1">
                  N° cheque <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="78542"
                  value={checkNumber}
                  onChange={e => setCheckNumber(e.target.value)}
                  className="input text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-warm-500 uppercase tracking-wide mb-1">Banque</label>
                <input
                  type="text"
                  placeholder="BNP Paribas..."
                  value={bank}
                  onChange={e => setBank(e.target.value)}
                  className="input text-sm"
                />
              </div>
            </div>
          )}

          {method === 'card' && (
            <div className="p-3 bg-blue-50/40 rounded-xl border border-blue-100">
              <label className="block text-xs font-semibold text-warm-500 uppercase tracking-wide mb-1">N° transaction</label>
              <input
                type="text"
                placeholder="TXN-9A3F21..."
                value={transactionId}
                onChange={e => setTransactionId(e.target.value)}
                className="input text-sm"
              />
            </div>
          )}

          {method === 'transfer' && (
            <div className="p-3 bg-blue-50/40 rounded-xl border border-blue-100">
              <label className="block text-xs font-semibold text-warm-500 uppercase tracking-wide mb-1">Reference virement</label>
              <input
                type="text"
                placeholder="VIR-20251103..."
                value={transferRef}
                onChange={e => setTransferRef(e.target.value)}
                className="input text-sm"
              />
            </div>
          )}

          {/* N° reçu + Notes */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-warm-500 uppercase tracking-wide mb-1">N° recu</label>
              <input
                type="text"
                value={receipt}
                onChange={e => setReceipt(e.target.value)}
                className="input text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-warm-500 uppercase tracking-wide mb-1">Notes</label>
              <input
                type="text"
                placeholder="Remarque..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="input text-sm"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="btn btn-primary flex-1 flex items-center justify-center gap-1.5"
            >
              <Check size={15} />
              {saving ? 'Enregistrement...' : isEdit ? 'Modifier le paiement' : 'Enregistrer le paiement'}
            </button>
            <button type="button" onClick={onClose} disabled={saving} className="btn btn-secondary">
              Annuler
            </button>
          </div>

        </form>
      </div>
    </div>
  )
}
