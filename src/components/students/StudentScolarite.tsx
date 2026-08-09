'use client'

import { useMemo } from 'react'
import { clsx } from 'clsx'
import PeriodeCell from '@/components/scolarite/PeriodeCell'

/**
 * SCOLARITÉ — un HISTORIQUE, année après année.
 *
 * ┌─ TOUT VIENT DES BULLETINS ARCHIVÉS ─────────────────────────────────────┐
 * │ Cet onglet ne calcule plus rien. Moyenne, absences et retards sont lus   │
 * │ sur la ligne d'archive du bulletin, où le bouton « Archiver » les a      │
 * │ écrits. Un bulletin archivé est un document PUBLIÉ : ses chiffres sont   │
 * │ des faits.                                                              │
 * │                                                                          │
 * │ Auparavant l'écran les reconstituait depuis `evaluations` + `grades` +   │
 * │ `absences`, avec deux défauts : il fallait quatre tables pour redire ce  │
 * │ qu'un document affirmait déjà, et le chiffre affiché pouvait DIVERGER de │
 * │ celui que la famille avait reçu — une note corrigée après l'archivage    │
 * │ changeait l'écran, jamais le PDF.                                       │
 * │                                                                          │
 * │ CONSÉQUENCE ASSUMÉE : une période non archivée n'affiche pas de chiffre. │
 * │ C'est la définition d'un historique, et c'est le choix retenu.           │
 * └──────────────────────────────────────────────────────────────────────────┘
 */

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

type PeriodRow = {
  id: string
  label: string
  order_index: number
  school_years: { label: string } | null
}

