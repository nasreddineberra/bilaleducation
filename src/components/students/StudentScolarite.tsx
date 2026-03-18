'use client'

import { useMemo } from 'react'
import { clsx } from 'clsx'
import { BookOpen, AlertTriangle, FileText, Download, ShieldAlert, Clock } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type EnrollmentRow = {
  id: string
  class_id: string
  enrollment_date: string
  status: string
  classes: {
    id: string
    name: string
    level: string
    academic_year: string
    day_of_week: string | null
    start_time: string | null
    end_time: string | null
    cotisation_types: { label: string } | null
  } | null
}

type EvaluationRow = {
  id: string
  class_id: string
  period_id: string | null
  cours_id: string | null
  eval_kind: string | null
  max_score: number | null
  coefficient: number
  cours: { nom_fr: string } | null
}

type GradeRow = {
  id: string
  evaluation_id: string
  score: number | null
  is_absent: boolean
  comment: string | null
}

type PeriodRow = {
  id: string
  label: string
  order_index: number
  school_years: { label: string } | null
}

type AbsenceRow = {
  class_id: string
  period_id: string
  absence_type: string
  is_justified: boolean
}

type BulletinArchiveRow = {
  class_id: string
  period_id: string
  file_url: string
}

type MainTeacherRow = {
  class_id: string
  teachers: { civilite: string | null; first_name: string; last_name: string } | null
}

type WarningRow = {
  period_id: string
  severity: string
}

interface Props {
  studentId: string
  enrollments: EnrollmentRow[]
  evaluations: EvaluationRow[]
  grades: GradeRow[]
  periods: PeriodRow[]
  absences: AbsenceRow[]
  bulletinArchives: BulletinArchiveRow[]
  mainTeachers: MainTeacherRow[]
  warnings: WarningRow[]
}

const STATUS_LABEL: Record<string, string> = {
  active: 'Actif',
  completed: 'Terminé',
  withdrawn: 'Retiré',
}

const STATUS_COLOR: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  completed: 'bg-blue-100 text-blue-700',
  withdrawn: 'bg-red-100 text-red-700',
}

const PERIOD_LABELS: Record<string, string> = {
  T1: 'Trimestre 1', T2: 'Trimestre 2', T3: 'Trimestre 3',
  S1: 'Semestre 1', S2: 'Semestre 2',
}

// ─── Composant ────────────────────────────────────────────────────────────────

