'use client'

import Link from 'next/link'
import { clsx } from 'clsx'
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip as RTooltip,
  LineChart, Line, XAxis, YAxis, CartesianGrid,
} from 'recharts'
import { Users, GraduationCap, BookOpen, AlertTriangle } from 'lucide-react'
import DashboardHeader from './DashboardHeader'
import StatCard from './StatCard'
import Tooltip from '@/components/ui/Tooltip'
import { SERIES, INK, VizTooltip, VizCard, VizLegend, fmtEur } from './viz'
import { classInfoOf } from './classInfo'
import type { FeeStatus } from '@/types/database'

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
    absencesThisMonth: number
    absencesUnjustified: number
    billed: number
    collected: number
    outstanding: number
    rate: number
    statusCounts: Record<FeeStatus, number>
    classCapacity: { name: string; enrolled: number; max: number }[]
    absenceTrend: { label: string; justified: number; unjustified: number }[]
    recentAbsences: { id: string; absence_date: string; absence_type: string; is_justified: boolean; students: { id: string; first_name: string; last_name: string } | null; classes: any | null }[]
    todo: { debtorFamilies: number; unjustifiedAbsences: number; unreadNotifs: number }
  }
}

const ABSENCE_TYPE: Record<string, string> = {
  absence: 'Absence', retard: 'Retard', authorized_absence: 'Abs. autorisée',
}

const RACCOURCIS = [
  { href: '/dashboard/students/new', label: 'Nouvel élève' },
  { href: '/dashboard/communications/new', label: 'Nouveau message' },
  { href: '/dashboard/grades', label: 'Saisie des notes' },
  { href: '/dashboard/absences', label: "Feuille d'appel" },
]

