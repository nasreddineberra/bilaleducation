'use client'

import { useState, useEffect, useId } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FloatInput, FloatSelect, FloatButton } from '@/components/ui/FloatFields'
import FiltreSwitch from '@/components/ui/FiltreSwitch'
import FormModal from '@/components/ui/FormModal'
import type { FeeInstallment, FeePaymentMethod, PaymentReference } from '@/types/database'
import type { RecapDossier, RetourPaiement } from '@/lib/financements/compute'

// Principales banques (chèques), triées alphabétiquement, + « Autre » pour saisie libre.
const BANKS = [
  'AXA Banque', 'BforBank', 'BNP Paribas', 'Banque Populaire', 'Boursorama',
  "Caisse d'Épargne", 'CIC', 'Crédit Agricole', 'Crédit Coopératif',
  'Crédit du Nord', 'Crédit Mutuel', 'Fortuneo', 'Hello bank!', 'HSBC', 'ING',
  'La Banque Postale', 'LCL', 'Monabanq', 'Société Générale',
].sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }))
const BANK_OTHER = '__autre__'

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
  // Le recapitulatif vient de la RPC, qui l a calcule dans la meme transaction.
  onSaved:             (payment: FeeInstallment, recap: RecapDossier) => void
}

const METHODS: { value: FeePaymentMethod; label: string }[] = [
  { value: 'cash',     label: 'Espèces'  },
  { value: 'check',    label: 'Chèque'   },
  { value: 'card',     label: 'CB'       },
  { value: 'transfer', label: 'Virement' },
  { value: 'online',   label: 'En ligne' },
]

function fmtEur(n: number) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency', currency: 'EUR',
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(n)
}