export default function StudentScolarite({
  studentId, enrollments, evaluations, grades, periods, absences, bulletinArchives, mainTeachers, warnings,
}: Props) {

  // Index bulletins archivés par class_id:period_id
  const bulletinMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const a of bulletinArchives) map.set(`${a.class_id}:${a.period_id}`, a.file_url)
    return map
  }, [bulletinArchives])

  // Index professeur principal par class_id
  const teacherMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const ct of mainTeachers) {
      if (ct.teachers) {
        const parts = [ct.teachers.civilite, ct.teachers.first_name, ct.teachers.last_name].filter(Boolean)
        map.set(ct.class_id, parts.join(' '))
      }
    }
    return map
  }, [mainTeachers])

  // Index grades par evaluation_id
  const gradeMap = useMemo(() => {
    const map = new Map<string, GradeRow>()
    for (const g of grades) map.set(g.evaluation_id, g)
    return map
  }, [grades])

  // Regrouper les périodes par année scolaire
  const periodsByYear = useMemo(() => {
    const map = new Map<string, PeriodRow[]>()
    for (const p of periods) {
      const year = (p.school_years as any)?.label ?? 'Inconnue'
      if (!map.has(year)) map.set(year, [])
      map.get(year)!.push(p)
    }
    return map
  }, [periods])

  // Map period_id → année scolaire
  const periodToYear = useMemo(() => {
    const map = new Map<string, string>()
    for (const p of periods) {
      const year = (p.school_years as any)?.label ?? 'Inconnue'
      map.set(p.id, year)
    }
    return map
  }, [periods])

  // Statistiques discipline par année scolaire
  const disciplineStatsByYear = useMemo(() => {
    const stats = new Map<string, { abs: number; unjustified: number; retards: number; warnings: number }>()
    for (const a of absences) {
      const year = periodToYear.get(a.period_id) ?? 'Inconnue'
      if (!stats.has(year)) stats.set(year, { abs: 0, unjustified: 0, retards: 0, warnings: 0 })
      const s = stats.get(year)!
      if (a.absence_type === 'absence') {
        s.abs++
        if (!a.is_justified) s.unjustified++
      } else {
        s.retards++
      }
    }
    for (const w of warnings) {
      const year = periodToYear.get(w.period_id) ?? 'Inconnue'
      if (!stats.has(year)) stats.set(year, { abs: 0, unjustified: 0, retards: 0, warnings: 0 })
      stats.get(year)!.warnings++
    }
    return stats
  }, [absences, warnings, periodToYear])

  // Regrouper les inscriptions par année scolaire (décroissant)
  const yearGroups = useMemo(() => {
    const validEnrollments = enrollments.filter(e => e.classes)
    const byYear = new Map<string, typeof validEnrollments>()
    for (const e of validEnrollments) {
      const year = e.classes!.academic_year
      if (!byYear.has(year)) byYear.set(year, [])
      byYear.get(year)!.push(e)
    }
    // Trier les années de façon décroissante
    return Array.from(byYear.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
  }, [enrollments])

  if (yearGroups.length === 0) {
    return (
      <div className="card p-4 text-center">
        <p className="text-xs text-warm-400 italic">Aucune inscription enregistrée.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {yearGroups.map(([year, yearEnrollments]) => (
        <div key={year}>
          {/* En-tête année scolaire + stats discipline */}
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <BookOpen size={13} className="text-primary flex-shrink-0" />
            <h3 className="text-xs font-bold text-secondary-800">{year}</h3>
            {(() => {
              const ds = disciplineStatsByYear.get(year)
              if (!ds || (ds.abs === 0 && ds.retards === 0 && ds.warnings === 0)) return null
              return (
                <span className="flex items-center gap-2 text-[11px] text-warm-500 ml-2">
                  {ds.abs > 0 && (
                    <span className="flex items-center gap-0.5">
                      <AlertTriangle size={10} className="text-red-400" />
                      {ds.abs} abs.{ds.unjustified > 0 && <span className="text-red-500">({ds.unjustified} nj)</span>}
                    </span>
                  )}
                  {ds.retards > 0 && (
                    <span className="flex items-center gap-0.5">
                      <Clock size={10} className="text-amber-400" />
                      {ds.retards} ret.
                    </span>
                  )}
                  {ds.warnings > 0 && (
                    <span className="flex items-center gap-0.5">
                      <ShieldAlert size={10} className="text-purple-400" />
                      {ds.warnings} avert.
                    </span>
                  )}
                </span>
              )
            })()}
          </div>

          <div className="space-y-2">
            {yearEnrollments.map(enrollment => {
              const cls = enrollment.classes!
              const teacher = teacherMap.get(enrollment.class_id)
              const yearPeriods = (periodsByYear.get(cls.academic_year) ?? [])
                .sort((a, b) => a.order_index - b.order_index)

              // Calcul des moyennes par période
              const classEvals = evaluations.filter(e => e.class_id === enrollment.class_id)

              return (
                <div key={enrollment.id} className="card overflow-hidden">
                  {/* Info classe */}
                  <div className="px-3 py-2 bg-warm-50 border-b border-warm-100 flex items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-bold text-secondary-800">
                          {cls.name} – {cls.level}
                        </p>
                        <span className={clsx(
                          'text-[10px] font-medium px-1.5 py-0.5 rounded-full',
                          STATUS_COLOR[enrollment.status] ?? 'bg-warm-100 text-warm-500'
                        )}>
                          {STATUS_LABEL[enrollment.status] ?? enrollment.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-warm-400 mt-0.5">
                        {teacher && <>{teacher} · </>}
                        {cls.cotisation_types?.label && <>{cls.cotisation_types.label} · </>}
                        Niveau {cls.level} · {cls.day_of_week && (
                          <>
                            {cls.day_of_week}
                            {cls.start_time && cls.end_time && ` ${cls.start_time.slice(0, 5)}–${cls.end_time.slice(0, 5)}`}
                            {' · '}
                          </>
                        )}
                        Inscrit le {new Date(enrollment.enrollment_date).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                  </div>

                  {/* Bulletins par période */}
                  {yearPeriods.length > 0 ? (
                    <div className="divide-y divide-warm-100">
                      {yearPeriods.map(period => {
                        const bulletinUrl = bulletinMap.get(`${enrollment.class_id}:${period.id}`)
                        const periodEvals = classEvals.filter(e => e.period_id === period.id)
                        const scoredEvals = periodEvals.filter(e => e.eval_kind === 'scored')

                        // Moyenne
                        let totalWeighted = 0
                        let totalCoeff = 0
                        for (const ev of scoredEvals) {
                          const grade = gradeMap.get(ev.id)
                          if (!grade || grade.is_absent || grade.score == null || !ev.max_score) continue
                          totalWeighted += (grade.score / ev.max_score) * 20 * ev.coefficient
                          totalCoeff += ev.coefficient
                        }
                        const avg = totalCoeff > 0 ? totalWeighted / totalCoeff : null

                        // Absences
                        const periodAbs = absences.filter(a => a.class_id === enrollment.class_id && a.period_id === period.id)
                        const absTotal = periodAbs.filter(a => a.absence_type === 'absence').length
                        const retards = periodAbs.filter(a => a.absence_type === 'retard').length

                        return (
                          <div key={period.id} className="px-3 py-1.5 flex items-center gap-2">
                            <span className="text-[11px] font-semibold text-warm-500 w-20 flex-shrink-0">
                              {PERIOD_LABELS[period.label] ?? period.label}
                            </span>

                            {avg != null && (
                              <span className={clsx(
                                'text-xs font-bold',
                                avg >= 14 ? 'text-green-600' : avg >= 10 ? 'text-amber-600' : 'text-red-600'
                              )}>
                                {avg.toFixed(2)}/20
                              </span>
                            )}

                            {bulletinUrl ? (
                              <a
                                href={bulletinUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-[11px] text-primary-600 hover:text-primary-700 font-medium"
                              >
                                <Download size={11} />
                                Bulletin
                              </a>
                            ) : (
                              <span className="text-[11px] text-warm-300 italic">—</span>
                            )}

                            {(absTotal > 0 || retards > 0) && (
                              <span className="flex items-center gap-1 text-[11px] text-warm-400 ml-auto">
                                {absTotal > 0 && <><AlertTriangle size={10} className="text-red-400" /> {absTotal} abs.</>}
                                {retards > 0 && <>{absTotal > 0 ? ' · ' : ''}<Clock size={10} className="text-amber-400" /> {retards} ret.</>}
                              </span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="px-3 py-2">
                      <p className="text-[11px] text-warm-300 italic">Aucune période trouvée</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
