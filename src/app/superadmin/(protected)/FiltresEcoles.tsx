'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { X } from 'lucide-react'
import FiltreSwitch from '@/components/ui/FiltreSwitch'

/**
 * Filtres de la liste des établissements (console), en `FiltreSwitch` comme
 * toutes les listes de l'application.
 *
 * L'état vit dans l'ADRESSE (`?filtre=` et `?q=`) : la page, rendue côté
 * serveur, filtre elle-même, et le filtre survit au retour depuis une fiche.
 * Ce composant ne fait qu'écrire l'adresse. La saisie de la recherche est dans
 * la barre du haut (recherche globale) ; ici, seulement le rappel du terme.
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

  const ecrire = (cle: 'filtre' | 'q', valeur: string) => {
    const p = new URLSearchParams(params.toString())
    if (!valeur || (cle === 'filtre' && valeur === 'toutes')) p.delete(cle)
    else p.set(cle, valeur)
    const qs = p.toString()
    router.replace(qs ? `?${qs}` : '?', { scroll: false })
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <FiltreSwitch
        ariaLabel="Filtrer les établissements"
        actif={filtre}
        onChange={v => ecrire('filtre', v)}
        options={(Object.keys(LIBELLES) as Filtre[]).map(f => ({
          valeur: f,
          nombre: comptes[f],
          libelle: LIBELLES[f],
          couleur: f === 'echeance' || f === 'surveiller' ? 'text-amber-700' : f === 'inactives' ? 'text-red-700' : undefined,
        }))}
      />
      {q && (
        <span className="inline-flex items-center gap-1.5 pl-3 pr-1 py-1 rounded-full text-xs bg-[var(--surface-card)] border border-[var(--card-border)] text-[var(--ink)]">
          Recherche : <span className="font-semibold">{q}</span>
          <button
            type="button"
            onClick={() => ecrire('q', '')}
            aria-label="Effacer la recherche"
            className="p-1 rounded-full text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--survol-ligne)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-focus)]"
          >
            <X size={12} />
          </button>
        </span>
      )}
    </div>
  )
}
