'use client'

import Link from 'next/link'
import { BookOpen, ClipboardList, Award } from 'lucide-react'
import DashboardHeader from './DashboardHeader'
import StatCard from './StatCard'

interface Props {
  firstName: string
  lastName: string
  role: string
  roleLabel: string
  yearLabel: string
  periodLabel: string
  unreadNotifs: number
  recentNotifs: any[]
  stats: {
    classesCount: number
    evalsCount: number
    bulletinsCount: number
    recentEvals: { id: string; title: string; evaluation_date: string | null; classes: { name: string } | null }[]
    evalsWithoutGrades: { id: string; title: string; classes: { name: string } | null }[]
  }
}

const RACCOURCIS = [
  { href: '/dashboard/evaluations', label: 'Évaluations' },
  { href: '/dashboard/grades', label: 'Saisie des notes' },
  { href: '/dashboard/bulletins', label: 'Bulletins' },
  { href: '/dashboard/cours', label: 'Référentiel cours' },
]

export default function DashboardPedago({ stats, ...headerProps }: Props) {
  return (
    <div className="space-y-4 animate-fade-in">
      <DashboardHeader {...headerProps} />

      {/* Raccourcis */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {RACCOURCIS.map(r => (
          <Link key={r.href} href={r.href} className="btn btn-secondary w-full !py-2 text-xs !rounded-lg">{r.label}</Link>
        ))}
      </div>

      {/* KPIs (bornes a l'annee en cours) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatCard title="Classes" value={stats.classesCount} icon={BookOpen} tone="amber" />
        <StatCard title={`Évaluations · ${headerProps.yearLabel}`} value={stats.evalsCount} icon={ClipboardList} tone="ardoise" />
        <StatCard title={`Bulletins · ${headerProps.yearLabel}`} value={stats.bulletinsCount} subtitle="archivés" icon={Award} tone="orange" />
      </div>

      {/* A finaliser : evals de la periode en cours sans note */}
      <section className="card p-3 space-y-2">
        <div className="flex items-baseline justify-between">
          <h3 className="stat-label">À finaliser · {headerProps.periodLabel || 'période en cours'}</h3>
          <Link href="/dashboard/grades" className="text-xs text-primary-600 hover:text-primary-700">Saisir les notes</Link>
        </div>
        {stats.evalsWithoutGrades.length === 0 ? (
          <p className="text-xs text-warm-700 italic py-3 text-center">Toutes les évaluations de la période sont notées.</p>
        ) : (
          <div className="space-y-1">
            {stats.evalsWithoutGrades.map(e => (
              <div key={e.id} className="flex items-center gap-2 bg-orange-50 rounded-lg px-3 py-1.5 text-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500 flex-shrink-0" />
                <span className="font-medium text-warm-700 truncate flex-1">{e.title}</span>
                <span className="text-warm-700 flex-shrink-0">{e.classes?.name}</span>
                <span className="text-orange-700 font-semibold flex-shrink-0">à noter</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Dernieres evaluations */}
      <section className="card p-3 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="stat-label">Dernières évaluations</h3>
          <Link href="/dashboard/evaluations" className="text-xs text-primary-600 hover:text-primary-700">Voir tout</Link>
        </div>
        {stats.recentEvals.length === 0 ? (
          <p className="text-xs text-warm-700 italic py-4 text-center">Aucune évaluation récente.</p>
        ) : (
          <div className="space-y-1">
            {stats.recentEvals.map(e => (
              <div key={e.id} className="flex items-center gap-2 bg-warm-50 rounded-lg px-3 py-1.5 text-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-primary-500 flex-shrink-0" />
                <span className="font-medium text-warm-700 truncate flex-1">{e.title}</span>
                <span className="text-warm-700 flex-shrink-0">{e.classes?.name}</span>
                {e.evaluation_date && (
                  <span className="text-warm-700 flex-shrink-0 tabular-nums">{new Date(e.evaluation_date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
