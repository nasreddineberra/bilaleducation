'use client'

import { clsx } from 'clsx'
import type { ReactNode } from 'react'

/**
 * Filtres d'une liste en SWITCH segmente (charte du 15/10/2026, validee sur la
 * page modele) : remplace la rangee de cartes `ListStatCard` cliquables.
 *
 * Un bloc borde, un segment par filtre (compteur + libelle). Le segment actif
 * prend le vert de marque ; hors selection, le chiffre garde sa couleur
 * semantique (`couleur`). Motif des bascules de l'emploi du temps.
 */
export interface OptionFiltre {
  valeur:   string
  nombre:   ReactNode
  libelle:  string
  /** Couleur du chiffre hors selection (ex. 'text-orange-600'). */
  couleur?: string
}

export default function FiltreSwitch({ options, actif, onChange, ariaLabel }: {
  options:   OptionFiltre[]
  actif:     string
  onChange:  (valeur: string) => void
  ariaLabel: string
}) {
  return (
    <div role="group" aria-label={ariaLabel} className="flex flex-wrap rounded-lg overflow-hidden text-xs font-medium border border-warm-300">
      {options.map((o, i) => {
        const estActif = actif === o.valeur
        return (
          <button
            key={o.valeur || '__tous__'}
            type="button"
            aria-pressed={estActif}
            onClick={() => onChange(o.valeur)}
            className={clsx(
              'flex items-baseline gap-1.5 px-3 py-1.5 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--brand-accent)]',
              i > 0 && 'border-l border-warm-300',
              estActif
                ? 'bg-[var(--brand-surface)] text-white dark:bg-[var(--brand-accent)] dark:text-[var(--brand-surface-2)]'
                : 'bg-white text-warm-700 hover:bg-warm-50',
            )}
          >
            <span className={clsx('text-sm font-bold tabular-nums', !estActif && (o.couleur ?? 'text-secondary-800'))}>{o.nombre}</span>
            {o.libelle}
          </button>
        )
      })}
    </div>
  )
}
