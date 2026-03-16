'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { clsx } from 'clsx'
import { CheckCircle2, AlertCircle, Clock, AlertTriangle } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface FamilyRow {
  parentId: string
  parentLabel: string
  totalDue: number
  totalPaid: number
  remaining: number
  status: 'pending' | 'partial' | 'paid' | 'overpaid'
  byMethod: Record<string, number>
}

interface Props {
  rows: FamilyRow[]
  yearLabel: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency', currency: 'EUR',
    minimumFractionDigits: 0, maximumFractionDigits: 2,
  }).format(n)
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'En attente',
  partial: 'Partiel',
  paid: 'Soldé',
  overpaid: 'Trop perçu',
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'text-amber-600',
  partial: 'text-orange-600',
  paid: 'text-success-600',
  overpaid: 'text-danger-600',
}

const STATUS_ICONS: Record<string, typeof CheckCircle2> = {
  pending: Clock,
  partial: AlertTriangle,
  paid: CheckCircle2,
  overpaid: AlertCircle,
}

const METHOD_LABELS: Record<string, string> = {
  cash: 'Espèces',
  check: 'Chèques',
  card: 'CB',
  transfer: 'Virement',
  online: 'En ligne',
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function VueGlobaleClient({ rows, yearLabel }: Props) {
  const router = useRouter()

  const { nonSoldes, soldes } = useMemo(() => {
    const nonSoldes = rows.filter(r => r.status === 'pending' || r.status === 'partial')
    const soldes = rows.filter(r => r.status === 'paid' || r.status === 'overpaid')
    return { nonSoldes, soldes }
  }, [rows])

  // Totaux non soldés
  const nonSoldesTotals = useMemo(() => {
    const totalDue = nonSoldes.reduce((s, r) => s + r.totalDue, 0)
    const totalPaid = nonSoldes.reduce((s, r) => s + r.totalPaid, 0)
    const remaining = nonSoldes.reduce((s, r) => s + r.remaining, 0)
    return { totalDue, totalPaid, remaining }
  }, [nonSoldes])

  // Totaux soldés + ventilation par moyen de paiement
  const soldesTotals = useMemo(() => {
    const totalDue = soldes.reduce((s, r) => s + r.totalDue, 0)
    const totalPaid = soldes.reduce((s, r) => s + r.totalPaid, 0)
    const remaining = soldes.reduce((s, r) => s + r.remaining, 0)
    const byMethod: Record<string, number> = {}
    for (const r of soldes) {
      for (const [method, amount] of Object.entries(r.byMethod)) {
        byMethod[method] = (byMethod[method] ?? 0) + amount
      }
    }
    return { totalDue, totalPaid, remaining, byMethod }
  }, [soldes])

  // Totaux globaux
  const globalTotals = useMemo(() => {
    const totalDue = rows.reduce((s, r) => s + r.totalDue, 0)
    const totalPaid = rows.reduce((s, r) => s + r.totalPaid, 0)
    const remaining = totalDue - totalPaid
    return { totalDue, totalPaid, remaining }
  }, [rows])

  const handleRowClick = (parentId: string) => {
    router.push(`/dashboard/financements/reglements?parent=${parentId}`)
  }

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)] gap-3 px-1">
      {/* KPI globaux */}
      <div className="grid grid-cols-4 gap-3">
        <div className="rounded-lg border border-warm-200 bg-white p-3 text-center">
          <p className="text-[11px] font-medium text-warm-500 uppercase tracking-wide">Familles</p>
          <p className="text-xl font-bold text-warm-900">{rows.length}</p>
        </div>
        <div className="rounded-lg border border-warm-200 bg-white p-3 text-center">
          <p className="text-[11px] font-medium text-warm-500 uppercase tracking-wide">Total global dû</p>
          <p className="text-xl font-bold text-warm-900">{fmt(globalTotals.totalDue)}</p>
        </div>
        <div className="rounded-lg border border-warm-200 bg-white p-3 text-center">
          <p className="text-[11px] font-medium text-warm-500 uppercase tracking-wide">Total global perçu</p>
          <p className="text-xl font-bold text-success-600">{fmt(globalTotals.totalPaid)}</p>
        </div>
        <div className="rounded-lg border border-warm-200 bg-white p-3 text-center">
          <p className="text-[11px] font-medium text-warm-500 uppercase tracking-wide">Reste à percevoir</p>
          <p className={clsx('text-xl font-bold', globalTotals.remaining > 0 ? 'text-danger-600' : 'text-success-600')}>
            {fmt(globalTotals.remaining)}
          </p>
        </div>
      </div>

      {/* Deux containers */}
      <div className="grid grid-cols-2 gap-3 flex-1 min-h-0">
        {/* ── Non soldés ─────────────────────────────────────────── */}
        <div className="flex flex-col rounded-lg border border-warm-200 bg-white overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 bg-amber-50 border-b border-warm-200">
            <h2 className="text-sm font-semibold text-amber-800">
              Non soldés ({nonSoldes.length})
            </h2>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-y-auto min-h-0">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-warm-50 z-10">
                <tr className="text-warm-500 uppercase tracking-wide text-[10px]">
                  <th className="text-left px-3 py-1.5 font-medium">Famille</th>
                  <th className="text-center px-2 py-1.5 font-medium">Statut</th>
                  <th className="text-right px-2 py-1.5 font-medium">Dû</th>
                  <th className="text-right px-2 py-1.5 font-medium">Perçu</th>
                  <th className="text-right px-3 py-1.5 font-medium">Reste</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-warm-100">
                {nonSoldes.map(r => {
                  const Icon = STATUS_ICONS[r.status]
                  return (
                    <tr
                      key={r.parentId}
                      onClick={() => handleRowClick(r.parentId)}
                      className="hover:bg-warm-50 cursor-pointer transition-colors"
                    >
                      <td className="px-3 py-1.5 font-medium text-warm-900 truncate max-w-[180px]">{r.parentLabel}</td>
                      <td className="px-2 py-1.5 text-center">
                        <span className={clsx('inline-flex items-center gap-1', STATUS_COLORS[r.status])}>
                          <Icon className="w-3 h-3" />
                          <span className="text-[10px]">{STATUS_LABELS[r.status]}</span>
                        </span>
                      </td>
                      <td className="px-2 py-1.5 text-right text-warm-700 tabular-nums">{fmt(r.totalDue)}</td>
                      <td className="px-2 py-1.5 text-right text-success-600 tabular-nums">{fmt(r.totalPaid)}</td>
                      <td className="px-3 py-1.5 text-right text-danger-600 font-semibold tabular-nums">{fmt(r.remaining)}</td>
                    </tr>
                  )
                })}
                {nonSoldes.length === 0 && (
                  <tr><td colSpan={5} className="px-3 py-6 text-center text-warm-400">Aucun financement en attente</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Totaux non soldés */}
          <div className="border-t border-warm-200 bg-amber-50/50 px-3 py-2 grid grid-cols-3 gap-2 text-xs">
            <div>
              <span className="text-warm-500">Total dû</span>
              <span className="ml-2 font-bold text-warm-900">{fmt(nonSoldesTotals.totalDue)}</span>
            </div>
            <div>
              <span className="text-warm-500">Total perçu</span>
              <span className="ml-2 font-bold text-success-600">{fmt(nonSoldesTotals.totalPaid)}</span>
            </div>
            <div>
              <span className="text-warm-500">Reste</span>
              <span className="ml-2 font-bold text-danger-600">{fmt(nonSoldesTotals.remaining)}</span>
            </div>
          </div>
        </div>

        {/* ── Soldés ─────────────────────────────────────────────── */}
        <div className="flex flex-col rounded-lg border border-warm-200 bg-white overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 bg-green-50 border-b border-warm-200">
            <h2 className="text-sm font-semibold text-green-800">
              Soldés ({soldes.length})
            </h2>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-y-auto min-h-0">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-warm-50 z-10">
                <tr className="text-warm-500 uppercase tracking-wide text-[10px]">
                  <th className="text-left px-3 py-1.5 font-medium">Famille</th>
                  <th className="text-center px-2 py-1.5 font-medium">Statut</th>
                  <th className="text-right px-2 py-1.5 font-medium">Dû</th>
                  <th className="text-right px-3 py-1.5 font-medium">Perçu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-warm-100">
                {soldes.map(r => {
                  const Icon = STATUS_ICONS[r.status]
                  return (
                    <tr
                      key={r.parentId}
                      onClick={() => handleRowClick(r.parentId)}
                      className={clsx('hover:bg-warm-50 cursor-pointer transition-colors', r.status === 'overpaid' && 'bg-red-50')}
                    >
                      <td className={clsx('px-3 py-1.5 font-medium truncate max-w-[180px]', r.status === 'overpaid' ? 'text-red-800' : 'text-warm-900')}>{r.parentLabel}</td>
                      <td className="px-2 py-1.5 text-center">
                        <span className={clsx('inline-flex items-center gap-1', STATUS_COLORS[r.status])}>
                          <Icon className="w-3 h-3" />
                          <span className="text-[10px]">{STATUS_LABELS[r.status]}</span>
                        </span>
                      </td>
                      <td className={clsx('px-2 py-1.5 text-right tabular-nums', r.status === 'overpaid' ? 'text-red-700' : 'text-warm-700')}>{fmt(r.totalDue)}</td>
                      <td className={clsx('px-3 py-1.5 text-right font-semibold tabular-nums', r.status === 'overpaid' ? 'text-red-700' : 'text-success-600')}>{fmt(r.totalPaid)}</td>
                    </tr>
                  )
                })}
                {soldes.length === 0 && (
                  <tr><td colSpan={4} className="px-3 py-6 text-center text-warm-400">Aucun financement soldé</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Totaux soldés + ventilation par méthode */}
          <div className="border-t border-warm-200 bg-green-50/50 px-3 py-2">
            <div className="flex items-center justify-between text-xs">
              <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-warm-600">
                {Object.entries(soldesTotals.byMethod)
                  .sort(([, a], [, b]) => b - a)
                  .map(([method, amount]) => {
                    const pct = soldesTotals.totalPaid > 0 ? Math.round((amount / soldesTotals.totalPaid) * 100) : 0
                    return (
                      <span key={method}>
                        {METHOD_LABELS[method] ?? method} : <span className="font-semibold text-warm-800">{fmt(amount)}</span> <span className="text-warm-400">({pct}%)</span>
                      </span>
                    )
                  })}
              </div>
              <div className="whitespace-nowrap">
                <span className="text-warm-500">Total perçu</span>
                <span className="ml-2 font-bold text-success-600">{fmt(soldesTotals.totalPaid)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
