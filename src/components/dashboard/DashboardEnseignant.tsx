'use client'

import Link from 'next/link'
import { clsx } from 'clsx'
import { Users, AlertTriangle, BookOpen, Calendar, FileText, Send } from 'lucide-react'
import DashboardHeader from './DashboardHeader'
import StatCard from './StatCard'

const DAY_NAMES = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']

const ABSENCE_TYPE: Record<string, string> = {
  absence: 'Absence', retard: 'Retard', authorized_absence: 'Abs. autorisée',
}

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
    myClasses: { id: string; name: string; level: string | null; isMain: boolean; enrolled: number; schedule: { day_of_week: number; start_time: string; end_time: string } | null }[]
    myStudentsCount: number
    absencesToday: number
    recentAbsences: { id: string; absence_date: string; absence_type: string; students: { first_name: string; last_name: string } | null; classes: { name: string } | null }[]
  }
}

function fmtTime(t: string): string {
  return t?.slice(0, 5) ?? ''
}

export default function DashboardEnseignant({ stats, ...headerProps }: Props) {
  return (
    <div className="space-y-6 animate-fade-in">
      <DashboardHeader {...headerProps} />

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <StatCard title="Mes élèves" value={stats.myStudentsCount} subtitle={`${stats.myClasses.length} classe${stats.myClasses.length > 1 ? 's' : ''}`} icon={Users} iconBg="bg-primary-100" iconColor="text-primary-600" accentBar="bg-primary-500" />
        <StatCard title="Absences aujourd'hui" value={stats.absencesToday} icon={AlertTriangle} iconBg="bg-amber-100" iconColor="text-amber-600" accentBar="bg-amber-500" />
        <StatCard title="Classes" value={stats.myClasses.length} icon={BookOpen} iconBg="bg-success-100" iconColor="text-success-600" accentBar="bg-success-500" />
      </div>

      {/* Mes classes */}
      <div className="card space-y-3">
        <h3 className="text-sm font-bold text-secondary-800 flex items-center gap-1.5">
          <BookOpen size={14} className="text-success-500" /> Mes classes
        </h3>
        {stats.myClasses.length === 0 ? (
          <p className="text-xs text-warm-400 italic py-4 text-center">Aucune classe assignée</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {stats.myClasses.map(c => (
              <div key={c.id} className={clsx('bg-warm-50 rounded-lg px-4 py-3 border', c.isMain ? 'border-primary-200 bg-primary-50/30' : 'border-warm-100')}>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-warm-800">{c.name}</span>
                  {c.isMain && <span className="text-[10px] font-bold uppercase bg-primary-100 text-primary-700 px-1.5 py-0.5 rounded">Principal</span>}
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-warm-500">
                  <span>{c.enrolled} élève{c.enrolled > 1 ? 's' : ''}</span>
                  {c.schedule && (
                    <span>{DAY_NAMES[c.schedule.day_of_week]} {fmtTime(c.schedule.start_time)}-{fmtTime(c.schedule.end_time)}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Absences recentes */}
      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-secondary-800 flex items-center gap-1.5">
            <AlertTriangle size={14} className="text-amber-500" /> Dernières absences
          </h3>
          <Link href="/dashboard/absences" className="text-xs text-primary-600 hover:text-primary-800">Voir tout</Link>
        </div>
        {stats.recentAbsences.length === 0 ? (
          <p className="text-xs text-warm-400 italic py-4 text-center">Aucune absence récente</p>
        ) : (
          <div className="space-y-1.5">
            {stats.recentAbsences.map(a => (
              <div key={a.id} className="flex items-center gap-2 bg-warm-50 rounded-lg px-3 py-1.5 text-xs">
                <span className="font-medium text-warm-700 truncate">
                  {a.students?.last_name} {a.students?.first_name}
                </span>
                <span className="text-warm-400 flex-shrink-0">{a.classes?.name}</span>
                <span className="ml-auto text-warm-400 flex-shrink-0">{ABSENCE_TYPE[a.absence_type] ?? a.absence_type}</span>
                <span className="text-warm-300 flex-shrink-0">
                  {new Date(a.absence_date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Raccourcis */}
      <div className="card space-y-3">
        <h3 className="text-sm font-bold text-secondary-800">Raccourcis</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          <Link href="/dashboard/absences" className="btn-secondary text-xs py-2 flex items-center justify-center gap-1.5">
            <Calendar size={14} /> Feuille d'appel
          </Link>
          <Link href="/dashboard/grades" className="btn-secondary text-xs py-2 flex items-center justify-center gap-1.5">
            <FileText size={14} /> Saisie notes
          </Link>
          <Link href="/dashboard/communications/new" className="btn-secondary text-xs py-2 flex items-center justify-center gap-1.5">
            <Send size={14} /> Nouveau message
          </Link>
        </div>
      </div>
    </div>
  )
}
