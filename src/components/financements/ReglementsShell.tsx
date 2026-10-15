'use client'

import Onglets, { classeOnglet } from '@/components/ui/Onglets'
import { useState } from 'react'
import FinancementsClient from './FinancementsClient'
import ImpayesAnterieurs from './ImpayesAnterieurs'

interface Props {
  currentYear: { id: string; label: string }
  parents: any[]
  adultEnrollments: any[]
  familyFees: any[]
  communications: any[]
  etablissement: any
  initialParentId?: string
  familyHistory: Record<string, any[]>
  /** Suppression du journal comptable : admin/direction seuls. */
  canDeleteComms?: boolean
  pastDebts: any[]
}

export default function ReglementsShell({ pastDebts, ...fc }: Props) {
  const [tab, setTab] = useState<'current' | 'past'>('current')

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
      <Onglets ariaLabel="Règlements" actifIndex={tab === 'current' ? 0 : 1} className="flex-shrink-0">
        {tabBtn('current', 'Année en cours')}
        {tabBtn('past', `Impayés années précédentes${pastDebts.length ? ` (${pastDebts.length})` : ''}`)}
      </Onglets>

      <div className="flex-1 min-h-0">
        {tab === 'current'
          ? <FinancementsClient {...fc} />
          : <ImpayesAnterieurs debts={pastDebts} />}
      </div>
    </div>
  )
}
