'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { clsx } from 'clsx'
import { SearchField } from '@/components/ui/FloatFields'
import ListStatCard from '@/components/ui/ListStatCard'
import UtilisateursTable from './UtilisateursTable'
import type { Profile, UserRole } from '@/types/database'

interface UtilisateursClientProps {
  profiles: Profile[]
  twoFactorUserIds?: string[]
}

const STAFF_ROLES: UserRole[] = ['super_admin', 'admin', 'direction', 'comptable', 'responsable_pedagogique', 'enseignant', 'secretaire']

// Ordre hiérarchique des rôles pour le tri
const ROLE_ORDER: Record<UserRole, number> = {
  super_admin:             0,
  admin:                   1,
  direction:               2,
  comptable:               3,
  responsable_pedagogique: 4,
  enseignant:              5,
  secretaire:              6,
  parent:                  7,
}

// Tri : rôle (hiérarchie) puis nom puis prénom (insensible casse/accents)
function byRoleThenName(a: Profile, b: Profile): number {
  const r = (ROLE_ORDER[a.role] ?? 99) - (ROLE_ORDER[b.role] ?? 99)
  if (r !== 0) return r
  const ln = (a.last_name ?? '').localeCompare(b.last_name ?? '', 'fr', { sensitivity: 'base' })
  if (ln !== 0) return ln
  return (a.first_name ?? '').localeCompare(b.first_name ?? '', 'fr', { sensitivity: 'base' })
}

type Tab = 'staff' | 'parents'
const TABS: { key: Tab; label: string }[] = [
  { key: 'staff',   label: 'Staff'   },
  { key: 'parents', label: 'Parents' },
]

export default function UtilisateursClient({ profiles, twoFactorUserIds = [] }: UtilisateursClientProps) {
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<Tab>('staff')
  const [activeFilter, setActiveFilter] = useState<'' | 'active'>('')
  const toggleFilter = (f: '' | 'active') => setActiveFilter(prev => (prev === f ? '' : f))
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])

  // Deep-link ?tab= (restauration au montage, sans refetch)
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('tab')
    if (t === 'parents' || t === 'staff') setTab(t)
  }, [])

  const selectTab = (key: Tab) => {
    setTab(key)
    setSearch('')
    setActiveFilter('')
    const url = new URL(window.location.href)
    url.searchParams.set('tab', key)
    window.history.replaceState(null, '', url)
  }

  // Navigation clavier entre onglets (flèches ← →)
  const onTabKeyDown = (e: React.KeyboardEvent, idx: number) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    const next = e.key === 'ArrowRight' ? (idx + 1) % TABS.length : (idx - 1 + TABS.length) % TABS.length
    selectTab(TABS[next].key)
    tabRefs.current[next]?.focus()
  }

  const staffProfiles  = profiles.filter(p => STAFF_ROLES.includes(p.role))
  const parentProfiles = profiles.filter(p => p.role === 'parent')

  const currentProfiles = tab === 'staff' ? staffProfiles : parentProfiles

  const searched = search.trim() === ''
    ? currentProfiles
    : currentProfiles.filter(p => {
        const q = search.toLowerCase()
        return (
          p.last_name?.toLowerCase().includes(q)  ||
          p.first_name?.toLowerCase().includes(q) ||
          p.email?.toLowerCase().includes(q)
        )
      })

  const filtered = searched
    .filter(p => activeFilter === 'active' ? p.is_active : true)
    .slice()
    .sort(byRoleThenName)

  const totalActifs = currentProfiles.filter(p => p.is_active).length

  return (
    <div className="space-y-2 animate-fade-in">

      {/* Onglets */}
      <div role="tablist" aria-label="Type d'utilisateur" className="flex items-center gap-1 bg-warm-100 rounded-xl p-1 w-fit">
        {TABS.map((t, idx) => {
          const active = tab === t.key
          const count = t.key === 'staff' ? staffProfiles.length : parentProfiles.length
          return (
            <button
              key={t.key}
              ref={el => { tabRefs.current[idx] = el }}
              role="tab"
              id={`tab-${t.key}`}
              aria-selected={active}
              aria-controls="panel-utilisateurs"
              tabIndex={active ? 0 : -1}
              onClick={() => selectTab(t.key)}
              onKeyDown={e => onTabKeyDown(e, idx)}
              className={clsx(
                'px-4 py-1.5 rounded-lg text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50',
                active
                  ? 'bg-white text-secondary-800 shadow-sm'
                  : 'text-warm-500 hover:text-secondary-700'
              )}
            >
              {t.label} ({count})
            </button>
          )
        })}
      </div>

      {/* Barre supérieure */}
      <div className="flex items-center gap-3 flex-wrap">
        <ListStatCard
          value={currentProfiles.length}
          label="au total"
          active={activeFilter === ''}
          onClick={() => toggleFilter('')}
        />
        <ListStatCard
          value={totalActifs}
          label={`actif${totalActifs > 1 ? 's' : ''}`}
          valueColor="text-primary-600"
          activeRing="ring-primary-600"
          active={activeFilter === 'active'}
          onClick={() => toggleFilter('active')}
        />

        <div className="flex-1" />

        {/* Recherche */}
        <SearchField
          value={search}
          onChange={setSearch}
          placeholder="Nom, prénom ou email..."
          ariaLabel="Rechercher un utilisateur"
          className="w-64"
        />

        {tab === 'staff' && (
          <Link
            href="/dashboard/utilisateurs/new"
            className="inline-flex items-center justify-center gap-2 px-5 py-2 rounded-lg font-semibold text-sm tracking-wide transition-all duration-200 active:scale-[0.97] select-none whitespace-nowrap bg-secondary-700 text-white hover:bg-secondary-800 shadow-[0_2px_6px_rgba(47,69,80,0.30)] hover:shadow-[0_4px_12px_rgba(47,69,80,0.40)] outline-none focus:ring-2 focus:ring-offset-1 focus:ring-secondary-500"
          >
            Ajouter
          </Link>
        )}
      </div>

      {/* Tableau */}
      <div role="tabpanel" id="panel-utilisateurs" aria-labelledby={`tab-${tab}`}>
        <UtilisateursTable profiles={filtered} twoFactorUserIds={twoFactorUserIds} />
      </div>

    </div>
  )
}
