'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { clsx } from 'clsx'
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip as RTooltip,
  LineChart, Line, XAxis, YAxis, CartesianGrid, ReferenceLine,
} from 'recharts'
import { DollarSign, TrendingUp, TrendingDown, Wallet } from 'lucide-react'
import DashboardHeader from './DashboardHeader'
import StatCard from './StatCard'
import Tooltip from '@/components/ui/Tooltip'
import { SERIES, CATEGORICAL, INK, METHOD_LABELS, VizTooltip, VizCard, VizLegend, fmtEur, fmtAxis } from './viz'
import type { FeeStatus } from '@/types/database'

interface DebtorRow {
  parentId: string
  parentLabel: string
  totalDue: number
  totalPaid: number
  remaining: number
  status: FeeStatus
}

interface Props {
  firstName: string
  lastName: string
  role: string
  roleLabel: string
  yearLabel: string
  periodLabel: string
  unreadNotifs: number
  recentNotifs: any[]
  stats: {
    billed: number
    collected: number
    outstanding: number
    overpaidCount: number
    overpaidAmount: number
    rate: number
    totalFamilies: number
    monthly: { key: string; label: string; amount: number; cumul: number }[]
    byMethod: Record<string, number>
    topDebtors: DebtorRow[]
    recentPayments: { id: string; amount_paid: number; paid_date: string | null; payment_method: string | null; family_fees: { parents: { tutor1_last_name: string; tutor1_first_name: string } | null } | null }[]
  }
}

