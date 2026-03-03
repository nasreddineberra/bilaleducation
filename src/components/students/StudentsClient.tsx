'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Plus, Search, ArrowUp, X } from 'lucide-react'
import StudentsTable from './StudentsTable'
import type { Student } from '@/types/database'

interface StudentsClientProps {
  students: Student[]
  maxStudents?: number | null
}

export default function StudentsClient({ students, maxStudents }: StudentsClientProps) {
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
  }, [students, search])

  const filtered = search.trim() === ''
    ? students
    : students.filter(s => {
        const q = search.toLowerCase()
        return (
          s.last_name?.toLowerCase().includes(q) ||
          s.first_name?.toLowerCase().includes(q) ||
          s.student_number?.toLowerCase().includes(q)
        )
      })

  const totalActive    = students.filter(s => s.is_active).length
  const totalNoParent  = students.filter(s => !s.parent_id).length
  const limitReached   = maxStudents != null && totalActive >= maxStudents

  const scrollToTop = () => {
    document.querySelector('main')?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Barre supérieure */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Statistiques */}
        <div className="card px-4 py-3 flex items-center gap-3">
          <span className="text-2xl font-bold text-secondary-800">{students.length}</span>
          <span className="text-xs text-warm-500 leading-tight">au total</span>
        </div>
        <div className="card px-4 py-3 flex items-center gap-3">
          <span className="text-2xl font-bold text-green-600">{totalActive}</span>
          <span className="text-xs text-warm-500 leading-tight">actif{totalActive > 1 ? 's' : ''}</span>
        </div>
        <div className="card px-4 py-3 flex items-center gap-3">
          <span className="text-2xl font-bold text-red-500">{totalNoParent}</span>
          <span className="text-xs text-warm-500 leading-tight">sans<br/>rattachement</span>
        </div>
        {maxStudents != null && (
          <div className={`card px-4 py-3 flex items-center gap-3 ${limitReached ? 'border-orange-300 bg-orange-50' : ''}`}>
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
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Nom, prénom ou n° élève..."
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
        {limitReached ? (
          <span className="btn btn-primary flex items-center gap-2 whitespace-nowrap opacity-50 cursor-not-allowed" title={`Limite de ${maxStudents} élèves atteinte`}>
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
      <StudentsTable students={filtered} />

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
