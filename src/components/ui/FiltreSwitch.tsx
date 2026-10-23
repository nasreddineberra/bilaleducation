'use client'

import { clsx } from 'clsx'
import type { ReactNode } from 'react'
import Tooltip from '@/components/ui/Tooltip'

/**
 * Filtres d'une liste en SWITCH segmente (charte du 15/10/2026, validee sur la
 * page modele) : remplace la rangee de cartes `ListStatCard` cliquables.
 *
 * Un bloc borde, un segment par filtre (compteur + libelle). Le segment actif
 * prend le vert de marque ; hors selection, le chiffre garde sa couleur
 * semantique (`couleur`). Motif des bascules de l'emploi du temps.
 * Sert aussi a un choix de valeur unique (mode de paiement) : aucun segment
 * actif tant que `actif` ne correspond a aucune option.
 */
export interface OptionFiltre {
  valeur:   string
  /** Compteur du segment ; absent = segment de simple choix (ex. periode). */
  nombre?:  ReactNode
  libelle:  string
  /** Couleur du chiffre hors selection (ex. 'text-orange-600'). */
  couleur?: string
  /** Segment grise (possible dans d'autres circonstances) ; `infobulle` en donne la raison. */
  desactive?: boolean
  infobulle?: ReactNode
}

export default function FiltreSwitch({ options, actif, onChange, ariaLabel }: {
  options:   OptionFiltre[]
  actif:     string
  onChange:  (valeur: string) => void
  ariaLabel: string
}) {
  return (
    // Sur telephone, une seule ligne qui defile au doigt : le retour a la ligne
    // empilait les segments en colonne irreguliere (Support, 23/10).
    <div role="group" aria-label={ariaLabel} className="flex flex-wrap max-md:flex-nowrap max-md:max-w-full max-md:overflow-x-auto rounded-lg overflow-hidden text-xs font-medium border border-warm-300">
      {options.map((o, i) => {
        const estActif = !o.desactive && actif === o.valeur
        const segment = (
          <button
            key={o.valeur || '__tous__'}
            type="button"
            disabled={o.desactive}
            aria-pressed={estActif}
            onClick={() => onChange(o.valeur)}
            className={clsx(
              'flex items-baseline gap-1.5 px-3 py-1.5 max-md:shrink-0 max-md:whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--brand-accent)]',
              i > 0 && 'border-l border-warm-300',
              o.desactive
                ? 'bg-[var(--champ-verrou)] text-warm-400 cursor-not-allowed'
                : estActif
                  ? 'bg-[var(--brand-surface)] text-white dark:bg-[var(--brand-accent)] dark:text-[var(--brand-surface-2)]'
                  : 'bg-white text-warm-700 hover:bg-warm-50',
            )}
          >
            {o.nombre !== undefined && (
              <span className={clsx('text-sm font-bold tabular-nums', !estActif && (o.couleur ?? 'text-secondary-800'))}>{o.nombre}</span>
            )}
            {o.libelle}
          </button>
        )
        return o.infobulle
          ? <Tooltip key={o.valeur || '__tous__'} content={o.infobulle}>{segment}</Tooltip>
          : segment
      })}
    </div>
  )
}
