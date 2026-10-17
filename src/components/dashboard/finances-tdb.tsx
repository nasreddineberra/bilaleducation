'use client'

import type { FeeStatus } from '@/types/database'
import { STATUS_COLOR, CATEGORICAL, fmtEur } from './viz'
import { Vide } from './tdb'

/**
 * Briques financieres partagees par les tableaux de bord Direction et
 * Comptable. Un seul dessin pour un meme chiffre.
 */

/** Couleur liee au MOYEN (et non au rang) : un virement reste turquoise
 *  quel que soit son classement. */
export const COULEUR_MOYEN: Record<string, string> = {
  transfer: CATEGORICAL[0],
  check:    CATEGORICAL[1],
  card:     CATEGORICAL[2],
  cash:     CATEGORICAL[3],
  online:   CATEGORICAL[4],
}

/** Histogramme des encaissements par mois. Il n'y a pas d'echeancier
 *  previsionnel : une seule serie, l'encaisse. */
export function HistoEncaissements({ mensuel, hauteur = 172 }: {
  mensuel: { key: string; label: string; encaisse: number }[]
  hauteur?: number
}) {
  if (mensuel.length === 0) return <Vide>Aucun encaissement.</Vide>
  const max = Math.max(1, ...mensuel.map(m => m.encaisse))
  const piste = hauteur - 44
  return (
    <div className="flex items-end gap-1" style={{ height: hauteur }} role="img"
      aria-label={`Encaissements par mois : ${mensuel.map(m => `${m.label} ${fmtEur(m.encaisse)}`).join(', ')}`}>
      {mensuel.map(m => (
        <div key={m.key} className="flex-1 min-w-0 h-full flex flex-col items-center justify-end gap-1.5">
          <span className="text-[9px] text-warm-700 tabular-nums whitespace-nowrap">
            {m.encaisse > 0 ? `${(m.encaisse / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })}k` : ''}
          </span>
          <div className="histo-barre" style={{ height: `${Math.max(4, (m.encaisse / max) * piste)}px` }}>
            {m.encaisse > 0 && <div className="histo-plein h-full" />}
          </div>
          <span className="text-[10px] font-semibold text-warm-700">{m.label}</span>
        </div>
      ))}
    </div>
  )
}

/** Familles par statut de reglement : barre empilee + une ligne par statut. */
export function RepartitionFamilles({ counts }: { counts: Record<FeeStatus, number> }) {
  const lignes = ([
    ['paid', 'Soldées'],
    ['partial', 'Paiement partiel'],
    ['pending', 'Aucun versement'],
    ['overpaid', 'Trop perçu'],
  ] as const).filter(([k]) => k !== 'overpaid' || counts.overpaid > 0)
  return (
    <>
      <div className="flex h-3 rounded-full overflow-hidden gap-0.5 mb-3 mt-1" role="presentation">
        {lignes.filter(([k]) => counts[k] > 0).map(([k]) => (
          <div key={k} style={{ flex: counts[k], background: STATUS_COLOR[k] }} />
        ))}
      </div>
      {lignes.map(([k, label]) => (
        <div key={k} className="ligne-tdb text-secondary-800">
          <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: STATUS_COLOR[k] }} aria-hidden="true" />
          <span className="flex-1">{label}</span>
          <b className="tabular-nums">{counts[k]}</b>
        </div>
      ))}
    </>
  )
}
