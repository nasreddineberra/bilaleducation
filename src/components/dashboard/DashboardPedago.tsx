'use client'

import Link from 'next/link'
import { BookOpen, ClipboardList, FileText, Award } from 'lucide-react'
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
  }
}

export default function DashboardPedago({ stats, ...headerProps }: Props) {
  return (
    <div className="space-y-6 animate-fade-in">
      <DashboardHeader {...headerProps} />

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        <StatCard title="Classes" value={stats.classesCount} icon={BookOpen} iconBg="bg-success-100" iconColor="text-success-600" accentBar="bg-success-500" />
        <StatCard title="Evaluations creees" value={stats.evalsCount} icon={ClipboardList} iconBg="bg-blue-100" iconColor="text-blue-600" accentBar="bg-blue-500" />
        <StatCard title="Bulletins archives" value={stats.bulletinsCount} icon={Award} iconBg="bg-amber-100" iconColor="text-amber-600" accentBar="bg-amber-500" />
      </div>

      {/* Evaluations recentes */}
      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-secondary-800 flex items-center gap-1.5">
            <ClipboardList size={14} className="text-blue-500" /> Dernieres evaluations
          </h3>
          <Link href="/dashboard/evaluations" className="text-xs text-primary-600 hover:text-primary-800">Voir tout</Link>
        </div>
        {stats.recentEvals.length === 0 ? (
          <p className="text-xs text-warm-400 italic py-4 text-center">Aucune evaluation recente</p>
        ) : (
          <div className="space-y-1.5">
            {stats.recentEvals.map(e => (
              <div key={e.id} className="flex items-center gap-2 bg-warm-50 rounded-lg px-3 py-1.5 text-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                <span className="font-medium text-warm-700 truncate flex-1">{e.title}</span>
                <span className="text-warm-400 flex-shrink-0">{e.classes?.name}</span>
                {e.evaluation_date && (
                  <span className="text-warm-300 flex-shrink-0">
                    {new Date(e.evaluation_date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Raccourcis */}
      <div className="card space-y-3">
        <h3 className="text-sm font-bold text-secondary-800">Raccourcis</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <Link href="/dashboard/evaluations" className="btn-secondary text-xs py-2 flex items-center justify-center gap-1.5">
            <ClipboardList size={14} /> Gabarits
          </Link>
          <Link href="/dashboard/grades" className="btn-secondary text-xs py-2 flex items-center justify-center gap-1.5">
            <FileText size={14} /> Saisie notes
          </Link>
          <Link href="/dashboard/bulletins" className="btn-secondary text-xs py-2 flex items-center justify-center gap-1.5">
            <Award size={14} /> Bulletins
          </Link>
          <Link href="/dashboard/cours" className="btn-secondary text-xs py-2 flex items-center justify-center gap-1.5">
            <BookOpen size={14} /> Ref. cours
          </Link>
        </div>
      </div>
    </div>
  )
}
