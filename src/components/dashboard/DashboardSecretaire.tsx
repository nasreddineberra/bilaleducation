'use client'

import Link from 'next/link'
import { Users, Contact, GraduationCap, ClipboardList, UserPlus, Calendar } from 'lucide-react'
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
    studentsActive: number
    parentsCount: number
    teachersCount: number
    enrollmentsThisMonth: number
    recentStudents: { id: string; first_name: string; last_name: string; student_number: string; created_at: string }[]
  }
}

export default function DashboardSecretaire({ stats, ...headerProps }: Props) {
  return (
    <div className="space-y-6 animate-fade-in">
      <DashboardHeader {...headerProps} />

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard title="Eleves actifs" value={stats.studentsActive} icon={Users} iconBg="bg-primary-100" iconColor="text-primary-600" accentBar="bg-primary-500" />
        <StatCard title="Parents" value={stats.parentsCount} icon={Contact} iconBg="bg-blue-100" iconColor="text-blue-600" accentBar="bg-blue-500" />
        <StatCard title="Enseignants" value={stats.teachersCount} icon={GraduationCap} iconBg="bg-secondary-100" iconColor="text-secondary-600" accentBar="bg-secondary-500" />
        <StatCard title="Inscriptions ce mois" value={stats.enrollmentsThisMonth} icon={ClipboardList} iconBg="bg-amber-100" iconColor="text-amber-600" accentBar="bg-amber-500" />
      </div>

      {/* Derniers eleves inscrits */}
      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-secondary-800 flex items-center gap-1.5">
            <UserPlus size={14} className="text-primary-500" /> Derniers eleves inscrits
          </h3>
          <Link href="/dashboard/students" className="text-xs text-primary-600 hover:text-primary-800">Voir tout</Link>
        </div>
        {stats.recentStudents.length === 0 ? (
          <p className="text-xs text-warm-400 italic py-4 text-center">Aucun eleve recent</p>
        ) : (
          <div className="space-y-1.5">
            {stats.recentStudents.map(s => (
              <Link
                key={s.id}
                href={`/dashboard/students/${s.id}`}
                className="flex items-center gap-2 bg-warm-50 rounded-lg px-3 py-1.5 text-xs hover:bg-warm-100 transition-colors"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-primary-500 flex-shrink-0" />
                <span className="font-medium text-warm-700 truncate">{s.last_name} {s.first_name}</span>
                <span className="text-warm-400 flex-shrink-0">{s.student_number}</span>
                <span className="ml-auto text-warm-300 flex-shrink-0">
                  {new Date(s.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Raccourcis */}
      <div className="card space-y-3">
        <h3 className="text-sm font-bold text-secondary-800">Raccourcis</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          <Link href="/dashboard/students/new" className="btn-secondary text-xs py-2 flex items-center justify-center gap-1.5">
            <UserPlus size={14} /> Nouvel eleve
          </Link>
          <Link href="/dashboard/parents/new" className="btn-secondary text-xs py-2 flex items-center justify-center gap-1.5">
            <Contact size={14} /> Nouveau parent
          </Link>
          <Link href="/dashboard/absences" className="btn-secondary text-xs py-2 flex items-center justify-center gap-1.5">
            <Calendar size={14} /> Feuille d'appel
          </Link>
        </div>
      </div>
    </div>
  )
}
