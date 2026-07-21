'use client'

import { useState } from 'react'
import { clsx } from 'clsx'
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
      className={clsx(
        'px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px rounded-t outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500/50',
        tab === key ? 'border-primary-600 text-primary-700' : 'border-transparent text-warm-700 hover:text-secondary-800 hover:border-warm-300',
      )}
    >
      {label}
    </button>
  )

  return (
    <div className="h-full flex flex-col gap-3">
      <div role="tablist" aria-label="Règlements" className="flex gap-1 border-b border-warm-200 flex-shrink-0">
        {tabBtn('current', 'Année en cours')}
        {tabBtn('past', `Impayés années précédentes${pastDebts.length ? ` (${pastDebts.length})` : ''}`)}
      </div>

      <div className="flex-1 min-h-0">
        {tab === 'current'
          ? <FinancementsClient {...fc} />
          : <ImpayesAnterieurs debts={pastDebts} />}
      </div>
    </div>
  )
}
