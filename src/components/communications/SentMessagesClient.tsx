'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { clsx } from 'clsx'
import { Send, Search, Mail, Users, UserCheck, Globe, ChevronRight } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type MessageRow = {
  id: string
  title: string
  announcement_type: string | null
  target_class_id: string | null
  channel: string | null
  recipient_count: number | null
  published_at: string | null
  sent_at: string | null
  published_by: string | null
  profiles: { first_name: string; last_name: string } | null
  classes: { name: string } | null
}

interface Props {
  messages: MessageRow[]
  role: string
}

const TYPE_LABELS: Record<string, { label: string; icon: any; color: string }> = {
  all_active:     { label: 'Tous (actifs)',    icon: Users,     color: 'bg-blue-100 text-blue-700' },
  all_registered: { label: 'Tous (base)',      icon: Globe,     color: 'bg-purple-100 text-purple-700' },
  class:          { label: 'Classe',           icon: UserCheck, color: 'bg-amber-100 text-amber-700' },
  selected:       { label: 'Selection',        icon: UserCheck, color: 'bg-green-100 text-green-700' },
  staff:          { label: 'Staff interne',    icon: Users,     color: 'bg-warm-100 text-warm-700' },
}

function formatDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function SentMessagesClient({ messages, role }: Props) {
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<string>('')

  const filtered = useMemo(() => {
    let list = messages
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(m => m.title.toLowerCase().includes(q))
    }
    if (filterType) {
      list = list.filter(m => m.announcement_type === filterType)
    }
    return list
  }, [messages, search, filterType])

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-end">
        <Link
          href="/dashboard/communications/new"
          className="btn-primary text-sm px-4 py-2 flex items-center gap-1.5"
        >
          <Send size={14} /> Nouveau message
        </Link>
      </div>

      {/* Filtres */}
      <div className="card px-3 py-2 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-warm-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher par objet..."
            className="input text-sm py-1.5 pl-8 w-full"
          />
        </div>
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          className="input text-sm py-1.5"
        >
          <option value="">Tous les types</option>
          <option value="all_active">Tous (actifs)</option>
          <option value="all_registered">Tous (base)</option>
          <option value="class">Classe</option>
          <option value="selected">Selection</option>
          <option value="staff">Staff</option>
        </select>
      </div>

      {/* Tableau */}
      {filtered.length === 0 ? (
        <div className="card px-6 py-10 text-center">
          <Mail size={32} className="mx-auto text-warm-300 mb-2" />
          <p className="text-sm text-warm-400">Aucun message envoye.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-warm-50 border-b border-warm-100">
                <th className="px-3 py-2 text-left text-xs font-bold text-warm-500 uppercase">Date</th>
                <th className="px-3 py-2 text-left text-xs font-bold text-warm-500 uppercase">Objet</th>
                <th className="px-3 py-2 text-left text-xs font-bold text-warm-500 uppercase">Type</th>
                <th className="px-3 py-2 text-left text-xs font-bold text-warm-500 uppercase">Dest.</th>
                <th className="px-3 py-2 text-left text-xs font-bold text-warm-500 uppercase">Expediteur</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-warm-50">
              {filtered.map(m => {
                const typeInfo = TYPE_LABELS[m.announcement_type ?? ''] ?? { label: m.announcement_type ?? '—', icon: Mail, color: 'bg-warm-100 text-warm-600' }
                const TypeIcon = typeInfo.icon
                return (
                  <tr key={m.id} className="hover:bg-warm-50 transition-colors">
                    <td className="px-3 py-2 text-xs text-warm-500 whitespace-nowrap">
                      {formatDate(m.published_at)}
                    </td>
                    <td className="px-3 py-2 font-medium text-warm-700">
                      {m.title}
                    </td>
                    <td className="px-3 py-2">
                      <span className={clsx('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase', typeInfo.color)}>
                        <TypeIcon size={10} />
                        {typeInfo.label}
                        {m.classes?.name ? ` — ${m.classes.name}` : ''}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-warm-600">
                      {m.recipient_count ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-xs text-warm-500">
                      {m.profiles ? `${m.profiles.first_name} ${m.profiles.last_name}` : '—'}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Link
                        href={`/dashboard/communications/${m.id}`}
                        className="text-primary-600 hover:text-primary-800"
                      >
                        <ChevronRight size={14} />
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
