'use client'

import Link from 'next/link'
import { clsx } from 'clsx'
import {
  Users, GraduationCap, BookOpen, ClipboardList, AlertTriangle,
  DollarSign, MessageSquare, UserPlus, Send, FileText, Calendar
} from 'lucide-react'
import DashboardHeader from './DashboardHeader'
import StatCard from './StatCard'

// ─── Types ────────────────────────────────────────────────────────────────────

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
    studentsTotal: number
    teachersActive: number
    classesCount: number
    enrollmentsActive: number
    parentsCount: number
    absencesThisMonth: number
    absencesUnjustified: number
    totalDue: number
    feesByStatus: { pending: number; partial: number; paid: number; overdue: number; overpaid: number }
    classCapacity: { name: string; enrolled: number; max: number }[]
    recentAbsences: { id: string; absence_date: string; absence_type: string; is_justified: boolean; students: { first_name: string; last_name: string } | null; classes: { name: string } | null }[]
    msgSentThisMonth: number
    msgReadRate: number
  }
}

const ABSENCE_TYPE: Record<string, string> = {
  absence: 'Absence',
  late: 'Retard',
  authorized_absence: 'Abs. autorisee',
}

const STATUS_COLORS: Record<string, string> = {
  paid: 'bg-success-500',
  partial: 'bg-amber-500',
  pending: 'bg-warm-300',
  overdue: 'bg-danger-500',
  overpaid: 'bg-red-500',
}

const STATUS_LABELS: Record<string, string> = {
  paid: 'Solde',
  partial: 'Partiel',
  pending: 'En attente',
  overdue: 'En retard',
  overpaid: 'Trop percu',
}

