'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { SearchField } from '@/components/ui/FloatFields'
import ListStatCard from '@/components/ui/ListStatCard'
import ParentsTable from './ParentsTable'
import ParentsAdultSyncModal from './ParentsAdultSyncModal'
import type { Parent } from '@/types/database'

const PAGE_SIZE = 20

type StatFilter = '' | 'adult_courses'

interface ParentsClientProps {
  parents:             Parent[]
  filteredCount:       number
  page:                number
  q:                   string
  filter:              string
  totalAll:            number
  totalAdultCourses:   number
  parentsWithChildren: Set<string>
  parentsWithPAI:      Set<string>
}

// ─── Pagination ───────────────────────────────────────────────────────────────

function PaginationBar({ page, totalPages, onNavigate }: {
  page:       number
  totalPages: number
  onNavigate: (p: number) => void
}) {
  if (totalPages <= 1) return null

  const getPages = (): (number | '...')[] => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)
    const pages: (number | '...')[] = [1]
    if (page > 3) pages.push('...')
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
      pages.push(i)
    }
    if (page < totalPages - 2) pages.push('...')
    pages.push(totalPages)
    return pages
  }

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => onNavigate(page - 1)}
        disabled={page === 1}
        className="p-1.5 rounded-lg text-warm-700 hover:text-secondary-700 hover:bg-warm-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronLeft size={15} />
      </button>

      {getPages().map((p, i) =>
        p === '...' ? (
          <span key={`e${i}`} className="px-1 text-warm-700 text-sm select-none">…</span>
        ) : (
          <button
            key={p}
            onClick={() => onNavigate(p)}
            className={`min-w-[30px] h-[30px] rounded-lg text-sm font-medium transition-colors ${
              p === page
                ? 'bg-primary-500 text-white shadow-sm'
                : 'text-secondary-600 hover:bg-warm-100'
            }`}
          >
            {p}
          </button>
        )
      )}

      <button
        onClick={() => onNavigate(page + 1)}
        disabled={page === totalPages}
        className="p-1.5 rounded-lg text-warm-700 hover:text-secondary-700 hover:bg-warm-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronRight size={15} />
      </button>
    </div>
  )
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function ParentsClient({
  parents, filteredCount, page, q, filter,
  totalAll, totalAdultCourses,
  parentsWithChildren, parentsWithPAI,
}: ParentsClientProps) {
  const router      = useRouter()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [inputValue, setInputValue] = useState(q)
  const [showAdult, setShowAdult] = useState(false)
  const activeFilter = (filter || '') as StatFilter

  const totalPages = Math.ceil(filteredCount / PAGE_SIZE)

  useEffect(() => { setInputValue(q) }, [q])

  const navigate = (newPage: number, newQ: string, newFilter?: StatFilter) => {
    const params = new URLSearchParams()
    if (newQ.trim()) params.set('q', newQ.trim())
    if (newPage > 1)  params.set('page', String(newPage))
    const f = newFilter ?? activeFilter
    if (f) params.set('filter', f)
    const qs = params.toString()
    router.push(`/dashboard/parents${qs ? `?${qs}` : ''}`)
  }

  const toggleFilter = (f: StatFilter) => {
    navigate(1, inputValue, activeFilter === f ? '' : f)
  }

  const handleSearch = (value: string) => {
    setInputValue(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => navigate(1, value), 300)
  }

  return (
    <div className="space-y-2 animate-fade-in">

      {/* Barre supérieure */}
      <div className="flex items-center gap-3 flex-wrap">

        {/* Statistiques (cliquables = filtres) */}
        <ListStatCard
          value={totalAll}
          label={`fiche${totalAll > 1 ? 's' : ''}`}
          active={activeFilter === ''}
          onClick={() => toggleFilter('')}
        />
        <ListStatCard
          value={totalAdultCourses}
          label={<>inscrits<br/>aux cours</>}
          valueColor="text-primary-600"
          activeRing="ring-primary-600"
          active={activeFilter === 'adult_courses'}
          onClick={() => toggleFilter('adult_courses')}
        />

        <div className="flex-1" />

        {/* Recherche */}
        <SearchField
          value={inputValue}
          onChange={handleSearch}
          placeholder="Nom ou prénom du tuteur…"
        />

        {/* Cours adultes en lot */}
        <button
          type="button"
          onClick={() => setShowAdult(true)}
          className="inline-flex items-center px-5 py-2 rounded-lg font-semibold text-sm tracking-wide bg-white text-secondary-600 border border-warm-300 shadow-sm hover:bg-warm-50 hover:border-warm-400 transition-all duration-200 whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-secondary-300"
        >
          Cours adultes en lot
        </button>

        {/* Ajouter */}
        <Link href="/dashboard/parents/new" className="inline-flex items-center px-5 py-2 rounded-lg font-semibold text-sm tracking-wide bg-secondary-700 text-white hover:bg-secondary-800 shadow-[0_2px_6px_rgba(47,69,80,0.30)] hover:shadow-[0_4px_12px_rgba(47,69,80,0.40)] transition-all duration-200 whitespace-nowrap">
          Ajouter
        </Link>
      </div>

      {showAdult && <ParentsAdultSyncModal onClose={() => setShowAdult(false)} />}

      {/* Tableau */}
      <ParentsTable parents={parents} parentsWithChildren={parentsWithChildren} parentsWithPAI={parentsWithPAI} />

      {/* Pied de page : résumé + pagination */}
      <div className="flex items-center justify-between px-1">
        <span className="text-xs text-warm-700">
          {filteredCount} fiche{filteredCount > 1 ? 's' : ''}
          {q.trim()
            ? ` trouvée${filteredCount > 1 ? 's' : ''} pour « ${q} »`
            : totalPages > 1 ? ` · page ${page} / ${totalPages}` : ''
          }
        </span>
        <PaginationBar page={page} totalPages={totalPages} onNavigate={p => navigate(p, q, activeFilter)} />
      </div>

    </div>
  )
}
