'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { clsx } from 'clsx'
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip as RTooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line, ReferenceLine,
} from 'recharts'
import Tooltip from '@/components/ui/Tooltip'
import type { FeeStatus } from '@/types/database'

// ─── Types ────────────────────────────────────────────────────────────────────

interface FamilyRow {
  parentId: string
  parentLabel: string
  totalDue: number
  totalPaid: number
  remaining: number
  status: FeeStatus
}

interface Props {
  rows: FamilyRow[]
  yearLabel: string
  monthly: { key: string; label: string; amount: number; cumul: number }[]
  byMethod: Record<string, number>
  byCotisation: { label: string; billed: number; count: number; isAdult: boolean }[]
}

// ─── Palette (validee : scripts/validate_palette.js, surface #ffffff) ─────────
// Les rampes `secondary` (ardoise) et `warm` (beige) de la charte tombent sous le
// plancher de chroma : inutilisables comme couleurs categorielles (elles lisent
// gris). D'ou marque en tete (turquoise + ambre) puis emprunts separables.
const SERIES = {
  encaisse: '#18aa99',   // primary-500 — couleur positive de l'app
  reste:    '#f97316',   // orange-500 — orange de la charte
}

// Moyens de paiement : 5 slots, palette validee (CVD + normal-vision OK).
const METHOD_COLORS = ['#18aa99', '#cc8200', '#2a78d6', '#e87ba4', '#4a3aa7']

// Statut = palette d'ETAT (reservee), alignee sur les pastilles de Reglements.
// Jamais la couleur seule : toujours accompagnee de son libelle.
const STATUS_COLOR: Record<FeeStatus, string> = {
  pending:  '#d0c6ba',   // warm-300
  partial:  '#fb923c',   // orange-400
  paid:     '#18aa99',   // primary-500
  overpaid: '#ef4444',   // red-500
}

const STATUS_LABELS: Record<FeeStatus, string> = {
  pending:  'En attente',
  partial:  'Partiel',
  paid:     'Soldé',
  overpaid: 'Trop perçu',
}

const METHOD_LABELS: Record<string, string> = {
  cash: 'Espèces', check: 'Chèque', card: 'CB', transfer: 'Virement', online: 'En ligne',
}

// Chrome des graphiques (ink recessif, jamais la couleur de serie sur le texte).
const INK = { muted: '#898781', grid: '#e1e0d9', axis: '#c3c2b7' }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency', currency: 'EUR',
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(n)
}

/** Montants d'axe : compacts, sans decimales (les valeurs exactes sont au survol). */
function fmtAxis(n: number) {
  if (Math.abs(n) >= 1000) return `${Math.round(n / 100) / 10} k€`
  return `${Math.round(n)} €`
}

/** Tooltip commun : surface blanche, ink texte, pastille de serie a cote.
 *  `unit` non vide = valeurs en effectif (et non en euros). */
function VizTooltip({ active, payload, label, total, unit }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-warm-200 bg-white px-2.5 py-1.5 shadow-lg">
      {label && <p className="text-[11px] font-semibold text-secondary-800 mb-0.5">{label}</p>}
      {payload.map((p: any) => {
        const value = Number(p.value ?? 0)
        const pct = total && total > 0 ? ` (${Math.round((value / total) * 100)} %)` : ''
        const shown = unit ? `${value} ${unit}${value > 1 ? 's' : ''}` : fmt(value)
        return (
          <p key={p.dataKey ?? p.name} className="flex items-center gap-1.5 text-[11px] text-secondary-700">
            <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: p.color ?? p.payload?.fill }} aria-hidden="true" />
            <span className="text-warm-500">{p.name}</span>
            <span className="font-semibold tabular-nums ml-auto">{shown}{pct}</span>
          </p>
        )
      })}
    </div>
  )
}

/** Encadre de graphique : titre + aide facultative + zone de trace a hauteur fixe. */
function VizCard({ title, hint, height = 200, children, className }: {
  title: string; hint?: string; height?: number; children: React.ReactNode; className?: string
}) {
  return (
    <section className={clsx('card p-3 flex flex-col', className)}>
      <div className="flex items-baseline gap-2 mb-2">
        <h2 className="stat-label">{title}</h2>
        {hint && <p className="text-[10px] text-warm-400">{hint}</p>}
      </div>
      <div style={{ height }} className="min-w-0">{children}</div>
    </section>
  )
}

