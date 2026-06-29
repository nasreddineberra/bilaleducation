'use client'

import { clsx } from 'clsx'
import type { ReactNode } from 'react'

/**
 * Carte statistique des listes globales (apprenants, parents, enseignants, classes…).
 * - Statique si `onClick` absent ; bouton/filtre cliquable sinon.
 * - Le liseré actif (`activeRing`) est en général assorti à la couleur des chiffres (`valueColor`).
 * NB : distinct de `dashboard/StatCard` (tuiles du tableau de bord).
 */
interface ListStatCardProps {
  value:        ReactNode
  label:        ReactNode
  valueColor?:  string   // ex. 'text-secondary-800', 'text-primary-600', 'text-red-500'
  active?:      boolean
  activeRing?:  string   // ex. 'ring-[#2e4550]', 'ring-primary-600'
  onClick?:     () => void
  className?:   string   // classes additionnelles sur la carte (ex. fond rouge)
}

export default function ListStatCard({
  value,
  label,
  valueColor = 'text-secondary-800',
  active = false,
  activeRing = 'ring-[#2e4550]',
  onClick,
  className,
}: ListStatCardProps) {
  const base = 'card px-4 py-1.5 flex items-center gap-3'

  const content = (
    <>
      <span className={clsx('text-xl font-bold', valueColor)}>{value}</span>
      <span className="text-xs text-warm-500 leading-tight">{label}</span>
    </>
  )

  if (!onClick) {
    return <div className={clsx(base, className)}>{content}</div>
  }

  return (
    <button
      onClick={onClick}
      className={clsx(
        base,
        'cursor-pointer transition-all',
        active ? `ring-2 ${activeRing}` : 'hover:shadow-md',
        className
      )}
    >
      {content}
    </button>
  )
}