export default function DashboardAdmin({ stats, ...headerProps }: Props) {
  const treso = [
    { name: 'Encaissé', value: Math.round(stats.collected), fill: SERIES.primary },
    { name: 'Reste', value: Math.round(stats.outstanding), fill: SERIES.orange },
  ].filter(d => d.value > 0)

  const trendHasData = stats.absenceTrend.some(d => d.justified > 0 || d.unjustified > 0)

  return (
    <div className="space-y-4 animate-fade-in">
      <DashboardHeader {...headerProps} />

      {/* Raccourcis (libelle seul) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {RACCOURCIS.map(r => (
          <Link key={r.href} href={r.href} className="btn btn-secondary w-full !py-2 text-xs !rounded-lg">
            {r.label}
          </Link>
        ))}
      </div>

      {/* KPIs principaux */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard title="Élèves actifs" value={stats.studentsActive} subtitle={`${stats.studentsTotal} au total`} icon={Users} tone="primary" />
        <StatCard title="Enseignants" value={stats.teachersActive} subtitle="actifs" icon={GraduationCap} tone="ardoise" />
        <StatCard title="Classes" value={stats.classesCount} subtitle={`${stats.enrollmentsActive} inscriptions`} icon={BookOpen} tone="amber" />
        <StatCard title="Absences ce mois" value={stats.absencesThisMonth} subtitle={`${stats.absencesUnjustified} non justifiées`} icon={AlertTriangle} tone="orange" />
      </div>

      {/* Tresorerie (donut) + A traiter */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="card p-3">
          <div className="flex items-baseline justify-between mb-2">
            <h3 className="stat-label">Recouvrement · {headerProps.yearLabel}</h3>
            <Link href="/dashboard/financements/vue-globale" className="text-xs text-primary-600 hover:text-primary-700">Statistiques</Link>
          </div>
          {stats.billed === 0 ? (
            <p className="text-xs text-warm-700 italic py-8 text-center">Aucune facturation.</p>
          ) : (
            <div className="flex items-center gap-6">
              <div className="relative shrink-0" style={{ width: 128, height: 128 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={treso} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="90%"
                      paddingAngle={2} stroke="#ffffff" strokeWidth={2} isAnimationActive={false}>
                      {treso.map(d => <Cell key={d.name} fill={d.fill} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 grid place-items-center pointer-events-none">
                  <div className="text-center">
                    <p className="text-xl font-bold text-secondary-800 tabular-nums leading-none">{stats.rate}%</p>
                    <p className="text-[9px] text-warm-700 uppercase tracking-wide">encaissé</p>
                  </div>
                </div>
              </div>
              <dl className="flex-1 grid grid-cols-3 gap-4">
                <div className="border-l-2 border-primary-500 pl-2.5">
                  <dd className="text-lg font-bold text-primary-600 tabular-nums leading-none">{fmtEur(stats.collected)}</dd>
                  <dt className="text-[10px] text-warm-700 mt-1">encaissé</dt>
                </div>
                <div className="border-l-2 border-orange-500 pl-2.5">
                  <dd className="text-lg font-bold text-orange-700 tabular-nums leading-none">{fmtEur(stats.outstanding)}</dd>
                  <dt className="text-[10px] text-warm-700 mt-1">reste à encaisser</dt>
                </div>
                <div className="border-l-2 border-warm-300 pl-2.5">
                  <dd className="text-lg font-bold text-warm-700 tabular-nums leading-none">{fmtEur(stats.billed)}</dd>
                  <dt className="text-[10px] text-warm-700 mt-1">facturé</dt>
                </div>
              </dl>
            </div>
          )}
        </section>

        <section className="card p-3">
          <h3 className="stat-label mb-2">À traiter</h3>
          <div className="space-y-1.5">
            <TodoRow href="/dashboard/financements/reglements" label="Familles avec impayé" count={stats.todo.debtorFamilies} tone="orange" />
            <TodoRow href="/dashboard/absences" label="Absences non justifiées" count={stats.todo.unjustifiedAbsences} tone="red" />
            <TodoRow href="/dashboard/notifications" label="Notifications non lues" count={stats.todo.unreadNotifs} tone="primary" />
          </div>
        </section>
      </div>

      {/* Effectifs (barres CSS, denominateur par classe) + Tendance absences (courbe) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="card p-3">
          <h3 className="stat-label mb-2">Effectifs par classe</h3>
          {stats.classCapacity.length === 0 ? (
            <p className="text-xs text-warm-700 italic py-4 text-center">Aucune classe.</p>
          ) : (
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              {stats.classCapacity.map(c => {
                const pct = c.max > 0 ? Math.round((c.enrolled / c.max) * 100) : 0
                return (
                  <div key={c.name}>
                    <div className="flex items-center justify-between text-[11px] mb-0.5">
                      <span className="text-warm-700 font-medium truncate">{c.name}</span>
                      <span className="text-warm-700 flex-shrink-0 tabular-nums">{c.enrolled}/{c.max}</span>
                    </div>
                    <div className="h-1.5 bg-warm-100 rounded-full overflow-hidden">
                      <div
                        className={clsx('h-full rounded-full transition-all', pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-orange-500' : 'bg-primary-500')}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        <VizCard title="Absences · 30 derniers jours" height={160}>
          {!trendHasData ? (
            <p className="text-xs text-warm-700 italic grid place-items-center h-full">Aucune absence sur la période.</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats.absenceTrend} margin={{ top: 6, right: 10, bottom: 0, left: -18 }}>
                  <CartesianGrid vertical={false} stroke={INK.grid} />
                  <XAxis dataKey="label" tick={{ fill: INK.muted, fontSize: 9 }} axisLine={{ stroke: INK.axis }} tickLine={false} interval={6} />
                  <YAxis allowDecimals={false} tick={{ fill: INK.muted, fontSize: 10 }} axisLine={false} tickLine={false} width={32} />
                  <RTooltip content={<VizTooltip unit="absence" />} cursor={{ stroke: INK.axis }} />
                  <Line type="monotone" dataKey="unjustified" name="Non justifiées" stroke={SERIES.orange} strokeWidth={2} dot={false} activeDot={{ r: 3, strokeWidth: 2, stroke: '#ffffff' }} isAnimationActive={false} />
                  <Line type="monotone" dataKey="justified" name="Justifiées" stroke={SERIES.primary} strokeWidth={2} dot={false} activeDot={{ r: 3, strokeWidth: 2, stroke: '#ffffff' }} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
              <VizLegend items={[
                { label: 'Non justifiées', color: SERIES.orange },
                { label: 'Justifiées', color: SERIES.primary },
              ]} />
            </>
          )}
        </VizCard>
      </div>

      {/* Dernieres absences */}
      <section className="card p-3 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="stat-label">Dernières absences</h3>
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
                  <span className={clsx('w-1.5 h-1.5 rounded-full flex-shrink-0', a.is_justified ? 'bg-primary-500' : 'bg-red-500')} />
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
    </div>
  )
}

// ─── Ligne « A traiter » ────────────────────────────────────────────────────
const TODO_TONE: Record<string, string> = {
  orange: 'bg-orange-100 text-orange-700',
  red: 'bg-red-100 text-red-700',
  primary: 'bg-primary-100 text-primary-700',
}

function TodoRow({ href, label, count, tone }: { href: string; label: string; count: number; tone: string }) {
  return (
    <Link href={href} className="flex items-center gap-2 bg-warm-50 rounded-lg px-3 py-2 text-xs hover:bg-warm-100 transition-colors">
      <span className={clsx('inline-grid place-items-center min-w-[1.5rem] h-6 px-1.5 rounded-full font-bold tabular-nums', count > 0 ? TODO_TONE[tone] : 'bg-warm-100 text-warm-700')}>
        {count}
      </span>
      <span className="font-medium text-warm-700">{label}</span>
    </Link>
  )
}
