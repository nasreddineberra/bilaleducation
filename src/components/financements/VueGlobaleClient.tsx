'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { clsx } from 'clsx'
import { DollarSign, TrendingUp, TrendingDown, Users, Search, ChevronRight, ArrowUpDown } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface FamilyRow {
  id: string
  parentId: string
  parentName: string
  tutor2Name: string | null
  childrenCount: number
  totalDue: number
  paid: number
  remaining: number
  status: string
}

interface Props {
  yearLabel: string
  summary: {
    totalFamilies: number
    totalDue: number
    totalPaid: number
    remaining: number
    feesByStatus: { pending: number; partial: number; paid: number; overdue: number; overpaid: number }
  }
  families: FamilyRow[]
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending:  { label: 'En attente', color: 'text-warm-600',    bg: 'bg-warm-100' },
  partial:  { label: 'Partiel',    color: 'text-amber-700',   bg: 'bg-amber-100' },
  paid:     { label: 'Solde',      color: 'text-success-700', bg: 'bg-success-100' },
  overdue:  { label: 'En retard',  color: 'text-danger-700',  bg: 'bg-danger-100' },
  overpaid: { label: 'Trop percu', color: 'text-red-700',     bg: 'bg-red-100' },
}

const BAR_COLORS: Record<string, string> = {
  paid: 'bg-success-500', partial: 'bg-amber-500', pending: 'bg-warm-300', overdue: 'bg-danger-500', overpaid: 'bg-red-500',
}

function fmt(n: number): string {
  return n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })
}

type SortKey = 'name' | 'children' | 'due' | 'paid' | 'remaining' | 'status'

// ─── Component ───────────────────────────────────────────────────────────────