function getReceiptPrefix() {
  const now = new Date()
  return `REC-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
}

// ─── Composant ────────────────────────────────────────────────────────────────

export default function PaymentModal({
  familyFeeId,
  // `subtotal` etait declare en prop, passe par l'appelant, et JAMAIS
  // destructure — donc inutilise. Il sert desormais : la RPC en a besoin pour
  // recalculer le du sans avoir a rejouer la remise fratrie en SQL.
  subtotal,
  totalDue, remaining, paymentNumber,
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
  const formId = useId()
  const [saving,       setSaving]       = useState(false)
  const [error,        setError]        = useState<string | null>(null)

  // Champs spécifiques par méthode
  const [checkNumber,   setCheckNumber]   = useState(initCheckNumber)
  // Banque : select des principales + « Autre » → saisie libre.
  const [bankChoice, setBankChoice] = useState(initBank ? (BANKS.includes(initBank) ? initBank : BANK_OTHER) : '')
  const [bankOther,  setBankOther]  = useState(BANKS.includes(initBank) ? '' : initBank)
  const bank = bankChoice === BANK_OTHER ? bankOther.trim() : bankChoice
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
      // UNE SEULE ECRITURE POUR LES DEUX MODES, ET ELLE EST ATOMIQUE.
      //
      // La ligne de paiement etait ecrite ici, le recapitulatif du dossier
      // l'etait ensuite dans `FinancementsClient` : deux requetes HTTP, donc un
      // entre-deux ou le paiement pouvait exister pendant que le dossier gardait
      // son ancien statut. `fin_enregistrer_paiement` fait les deux dans une
      // seule transaction et rend le recapitulatif a jour.
      //
      // Le paiement part en `jsonb` : c'est PostgreSQL qui le type d'apres la
      // table (`jsonb_populate_record`), ce qui evite de supposer le type de
      // `payment_method` ou `payment_reference` — le depot n'a plus de
      // `schema.sql` depuis le 5 aout.
      const feeId = isEdit && ep ? ep.family_fee_id : (familyFeeId ?? await onEnsureFamilyFee())
      if (!feeId) { setSaving(false); return }

      const { data: res, error: err } = await supabase.rpc('fin_enregistrer_paiement', {
        p_fee_id:     feeId,
        p_subtotal:   subtotal,
        p_payment_id: isEdit && ep ? ep.id : null,
        p_paiement: {
          installment_number: paymentNumber,
          due_date:           paidDate,
          amount_due:         parsedAmount,
          amount_paid:        parsedAmount,
          paid_date:          paidDate,
          payment_method:     safeMethod,
          payment_reference:  Object.keys(reference).length ? { ...reference } : null,
          receipt_number:     receipt.trim() || null,
          status:             'paid',
          notes:              notes.trim() || null,
        },
      })
      if (err) throw err

      // Le reçu par email n'est plus envoyé ici (route cassée : garde de rôle
      // oubliant le comptable + envoi fire-and-forget silencieux). Remplacé par
      // l'attestation de paiement, envoyée quand le règlement est soldé (lot 2).
      setSaving(false)
      const { paiement, recap } = res as unknown as RetourPaiement
      onSaved(paiement, recap)
    } catch (e: any) {
      setError(e.message ?? 'Erreur lors de l\'enregistrement.')
      setSaving(false)
    }
  }

  return (
    // Modale de saisie : fermeture par X / Annuler uniquement (FormModal : ni fond
    // cliquable ni Echap), portee dans <body> comme toutes les modales.
    <FormModal
      title={isEdit ? 'Modifier le paiement' : 'Enregistrer un paiement'}
      onClose={onClose}
      footer={<>
        <span className="text-xs text-red-700"><span className="font-semibold">*</span> obligatoire</span>
        <div className="flex-1" />
        <FloatButton type="button" variant="secondary" onClick={onClose} disabled={saving}>
          Annuler
        </FloatButton>
        <FloatButton type="submit" form={formId} variant={isEdit ? 'edit' : 'submit'} disabled={saving || !canSubmit || !hasChanges}>
          {isEdit ? 'Modifier' : 'Valider'}
        </FloatButton>
      </>}
    >
        <form id={formId} onSubmit={handleSubmit} className="space-y-4">

          <p className="text-xs text-warm-700">
            Total dû : {fmtEur(totalDue)}
            {remaining < totalDue && remaining > 0 && ` · Reste : ${fmtEur(remaining)}`}
          </p>

          {error && (
            <div role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">{error}</div>
          )}

          {/* Montant + Date */}
          <div className="grid grid-cols-2 gap-3">
            <FloatInput
              label="Montant (€)"
              type="number"
              min="0.01"
              step="any"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              required
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
            <p className="block text-xs font-semibold text-warm-700 uppercase tracking-wide mb-2">
              Mode de paiement <span className="text-red-700">*</span>
            </p>
            <div className="flex">
              <FiltreSwitch
                ariaLabel="Mode de paiement"
                actif={method}
                onChange={v => setMethod(v as FeePaymentMethod)}
                options={METHODS.map(m => m.value === 'online'
                  ? { valeur: m.value, libelle: m.label, desactive: true, infobulle: 'Bientôt disponible' }
                  : { valeur: m.value, libelle: m.label })}
              />
            </div>
          </div>

          {/* Champs dynamiques selon méthode */}
          {method === 'check' && (
            <div className="p-3 bg-warm-50 rounded-xl border border-warm-200 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <FloatInput
                  label="N° chèque"
                  type="text"
                  placeholder="78542"
                  value={checkNumber}
                  onChange={e => setCheckNumber(e.target.value.replace(/\D/g, ''))}
                  required
                />
                <FloatSelect
                  label="Banque"
                  required
                  value={bankChoice}
                  onChange={e => setBankChoice(e.target.value)}
                >
                  <option value="" disabled hidden></option>
                  {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                  <option value={BANK_OTHER}>Autre…</option>
                </FloatSelect>
              </div>
              {bankChoice === BANK_OTHER && (
                <FloatInput
                  label="Nom de la banque"
                  type="text"
                  placeholder="Saisir le nom de la banque"
                  value={bankOther}
                  onChange={e => setBankOther(e.target.value)}
                  required
                />
              )}
            </div>
          )}

          {method === 'card' && (
            <div className="p-3 bg-warm-50 rounded-xl border border-warm-200">
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
            <div className="p-3 bg-warm-50 rounded-xl border border-warm-200">
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

        </form>
    </FormModal>
  )
}