/** Legende maison : identite jamais portee par la couleur seule. */
function VizLegend({ items }: { items: { label: string; color: string; value?: string }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5">
      {items.map(i => (
        <li key={i.label} className="flex items-center gap-1.5 text-[11px] text-secondary-700">
          <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: i.color }} aria-hidden="true" />
          {i.label}
          {i.value && <span className="text-warm-500 tabular-nums">· {i.value}</span>}
        </li>
      ))}
    </ul>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function VueGlobaleClient({ rows, yearLabel, monthly, byMethod, byCotisation }: Props) {
  const router = useRouter()

  // ── Agregats (identiques au bandeau de Reglements) ──────────────────────────
  const kpi = useMemo(() => {
    let billed = 0, collected = 0, outstanding = 0, overpaid = 0
    const counts: Record<FeeStatus, number> = { pending: 0, partial: 0, paid: 0, overpaid: 0 }
    for (const r of rows) {
      billed      += r.totalDue
      collected   += Math.max(0, r.totalPaid)
      outstanding += Math.max(0, r.remaining)
      overpaid    += Math.max(0, -r.remaining)
      counts[r.status]++
    }
    const rate = billed > 0 ? Math.min(100, Math.round((Math.min(collected, billed) / billed) * 100)) : 0
    return { billed, collected, outstanding, overpaid, counts, rate }
  }, [rows])

  // Tableau : le reste du en tete (c'est la liste de travail du comptable).
  const sortedRows = useMemo(
    () => [...rows].sort((a, b) => b.remaining - a.remaining),
    [rows]
  )

  const statusData = useMemo(
    () => (['paid', 'partial', 'pending', 'overpaid'] as FeeStatus[])
      .filter(s => kpi.counts[s] > 0)
      .map(s => ({ name: STATUS_LABELS[s], value: kpi.counts[s], fill: STATUS_COLOR[s] })),
    [kpi.counts]
  )

  // Moyens de paiement : au-dela de 4, on replie sur « Autres » (jamais de teinte generee).
  const methodData = useMemo(() => {
    const all = Object.entries(byMethod)
      .map(([k, v]) => ({ name: METHOD_LABELS[k] ?? k, value: v }))
      .sort((a, b) => b.value - a.value)
    if (all.length <= METHOD_COLORS.length) {
      return all.map((d, i) => ({ ...d, fill: METHOD_COLORS[i] }))
    }
    const head = all.slice(0, METHOD_COLORS.length - 1)
    const rest = all.slice(METHOD_COLORS.length - 1).reduce((s, d) => s + d.value, 0)
    return [...head, { name: 'Autres', value: rest }].map((d, i) => ({ ...d, fill: METHOD_COLORS[i] }))
  }, [byMethod])

  const methodTotal = useMemo(() => methodData.reduce((s, d) => s + d.value, 0), [methodData])

  const topDebtors = useMemo(
    () => sortedRows.filter(r => r.remaining > 0).slice(0, 10),
    [sortedRows]
  )
  const topMax = topDebtors[0]?.remaining ?? 0

  const cotisData = useMemo(() => byCotisation.slice(0, 8), [byCotisation])

  const openFamily = (parentId: string) => router.push(`/dashboard/financements/reglements?parent=${parentId}`)

  if (rows.length === 0) {
    return (
      <div className="card p-8 text-center">
        <p className="text-sm text-warm-500">Aucun dossier pour l'année {yearLabel}.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">

      {/* ── Bandeau (memes intitules que Reglements) ── */}
      <div className={clsx('grid grid-cols-2 gap-2', kpi.counts.overpaid > 0 ? 'lg:grid-cols-6' : 'lg:grid-cols-5')}>
        <div className="card px-3 py-2">
          <p className="stat-label">Dossiers</p>
          <p className="text-lg font-bold text-secondary-800 tabular-nums">{rows.length}</p>
        </div>
        <div className="card px-3 py-2">
          <p className="stat-label">Facturé</p>
          <p className="text-lg font-bold text-secondary-800 tabular-nums">{fmt(kpi.billed)}</p>
        </div>
        <div className="card px-3 py-2">
          <p className="stat-label">Encaissé</p>
          <p className="text-lg font-bold text-primary-600 tabular-nums">{fmt(kpi.collected)}</p>
        </div>
        <div className="card px-3 py-2">
          <p className="stat-label">Reste à encaisser</p>
          <p className="text-lg font-bold text-orange-700 tabular-nums">{fmt(kpi.outstanding)}</p>
        </div>
        {kpi.counts.overpaid > 0 && (
          <div className="card px-3 py-2">
            <p className="stat-label flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-500" aria-hidden="true" /> Trop perçu
            </p>
            <p className="text-lg font-bold text-red-600 tabular-nums flex items-baseline justify-between gap-2">
              <span>{kpi.counts.overpaid}</span>
              <span>{fmt(kpi.overpaid)}</span>
            </p>
          </div>
        )}
        <div className="card px-3 py-2">
          <p className="stat-label">Taux de recouvrement</p>
          <div className="flex items-center gap-2">
            <p className="text-lg font-bold text-secondary-800 tabular-nums">{kpi.rate} %</p>
            <div className="flex-1 h-1.5 rounded-full bg-warm-100 overflow-hidden" aria-hidden="true">
              <div className="h-full rounded-full" style={{ width: `${kpi.rate}%`, background: SERIES.encaisse }} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Ligne 1 : répartitions (2 donuts dans un seul encadré) + activités ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <section className="card p-3">
          <h2 className="text-[11px] font-bold text-warm-500 uppercase tracking-widest mb-2">Répartitions</h2>
          <div className="grid grid-cols-2 gap-2">
            {/* Statut */}
            <div className="min-w-0">
              <p className="text-[10px] text-warm-400 text-center mb-1">Dossiers par statut</p>
              <div style={{ height: 132 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusData} dataKey="value" nameKey="name"
                      innerRadius="52%" outerRadius="82%" paddingAngle={2} stroke="#ffffff" strokeWidth={2}
                      isAnimationActive={false}
                    >
                      {statusData.map(d => <Cell key={d.name} fill={d.fill} />)}
                    </Pie>
                    <RTooltip content={<VizTooltip total={rows.length} unit="dossier" />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <VizLegend items={statusData.map(d => ({ label: d.name, color: d.fill, value: String(d.value) }))} />
            </div>

            {/* Moyens de paiement */}
            <div className="min-w-0 lg:border-l lg:border-warm-100 lg:pl-2">
              <p className="text-[10px] text-warm-400 text-center mb-1">Moyens de paiement</p>
              {methodTotal === 0 ? (
                <p className="text-xs text-warm-400 italic grid place-items-center" style={{ height: 132 }}>Aucun encaissement.</p>
              ) : (
                <>
                  <div style={{ height: 132 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={methodData} dataKey="value" nameKey="name"
                          innerRadius="52%" outerRadius="82%" paddingAngle={2} stroke="#ffffff" strokeWidth={2}
                          isAnimationActive={false}
                        >
                          {methodData.map(d => <Cell key={d.name} fill={d.fill} />)}
                        </Pie>
                        <RTooltip content={<VizTooltip total={methodTotal} />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <VizLegend items={methodData.map(d => ({ label: d.name, color: d.fill }))} />
                </>
              )}
            </div>
          </div>
        </section>

        <VizCard
          title="Facturé par activité"
          hint="l'encaissé n'est pas ventilable (paiement au foyer)"
          height={Math.max(150, cotisData.length * 24)}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={cotisData} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 8 }} barSize={14}>
              <CartesianGrid horizontal={false} stroke={INK.grid} />
              <XAxis type="number" tickFormatter={fmtAxis} tick={{ fill: INK.muted, fontSize: 10 }} axisLine={{ stroke: INK.axis }} tickLine={false} />
              <YAxis type="category" dataKey="label" tick={{ fill: INK.muted, fontSize: 10 }} axisLine={false} tickLine={false} width={110} />
              <RTooltip content={<VizTooltip total={kpi.billed} />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
              <Bar dataKey="billed" name="Facturé" fill={SERIES.encaisse} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </VizCard>
      </div>

      {/* ── Ligne 2 : débiteurs + rythme ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <section className="card p-3 flex flex-col">
          <div className="flex items-baseline gap-2 mb-2">
            <h2 className="stat-label">Top 10 familles débitrices</h2>
            <p className="text-[10px] text-warm-400">cliquer pour ouvrir le dossier</p>
          </div>
          {topDebtors.length === 0 ? (
            <p className="text-xs text-warm-400 italic py-6 text-center">Aucun impayé.</p>
          ) : (
            <ul className="space-y-0.5">
              {topDebtors.map(r => (
                <li key={r.parentId}>
                  <button
                    type="button"
                    onClick={() => openFamily(r.parentId)}
                    className="w-full flex items-center gap-2 px-1 py-0.5 rounded hover:bg-warm-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                  >
                    <Tooltip content={r.parentLabel} maxWidth="max-w-none" className="min-w-0 flex-1">
                      <span className="block text-[11px] text-secondary-800 text-left truncate whitespace-nowrap">
                        {r.parentLabel}
                      </span>
                    </Tooltip>
                    <span className="w-24 h-2 rounded-full bg-warm-100 overflow-hidden shrink-0" aria-hidden="true">
                      <span className="block h-full rounded-full"
                        style={{ width: `${topMax > 0 ? (r.remaining / topMax) * 100 : 0}%`, background: SERIES.reste }} />
                    </span>
                    <span className="w-20 text-[11px] font-semibold text-orange-700 tabular-nums text-right shrink-0">
                      {fmt(r.remaining)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <VizCard title="Rythme de collecte" hint="cumul encaissé vs facturé" height={168}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={monthly} margin={{ top: 8, right: 12, bottom: 0, left: 8 }}>
              <CartesianGrid vertical={false} stroke={INK.grid} />
              <XAxis dataKey="label" tick={{ fill: INK.muted, fontSize: 10 }} axisLine={{ stroke: INK.axis }} tickLine={false} interval="preserveStartEnd" />
              <YAxis tickFormatter={fmtAxis} tick={{ fill: INK.muted, fontSize: 10 }} axisLine={false} tickLine={false} width={52} />
              <RTooltip content={<VizTooltip />} cursor={{ stroke: INK.axis }} />
              <ReferenceLine y={kpi.billed} stroke={INK.muted} strokeDasharray="4 4"
                label={{ value: 'Facturé', position: 'insideTopLeft', fill: INK.muted, fontSize: 10 }} />
              <Line type="monotone" dataKey="cumul" name="Cumul encaissé" stroke={SERIES.encaisse}
                strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: '#ffffff' }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </VizCard>
      </div>

      {/* ── Tableau des dossiers (reste dû décroissant) : la vue non graphique ── */}
      <section className="card p-0">
        <div className="px-3 py-2 border-b border-warm-100">
          <h2 className="stat-label">
            Dossiers · {yearLabel} <span className="text-warm-400 font-medium normal-case tracking-normal">· reste dû décroissant</span>
          </h2>
        </div>
        <div className="max-h-56 overflow-y-auto list-scroll">
          <table className="w-full text-xs leading-4" aria-label={`Dossiers ${yearLabel}, triés par reste dû décroissant`}>
            <thead className="sticky top-0 bg-white z-10">
              <tr>
                <th scope="col" className="list-th text-left">Famille</th>
                <th scope="col" className="list-th text-center">Statut</th>
                <th scope="col" className="list-th text-right">Dû</th>
                <th scope="col" className="list-th text-right">Perçu</th>
                <th scope="col" className="list-th text-right">Reste</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-warm-50">
              {sortedRows.map(r => (
                <tr key={r.parentId} onClick={() => openFamily(r.parentId)} className="hover:bg-warm-50 cursor-pointer transition-colors">
                  {/* Densite maximale : on herite du text-xs de la table (pas de
                      `list-name`, dont le 13px rallonge chaque ligne). */}
                  <td className="list-td font-medium text-secondary-800">{r.parentLabel}</td>
                  <td className="list-td text-center">
                    <span className="inline-flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: STATUS_COLOR[r.status] }} aria-hidden="true" />
                      {STATUS_LABELS[r.status]}
                    </span>
                  </td>
                  <td className="list-td text-right tabular-nums">{fmt(r.totalDue)}</td>
                  <td className="list-td text-right tabular-nums text-primary-600">{fmt(r.totalPaid)}</td>
                  <td className={clsx('list-td text-right tabular-nums font-semibold',
                    r.remaining > 0 ? 'text-orange-700' : r.remaining < 0 ? 'text-red-600' : 'text-warm-400')}>
                    {r.remaining < 0 ? `+ ${fmt(Math.abs(r.remaining))}` : fmt(Math.max(0, r.remaining))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
