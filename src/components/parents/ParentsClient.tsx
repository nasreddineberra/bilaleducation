'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Plus, Search, ArrowUp, X } from 'lucide-react'
import ParentsTable from './ParentsTable'
import type { Parent } from '@/types/database'

interface ParentsClientProps {
  parents: Parent[]
  parentsWithChildren: Set<string>
  parentsWithPAI: Set<string>
}

export default function ParentsClient({ parents, parentsWithChildren, parentsWithPAI }: ParentsClientProps) {
  const [search, setSearch] = useState('')
  const [showScrollTop, setShowScrollTop] = useState(false)

  useEffect(() => {
    const main = document.querySelector('main')
    if (!main) return

    const check = () => setShowScrollTop(main.scrollHeight > main.clientHeight)

    check()

    const observer = new ResizeObserver(check)
    observer.observe(main)
    return () => observer.disconnect()
  }, [parents, search])

  const filtered = search.trim() === ''
    ? parents
    : parents.filter(p => {
        const q = search.toLowerCase()
        return (
          p.tutor1_last_name?.toLowerCase().includes(q) ||
          p.tutor1_first_name?.toLowerCase().includes(q) ||
          p.tutor2_last_name?.toLowerCase().includes(q) ||
          p.tutor2_first_name?.toLowerCase().includes(q)
        )
      })

  const totalAdultCourses = parents.reduce(
    (acc, p) => acc + (p.tutor1_adult_courses ? 1 : 0) + (p.tutor2_adult_courses ? 1 : 0),
    0
  )

  const scrollToTop = () => {
    document.querySelector('main')?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Barre supérieure */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Statistiques */}
        <div className="card px-4 py-3 flex items-center gap-3">
          <span className="text-2xl font-bold text-secondary-800">{parents.length}</span>
          <span className="text-xs text-warm-500 leading-tight">fiche{parents.length > 1 ? 's' : ''}</span>
        </div>
        <div className="card px-4 py-3 flex items-center gap-3">
          <span className="text-2xl font-bold text-primary-600">{totalAdultCourses}</span>
          <span className="text-xs text-warm-500 leading-tight">inscrits<br/>aux cours</span>
        </div>

        <div className="flex-1" />

        {/* Recherche */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-warm-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un parent..."
            className="pl-8 pr-8 py-2 text-sm bg-white border border-warm-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-transparent w-64 text-secondary-800 placeholder:text-warm-400"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-warm-400 hover:text-warm-600 transition-colors"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Ajouter */}
        <Link href="/dashboard/parents/new" className="btn btn-primary flex items-center gap-2 whitespace-nowrap">
          <Plus size={16} />
          Ajouter une fiche
        </Link>
      </div>

      {/* Tableau */}
      <ParentsTable parents={filtered} parentsWithChildren={parentsWithChildren} parentsWithPAI={parentsWithPAI} />

      {/* Scroll to top */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-6 right-6 w-10 h-10 bg-secondary-700 hover:bg-secondary-800 text-white rounded-full shadow-lg flex items-center justify-center transition-colors"
          title="Revenir en haut"
        >
          <ArrowUp size={18} />
        </button>
      )}

    </div>
  )
}