/** Ligne d'archive : le fichier ET les chiffres imprimés sur le document. */
type BulletinArchiveRow = {
  class_id: string
  period_id: string
  file_path: string
  moyenne_generale: number | null
  absences_count: number
  absences_unjustified: number
  retards_count: number
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
  /** « Inscrit » = ACTIF dans cette application : l'etat vide ne peut pas
      affirmer qu'un apprenant desactive est inscrit. */
  studentActive: boolean
  enrollments: EnrollmentRow[]
  periods: PeriodRow[]
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

// Le jour de classe est stocké en anglais (« monday ») : il se traduit à l'affichage.
const DAYS_FR: Record<string, string> = {
  monday: 'Lundi', tuesday: 'Mardi', wednesday: 'Mercredi',
  thursday: 'Jeudi', friday: 'Vendredi', saturday: 'Samedi', sunday: 'Dimanche',
}

// ─── Composant ────────────────────────────────────────────────────────────────

export default function StudentScolarite({
  studentActive, enrollments, periods, bulletinArchives, mainTeachers, warnings,
}: Props) {

  // Archives indexées par classe:période — la source unique de cet écran.
  const archiveMap = useMemo(() => {
    const map = new Map<string, BulletinArchiveRow>()
    for (const a of bulletinArchives) map.set(`${a.class_id}:${a.period_id}`, a)
    return map
  }, [bulletinArchives])

  const teacherMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const ct of mainTeachers) {
      if (ct.teachers) {
        // NOM avant prénom, règle du projet.
        map.set(ct.class_id, [ct.teachers.civilite, ct.teachers.last_name, ct.teachers.first_name].filter(Boolean).join(' '))
      }
    }
    return map
  }, [mainTeachers])

  const periodsByYear = useMemo(() => {
    const map = new Map<string, PeriodRow[]>()
    for (const p of periods) {
      const year = (p.school_years as any)?.label ?? 'Inconnue'
      if (!map.has(year)) map.set(year, [])
      map.get(year)!.push(p)
    }
    return map
  }, [periods])

  // Avertissements par année. Ils ne figurent sur AUCUN bulletin — ils restent
  // donc lus en direct, et sont le seul chiffre de cet écran qui ne vienne pas
  // d'une archive.
  const warningsByYear = useMemo(() => {
    const periodToYear = new Map<string, string>()
    for (const p of periods) periodToYear.set(p.id, (p.school_years as any)?.label ?? 'Inconnue')
    const map = new Map<string, number>()
    for (const w of warnings) {
      const y = periodToYear.get(w.period_id) ?? 'Inconnue'
      map.set(y, (map.get(y) ?? 0) + 1)
    }
    return map
  }, [warnings, periods])

  const yearGroups = useMemo(() => {
    const valides = enrollments.filter(e => e.classes)
    const byYear = new Map<string, typeof valides>()
    for (const e of valides) {
      const year = e.classes!.academic_year
      if (!byYear.has(year)) byYear.set(year, [])
      byYear.get(year)!.push(e)
    }
    return Array.from(byYear.entries()).sort((a, b) => b[0].localeCompare(a[0]))
  }, [enrollments])

  if (yearGroups.length === 0) {
    return (
      <div className="card p-6 text-center">
        {/* « Aucune inscription » etait FAUX : l'apprenant EST inscrit a
            l'etablissement - il a une fiche -, il n'est simplement affecte a
            aucune classe. Ce sont deux choses differentes, et le bandeau de la
            fiche affiche deja « Non affecte ». */}
        <p className="text-sm text-secondary-800">Aucune affectation à une classe.</p>
        <p className="mt-1 text-xs text-warm-700">
          {studentActive
            ? 'L’apprenant est inscrit mais n’a pas encore de classe. Sa scolarité apparaîtra ici dès son affectation.'
            : 'L’apprenant n’est pas inscrit cette année et n’a aucune classe.'}
        </p>
      </div>
    )
  }

  /**
   * Une carte par INSCRIPTION et non par année seule : un élève n'est jamais dans
   * deux classes à la fois, mais il peut en changer en cours d'année, et deux
   * classes successives ne se moyennent pas dans une même colonne. Ce cas rare
   * donne donc deux cartes pour la même année, chacune avec son statut.
   */
  return (
    <div className="space-y-3">
      {yearGroups.map(([year, yearEnrollments]) =>
        yearEnrollments.map(enrollment => {
          const cls     = enrollment.classes!
          const teacher = teacherMap.get(enrollment.class_id)
          const yearPeriods = (periodsByYear.get(cls.academic_year) ?? [])
            .sort((a, b) => a.order_index - b.order_index)

          // Infos de classe : au niveau de l'annee, sur une seule ligne.
          const infosClasse = [
            cls.level ? `Niveau ${cls.level}` : null,
            teacher,
            cls.cotisation_types?.label,
            cls.day_of_week
              ? `${DAYS_FR[cls.day_of_week] ?? cls.day_of_week}${cls.start_time && cls.end_time ? ` ${cls.start_time.slice(0, 5)}-${cls.end_time.slice(0, 5)}` : ''}`
              : null,
          ].filter(Boolean).join(' · ')

          // Seuls les avertissements restent au niveau de l'annee : aucune colonne
          // ne les porte, et ils ne figurent sur aucun bulletin.
          const avert = warningsByYear.get(year) ?? 0

          return (
            <section key={enrollment.id} className="card p-4 space-y-2">

              {/* En-tete : annee, statut, classe et ses infos, bilan a droite */}
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

                <span className="text-xs text-warm-700">
                  {avert > 0 && <>{avert} avert. · </>}
                  {/* `enrollments.enrollment_date` date l'AFFECTATION a la classe.
                      Dans cette application « inscrit » veut dire ACTIF : appeler
                      cette date « Inscrit le » melangeait les deux notions. */}
                  Affecté le {new Date(enrollment.enrollment_date).toLocaleDateString('fr-FR')}
                </span>
              </div>

              {/* Les periodes en COLONNES : 2 semestres ou 3 trimestres. Une
                  seule colonne sur petit ecran, sinon la ligne serait rognee. */}
              {yearPeriods.length > 0 ? (
                <div className={clsx(
                  'grid gap-2',
                  yearPeriods.length === 2
                    ? 'grid-cols-1 lg:grid-cols-2'
                    : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3',
                )}>
                  {yearPeriods.map(period => {
                    const a = archiveMap.get(`${enrollment.class_id}:${period.id}`)
                    return (
                      <PeriodeCell
                        key={period.id}
                        label={period.label}
                        archived={!!a}
                        moyenne={a?.moyenne_generale ?? null}
                        filePath={a?.file_path ?? null}
                        abs={a?.absences_count ?? 0}
                        absNJ={a?.absences_unjustified ?? 0}
                        retards={a?.retards_count ?? 0}
                      />
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
