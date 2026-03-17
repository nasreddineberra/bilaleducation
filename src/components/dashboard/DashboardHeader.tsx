'use client'

import Link from 'next/link'
import { Bell, ChevronRight } from 'lucide-react'

interface Props {
  firstName: string
  lastName: string
  roleLabel: string
  yearLabel: string
  periodLabel: string
  unreadNotifs: number
  recentNotifs: {
    id: string
    is_read: boolean
    announcements: { id: string; title: string; published_at: string | null; profiles: { first_name: string; last_name: string } | null } | null
  }[]
}

function formatDate(d: string | null): string {
  if (!d) return ''
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const PERIOD_FULL_LABELS: Record<string, string> = {
  T1: 'Trimestre 1', T2: 'Trimestre 2', T3: 'Trimestre 3',
  S1: 'Semestre 1', S2: 'Semestre 2',
}

function expandPeriodLabel(label: string): string {
  return PERIOD_FULL_LABELS[label.toUpperCase()] ?? label
}

export default function DashboardHeader({ firstName, roleLabel, yearLabel, periodLabel, unreadNotifs, recentNotifs }: Props) {
  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div className="space-y-4">
      {/* Bandeau bienvenue */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-secondary-800">
            Bonjour, {firstName}
          </h2>
          <p className="text-warm-500 mt-1 text-sm">
            {roleLabel} · {today}
          </p>
        </div>
      </div>

      {/* Notifications recentes */}
      {unreadNotifs > 0 && (
        <div className="card p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Bell size={14} className="text-primary-500" />
              <span className="text-xs font-bold text-warm-600">
                {unreadNotifs} notification{unreadNotifs > 1 ? 's' : ''} non lue{unreadNotifs > 1 ? 's' : ''}
              </span>
            </div>
            <Link href="/dashboard/notifications" className="text-xs text-primary-600 hover:text-primary-800 flex items-center gap-0.5">
              Tout voir <ChevronRight size={12} />
            </Link>
          </div>
          <div className="space-y-1">
            {recentNotifs.filter(n => !n.is_read).slice(0, 3).map(n => {
              const ann = n.announcements
              if (!ann) return null
              return (
                <Link
                  key={n.id}
                  href={`/dashboard/notifications/${ann.id}?rid=${n.id}&rt=staff`}
                  className="flex items-center gap-2 bg-warm-50 rounded-lg px-3 py-1.5 text-xs hover:bg-warm-100 transition-colors"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-primary-500 flex-shrink-0" />
                  <span className="font-medium text-warm-700 truncate flex-1">{ann.title}</span>
                  <span className="text-warm-400 flex-shrink-0">{formatDate(ann.published_at)}</span>
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
