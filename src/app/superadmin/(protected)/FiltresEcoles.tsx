'use client'

import { useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { clsx } from 'clsx'
import { SearchField } from '@/components/ui/FloatFields'

/**
 * Filtres de la liste des établissements (console).
 *
 * L'état vit dans l'ADRESSE (`?filtre=` et `?q=`) : la page, rendue côté
 * serveur, filtre elle-même, et le filtre survit au retour depuis une fiche.
 * Ce composant ne fait qu'écrire l'adresse.
 */
export type Filtre = 'toutes' | 'surveiller' | 'echeance' | 'inactives'

const LIBELLES: Record<Filtre, string> = {
  toutes:     'Toutes',
  surveiller: 'À surveiller',
  echeance:   'Échéance < 30 j',
  inactives:  'Inactives',
}

export default function FiltresEcoles({ filtre, q, comptes }: {
  filtre: Filtre
  q: string
  comptes: Record<Filtre, number>
}) {
  const router = useRouter()
  const params = useSearchParams()
  const minuterie = useRef<ReturnType<typeof setTimeout> | null>(null)

  const ecrire = (cle: 'filtre' | 'q', valeur: string) => {
    const p = new URLSearchParams(params.toString())
    if (!valeur || (cle === 'filtre' && valeur === 'toutes')) p.delete(cle)
    else p.set(cle, valeur)
    const qs = p.toString()
    router.replace(qs ? `?${qs}` : '?', { scroll: false })
  }

  // La recherche relance un rendu serveur : on attend la fin de la frappe.
  const rechercher = (v: string) => {
    if (minuterie.current) clearTimeout(minuterie.current)
    minuterie.current = setTimeout(() => ecrire('q', v), 300)
  }

  return (
    <div className="card px-3 py-2 flex flex-wrap items-center gap-3">
      <SearchField
        value={q}
        onChange={rechercher}
        placeholder="Nom ou adresse…"
        ariaLabel="Rechercher un établissement par nom ou adresse"
      />
      <div className="flex flex-wrap items-center gap-1.5">
        {(Object.keys(LIBELLES) as Filtre[]).map(f => {
          const actif = filtre === f
          return (
            <button
              key={f}
              type="button"
              aria-pressed={actif}
              onClick={() => ecrire('filtre', f)}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400',
                actif
                  ? 'border-primary-300 bg-primary-50 text-primary-700'
                  : 'border-warm-200 text-warm-700 bg-white hover:bg-warm-50',
              )}
            >
              {LIBELLES[f]} <span className="tabular-nums">({comptes[f]})</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
