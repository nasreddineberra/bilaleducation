'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { SearchField } from '@/components/ui/FloatFields'
import TeachersTable from './TeachersTable'
import type { Teacher } from '@/types/database'

interface TeachersClientProps {
  teachers: Teacher[]
}

export default function TeachersClient({ teachers }: TeachersClientProps) {
  const [search, setSearch] = useState('')

  const filtered = search.trim() === ''
    ? teachers
    : teachers.filter(t => {
        const q = search.toLowerCase()
        return (
          t.last_name?.toLowerCase().includes(q)      ||
          t.first_name?.toLowerCase().includes(q)     ||
          t.email?.toLowerCase().includes(q)          ||
          t.specialization?.toLowerCase().includes(q) ||
          t.employee_number?.toLowerCase().includes(q)
        )
      })

  const activeCount = teachers.filter(t => t.is_active).length

  return (
    <div className="space-y-2 animate-fade-in">

      {/* Barre supérieure */}
      <div className="flex items-center gap-3 flex-wrap">

        {/* Statistiques */}
        <div className="card px-4 py-2 flex items-center gap-3">
          <span className="text-2xl font-bold text-secondary-800">{teachers.length}</span>
          <span className="text-xs text-warm-500 leading-tight">au total</span>
        </div>
        <div className="card px-4 py-2 flex items-center gap-3">
          <span className="text-2xl font-bold text-green-600">{activeCount}</span>
          <span className="text-xs text-warm-500 leading-tight">actif{activeCount > 1 ? 's' : ''}</span>
        </div>

        <div className="flex-1" />

        {/* Recherche */}
        <SearchField
          value={search}
          onChange={setSearch}
          placeholder="Nom, prénom ou n° employé…"
        />

        {/* Ajouter */}
        <Link
          href="/dashboard/teachers/new"
          className="inline-flex items-center gap-2 px-5 py-2 rounded-lg font-semibold text-sm tracking-wide bg-secondary-700 text-white hover:bg-secondary-800 shadow-[0_2px_6px_rgba(47,69,80,0.30)] hover:shadow-[0_4px_12px_rgba(47,69,80,0.40)] transition-all duration-200 whitespace-nowrap"
        >
          <Plus size={16} />
          Ajouter
        </Link>
      </div>

      {/* Tableau */}
      <TeachersTable teachers={filtered} />

      {/* Résumé */}
      <div className="px-1">
        <span className="text-xs text-warm-400">
          {filtered.length} enseignant{filtered.length > 1 ? 's' : ''}
          {search.trim() ? ` trouvé${filtered.length > 1 ? 's' : ''} pour « ${search} »` : ''}
        </span>
      </div>

    </div>
  )
}
