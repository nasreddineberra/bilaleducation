'use client'

import Onglets, { classeOnglet } from '@/components/ui/Onglets'
import { useState } from 'react'
import FinancementsClient from './FinancementsClient'
import ImpayesAnterieurs from './ImpayesAnterieurs'

interface Props {
  currentYear: { id: string; label: string; start_date?: string | null; end_date?: string | null }
  parents: any[]
  adultEnrollments: any[]
  familyFees: any[]
  communications: any[]
  mouvements: any[]
  etablissement: any
  initialParentId?: string
  familyHistory: Record<string, any[]>
  /** Suppression du journal comptable : admin/direction seuls. */
  canDeleteComms?: boolean
  pastDebts: any[]
}

export default function ReglementsShell({ pastDebts, ...fc }: Props) {
  const [tab, setTab] = useState<'current' | 'past'>('current')
  // Emplacement a DROITE des onglets : `FinancementsClient`, qui calcule les
  // montants de l'annee, y affiche ses cartes (portail). Vide sur l'onglet des
  // impayes anterieurs.
  const [emplacementMontants, setEmplacementMontants] = useState<HTMLDivElement | null>(null)

  const tabBtn = (key: 'current' | 'past', label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={tab === key}
      onClick={() => setTab(key)}
      className={classeOnglet(tab === key)}
    >
      {label}
    </button>
  )

  return (
    <div className="h-full flex flex-col gap-3">
      <div className="flex items-end gap-3 flex-shrink-0">
        <Onglets ariaLabel="Règlements" actifIndex={tab === 'current' ? 0 : 1} className="flex-1 min-w-0">
          {tabBtn('current', 'Année en cours')}
          {tabBtn('past', `Impayés années précédentes${pastDebts.length ? ` (${pastDebts.length})` : ''}`)}
        </Onglets>
        <div ref={setEmplacementMontants} className="flex items-center gap-2 pb-1 shrink-0" />
      </div>

      <div className="flex-1 min-h-0">
        {tab === 'current'
          ? <FinancementsClient {...fc} emplacementMontants={emplacementMontants} />
          : <ImpayesAnterieurs debts={pastDebts} />}
      </div>
    </div>
  )
}
