'use client'

import Link from 'next/link'
import { clsx } from 'clsx'
import { Users, FileText, AlertTriangle, DollarSign, Bell } from 'lucide-react'
import DashboardHeader from './DashboardHeader'

const ABSENCE_TYPE: Record<string, string> = {
  absence: 'Absence', retard: 'Retard', authorized_absence: 'Abs. autorisée',
}

const FEE_STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: 'En attente', color: 'text-warm-500 bg-warm-100' },
  partial: { label: 'Partiel', color: 'text-amber-700 bg-amber-100' },
  paid:    { label: 'Soldé', color: 'text-success-700 bg-success-100' },
  overdue: { label: 'En retard', color: 'text-danger-700 bg-danger-100' },
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
    children: { id: string; first_name: string; last_name: string; gender: string | null; photo_url: string | null; enrollments: { class_id: string; classes: { name: string } | null }[] }[]
    recentGrades: { id: string; score: number; evaluations: { title: string; max_score: number; evaluation_date: string | null } | null; students: { first_name: string; last_name: string } | null }[]
    recentAbsences: { id: string; absence_date: string; absence_type: string; is_justified: boolean; students: { first_name: string; last_name: string } | null }[]
    familyFee: { id: string; total_due: number; status: string } | null
  }
}

function formatCurrency(n: number): string {
  return n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })
}

export default function DashboardParent({ stats, ...headerProps }: Props) {
  const feeInfo = stats.familyFee ? FEE_STATUS[stats.familyFee.status] ?? FEE_STATUS.pending : null

  return (
    <div className="space-y-6 animate-fade-in">
      <DashboardHeader {...headerProps} />

      {/* Mes enfants */}
      <div className="card space-y-3">
        <h3 className="text-sm font-bold text-secondary-800 flex items-center gap-1.5">
          <Users size={14} className="text-primary-500" /> Mes enfants
        </h3>
        {stats.children.length === 0 ? (
          <p className="text-xs text-warm-400 italic py-4 text-center">Aucun enfant enregistré</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {stats.children.map(child => (
              <Link
                key={child.id}
                href={`/dashboard/students/${child.id}`}
                className="flex items-center gap-3 bg-warm-50 rounded-lg px-4 py-3 hover:bg-warm-100 transition-colors"
              >
                <div className={clsx(
                  'w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0',
                  child.gender === 'M' ? 'bg-blue-400' : child.gender === 'F' ? 'bg-pink-400' : 'bg-warm-400'
                )}>
                  {child.first_name?.[0]}{child.last_name?.[0]}
                </div>
                <div>
                  <p className="text-sm font-bold text-warm-800">{child.first_name} {child.last_name}</p>
                  <p className="text-xs text-warm-500">
                    {child.enrollments?.[0]?.classes?.name ?? 'Non inscrit'}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Notes + Absences */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Dernieres notes */}
        <div className="card space-y-3">
          <h3 className="text-sm font-bold text-secondary-800 flex items-center gap-1.5">
            <FileText size={14} className="text-blue-500" /> Dernières notes
          </h3>
          {stats.recentGrades.length === 0 ? (
            <p className="text-xs text-warm-400 italic py-4 text-center">Aucune note récente</p>
          ) : (
            <div className="space-y-1.5">
              {stats.recentGrades.map(g => (
                <div key={g.id} className="flex items-center gap-2 bg-warm-50 rounded-lg px-3 py-1.5 text-xs">
                  <span className="font-medium text-warm-700 truncate">{g.students?.first_name}</span>
                  <span className="text-warm-400 truncate flex-1">{g.evaluations?.title}</span>
                  <span className="font-bold text-secondary-800 flex-shrink-0">
                    {g.score}/{g.evaluations?.max_score}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Absences */}
        <div className="card space-y-3">
          <h3 className="text-sm font-bold text-secondary-800 flex items-center gap-1.5">
            <AlertTriangle size={14} className="text-amber-500" /> Absences
          </h3>
          {stats.recentAbsences.length === 0 ? (
            <p className="text-xs text-warm-400 italic py-4 text-center">Aucune absence</p>
          ) : (
            <div className="space-y-1.5">
              {stats.recentAbsences.map(a => (
                <div key={a.id} className="flex items-center gap-2 bg-warm-50 rounded-lg px-3 py-1.5 text-xs">
                  <span className={clsx('w-1.5 h-1.5 rounded-full flex-shrink-0', a.is_justified ? 'bg-success-500' : 'bg-danger-500')} />
                  <span className="font-medium text-warm-700 truncate">{a.students?.first_name}</span>
                  <span className="text-warm-400 flex-shrink-0">{ABSENCE_TYPE[a.absence_type] ?? a.absence_type}</span>
                  <span className="ml-auto text-warm-300 flex-shrink-0">
                    {new Date(a.absence_date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Solde financier */}
      {stats.familyFee && feeInfo && (
        <div className="card space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-secondary-800 flex items-center gap-1.5">
              <DollarSign size={14} className="text-success-500" /> Situation financière
            </h3>
            <Link href="/dashboard/financements/reglements" className="text-xs text-primary-600 hover:text-primary-800">Détails</Link>
          </div>
          <div className="flex items-center gap-3">
            <p className="text-2xl font-bold text-secondary-800">{formatCurrency(Number(stats.familyFee.total_due))}</p>
            <span className={clsx('px-2 py-0.5 rounded-full text-xs font-bold', feeInfo.color)}>
              {feeInfo.label}
            </span>
          </div>
        </div>
      )}

      {/* Raccourcis */}
      <div className="card space-y-3">
        <h3 className="text-sm font-bold text-secondary-800">Raccourcis</h3>
        <div className="grid grid-cols-2 gap-2">
          <Link href="/dashboard/notifications" className="btn-secondary text-xs py-2 flex items-center justify-center gap-1.5">
            <Bell size={14} /> Messages
          </Link>
          <Link href="/dashboard/financements/reglements" className="btn-secondary text-xs py-2 flex items-center justify-center gap-1.5">
            <DollarSign size={14} /> Paiements
          </Link>
        </div>
      </div>
    </div>
  )
}
