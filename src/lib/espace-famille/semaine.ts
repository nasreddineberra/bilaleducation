import { enseignantDeSeance, fusionnerDecisions, salleDeSeance, type TitulaireDe } from '../edt/seance.ts'
import { intituleCreneau, libelleSalle } from '../edt/intitule.ts'
import { jourFerme, type JourFerme } from '../school-year/jours-fermes.ts'
import type { VacationPeriod, JourFerie } from '@/types/database'

/**
 * SEMAINE D'UNE FAMILLE (espace famille, emploi du temps) : calcul PUR, teste.
 *
 * Les seances des classes de ses participants (enfants et cours adulte du tuteur,
 * fusionnes le 03/11), jour par jour. Rien n'est recalcule a part : QUI assure
 * une seance (`enseignantDeSeance`), les decisions d'absence fondues dans les
 * exceptions (`fusionnerDecisions`), la salle (`salleDeSeance`), l'intitule
 * (`intituleCreneau`) et les jours fermes (`jourFerme`) sont ceux de l'EDT de
 * l'ecole. Dates en `AAAA-MM-JJ` (comparaison lexicographique exacte).
 */

export interface CreneauFamille {
  id: string
  class_id: string
  day_of_week: number | null
  start_time: string
  end_time: string
  slot_type: string
  is_recurring: boolean
  slot_date: string | null
  effective_from: string | null
  effective_until: string | null
  is_active: boolean
  room_id: string | null
  libelle: string | null
  unites_enseignement: { nom_fr: string } | null
}

export interface ExceptionFamille {
  schedule_slot_id: string
  exception_date: string
  exception_type: string
  override_room_id: string | null
}

/** Rendu de `famille_seances_modifiees` : jamais l'absence ni son motif. */
export interface SeanceModifiee {
  schedule_slot_id: string
  seance_date: string
  decision: string
  remplacant_profile_id: string | null
  remplacant_teacher_id: string | null
  remplacant_civilite: string | null
  remplacant_nom: string | null
  remplacant_prenom: string | null
}

export interface SeanceFamille {
  slotId: string
  debut: string
  fin: string
  intitule: string
  salle: string | null
  /** Qui l'assure (remplacant compris) ; `null` = « Prof non affecté » ou annulee. */
  enseignant: string | null
  statut: 'prevue' | 'annulee' | 'remplacee'
  /** Libelles des participants de la classe (« Lina », « Moi »). */
  qui: string[]
}

export interface JourFamille {
  date: string
  ferme: JourFerme | null
  seances: SeanceFamille[]
}

export interface EntreeSemaine {
  /** Dates de la semaine affichee, dans l'ordre. */
  jours: string[]
  creneaux: CreneauFamille[]
  exceptions: ExceptionFamille[]
  decisions: SeanceModifiee[]
  titulaireDe: TitulaireDe
  /** Nom affiche d'un enseignant (`teachers.id`), « Civilite NOM Prenom ». */
  nomEnseignant: (teacherId: string) => string | null
  /** Salle de la classe (« meme salle pour tous les creneaux »), si elle en a une. */
  salleDeLaClasse: (classId: string) => string | null
  nomSalle: (roomId: string) => string | null
  vacances: VacationPeriod[] | null
  feries: JourFerie[] | null
  /** Participants : classe et libelle. */
  participants: { classId: string; libelle: string }[]
}

/** Jour de la semaine de `date` au format de `day_of_week` (0 = dimanche). */
function jourSemaine(date: string): number {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d).getDay()
}

/** `date` decale de `n` jours (`AAAA-MM-JJ`, jamais `toISOString`). */
export function decalerJour(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number)
  const x = new Date(y, m - 1, d + n)
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
}

/** Jours affiches de la semaine de `date` : du jour de debut de l'ecole, sur ses jours ouvres. */
export function joursDeLaSemaine(date: string, debutSemaine: number, joursOuvres: number): string[] {
  const premier = decalerJour(date, -((jourSemaine(date) - debutSemaine + 7) % 7))
  return Array.from({ length: Math.min(7, Math.max(1, joursOuvres)) }, (_, i) => decalerJour(premier, i))
}

/** Le creneau a-t-il lieu ce jour-la (recurrence et dates d'effet, ou seance ponctuelle) ? */
function aLieu(c: CreneauFamille, date: string): boolean {
  if (!c.is_active) return false
  if (!c.is_recurring) return c.slot_date === date
  if (c.day_of_week !== jourSemaine(date)) return false
  if (c.effective_from && date < c.effective_from) return false
  if (c.effective_until && date > c.effective_until) return false
  return true
}

export function semaineFamille(e: EntreeSemaine): JourFamille[] {
  // Decisions d'absence fondues dans les exceptions, comme sur l'EDT de l'ecole.
  const profilVersEnseignant = new Map(e.decisions.map(d => [d.remplacant_profile_id ?? '', d.remplacant_teacher_id]))
  const exceptions = fusionnerDecisions(
    e.exceptions.map(x => ({ ...x, remplacant_teacher_id: null as string | null })),
    e.decisions.map(d => ({ absence_id: '', schedule_slot_id: d.schedule_slot_id, seance_date: d.seance_date, decision: d.decision, remplacant_profile_id: d.remplacant_profile_id })),
    pid => profilVersEnseignant.get(pid) ?? null,
  )
  const quiDe = (classId: string) => e.participants.filter(p => p.classId === classId).map(p => p.libelle)

  return e.jours.map(date => {
    const ferme = jourFerme(date, e.vacances, e.feries)
    if (ferme) return { date, ferme, seances: [] }

    const seances = e.creneaux
      .filter(c => aLieu(c, date) && quiDe(c.class_id).length > 0)
      .map(c => {
        const ex = exceptions.find(x => x.schedule_slot_id === c.id && x.exception_date === date) ?? null
        const ens = enseignantDeSeance(c.class_id, date, ex, e.titulaireDe)
        const decision = e.decisions.find(d => d.schedule_slot_id === c.id && String(d.seance_date).slice(0, 10) === date)
        const remplacant = decision?.decision === 'remplacee'
          ? [decision.remplacant_civilite, decision.remplacant_nom, decision.remplacant_prenom].filter(Boolean).join(' ') || null
          : null
        const salleId = salleDeSeance(c, ex, e.salleDeLaClasse(c.class_id))
        const nomSalle = salleId ? e.nomSalle(salleId) : null
        return {
          slotId: c.id,
          debut: c.start_time.slice(0, 5),
          fin: c.end_time.slice(0, 5),
          intitule: intituleCreneau(c),
          salle: nomSalle ? libelleSalle(nomSalle) : null,
          enseignant: ens.annulee ? null : remplacant ?? (ens.teacherId ? e.nomEnseignant(ens.teacherId) : null),
          statut: ens.annulee ? 'annulee' as const : ens.remplacement ? 'remplacee' as const : 'prevue' as const,
          qui: quiDe(c.class_id),
        }
      })
      .sort((a, b) => a.debut.localeCompare(b.debut))
    return { date, ferme: null, seances }
  })
}
