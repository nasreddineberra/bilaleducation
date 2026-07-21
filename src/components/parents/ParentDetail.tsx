'use client'

import { useState, useRef } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { clsx } from 'clsx'
import { User, GraduationCap } from 'lucide-react'
import ParentForm from './ParentForm'
import ParentAdultHistory from './ParentAdultHistory'
import type { Parent } from '@/types/database'

const TABS = [
  { key: 'identite',         label: 'Identité',         icon: User },
  { key: 'scolarite_adulte', label: 'Scolarité adulte', icon: GraduationCap },
] as const
type TabKey = typeof TABS[number]['key']

interface Props {
  parent: Parent
  tutor1AdultEnrolled: boolean
  tutor2AdultEnrolled: boolean
  adultHistory: any[]
}

export default function ParentDetail({ parent, tutor1AdultEnrolled, tutor2AdultEnrolled, adultHistory }: Props) {
  const pathname     = usePathname()
  const searchParams = useSearchParams()

  const initialTab = (TABS.find(t => t.key === searchParams.get('tab'))?.key ?? 'identite') as TabKey
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab)
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])

  const selectTab = (key: TabKey) => {
    setActiveTab(key)
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', key)
    window.history.replaceState(null, '', `${pathname}?${params.toString()}`)
  }

  const onTabKeyDown = (e: React.KeyboardEvent, idx: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    e.preventDefault()
    const dir  = e.key === 'ArrowRight' ? 1 : -1
    const next = (idx + dir + TABS.length) % TABS.length
    tabRefs.current[next]?.focus()
    selectTab(TABS[next].key)
  }

  return (
    <div className="space-y-4">
      {/* Onglets */}
      <div role="tablist" aria-label="Sections de la fiche parent" className="flex gap-1 border-b border-warm-200">
        {TABS.map((tab, idx) => {
          const Icon = tab.icon
          const active = activeTab === tab.key
          return (
            <button
              key={tab.key}
              ref={el => { tabRefs.current[idx] = el }}
              role="tab"
              id={`tab-${tab.key}`}
              aria-selected={active}
              aria-controls={`panel-${tab.key}`}
              tabIndex={active ? 0 : -1}
              onClick={() => selectTab(tab.key)}
              onKeyDown={e => onTabKeyDown(e, idx)}
              className={clsx(
                'flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px rounded-t',
                'outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500/50',
                active
                  ? 'border-primary-600 text-primary-700'
                  : 'border-transparent text-warm-700 hover:text-secondary-800 hover:border-warm-300'
              )}
            >
              <Icon size={15} />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Contenu */}
      {activeTab === 'identite' && (
        <div role="tabpanel" id="panel-identite" aria-labelledby="tab-identite">
          <ParentForm parent={parent} tutor1AdultEnrolled={tutor1AdultEnrolled} tutor2AdultEnrolled={tutor2AdultEnrolled} />
        </div>
      )}

      {activeTab === 'scolarite_adulte' && (
        <div role="tabpanel" id="panel-scolarite_adulte" aria-labelledby="tab-scolarite_adulte">
          <ParentAdultHistory rows={adultHistory} />
        </div>
      )}
    </div>
  )
}