export default function VueGlobaleClient({ yearLabel, summary, families }: Props) {
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortAsc, setSortAsc] = useState(true)

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc)
    else { setSortKey(key); setSortAsc(true) }
  }

  const filtered = useMemo(() => {
    let list = families
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(f => f.parentName.toLowerCase().includes(q) || (f.tutor2Name?.toLowerCase().includes(q) ?? false))
    }
    if (filterStatus) list = list.filter(f => f.status === filterStatus)

    list = [...list].sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case 'name': cmp = a.parentName.localeCompare(b.parentName); break
        case 'children': cmp = a.childrenCount - b.childrenCount; break
        case 'due': cmp = a.totalDue - b.totalDue; break
        case 'paid': cmp = a.paid - b.paid; break
        case 'remaining': cmp = a.remaining - b.remaining; break
        case 'status': cmp = a.status.localeCompare(b.status); break
      }
      return sortAsc ? cmp : -cmp
    })
    return list
  }, [families, search, filterStatus, sortKey, sortAsc])

  const collectRate = summary.totalDue > 0 ? Math.round((summary.totalPaid / summary.totalDue) * 100) : 0
  const totalFees = summary.totalFamilies

  return (
    <div className="space-y-5">

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card card-hover relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-blue-500 rounded-t-2xl" />
          <div className="flex items-center justify-between pt-2">
            <div>
              <p className="text-xs font-semibold text-warm-500 uppercase tracking-wider">Total du</p>
              <p className="text-2xl font-bold text-secondary-800 mt-1">{fmt(summary.totalDue)}</p>
              <p className="text-xs text-warm-400 mt-1">{summary.totalFamilies} famille{summary.totalFamilies > 1 ? 's' : ''}</p>
            </div>
            <div className="p-3 rounded-2xl bg-blue-100 shadow-sm"><DollarSign className="w-6 h-6 text-blue-600" /></div>
          </div>
        </div>

        <div className="card card-hover relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-success-500 rounded-t-2xl" />
          <div className="flex items-center justify-between pt-2">
            <div>
              <p className="text-xs font-semibold text-warm-500 uppercase tracking-wider">Encaisse</p>
              <p className="text-2xl font-bold text-secondary-800 mt-1">{fmt(summary.totalPaid)}</p>
              <p className="text-xs text-warm-400 mt-1">{collectRate}% du total</p>
            </div>
            <div className="p-3 rounded-2xl bg-success-100 shadow-sm"><TrendingUp className="w-6 h-6 text-success-600" /></div>
          </div>
        </div>

        <div className="card card-hover relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-amber-500 rounded-t-2xl" />
          <div className="flex items-center justify-between pt-2">
            <div>
              <p className="text-xs font-semibold text-warm-500 uppercase tracking-wider">Reste a percevoir</p>
              <p className="text-2xl font-bold text-secondary-800 mt-1">{fmt(summary.remaining)}</p>
            </div>
            <div className="p-3 rounded-2xl bg-amber-100 shadow-sm"><TrendingDown className="w-6 h-6 text-amber-600" /></div>
          </div>
        </div>

        <div className="card card-hover relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-primary-500 rounded-t-2xl" />
          <div className="flex items-center justify-between pt-2">
            <div>
              <p className="text-xs font-semibold text-warm-500 uppercase tracking-wider">Taux encaissement</p>
              <p className="text-2xl font-bold text-secondary-800 mt-1">{collectRate}%</p>
              <div className="h-2 w-24 bg-warm-100 rounded-full overflow-hidden mt-2">
                <div className="h-full bg-success-500 rounded-full" style={{ width: `${collectRate}%` }} />
              </div>
            </div>
            <div className="p-3 rounded-2xl bg-primary-100 shadow-sm"><Users className="w-6 h-6 text-primary-600" /></div>
          </div>
        </div>
      </div>

      {/* Barre repartition statuts */}
      {totalFees > 0 && (
        <div className="card p-3 space-y-2">
          <p className="text-xs font-bold text-warm-500 uppercase tracking-widest">Repartition des statuts</p>
          <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
            {Object.entries(summary.feesByStatus).filter(([, v]) => v > 0).map(([status, count]) => (
              <div key={status} className={clsx('rounded-full', BAR_COLORS[status])} style={{ width: `${(count / totalFees) * 100}%` }} title={`${STATUS_CONFIG[status]?.label}: ${count}`} />
            ))}
          </div>
          <div className="flex flex-wrap gap-3">
            {Object.entries(summary.feesByStatus).filter(([, v]) => v > 0).map(([status, count]) => (
              <span key={status} className="flex items-center gap-1 text-[10px] text-warm-500">
                <span className={clsx('w-2 h-2 rounded-full', BAR_COLORS[status])} />
                {STATUS_CONFIG[status]?.label} ({count})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Filtres */}
      <div className="card px-3 py-2 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-warm-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher une famille..."
            className="input text-sm py-1.5 pl-8 w-full"
          />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="input text-sm py-1.5">
          <option value="">Tous les statuts</option>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        <span className="text-xs text-warm-400 ml-auto">{filtered.length} famille{filtered.length > 1 ? 's' : ''}</span>
      </div>

      {/* Tableau familles */}
      {filtered.length === 0 ? (
        <div className="card px-6 py-10 text-center">
          <DollarSign size={32} className="mx-auto text-warm-300 mb-2" />
          <p className="text-sm text-warm-400">Aucune famille trouvee.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-warm-50 border-b border-warm-100">
                <SortHeader label="Famille" sortKey="name" current={sortKey} asc={sortAsc} onSort={toggleSort} />
                <SortHeader label="Enfants" sortKey="children" current={sortKey} asc={sortAsc} onSort={toggleSort} className="text-center" />
                <SortHeader label="Total du" sortKey="due" current={sortKey} asc={sortAsc} onSort={toggleSort} className="text-right" />
                <SortHeader label="Paye" sortKey="paid" current={sortKey} asc={sortAsc} onSort={toggleSort} className="text-right" />
                <SortHeader label="Reste" sortKey="remaining" current={sortKey} asc={sortAsc} onSort={toggleSort} className="text-right" />
                <SortHeader label="Statut" sortKey="status" current={sortKey} asc={sortAsc} onSort={toggleSort} className="text-center" />
                <th className="px-3 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-warm-50">
              {filtered.map(f => {
                const cfg = STATUS_CONFIG[f.status] ?? STATUS_CONFIG.pending
                return (
                  <tr key={f.id} className="hover:bg-warm-50 transition-colors">
                    <td className="px-3 py-2">
                      <p className="font-medium text-warm-700">{f.parentName}</p>
                      {f.tutor2Name && <p className="text-xs text-warm-400">{f.tutor2Name}</p>}
                    </td>
                    <td className="px-3 py-2 text-center text-warm-600">{f.childrenCount}</td>
                    <td className="px-3 py-2 text-right font-medium text-warm-700">{fmt(f.totalDue)}</td>
                    <td className="px-3 py-2 text-right text-success-600 font-medium">{fmt(f.paid)}</td>
                    <td className={clsx('px-3 py-2 text-right font-medium', f.remaining > 0 ? 'text-amber-600' : 'text-success-600')}>
                      {fmt(f.remaining)}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={clsx('px-2 py-0.5 rounded-full text-[10px] font-bold uppercase', cfg.bg, cfg.color)}>
                        {cfg.label}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Link
                        href={`/dashboard/financements/reglements?parent=${f.parentId}`}
                        className="text-primary-600 hover:text-primary-800"
                        title="Voir la fiche"
                      >
                        <ChevronRight size={16} />
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Sort Header ─────────────────────────────────────────────────────────────

function SortHeader({ label, sortKey: key, current, asc, onSort, className }: {
  label: string; sortKey: SortKey; current: SortKey; asc: boolean; onSort: (k: SortKey) => void; className?: string
}) {
  const isActive = current === key
  return (
    <th className={clsx('px-3 py-2 text-xs font-bold text-warm-500 uppercase cursor-pointer select-none hover:text-warm-700', className)} onClick={() => onSort(key)}>
      <span className="inline-flex items-center gap-0.5">
        {label}
        <ArrowUpDown size={10} className={clsx(isActive ? 'text-primary-500' : 'text-warm-300')} />
      </span>
    </th>
  )
}