function formatCurrency(n: number): string {
  return n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function DashboardAdmin({ stats, ...headerProps }: Props) {
  const totalFees = Object.values(stats.feesByStatus).reduce((a, b) => a + b, 0)

  return (
    <div className="space-y-6 animate-fade-in">
      <DashboardHeader {...headerProps} />

      {/* KPIs principaux */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard title="Eleves actifs" value={stats.studentsActive} subtitle={`${stats.studentsTotal} au total`} icon={Users} iconBg="bg-primary-100" iconColor="text-primary-600" accentBar="bg-primary-500" />
        <StatCard title="Enseignants" value={stats.teachersActive} subtitle="actifs" icon={GraduationCap} iconBg="bg-secondary-100" iconColor="text-secondary-600" accentBar="bg-secondary-500" />
        <StatCard title="Classes" value={stats.classesCount} subtitle={`${stats.enrollmentsActive} inscriptions`} icon={BookOpen} iconBg="bg-success-100" iconColor="text-success-600" accentBar="bg-success-500" />
        <StatCard title="Absences ce mois" value={stats.absencesThisMonth} subtitle={`${stats.absencesUnjustified} non justifiees`} icon={AlertTriangle} iconBg="bg-amber-100" iconColor="text-amber-600" accentBar="bg-amber-500" />
      </div>

      {/* Financier + Communications */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Bloc financier */}
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-secondary-800 flex items-center gap-1.5">
              <DollarSign size={14} className="text-success-500" /> Finances
            </h3>
            <Link href="/dashboard/financements" className="text-xs text-primary-600 hover:text-primary-800">Voir tout</Link>
          </div>
          <p className="text-2xl font-bold text-secondary-800">{formatCurrency(stats.totalDue)}</p>
          <p className="text-xs text-warm-400 -mt-2">total du</p>
          {/* Barre de repartition */}
          {totalFees > 0 && (
            <div>
              <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
                {Object.entries(stats.feesByStatus).filter(([, v]) => v > 0).map(([status, count]) => (
                  <div
                    key={status}
                    className={clsx('rounded-full', STATUS_COLORS[status])}
                    style={{ width: `${(count / totalFees) * 100}%` }}
                    title={`${STATUS_LABELS[status]}: ${count}`}
                  />
                ))}
              </div>
              <div className="flex flex-wrap gap-3 mt-2">
                {Object.entries(stats.feesByStatus).filter(([, v]) => v > 0).map(([status, count]) => (
                  <span key={status} className="flex items-center gap-1 text-[10px] text-warm-500">
                    <span className={clsx('w-2 h-2 rounded-full', STATUS_COLORS[status])} />
                    {STATUS_LABELS[status]} ({count})
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Bloc communications */}
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-secondary-800 flex items-center gap-1.5">
              <MessageSquare size={14} className="text-blue-500" /> Communications
            </h3>
            <Link href="/dashboard/communications" className="text-xs text-primary-600 hover:text-primary-800">Voir tout</Link>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-2xl font-bold text-secondary-800">{stats.msgSentThisMonth}</p>
              <p className="text-xs text-warm-400">messages ce mois</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-secondary-800">{stats.msgReadRate}%</p>
              <p className="text-xs text-warm-400">taux de lecture</p>
            </div>
          </div>
          {/* Barre taux de lecture */}
          <div className="h-2 bg-warm-100 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${stats.msgReadRate}%` }} />
          </div>
        </div>
      </div>

      {/* Effectifs par classe + Absences recentes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Effectifs */}
        <div className="card space-y-3">
          <h3 className="text-sm font-bold text-secondary-800 flex items-center gap-1.5">
            <BookOpen size={14} className="text-success-500" /> Effectifs par classe
          </h3>
          {stats.classCapacity.length === 0 ? (
            <p className="text-xs text-warm-400 italic py-4 text-center">Aucune classe</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {stats.classCapacity.map(c => {
                const pct = c.max > 0 ? Math.round((c.enrolled / c.max) * 100) : 0
                return (
                  <div key={c.name}>
                    <div className="flex items-center justify-between text-xs mb-0.5">
                      <span className="text-warm-700 font-medium truncate">{c.name}</span>
                      <span className="text-warm-400 flex-shrink-0">{c.enrolled}/{c.max}</span>
                    </div>
                    <div className="h-2 bg-warm-100 rounded-full overflow-hidden">
                      <div
                        className={clsx('h-full rounded-full transition-all', pct >= 90 ? 'bg-danger-500' : pct >= 70 ? 'bg-amber-500' : 'bg-success-500')}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Absences recentes */}
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-secondary-800 flex items-center gap-1.5">
              <AlertTriangle size={14} className="text-amber-500" /> Dernieres absences
            </h3>
            <Link href="/dashboard/absences" className="text-xs text-primary-600 hover:text-primary-800">Voir tout</Link>
          </div>
          {stats.recentAbsences.length === 0 ? (
            <p className="text-xs text-warm-400 italic py-4 text-center">Aucune absence recente</p>
          ) : (
            <div className="space-y-1.5">
              {stats.recentAbsences.map(a => (
                <div key={a.id} className="flex items-center gap-2 bg-warm-50 rounded-lg px-3 py-1.5 text-xs">
                  <span className={clsx('w-1.5 h-1.5 rounded-full flex-shrink-0', a.is_justified ? 'bg-success-500' : 'bg-danger-500')} />
                  <span className="font-medium text-warm-700 truncate">
                    {a.students?.last_name} {a.students?.first_name}
                  </span>
                  <span className="text-warm-400 flex-shrink-0">{a.classes?.name}</span>
                  <span className="ml-auto text-warm-400 flex-shrink-0">
                    {ABSENCE_TYPE[a.absence_type] ?? a.absence_type}
                  </span>
                  <span className="text-warm-300 flex-shrink-0">
                    {new Date(a.absence_date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Raccourcis rapides */}
      <div className="card space-y-3">
        <h3 className="text-sm font-bold text-secondary-800">Raccourcis</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <Link href="/dashboard/students/new" className="btn-secondary text-xs py-2 flex items-center justify-center gap-1.5">
            <UserPlus size={14} /> Nouvel eleve
          </Link>
          <Link href="/dashboard/communications/new" className="btn-secondary text-xs py-2 flex items-center justify-center gap-1.5">
            <Send size={14} /> Nouveau message
          </Link>
          <Link href="/dashboard/grades" className="btn-secondary text-xs py-2 flex items-center justify-center gap-1.5">
            <FileText size={14} /> Saisie notes
          </Link>
          <Link href="/dashboard/absences" className="btn-secondary text-xs py-2 flex items-center justify-center gap-1.5">
            <Calendar size={14} /> Feuille d'appel
          </Link>
        </div>
      </div>
    </div>
  )
}
