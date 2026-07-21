'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FloatButton } from '@/components/ui/FloatFields'
import PaymentModal from './PaymentModal'

interface Debt {
  feeId: string
  parentId: string
  parentLabel: string
  yearId: string
  yearLabel: string
  totalDue: number
  totalPaid: number
  remaining: number
  installmentCount: number
}

function fmtEur(n: number) {
  return n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function ImpayesAnterieurs({ debts }: { debts: Debt[] }) {
  const router = useRouter()
  const [payDebt, setPayDebt] = useState<Debt | null>(null)

  if (debts.length === 0) {
    return (
      <div className="card p-8 text-center">
        <p className="text-sm text-warm-700">Aucun impayé sur les années précédentes.</p>
        <p className="text-xs text-warm-700 mt-1">Les dettes d’années passées non soldées apparaissent ici, payables à tout moment.</p>
      </div>
    )
  }

  const totalRemaining = debts.reduce((s, d) => s + d.remaining, 0)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <p className="text-xs text-warm-700">
          {debts.length} foyer(s) · reste dû <span className="font-semibold text-orange-700 tabular-nums">{fmtEur(totalRemaining)}</span>
        </p>
      </div>

      <div className="card p-0 overflow-hidden">
        <table className="w-full text-xs" aria-label="Impayés des années précédentes">
          <thead>
            <tr className="border-b border-warm-100 bg-warm-50">
              <th className="list-th text-left">Foyer</th>
              <th className="list-th text-left">Année</th>
              <th className="list-th text-right">Dû</th>
              <th className="list-th text-right">Perçu</th>
              <th className="list-th text-right">Reste</th>
              <th className="list-th" />
            </tr>
          </thead>
          <tbody className="divide-y divide-warm-50">
            {debts.map(d => (
              <tr key={d.feeId} className="hover:bg-warm-50/60 transition-colors">
                <td className="list-td font-medium text-secondary-800">{d.parentLabel}</td>
                <td className="list-td text-warm-700 tabular-nums">{d.yearLabel}</td>
                <td className="list-td text-right tabular-nums">{fmtEur(d.totalDue)}</td>
                <td className="list-td text-right tabular-nums text-primary-600">{fmtEur(d.totalPaid)}</td>
                <td className="list-td text-right tabular-nums font-semibold text-orange-700">{fmtEur(d.remaining)}</td>
                <td className="list-td text-right">
                  <FloatButton type="button" variant="submit" onClick={() => setPayDebt(d)} className="!py-1 text-xs">
                    Solder
                  </FloatButton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {payDebt && (
        <PaymentModal
          familyFeeId={payDebt.feeId}
          parentId={payDebt.parentId}
          schoolYearId={payDebt.yearId}
          subtotal={payDebt.totalDue}
          totalDue={payDebt.totalDue}
          remaining={payDebt.remaining}
          paymentNumber={payDebt.installmentCount + 1}
          onEnsureFamilyFee={async () => payDebt.feeId}
          onClose={() => setPayDebt(null)}
          onSaved={() => { setPayDebt(null); router.refresh() }}
        />
      )}
    </div>
  )
}