export default function DashboardComptable({ stats, ...headerProps }: Props) {
  const methodData = useMemo(() => {
    const all = Object.entries(stats.byMethod)
      .map(([k, v]) => ({ name: METHOD_LABELS[k] ?? k, value: v }))
      .sort((a, b) => b.value - a.value)
    if (all.length <= CATEGORICAL.length) return all.map((d, i) => ({ ...d, fill: CATEGORICAL[i] }))
    const head = all.slice(0, CATEGORICAL.length - 1)
    const rest = all.slice(CATEGORICAL.length - 1).reduce((s, d) => s + d.value, 0)
    return [...head, { name: 'Autres', value: rest }].map((d, i) => ({ ...d, fill: CATEGORICAL[i] }))
  }, [stats.byMethod])
  const methodTotal = methodData.reduce((s, d) => s + d.value, 0)
  const topMax = stats.topDebtors[0]?.remaining ?? 0

  return (
    <div className="space-y-4 animate-fade-in">
      <DashboardHeader {...headerProps} />

      {/* KPIs financiers */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard title="Facturé" value={fmtEur(stats.billed)} subtitle={`${stats.totalFamilies} dossiers`} icon={Wallet} tone="ardoise" />
        <StatCard title="Encaissé" value={fmtEur(stats.collected)} subtitle={`${stats.rate}% du facturé`} icon={TrendingUp} tone="primary" />
        <StatCard title="Reste à encaisser" value={fmtEur(stats.outstanding)} icon={TrendingDown} tone="orange" />
        <StatCard title="Trop perçu" value={stats.overpaidCount} subtitle={stats.overpaidCount > 0 ? fmtEur(stats.overpaidAmount) : 'aucun'} icon={DollarSign} tone="red" />
      </div>

      {/* Jauge de recouvrement + Courbe de collecte */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="card p-3">
          <div className="flex items-baseline justify-between mb-2">
            <h3 className="stat-label">Taux de recouvrement</h3>
            <Link href="/dashboard/financements/vue-globale" className="text-xs text-primary-600 hover:text-primary-700">Statistiques complètes</Link>
          </div>
          <div className="flex items-end gap-3">
            <p className="text-4xl font-bold text-secondary-800 tabular-nums leading-none">{stats.rate}%</p>
            <p className="text-xs text-warm-700 pb-1">du total facturé</p>
          </div>
          <div className="h-3 bg-warm-100 rounded-full overflow-hidden mt-3">
            <div className="h-full rounded-full transition-all" style={{ width: `${stats.rate}%`, background: SERIES.primary }} />
          </div>
          <div className="flex items-center justify-between mt-2 text-[11px] text-warm-700">
            <span className="tabular-nums"><span className="text-primary-600 font-semibold">{fmtEur(stats.collected)}</span> encaissé</span>
            <span className="tabular-nums"><span className="text-orange-700 font-semibold">{fmtEur(stats.outstanding)}</span> restant</span>
          </div>
        </section>

        <VizCard title="Rythme de collecte" hint="cumul encaissé vs facturé" height={172}>
          {stats.monthly.length === 0 ? (
            <p className="text-xs text-warm-700 italic grid place-items-center h-full">Aucun encaissement.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.monthly} margin={{ top: 8, right: 12, bottom: 0, left: 8 }}>
                <CartesianGrid vertical={false} stroke={INK.grid} />
                <XAxis dataKey="label" tick={{ fill: INK.muted, fontSize: 10 }} axisLine={{ stroke: INK.axis }} tickLine={false} interval="preserveStartEnd" />
                <YAxis tickFormatter={fmtAxis} tick={{ fill: INK.muted, fontSize: 10 }} axisLine={false} tickLine={false} width={52} />
                <RTooltip content={<VizTooltip />} cursor={{ stroke: INK.axis }} />
                <ReferenceLine y={stats.billed} stroke={INK.muted} strokeDasharray="4 4"
                  label={{ value: 'Facturé', position: 'insideTopLeft', fill: INK.muted, fontSize: 10 }} />
                <Line type="monotone" dataKey="cumul" name="Cumul encaissé" stroke={SERIES.primary}
                  strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: '#ffffff' }} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </VizCard>
      </div>

      {/* Moyens de paiement (donut) + Top debiteurs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="card p-3">
          <h3 className="stat-label mb-2">Moyens de paiement</h3>
          {methodTotal === 0 ? (
            <p className="text-xs text-warm-700 italic py-8 text-center">Aucun encaissement.</p>
          ) : (
            <div className="flex items-center gap-3">
              <div style={{ width: 132, height: 132 }} className="shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={methodData} dataKey="value" nameKey="name" innerRadius="52%" outerRadius="82%"
                      paddingAngle={2} stroke="#ffffff" strokeWidth={2} isAnimationActive={false}>
                      {methodData.map(d => <Cell key={d.name} fill={d.fill} />)}
                    </Pie>
                    <RTooltip content={<VizTooltip total={methodTotal} />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="min-w-0 flex-1">
                <VizLegend items={methodData.map(d => ({ label: d.name, color: d.fill, value: fmtEur(d.value) }))} />
              </div>
            </div>
          )}
        </section>

        <section className="card p-3 flex flex-col">
          <div className="flex items-baseline gap-2 mb-2">
            <h3 className="stat-label">Top familles débitrices</h3>
            <p className="text-[10px] text-warm-700">cliquer pour ouvrir le dossier</p>
          </div>
          {stats.topDebtors.length === 0 ? (
            <p className="text-xs text-warm-700 italic py-6 text-center">Aucun impayé.</p>
          ) : (
            <ul className="space-y-0.5">
              {stats.topDebtors.map(r => (
                <li key={r.parentId}>
                  <Link href={`/dashboard/financements/reglements?parent=${r.parentId}`}
                    className="w-full flex items-center gap-2 px-1 py-0.5 rounded hover:bg-warm-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400">
                    <Tooltip content={r.parentLabel} maxWidth="max-w-none" className="min-w-0 flex-1">
                      <span className="block text-[11px] text-secondary-800 text-left truncate whitespace-nowrap">{r.parentLabel}</span>
                    </Tooltip>
                    <span className="w-20 h-2 rounded-full bg-warm-100 overflow-hidden shrink-0" aria-hidden="true">
                      <span className="block h-full rounded-full" style={{ width: `${topMax > 0 ? (r.remaining / topMax) * 100 : 0}%`, background: SERIES.orange }} />
                    </span>
                    <span className="w-20 text-[11px] font-semibold text-orange-700 tabular-nums text-right shrink-0">{fmtEur(r.remaining)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Derniers paiements */}
      <section className="card p-3 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="stat-label">Derniers paiements</h3>
          <Link href="/dashboard/financements/reglements" className="text-xs text-primary-600 hover:text-primary-700">Voir tout</Link>
        </div>
        {stats.recentPayments.length === 0 ? (
          <p className="text-xs text-warm-700 italic py-4 text-center">Aucun paiement récent.</p>
        ) : (
          <div className="space-y-1">
            {stats.recentPayments.map(p => (
              <div key={p.id} className="flex items-center gap-2 bg-warm-50 rounded-lg px-3 py-1 text-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-primary-500 flex-shrink-0" />
                <span className="font-medium text-warm-700 truncate">
                  {p.family_fees?.parents?.tutor1_last_name} {p.family_fees?.parents?.tutor1_first_name}
                </span>
                <span className="ml-auto font-bold text-primary-600 flex-shrink-0 tabular-nums">{fmtEur(Number(p.amount_paid))}</span>
                <span className="text-warm-700 flex-shrink-0">{METHOD_LABELS[p.payment_method ?? ''] ?? p.payment_method}</span>
                {p.paid_date && <span className="text-warm-700 flex-shrink-0 tabular-nums">{new Date(p.paid_date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}</span>}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
