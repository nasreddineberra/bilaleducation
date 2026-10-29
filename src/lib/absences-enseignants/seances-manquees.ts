/**
 * LES SEANCES QU'UNE ABSENCE FAIT MANQUER (lot 4, 29/10).
 *
 * Une absence d'enseignant pese les heures des seances qu'elle touche
 * (`seancesTouchees`, lib/edt/absences.ts), et non sa duree brute : « du lundi
 * 8 h au mercredi 18 h » ne correspond a aucun temps de travail. Chaque seance
 * touchee porte sa decision : remplacee (et par qui), annulee, ou a decider
 * (aucune ligne en base).
 *
 * Une seule lecture pour quatre ecrans : liste des absences, Temps de presence
 * (recapitulatifs), assiduite (fiche enseignant, Mon compte). Module PUR.
 */
import type { SeanceTouchee } from '../edt/absences.ts'
import { dureeMinutes } from '../edt/temps.ts'
import type { Decision } from './libelles.ts'

/** Une ligne de `absences_enseignants_seances`. */
export interface DecisionEnBase {
  absence_id: string
  schedule_slot_id: string
  seance_date: string
  decision: 'remplacee' | 'annulee'
  remplacant_profile_id: string | null
}

export interface SeanceManquee extends SeanceTouchee {
  absenceId: string
  minutes: number
  decision: Decision
  /** `profiles.id` du remplacant, pour une seance remplacee. */
  remplacantProfileId: string | null
}

/**
 * Les seances touchees par l'absence `absenceId`, chacune avec sa decision.
 * Une decision qui ne correspond plus a une seance touchee (absence raccourcie,
 * creneau retire) est ignoree : elle ne compte plus.
 */
export function seancesManquees(
  absenceId: string,
  seances: SeanceTouchee[],
  decisions: DecisionEnBase[],
): SeanceManquee[] {
  const parSeance = new Map(
    decisions.filter(d => d.absence_id === absenceId).map(d => [`${d.schedule_slot_id}|${d.seance_date}`, d]),
  )
  return seances.map(s => {
    const d = parSeance.get(`${s.slotId}|${s.date}`)
    return {
      ...s,
      absenceId,
      minutes: dureeMinutes(s.startTime.slice(0, 5), s.endTime.slice(0, 5)),
      decision: d?.decision ?? 'a_decider',
      remplacantProfileId: d?.decision === 'remplacee' ? d.remplacant_profile_id : null,
    }
  })
}
