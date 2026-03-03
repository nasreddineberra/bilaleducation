'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, Search, X, ChevronLeft, ChevronRight } from 'lucide-react'
import StudentsTable from './StudentsTable'
import type { Student } from '@/types/database'

const PAGE_SIZE = 20

interface StudentsClientProps {
  students:      Student[]
  filteredCount: number
  page:          number
  q:             string
  totalAll:      number
  totalActive:   number
  totalNoParent: number
  maxStudents?:  number | null
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
        className="p-1.5 rounded-lg text-warm-400 hover:text-secondary-700 hover:bg-warm-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronLeft size={15} />
      </button>

      {getPages().map((p, i) =>
        p === '...' ? (
          <span key={`e${i}`} className="px-1 text-warm-400 text-sm select-none">…</span>
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
        className="p-1.5 rounded-lg text-warm-400 hover:text-secondary-700 hover:bg-warm-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronRight size={15} />
      </button>
    </div>
  )
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function StudentsClient({
  students, filteredCount, page, q,
  totalAll, totalActive, totalNoParent, maxStudents,
}: StudentsClientProps) {
  const router      = useRouter()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [inputValue, setInputValue] = useState(q)

  const totalPages   = Math.ceil(filteredCount / PAGE_SIZE)
  const limitReached = maxStudents != null && totalActive >= maxStudents

  useEffect(() => { setInputValue(q) }, [q])

  const navigate = (newPage: number, newQ: string) => {
    const params = new URLSearchParams()
    if (newQ.trim()) params.set('q', newQ.trim())
    if (newPage > 1)  params.set('page', String(newPage))
    const qs = params.toString()
    router.push(`/dashboard/students${qs ? `?${qs}` : ''}`)
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

        {/* Statistiques */}
        <div className="card px-4 py-2 flex items-center gap-3">
          <span className="text-2xl font-bold text-secondary-800">{totalAll}</span>
          <span className="text-xs text-warm-500 leading-tight">au total</span>
        </div>
        <div className="card px-4 py-2 flex items-center gap-3">
          <span className="text-2xl font-bold text-green-600">{totalActive}</span>
          <span className="text-xs text-warm-500 leading-tight">actif{totalActive > 1 ? 's' : ''}</span>
        </div>
        <div className="card px-4 py-2 flex items-center gap-3">
          <span className="text-2xl font-bold text-red-500">{totalNoParent}</span>
          <span className="text-xs text-warm-500 leading-tight">sans<br/>rattachement</span>
        </div>
        {maxStudents != null && (
          <div className={`card px-4 py-2 flex items-center gap-3 ${limitReached ? 'border-orange-300 bg-orange-50' : ''}`}>
            <span className={`text-2xl font-bold ${limitReached ? 'text-orange-500' : 'text-secondary-800'}`}>
              {totalActive}/{maxStudents}
            </span>
            <span className="text-xs text-warm-500 leading-tight">quota<br/>essai</span>
          </div>
        )}

        <div className="flex-1" />

        {/* Recherche */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-warm-400 pointer-events-none" />
          <input
            type="text"
            value={inputValue}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Nom, prénom ou n° élève..."
            className="pl-8 pr-8 py-2 text-sm bg-white border border-warm-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-transparent w-64 text-secondary-800 placeholder:text-warm-400"
          />
          {inputValue && (
            <button
              onClick={() => handleSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-warm-400 hover:text-warm-600 transition-colors"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Ajouter */}
        {limitReached ? (
          <span
            className="btn btn-primary flex items-center gap-2 whitespace-nowrap opacity-50 cursor-not-allowed"
            title={`Limite de ${maxStudents} élèves atteinte`}
          >
            <Plus size={16} />
            Limite atteinte
          </span>
        ) : (
          <Link href="/dashboard/students/new" className="btn btn-primary flex items-center gap-2 whitespace-nowrap">
            <Plus size={16} />
            Ajouter un élève
          </Link>
        )}
      </div>

      {/* Tableau */}
      <StudentsTable students={students} />

      {/* Pied de page : résumé + pagination */}
      <div className="flex items-center justify-between px-1">
        <span className="text-xs text-warm-400">
          {filteredCount} élève{filteredCount > 1 ? 's' : ''}
          {q.trim()
            ? ` trouvé${filteredCount > 1 ? 's' : ''} pour « ${q} »`
            : totalPages > 1 ? ` — page ${page} / ${totalPages}` : ''
          }
        </span>
        <PaginationBar page={page} totalPages={totalPages} onNavigate={p => navigate(p, q)} />
      </div>

    </div>
  )
}
