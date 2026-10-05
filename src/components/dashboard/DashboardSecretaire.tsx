'use client'

import { usePetitEcran } from '@/hooks/usePetitEcran'
import type { Raccourci } from '@/lib/mobile'
import { Cliquable } from '@/components/ui/Cliquable'

import Link from 'next/link'
import { Users, Contact, GraduationCap, ClipboardList } from 'lucide-react'
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

// `mobile` : meme drapeau que la barre laterale. Un raccourci vers un ecran
// masque serait offrir en tete de page ce que le menu refuse.
const RACCOURCIS: Raccourci[] = [
  { href: '/dashboard/students/new', label: 'Nouvel élève' },
  { href: '/dashboard/parents/new', label: 'Nouveau parent' },
  { href: '/dashboard/absences', label: "Feuille d'appel", mobile: true },
]

export default function DashboardSecretaire({ stats, ...headerProps }: Props) {
  const petitEcran = usePetitEcran()
  const raccourcis = RACCOURCIS.filter(r => !petitEcran || r.mobile)

  return (
    <div className="space-y-4 animate-fade-in">
      <DashboardHeader {...headerProps} />

      {/* Raccourcis */}
      {raccourcis.length > 0 && (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {raccourcis.map(r => (
          <Link key={r.href} href={r.href} className="btn btn-secondary w-full !py-2 text-xs !rounded-lg">{r.label}</Link>
        ))}
      </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard title="Élèves actifs" value={stats.studentsActive} icon={Users} tone="primary" />
        <StatCard title="Parents" value={stats.parentsCount} icon={Contact} tone="ardoise" />
        <StatCard title="Enseignants actifs" value={stats.teachersCount} icon={GraduationCap} tone="amber" />
        <StatCard title="Inscriptions ce mois" value={stats.enrollmentsThisMonth} icon={ClipboardList} tone="orange" />
      </div>

      {/* Derniers eleves inscrits */}
      <section className="card p-3 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="stat-label">Derniers élèves inscrits</h3>
          {!petitEcran && <Link href="/dashboard/students" className="text-xs text-primary-600 hover:text-primary-700">Voir tout</Link>}
        </div>
        {stats.recentStudents.length === 0 ? (
          <p className="text-xs text-warm-700 italic py-4 text-center">Aucun élève récent.</p>
        ) : (
          <div className="space-y-1">
            {stats.recentStudents.map(s => (
              <Cliquable
                key={s.id}
                href={petitEcran ? null : `/dashboard/students/${s.id}`}
                className="flex items-center gap-2 bg-warm-50 rounded-lg px-3 py-1.5 text-xs"
                classNameLien="hover:bg-warm-100 transition-colors"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-primary-500 flex-shrink-0" />
                <span className="font-medium text-warm-700 truncate">{s.last_name} {s.first_name}</span>
                <span className="text-warm-700 flex-shrink-0 tabular-nums">{s.student_number}</span>
                <span className="ml-auto text-warm-700 flex-shrink-0 tabular-nums">{new Date(s.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}</span>
              </Cliquable>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
