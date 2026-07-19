'use client'

import Link from 'next/link'
import { clsx } from 'clsx'
import { Users, FileText, AlertTriangle, DollarSign, BookOpenText, ClipboardList, BookOpen, Lightbulb } from 'lucide-react'
import DashboardHeader from './DashboardHeader'

const ABSENCE_TYPE: Record<string, string> = {
  absence: 'Absence', retard: 'Retard', authorized_absence: 'Abs. autorisée',
}

const FEE_STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: 'En attente', color: 'text-warm-700 bg-warm-100' },
  partial: { label: 'Partiel', color: 'text-orange-700 bg-orange-100' },
  paid:    { label: 'Soldé', color: 'text-primary-700 bg-primary-100' },
  overpaid:{ label: 'Trop perçu', color: 'text-red-700 bg-red-100' },
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
    upcomingHomework?: { id: string; title: string; homework_type: string; due_date: string; subject: string; classes: { name: string } | null }[]
  }
}

const HW_TYPE_BADGE: Record<string, { label: string; color: string; icon: any }> = {
  exercice: { label: 'Exercice', color: 'bg-blue-100 text-blue-700', icon: ClipboardList },
  lecon:    { label: 'Leçon',    color: 'bg-green-100 text-green-700', icon: BookOpen },
  expose:   { label: 'Exposé',   color: 'bg-purple-100 text-purple-700', icon: Lightbulb },
  autre:    { label: 'Autre',    color: 'bg-warm-100 text-warm-700', icon: FileText },
}

function formatCurrency(n: number): string {
  return n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })
}

export default function DashboardParent({ stats, ...headerProps }: Props) {
  const feeInfo = stats.familyFee ? FEE_STATUS[stats.familyFee.status] ?? FEE_STATUS.pending : null

  return (
    <div className="space-y-4 animate-fade-in">
      <DashboardHeader {...headerProps} />

      {/* Mes enfants */}
      <section className="card p-3 space-y-2">
        <h3 className="stat-label flex items-center gap-1.5"><Users size={13} className="text-warm-700" /> Mes enfants</h3>
        {stats.children.length === 0 ? (
          <p className="text-xs text-warm-700 italic py-4 text-center">Aucun enfant enregistré.</p>
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
                  {child.last_name?.[0]}{child.first_name?.[0]}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-warm-800 truncate">{child.last_name} {child.first_name}</p>
                  <p className="text-xs text-warm-700">{child.enrollments?.[0]?.classes?.name ?? 'Non inscrit'}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Notes + Absences */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="card p-3 space-y-2">
          <h3 className="stat-label">Dernières notes</h3>
          {stats.recentGrades.length === 0 ? (
            <p className="text-xs text-warm-700 italic py-4 text-center">Aucune note récente.</p>
          ) : (
            <div className="space-y-1">
              {stats.recentGrades.map(g => (
                <div key={g.id} className="flex items-center gap-2 bg-warm-50 rounded-lg px-3 py-1.5 text-xs">
                  <span className="font-medium text-warm-700 truncate">{g.students?.first_name}</span>
                  <span className="text-warm-700 truncate flex-1">{g.evaluations?.title}</span>
                  <span className="font-bold text-secondary-800 flex-shrink-0 tabular-nums">{g.score}/{g.evaluations?.max_score}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="card p-3 space-y-2">
          <h3 className="stat-label">Absences</h3>
          {stats.recentAbsences.length === 0 ? (
            <p className="text-xs text-warm-700 italic py-4 text-center">Aucune absence.</p>
          ) : (
            <div className="space-y-1">
              {stats.recentAbsences.map(a => (
                <div key={a.id} className="flex items-center gap-2 bg-warm-50 rounded-lg px-3 py-1.5 text-xs">
                  <span className={clsx('w-1.5 h-1.5 rounded-full flex-shrink-0', a.is_justified ? 'bg-primary-500' : 'bg-red-500')} />
                  <span className="font-medium text-warm-700 truncate">{a.students?.first_name}</span>
                  <span className="text-warm-700 flex-shrink-0">{ABSENCE_TYPE[a.absence_type] ?? a.absence_type}</span>
                  <span className="ml-auto text-warm-700 flex-shrink-0 tabular-nums">{new Date(a.absence_date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Devoirs à venir */}
      {(stats.upcomingHomework ?? []).length > 0 && (
        <section className="card p-3 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="stat-label flex items-center gap-1.5"><BookOpenText size={13} className="text-warm-700" /> Devoirs à venir</h3>
            <Link href="/dashboard/cahier-texte" className="text-xs text-primary-600 hover:text-primary-700">Voir tout</Link>
          </div>
          <div className="space-y-1">
            {stats.upcomingHomework!.map(hw => {
              const typeInfo = HW_TYPE_BADGE[hw.homework_type] ?? HW_TYPE_BADGE.autre
              return (
                <div key={hw.id} className="flex items-center gap-2 bg-warm-50 rounded-lg px-3 py-1.5 text-xs">
                  <span className={clsx('inline-flex items-center px-1.5 py-0.5 rounded font-bold uppercase flex-shrink-0', typeInfo.color)}>
                    {typeInfo.label}
                  </span>
                  <span className="font-medium text-warm-700 truncate flex-1">{hw.title}</span>
                  <span className="text-warm-700 flex-shrink-0">{hw.classes?.name}</span>
                  <span className="ml-1 font-bold text-red-600 flex-shrink-0 tabular-nums">{new Date(hw.due_date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}</span>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Solde financier */}
      {stats.familyFee && feeInfo && (
        <section className="card p-3 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="stat-label flex items-center gap-1.5"><DollarSign size={13} className="text-warm-700" /> Situation financière</h3>
            <Link href="/dashboard/financements/reglements" className="text-xs text-primary-600 hover:text-primary-700">Détails</Link>
          </div>
          <div className="flex items-center gap-3">
            <p className="text-2xl font-bold text-secondary-800 tabular-nums">{formatCurrency(Number(stats.familyFee.total_due))}</p>
            <span className={clsx('px-2 py-0.5 rounded-full text-xs font-bold', feeInfo.color)}>{feeInfo.label}</span>
          </div>
        </section>
      )}

      {/* Raccourcis */}
      <div className="grid grid-cols-2 gap-2">
        <Link href="/dashboard/notifications" className="btn btn-secondary w-full !py-2 text-xs !rounded-lg">Messages</Link>
        <Link href="/dashboard/financements/reglements" className="btn btn-secondary w-full !py-2 text-xs !rounded-lg">Paiements</Link>
      </div>
    </div>
  )
}
