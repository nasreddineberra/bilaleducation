'use client'

import Link from 'next/link'
import { clsx } from 'clsx'
import { DollarSign, TrendingUp, TrendingDown, AlertTriangle, Wallet } from 'lucide-react'
import DashboardHeader from './DashboardHeader'
import StatCard from './StatCard'

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
    totalDue: number
    totalCollected: number
    remaining: number
    familiesOverdue: number
    feesByStatus: { pending: number; partial: number; paid: number; overdue: number }
    totalFamilies: number
    recentPayments: { id: string; amount_paid: number; paid_date: string | null; payment_method: string | null; family_fees: { parents: { tutor1_last_name: string; tutor1_first_name: string } | null } | null }[]
    overdueFamilies: { id: string; total_due: number; parents: { tutor1_last_name: string; tutor1_first_name: string } | null }[]
  }
}

const STATUS_COLORS: Record<string, string> = {
  paid: 'bg-success-500', partial: 'bg-amber-500', pending: 'bg-warm-300', overdue: 'bg-danger-500',
}
const STATUS_LABELS: Record<string, string> = {
  paid: 'Soldé', partial: 'Partiel', pending: 'En attente', overdue: 'En retard',
}
const METHOD_LABELS: Record<string, string> = {
  cash: 'Espèces', check: 'Chèque', card: 'CB', transfer: 'Virement', online: 'En ligne',
}

function formatCurrency(n: number): string {
  return n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })
}

export default function DashboardComptable({ stats, ...headerProps }: Props) {
  const totalFees = stats.totalFamilies
  const collectRate = stats.totalDue > 0 ? Math.round((stats.totalCollected / stats.totalDue) * 100) : 0

  return (
    <div className="space-y-6 animate-fade-in">
      <DashboardHeader {...headerProps} />

      {/* KPIs financiers */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard title="Total dû" value={formatCurrency(stats.totalDue)} icon={DollarSign} iconBg="bg-blue-100" iconColor="text-blue-600" accentBar="bg-blue-500" />
        <StatCard title="Total encaissé" value={formatCurrency(stats.totalCollected)} icon={TrendingUp} iconBg="bg-success-100" iconColor="text-success-600" accentBar="bg-success-500" />
        <StatCard title="Reste à percevoir" value={formatCurrency(stats.remaining)} icon={TrendingDown} iconBg="bg-amber-100" iconColor="text-amber-600" accentBar="bg-amber-500" />
        <StatCard title="Familles en retard" value={stats.familiesOverdue} subtitle={`sur ${totalFees} familles`} icon={AlertTriangle} iconBg="bg-danger-100" iconColor="text-danger-600" accentBar="bg-danger-500" />
      </div>

      {/* Taux d'encaissement + Repartition statuts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Taux encaissement */}
        <div className="card space-y-3">
          <h3 className="text-sm font-bold text-secondary-800 flex items-center gap-1.5">
            <TrendingUp size={14} className="text-success-500" /> Taux d'encaissement
          </h3>
          <div className="flex items-end gap-3">
            <p className="text-4xl font-bold text-secondary-800">{collectRate}%</p>
            <p className="text-xs text-warm-400 pb-1">du total facturé</p>
          </div>
          <div className="h-3 bg-warm-100 rounded-full overflow-hidden">
            <div className="h-full bg-success-500 rounded-full transition-all" style={{ width: `${collectRate}%` }} />
          </div>
        </div>

        {/* Repartition */}
        <div className="card space-y-3">
          <h3 className="text-sm font-bold text-secondary-800 flex items-center gap-1.5">
            <Wallet size={14} className="text-blue-500" /> Répartition des statuts
          </h3>
          {totalFees > 0 && (
            <>
              <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
                {Object.entries(stats.feesByStatus).filter(([, v]) => v > 0).map(([status, count]) => (
                  <div key={status} className={clsx('rounded-full', STATUS_COLORS[status])} style={{ width: `${(count / totalFees) * 100}%` }} title={`${STATUS_LABELS[status]}: ${count}`} />
                ))}
              </div>
              <div className="flex flex-wrap gap-3 mt-1">
                {Object.entries(stats.feesByStatus).filter(([, v]) => v > 0).map(([status, count]) => (
                  <span key={status} className="flex items-center gap-1 text-[10px] text-warm-500">
                    <span className={clsx('w-2 h-2 rounded-full', STATUS_COLORS[status])} />
                    {STATUS_LABELS[status]} ({count})
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Derniers paiements + Familles en retard */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Derniers paiements */}
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-secondary-800">Derniers paiements</h3>
            <Link href="/dashboard/financements" className="text-xs text-primary-600 hover:text-primary-800">Voir tout</Link>
          </div>
          {stats.recentPayments.length === 0 ? (
            <p className="text-xs text-warm-400 italic py-4 text-center">Aucun paiement récent</p>
          ) : (
            <div className="space-y-1.5">
              {stats.recentPayments.map(p => (
                <div key={p.id} className="flex items-center gap-2 bg-warm-50 rounded-lg px-3 py-1.5 text-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-success-500 flex-shrink-0" />
                  <span className="font-medium text-warm-700 truncate">
                    {p.family_fees?.parents?.tutor1_last_name} {p.family_fees?.parents?.tutor1_first_name}
                  </span>
                  <span className="ml-auto font-bold text-success-600 flex-shrink-0">{formatCurrency(Number(p.amount_paid))}</span>
                  <span className="text-warm-400 flex-shrink-0">{METHOD_LABELS[p.payment_method ?? ''] ?? p.payment_method}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Familles en retard */}
        <div className="card space-y-3">
          <h3 className="text-sm font-bold text-secondary-800 flex items-center gap-1.5">
            <AlertTriangle size={14} className="text-danger-500" /> Familles en retard
          </h3>
          {stats.overdueFamilies.length === 0 ? (
            <p className="text-xs text-warm-400 italic py-4 text-center">Aucune famille en retard</p>
          ) : (
            <div className="space-y-1.5">
              {stats.overdueFamilies.map(f => (
                <div key={f.id} className="flex items-center gap-2 bg-danger-50 rounded-lg px-3 py-1.5 text-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-danger-500 flex-shrink-0" />
                  <span className="font-medium text-warm-700 truncate">
                    {f.parents?.tutor1_last_name} {f.parents?.tutor1_first_name}
                  </span>
                  <span className="ml-auto font-bold text-danger-600 flex-shrink-0">{formatCurrency(Number(f.total_due))}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Raccourcis */}
      <div className="card space-y-3">
        <h3 className="text-sm font-bold text-secondary-800">Raccourcis</h3>
        <div className="grid grid-cols-2 gap-2">
          <Link href="/dashboard/financements" className="btn-secondary text-xs py-2 flex items-center justify-center gap-1.5">
            <DollarSign size={14} /> Financements
          </Link>
          <Link href="/dashboard/cotisations" className="btn-secondary text-xs py-2 flex items-center justify-center gap-1.5">
            <Wallet size={14} /> Cotisations
          </Link>
        </div>
      </div>
    </div>
  )
}
