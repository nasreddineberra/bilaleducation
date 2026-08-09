'use client'

import { useMemo } from 'react'
import { clsx } from 'clsx'
import { createClient } from '@/lib/supabase/client'

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
  file_path: string
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

// Le jour de classe etait rendu tel qu'il est stocke (« monday ») : anglais a
// l'ecran, dans une interface entierement francaise.
const DAYS_FR: Record<string, string> = {
  monday: 'Lundi', tuesday: 'Mardi', wednesday: 'Mercredi',
  thursday: 'Jeudi', friday: 'Vendredi', saturday: 'Samedi', sunday: 'Dimanche',
}

const PERIOD_LABELS: Record<string, string> = {
  T1: 'Trimestre 1', T2: 'Trimestre 2', T3: 'Trimestre 3',
  S1: 'Semestre 1', S2: 'Semestre 2',
}

// ─── Composant ────────────────────────────────────────────────────────────────

export default function StudentScolarite({
  studentId, enrollments, evaluations, grades, periods, absences, bulletinArchives, mainTeachers, warnings,
}: Props) {

  // Index bulletins archivés par class_id:period_id → file_path (bucket privé)
  const bulletinMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const a of bulletinArchives) map.set(`${a.class_id}:${a.period_id}`, a.file_path)
    return map
  }, [bulletinArchives])

  // Ouvre un bulletin via URL signée (onglet ouvert AVANT l'await pour éviter le blocage popup).
  const openBulletin = async (fp: string) => {
    const w = window.open('', '_blank')
    const { data, error } = await createClient().storage.from('bulletins').createSignedUrl(fp, 60)
    if (error || !data?.signedUrl) { w?.close(); return }
    w ? (w.location.href = data.signedUrl) : window.open(data.signedUrl, '_blank')
  }

  // Index professeur principal par class_id
  const teacherMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const ct of mainTeachers) {
      if (ct.teachers) {
        const parts = [ct.teachers.civilite, ct.teachers.last_name, ct.teachers.first_name].filter(Boolean)
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
        <p className="text-xs text-warm-700 italic">Aucune inscription enregistrée.</p>
      </div>
    )
  }

  /**
   * MISE EN PAGE (choix utilisateur du 9 août) : une carte par année, calquée sur
   * la scolarité adulte — les informations de classe se lisent AU NIVEAU DE
   * L'ANNÉE, en tête de carte, et les périodes s'alignent en COLONNES au-dessous,
   * chacune portant sa moyenne, son bulletin et son assiduité.
   *
   * La carte reste rattachée à une INSCRIPTION et non à l'année seule : un élève
   * n'est jamais dans deux classes à la fois, mais il peut en changer en cours
   * d'année, et deux classes successives ne se moyennent pas dans une même
   * colonne. Ce cas rare donne donc deux cartes pour la même année, chacune avec
   * son statut.
   */

  return (
    <div className="space-y-3">
      {yearGroups.map(([year, yearEnrollments]) =>
        yearEnrollments.map(enrollment => {
          const cls     = enrollment.classes!
          const teacher = teacherMap.get(enrollment.class_id)
          const ds      = disciplineStatsByYear.get(year)
          const yearPeriods = (periodsByYear.get(cls.academic_year) ?? [])
            .sort((a, b) => a.order_index - b.order_index)
          const classEvals = evaluations.filter(e => e.class_id === enrollment.class_id)

          // Infos de classe : au niveau de l'annee, sur une seule ligne.
          const infosClasse = [
            cls.level ? `Niveau ${cls.level}` : null,
            teacher,
            cls.cotisation_types?.label,
            cls.day_of_week
              ? `${DAYS_FR[cls.day_of_week] ?? cls.day_of_week}${cls.start_time && cls.end_time ? ` ${cls.start_time.slice(0, 5)}-${cls.end_time.slice(0, 5)}` : ''}`
              : null,
            `Inscrit le ${new Date(enrollment.enrollment_date).toLocaleDateString('fr-FR')}`,
          ].filter(Boolean).join(' · ')

          return (
            <section key={enrollment.id} className="card p-4 space-y-2">

              {/* En-tete : annee, statut, classe, et le bilan d'assiduite de l'annee */}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-bold text-secondary-800">{year}</h3>
                  <span className={clsx(
                    'text-[10px] font-bold uppercase px-1.5 py-0.5 rounded',
                    STATUS_COLOR[enrollment.status] ?? 'bg-warm-100 text-warm-700',
                  )}>
                    {STATUS_LABEL[enrollment.status] ?? enrollment.status}
                  </span>
                  <span className="text-xs text-warm-700">
                    <span className="font-semibold text-warm-800">Classe : {cls.name}</span>
                    {infosClasse && <> · {infosClasse}</>}
                  </span>
                </div>

                {/* Les avertissements ne figurent dans aucune colonne : c'est ici
                    qu'ils se lisent, avec le total de l'annee. */}
                {ds && (ds.abs > 0 || ds.retards > 0 || ds.warnings > 0) && (
                  <span className="text-xs text-warm-700">
                    {ds.abs > 0 && <>{ds.abs} abs.{ds.unjustified > 0 && ` (${ds.unjustified} nj)`}</>}
                    {ds.retards > 0 && <>{ds.abs > 0 ? ' · ' : ''}{ds.retards} ret.</>}
                    {ds.warnings > 0 && <>{(ds.abs > 0 || ds.retards > 0) ? ' · ' : ''}{ds.warnings} avert.</>}
                  </span>
                )}
              </div>

              {/* Les periodes en COLONNES : 2 semestres ou 3 trimestres. */}
              {yearPeriods.length > 0 ? (
                <div className={clsx('grid gap-2', yearPeriods.length === 2 ? 'grid-cols-2' : 'grid-cols-3')}>
                  {yearPeriods.map(period => {
                    const bulletinPath = bulletinMap.get(`${enrollment.class_id}:${period.id}`)
                    const scoredEvals  = classEvals.filter(e => e.period_id === period.id && e.eval_kind === 'scored')

                    // Moyenne PONDEREE : chaque note ramenee sur 20, ponderee par
                    // son coefficient. Les absences et les evaluations non notees
                    // en sont exclues.
                    let totalWeighted = 0
                    let totalCoeff    = 0
                    for (const ev of scoredEvals) {
                      const grade = gradeMap.get(ev.id)
                      if (!grade || grade.is_absent || grade.score == null || !ev.max_score) continue
                      totalWeighted += (grade.score / ev.max_score) * 20 * ev.coefficient
                      totalCoeff    += ev.coefficient
                    }
                    const avg = totalCoeff > 0 ? totalWeighted / totalCoeff : null

                    const periodAbs = absences.filter(a => a.class_id === enrollment.class_id && a.period_id === period.id)
                    const absTotal  = periodAbs.filter(a => a.absence_type === 'absence').length
                    const absNJ     = periodAbs.filter(a => a.absence_type === 'absence' && !a.is_justified).length
                    const retards   = periodAbs.filter(a => a.absence_type === 'retard').length

                    return (
                      <div key={period.id} className="rounded-xl bg-warm-50 px-3 py-2">
                        <p className="stat-label">{PERIOD_LABELS[period.label] ?? period.label}</p>

                        {/* Moyenne, bulletin et assiduite sur UNE ligne. */}
                        <div className="flex items-center gap-1.5 text-[11px] text-warm-700">
                          <span className={clsx(
                            'font-bold tabular-nums',
                            avg == null ? 'text-warm-700'
                              : avg >= 14 ? 'text-primary-700'
                              : avg >= 10 ? 'text-amber-700'
                              : 'text-red-600',
                          )}>
                            {avg != null ? `${avg.toFixed(2)}/20` : 'Pas de note'}
                          </span>

                          <span aria-hidden="true">·</span>

                          {bulletinPath ? (
                            <button
                              type="button"
                              onClick={() => openBulletin(bulletinPath)}
                              className="text-primary-600 hover:text-primary-700 font-medium rounded outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                            >
                              Bulletin
                            </button>
                          ) : (
                            <span>Pas de bulletin</span>
                          )}

                          <span aria-hidden="true">·</span>

                          <span className="tabular-nums">
                            {absTotal} abs.{absNJ > 0 && <span className="text-orange-700"> ({absNJ} nj)</span>} · {retards} ret.
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-[11px] text-warm-700 italic">Aucune période configurée pour cette année.</p>
              )}
            </section>
          )
        })
      )}
    </div>
  )
}
