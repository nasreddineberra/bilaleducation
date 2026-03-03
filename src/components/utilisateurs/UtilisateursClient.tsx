'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Plus, Search, X } from 'lucide-react'
import UtilisateursTable from './UtilisateursTable'
import type { Profile } from '@/types/database'

interface UtilisateursClientProps {
  profiles: Profile[]
}

export default function UtilisateursClient({ profiles }: UtilisateursClientProps) {
  const [search, setSearch] = useState('')

  const filtered = search.trim() === ''
    ? profiles
    : profiles.filter(p => {
        const q = search.toLowerCase()
        return (
          p.last_name?.toLowerCase().includes(q)  ||
          p.first_name?.toLowerCase().includes(q) ||
          p.email?.toLowerCase().includes(q)
        )
      })

  const totalActifs = profiles.filter(p => p.is_active).length

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Barre supérieure */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Statistiques */}
        <div className="card px-4 py-3 flex items-center gap-3">
          <span className="text-2xl font-bold text-secondary-800">{profiles.length}</span>
          <span className="text-xs text-warm-500 leading-tight">au total</span>
        </div>
        <div className="card px-4 py-3 flex items-center gap-3">
          <span className="text-2xl font-bold text-green-600">{totalActifs}</span>
          <span className="text-xs text-warm-500 leading-tight">actif{totalActifs > 1 ? 's' : ''}</span>
        </div>

        <div className="flex-1" />

        {/* Recherche */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-warm-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Nom, prénom ou email..."
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

        <Link
          href="/dashboard/utilisateurs/new"
          className="btn btn-primary flex items-center gap-2 whitespace-nowrap"
        >
          <Plus size={16} />
          Ajouter un utilisateur
        </Link>
      </div>

      {/* Tableau */}
      <UtilisateursTable profiles={filtered} />

    </div>
  )
}
