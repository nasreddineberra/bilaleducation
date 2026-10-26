'use client'

import { useState, useRef } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import Onglets, { classeOnglet } from '@/components/ui/Onglets'
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
  /** Ou revenir apres enregistrement — depend de l'origine. */
  backHref?: string
  tutor1AdultEnrolled: boolean
  tutor2AdultEnrolled: boolean
  adultHistory: any[]
  adultCurrent: any[]
  adultsNonAffectes: { tutor_number: number; last_name: string; first_name: string }[]
  /** Regle et bornes de l'annee pour « Declarer un depart » (`null` sans cours adulte cette annee). */
  contexteDepart?: { regle: string; rentree: string | null; fin: string | null } | null
}

export default function ParentDetail({ parent, backHref, tutor1AdultEnrolled, tutor2AdultEnrolled, adultHistory, adultCurrent, adultsNonAffectes, contexteDepart = null }: Props) {
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
      <Onglets ariaLabel="Sections de la fiche parent" actifIndex={TABS.findIndex(t => t.key === activeTab)}>
        {TABS.map((tab, idx) => {
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
              className={classeOnglet(active)}
            >
              {tab.label}
            </button>
          )
        })}
      </Onglets>

      {/* Contenu */}
      {activeTab === 'identite' && (
        <div role="tabpanel" id="panel-identite" aria-labelledby="tab-identite">
          <ParentForm parent={parent} backHref={backHref} tutor1AdultEnrolled={tutor1AdultEnrolled} tutor2AdultEnrolled={tutor2AdultEnrolled} />
        </div>
      )}

      {activeTab === 'scolarite_adulte' && (
        <div role="tabpanel" id="panel-scolarite_adulte" aria-labelledby="tab-scolarite_adulte">
          <ParentAdultHistory parentId={parent.id} rows={adultHistory} current={adultCurrent} nonAffectes={adultsNonAffectes} contexteDepart={contexteDepart} />
        </div>
      )}
    </div>
  )
}
