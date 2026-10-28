/**
 * QUELLES SEANCES UNE ABSENCE D'ENSEIGNANT TOUCHE (lot 3a, decision du 28/10).
 *
 * Une absence va d'une date + heure a une date + heure (bornes comprises,
 * heure locale de l'ecole). Une seance est TOUCHEE des qu'elle CHEVAUCHE
 * l'absence, ne serait-ce qu'une minute ; une seance qui finit a l'heure ou
 * l'absence commence (ou commence a l'heure ou elle finit) ne l'est pas.
 *
 * Meme regle que la base (`decider_seances_absence`, migration
 * add-absences-enseignants.sql), qui reste le juge : le controle 29 eprouve
 * les memes cas limites des deux cotes.
 *
 * Les seances d'un jour viennent de `creneauxDuJour` (titulaire deduit a la
 * date, seances annulees dans l'EDT ecartees) : rien n'est recopie ici.
 * Module PUR, dates `AAAA-MM-JJ`, horodatages `AAAA-MM-JJTHH:MM`.
 */
import { creneauxDuJour, type CreneauSource, type ExceptionSource } from './creneaux-du-jour.ts'
import type { TitulaireDe } from './seance.ts'

export interface PeriodeAbsence {
  /** Horodatage local, `AAAA-MM-JJTHH:MM` (secondes et separateur espace toleres). */
  debut: string
  fin: string
}

export interface SeanceTouchee {
  slotId: string
  classId: string
  date: string
  startTime: string
  endTime: string
}

/** `AAAA-MM-JJ HH:MM:SS` ou `AAAA-MM-JJTHH:MM` -> `AAAA-MM-JJTHH:MM`, comparable en chaine. */
function horodatage(h: string): string {
  return h.replace(' ', 'T').slice(0, 16)
}

/** La seance `date` `debut`-`fin` chevauche-t-elle l'absence ? */
export function chevaucheAbsence(date: string, debut: string, fin: string, absence: PeriodeAbsence): boolean {
  const seanceDebut = `${date}T${debut.slice(0, 5)}`
  const seanceFin = `${date}T${fin.slice(0, 5)}`
  return seanceDebut < horodatage(absence.fin) && seanceFin > horodatage(absence.debut)
}

/** Une absence d'enseignant (`teachers.id`), telle que la lit l'EDT. */
export interface AbsenceEnseignant extends PeriodeAbsence {
  id: string
  teacher_id: string
}

/** L'absence de `teacherId` qui touche la seance, s'il y en a une. */
export function absenceDeSeance(
  absences: AbsenceEnseignant[],
  teacherId: string | null,
  date: string,
  debut: string,
  fin: string,
): AbsenceEnseignant | undefined {
  if (!teacherId) return undefined
  return absences.find(a => a.teacher_id === teacherId && chevaucheAbsence(date, debut, fin, a))
}

/** Les jours couverts par l'absence, du jour de debut au jour de fin compris. */
export function joursDeLAbsence(absence: PeriodeAbsence): string[] {
  const premier = horodatage(absence.debut).slice(0, 10)
  const dernier = horodatage(absence.fin).slice(0, 10)
  const jours: string[] = []
  const [y, m, d] = premier.split('-').map(Number)
  // Date LOCALE, avancee d'un jour a la fois (jamais toISOString : decalage UTC).
  for (const jour = new Date(y, m - 1, d); ; jour.setDate(jour.getDate() + 1)) {
    const iso = `${jour.getFullYear()}-${String(jour.getMonth() + 1).padStart(2, '0')}-${String(jour.getDate()).padStart(2, '0')}`
    if (iso > dernier) break
    jours.push(iso)
  }
  return jours
}

/**
 * Les seances que `teacherId` (un `teachers.id`) devait assurer pendant
 * l'absence, dans l'ordre chronologique. `estFerme` ecarte vacances et jours
 * feries (`lib/school-year/jours-fermes.ts`).
 */
export function seancesTouchees(
  absence: PeriodeAbsence & { teacherId: string },
  slots: CreneauSource[],
  exceptions: ExceptionSource[],
  titulaireDe: TitulaireDe,
  estFerme: (date: string) => boolean = () => false,
): SeanceTouchee[] {
  const resultat: SeanceTouchee[] = []
  for (const date of joursDeLAbsence(absence)) {
    if (estFerme(date)) continue
    for (const c of creneauxDuJour(slots, exceptions, titulaireDe, absence.teacherId, date)) {
      if (!chevaucheAbsence(date, c.startTime, c.endTime, absence)) continue
      resultat.push({ slotId: c.slotId, classId: c.classId, date, startTime: c.startTime, endTime: c.endTime })
    }
  }
  return resultat
}
