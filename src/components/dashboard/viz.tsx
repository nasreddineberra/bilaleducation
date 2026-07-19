'use client'

import { clsx } from 'clsx'
import type { FeeStatus } from '@/types/database'

// ─── Palette (validee : scripts/validate_palette.js, surface #ffffff) ─────────
// IDENTIQUE a Stats reglements (VueGlobaleClient) : marque en tete (turquoise +
// ambre) puis emprunts separables. Les rampes `secondary`/`warm` de la charte
// tombent sous le plancher de chroma (elles lisent gris) → pas categorielles.
export const SERIES = {
  primary: '#18aa99', // primary-500 — couleur positive de l'app
  orange:  '#f97316', // orange-500 — orange de la charte
}

// Slots categoriels (CVD + normal-vision OK).
export const CATEGORICAL = ['#18aa99', '#cc8200', '#2a78d6', '#e87ba4', '#4a3aa7']

// Statut = palette d'ETAT (reservee), alignee sur les pastilles de Reglements.
export const STATUS_COLOR: Record<FeeStatus, string> = {
  pending:  '#d0c6ba', // warm-300
  partial:  '#fb923c', // orange-400
  paid:     '#18aa99', // primary-500
  overpaid: '#ef4444', // red-500
}

export const STATUS_LABELS: Record<FeeStatus, string> = {
  pending:  'En attente',
  partial:  'Partiel',
  paid:     'Soldé',
  overpaid: 'Trop perçu',
}

export const METHOD_LABELS: Record<string, string> = {
  cash: 'Espèces', check: 'Chèque', card: 'CB', transfer: 'Virement', online: 'En ligne',
}

// Chrome des graphiques (ink recessif, jamais la couleur de serie sur le texte).
export const INK = { muted: '#898781', grid: '#e1e0d9', axis: '#c3c2b7' }

// ─── Helpers de format ────────────────────────────────────────────────────────

export function fmtEur(n: number) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency', currency: 'EUR',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(n)
}

/** Montants d'axe : compacts (les valeurs exactes sont au survol). */
export function fmtAxis(n: number) {
  if (Math.abs(n) >= 1000) return `${Math.round(n / 100) / 10} k€`
  return `${Math.round(n)} €`
}

// ─── Tooltip commun ─────────────────────────────────────────────────────────
// `unit` non vide = valeurs en effectif (et non en euros).
export function VizTooltip({ active, payload, label, total, unit }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-warm-200 bg-white px-2.5 py-1.5 shadow-lg">
      {label && <p className="text-[11px] font-semibold text-secondary-800 mb-0.5">{label}</p>}
      {payload.map((p: any) => {
        const value = Number(p.value ?? 0)
        const pct = total && total > 0 ? ` (${Math.round((value / total) * 100)} %)` : ''
        const shown = unit ? `${value} ${unit}${value > 1 ? 's' : ''}` : fmtEur(value)
        return (
          <p key={p.dataKey ?? p.name} className="flex items-center gap-1.5 text-[11px] text-secondary-700">
            <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: p.color ?? p.payload?.fill }} aria-hidden="true" />
            <span className="text-warm-700">{p.name}</span>
            <span className="font-semibold tabular-nums ml-auto">{shown}{pct}</span>
          </p>
        )
      })}
    </div>
  )
}

// ─── Encadre de graphique ─────────────────────────────────────────────────────
export function VizCard({ title, hint, height = 200, children, className }: {
  title: string; hint?: string; height?: number; children: React.ReactNode; className?: string
}) {
  return (
    <section className={clsx('card p-3 flex flex-col', className)}>
      <div className="flex items-baseline gap-2 mb-2">
        <h3 className="stat-label">{title}</h3>
        {hint && <p className="text-[10px] text-warm-700">{hint}</p>}
      </div>
      <div style={{ height }} className="min-w-0">{children}</div>
    </section>
  )
}

// ─── Legende maison ───────────────────────────────────────────────────────────
// Identite jamais portee par la couleur seule.
export function VizLegend({ items }: { items: { label: string; color: string; value?: string }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5">
      {items.map(i => (
        <li key={i.label} className="flex items-center gap-1.5 text-[11px] text-secondary-700">
          <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: i.color }} aria-hidden="true" />
          {i.label}
          {i.value && <span className="text-warm-700 tabular-nums">· {i.value}</span>}
        </li>
      ))}
    </ul>
  )
}
