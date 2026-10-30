'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { clsx } from 'clsx'
import PeriodeCell from '@/components/scolarite/PeriodeCell'
import { Puce, type Ton } from '@/components/dashboard/tdb'
import FormModal from '@/components/ui/FormModal'
import Tooltip from '@/components/ui/Tooltip'
import { FloatButton, FloatInput } from '@/components/ui/FloatFields'
import { useToast } from '@/lib/toast-context'
import { declarerDepartEleve } from '@/app/dashboard/students/actions'
import type { ContexteDepart, FicheEleve } from '@/lib/students/fiche'

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

type EnrollmentRow = FicheEleve['enrollments'][number]

type PeriodRow = FicheEleve['periods'][number]

/** Ligne d'archive : le fichier ET les chiffres imprimés sur le document. */
type BulletinArchiveRow = FicheEleve['bulletinArchives'][number]

type MainTeacherRow = FicheEleve['mainTeachers'][number]

type WarningRow = {
  period_id: string
  severity: string
}

/**
 * Depart en cours d'annee, prepare par la page (`students/[id]/page.tsx`).
 * Present seulement pour un eleve affecte a une classe de l'annee en cours.
 */

interface Props {
  studentId: string
  studentName: string
  depart: ContexteDepart | null
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
  withdrawn: 'Parti',
}

// Pastilles d'etat de la charte : actif au vert de marque, termine ardoise, retire rouge.
const STATUS_TON: Record<string, Ton> = {
  active: 'ok',
  completed: 'info',
  withdrawn: 'danger',
}

// « AAAA-MM-JJ » -> « JJ/MM/AAAA » par decoupage (pas de `new Date`, lu en UTC).
const dateFr = (d: string) => d.slice(0, 10).split('-').reverse().join('/')

// Le jour de classe est stocké en anglais (« monday ») : il se traduit à l'affichage.
const DAYS_FR: Record<string, string> = {
  monday: 'Lundi', tuesday: 'Mardi', wednesday: 'Mercredi',
  thursday: 'Jeudi', friday: 'Vendredi', saturday: 'Samedi', sunday: 'Dimanche',
}

// ─── Composant ────────────────────────────────────────────────────────────────

export default function StudentScolarite({
  studentId, studentName, depart, studentActive, enrollments, periods, bulletinArchives, mainTeachers, warnings,
}: Props) {
  const router = useRouter()
  const toast  = useToast()
  const [departOuvert, setDepartOuvert] = useState(false)
  const [dateDepart, setDateDepart]     = useState('')
  const [departEnCours, setDepartEnCours] = useState(false)
  const [departErreur, setDepartErreur]   = useState<string | null>(null)

  const ouvrirDepart = () => {
    // Aujourd'hui en date LOCALE (`fr-CA` rend AAAA-MM-JJ), jamais `toISOString`.
    setDateDepart(new Date().toLocaleDateString('fr-CA'))
    setDepartErreur(null)
    setDepartOuvert(true)
  }
  const validerDepart = async () => {
    setDepartEnCours(true)
    setDepartErreur(null)
    const res = await declarerDepartEleve(studentId, dateDepart)
    setDepartEnCours(false)
    if (res.error) { setDepartErreur(res.error); return }
    setDepartOuvert(false)
    toast.success('Départ enregistré.')
    router.refresh()
  }
  const dateValide = !!dateDepart
    && (!depart?.rentree || dateDepart >= depart.rentree)
    && (!depart?.fin || dateDepart <= depart.fin)

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
      const year = p.school_years?.label ?? 'Inconnue'
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
    for (const p of periods) periodToYear.set(p.id, p.school_years?.label ?? 'Inconnue')
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
            <section key={enrollment.id} className="card p-3 space-y-2">

              {/* Bandeau : annee et statut ; depart de l'annee en cours a droite */}
              <div className="encadre-titre gap-2">
                <h2 className="text-xs font-bold uppercase tracking-widest">{year}</h2>
                {enrollment.status && (
                  <Puce ton={STATUS_TON[enrollment.status] ?? 'neutre'}>
                    {STATUS_LABEL[enrollment.status] ?? enrollment.status}
                  </Puce>
                )}
                {depart && enrollment.status === 'active' && cls.name === depart.classe && (
                  <span className="ml-auto">
                    {depart.aDonnees ? (
                      <FloatButton type="button" variant="danger" size="mini" onClick={ouvrirDepart}>Déclarer un départ</FloatButton>
                    ) : (
                      <Tooltip content="Aucune note ni absence : retirez-le de sa classe depuis Affectations.">
                        <span tabIndex={0} className="inline-flex outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-focus)] rounded">
                          <FloatButton type="button" variant="danger" size="mini" disabled>Déclarer un départ</FloatButton>
                        </span>
                      </Tooltip>
                    )}
                  </span>
                )}
              </div>

              {/* Classe et ses infos ; affectation et avertissements a droite */}
              <div className="flex items-center justify-between gap-3 flex-wrap text-xs text-warm-700">
                <span>
                  <span className="font-semibold text-secondary-800">Classe : {cls.name}</span>
                  {infosClasse && <> · {infosClasse}</>}
                </span>
                <span>
                  {avert > 0 && <>{avert} avertissement{avert > 1 ? 's' : ''} · </>}
                  {/* `enrollments.enrollment_date` date l'AFFECTATION a la classe.
                      Dans cette application « inscrit » veut dire ACTIF : appeler
                      cette date « Inscrit le » melangeait les deux notions. */}
                  {enrollment.enrollment_date && <>Affecté le {dateFr(enrollment.enrollment_date)}</>}
                  {enrollment.status === 'withdrawn' && enrollment.date_depart && <> · Parti le {dateFr(enrollment.date_depart)}</>}
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

      {departOuvert && depart && (
        <FormModal
          title={`Départ de ${studentName}`}
          onClose={() => setDepartOuvert(false)}
          footer={<>
            <span className="text-xs text-red-700"><span className="font-semibold">*</span> obligatoire</span>
            <div className="flex-1" />
            <FloatButton variant="secondary" type="button" onClick={() => setDepartOuvert(false)} disabled={departEnCours}>Annuler</FloatButton>
            <FloatButton variant="submit" type="button" onClick={validerDepart} loading={departEnCours} disabled={!dateValide}>Valider</FloatButton>
          </>}
        >
          <div className="space-y-3">
            <p className="text-sm text-secondary-700">
              Classe : <span className="font-semibold text-secondary-800">{depart.classe}</span>
              {' · '}Règle de l’établissement : <span className="font-semibold text-secondary-800">{depart.regle}</span>
            </p>
            <FloatInput
              label="Date de départ"
              type="date"
              required
              aria-required="true"
              min={depart.rentree ?? undefined}
              max={depart.fin ?? undefined}
              value={dateDepart}
              onChange={e => setDateDepart(e.target.value)}
            />
            {depart.bulletinsManquants.length > 0 && (
              <p className="text-xs text-amber-700">
                Bulletin{depart.bulletinsManquants.length > 1 ? 's' : ''} non archivé{depart.bulletinsManquants.length > 1 ? 's' : ''} : {depart.bulletinsManquants.join(', ')}.
              </p>
            )}
            {departErreur && <p role="alert" className="text-xs text-red-700">{departErreur}</p>}
          </div>
        </FormModal>
      )}
    </div>
  )
}
