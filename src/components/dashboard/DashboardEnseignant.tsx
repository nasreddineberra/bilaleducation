'use client'

import Link from 'next/link'
import { clsx } from 'clsx'
import { Users, AlertTriangle, BookOpen, CalendarClock } from 'lucide-react'
import DashboardHeader from './DashboardHeader'
import StatCard from './StatCard'
import Tooltip from '@/components/ui/Tooltip'
import { classInfoOf } from './classInfo'

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
    myClasses: { id: string; name: string; level: string | null; isMain: boolean; enrolled: number }[]
    myStudentsCount: number
    absencesToday: number
    recentAbsences: { id: string; absence_date: string; absence_type: string; students: { id: string; first_name: string; last_name: string } | null; classes: any | null }[]
    todaySlots: { id: string; classId: string; className: string; start: string; end: string; slotType: string | null }[]
  }
}

const RACCOURCIS = [
  { href: '/dashboard/absences', label: "Feuille d'appel" },
  { href: '/dashboard/grades', label: 'Saisie des notes' },
  { href: '/dashboard/cahier-texte', label: 'Cahier de texte' },
]

function fmtTime(t: string): string {
  return t?.slice(0, 5) ?? ''
}

export default function DashboardEnseignant({ stats, ...headerProps }: Props) {
  return (
    <div className="space-y-4 animate-fade-in">
      <DashboardHeader {...headerProps} />

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatCard title="Mes élèves" value={stats.myStudentsCount} subtitle={`${stats.myClasses.length} classe${stats.myClasses.length > 1 ? 's' : ''}`} icon={Users} tone="primary" />
        <StatCard title="Absences aujourd'hui" value={stats.absencesToday} subtitle="mes classes" icon={AlertTriangle} tone="orange" />
        <StatCard title="Mes classes" value={stats.myClasses.length} icon={BookOpen} tone="amber" />
      </div>

      {/* Emploi du temps du jour */}
      <section className="card p-3 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="stat-label flex items-center gap-1.5"><CalendarClock size={13} className="text-warm-700" /> Mon emploi du temps du jour</h3>
          <Link href="/dashboard/emploi-du-temps" className="text-xs text-primary-600 hover:text-primary-700">Voir l'EDT</Link>
        </div>
        {stats.todaySlots.length === 0 ? (
          <p className="text-xs text-warm-700 italic py-3 text-center">Aucun cours aujourd'hui.</p>
        ) : (
          <div className="space-y-1">
            {stats.todaySlots.map(s => (
              <Link key={s.id} href="/dashboard/absences"
                className="flex items-center gap-3 bg-warm-50 rounded-lg px-3 py-2 text-xs hover:bg-warm-100 transition-colors">
                <span className="font-bold text-secondary-800 tabular-nums w-24 flex-shrink-0">{fmtTime(s.start)} - {fmtTime(s.end)}</span>
                <span className="font-medium text-warm-700 truncate flex-1">{s.className}</span>
                <span className="text-primary-600 flex-shrink-0">Faire l'appel</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Mes classes */}
      <section className="card p-3 space-y-2">
        <h3 className="stat-label">Mes classes</h3>
        {stats.myClasses.length === 0 ? (
          <p className="text-xs text-warm-700 italic py-4 text-center">Aucune classe assignée.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {stats.myClasses.map(c => (
              <div key={c.id} className={clsx('rounded-lg px-4 py-3 border', c.isMain ? 'border-primary-200 bg-primary-50/40' : 'border-warm-100 bg-warm-50')}>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-warm-800">{c.name}</span>
                  {c.isMain && <span className="text-[10px] font-bold uppercase bg-primary-100 text-primary-700 px-1.5 py-0.5 rounded">Titulaire</span>}
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-warm-700">
                  <span className="tabular-nums">{c.enrolled} élève{c.enrolled > 1 ? 's' : ''}</span>
                  {c.level && <span>{c.level}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Absences recentes de mes classes */}
      <section className="card p-3 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="stat-label">Dernières absences · mes classes</h3>
          <Link href="/dashboard/absences" className="text-xs text-primary-600 hover:text-primary-700">Voir tout</Link>
        </div>
        {stats.recentAbsences.length === 0 ? (
          <p className="text-xs text-warm-700 italic py-4 text-center">Aucune absence récente.</p>
        ) : (
          <div className="space-y-1">
            {stats.recentAbsences.map(a => {
              const info = classInfoOf(a.classes)
              return (
                <div key={a.id} className="flex items-center gap-2 bg-warm-50 rounded-lg px-3 py-1 text-xs">
                  {a.students?.id ? (
                    <Link href={`/dashboard/students/${a.students.id}`} className="font-medium text-secondary-800 truncate hover:underline rounded outline-none focus-visible:ring-2 focus-visible:ring-primary-400">
                      {a.students?.last_name} {a.students?.first_name}
                    </Link>
                  ) : (
                    <span className="font-medium text-warm-700 truncate">{a.students?.last_name} {a.students?.first_name}</span>
                  )}
                  {info ? (
                    <Tooltip content={info} maxWidth="max-w-none">
                      <span className="text-warm-700 flex-shrink-0 cursor-help underline decoration-dotted decoration-warm-300 underline-offset-2">{a.classes?.name}</span>
                    </Tooltip>
                  ) : (
                    <span className="text-warm-700 flex-shrink-0">{a.classes?.name}</span>
                  )}
                  <span className="ml-auto text-warm-700 flex-shrink-0">{ABSENCE_TYPE[a.absence_type] ?? a.absence_type}</span>
                  <span className="text-warm-700 flex-shrink-0 tabular-nums">{new Date(a.absence_date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}</span>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Raccourcis */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {RACCOURCIS.map(r => (
          <Link key={r.href} href={r.href} className="btn btn-secondary w-full !py-2 text-xs !rounded-lg">{r.label}</Link>
        ))}
      </div>
    </div>
  )
}
