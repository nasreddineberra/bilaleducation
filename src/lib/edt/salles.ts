/**
 * Salles proposees pour UNE seance (decision du 27/10) : les salles de COURS,
 * libres sur ce creneau a cette date. Une salle est occupee si une autre seance
 * non annulee l'utilise ce jour-la (salle changee pour la seance comprise) sur
 * un horaire qui chevauche. La salle actuelle de la seance reste proposee.
 *
 * Module PUR : la resolution des seances est celle des tableaux de bord
 * (`seancesDuJour`, series, ponctuelles, dates d'effet, exceptions), la salle
 * d'une seance celle de `salleDeSeance` (seance, ponctuelle, classe, creneau).
 * Heures en `HH:MM`, dates en `AAAA-MM-JJ`.
 */
import { seancesDuJour, type SlotSource, type ExceptionSource, type TitulaireDe } from '../dashboard/seances.ts'

export interface SalleSource {
  id: string
  name: string
  room_type: string
}

export function sallesLibres<S extends SalleSource>(
  salles: S[],
  slots: SlotSource[],
  exceptions: ExceptionSource[],
  date: string,
  debut: string,
  fin: string,
  options: { exclureSlotId?: string | null; salleActuelle?: string | null; salleDeClasse?: (classId: string) => string | null } = {},
): S[] {
  const titulaireSansObjet: TitulaireDe = () => null
  const occupees = new Set(
    !date || !debut || !fin ? [] : seancesDuJour(slots, exceptions, titulaireSansObjet, date, options.salleDeClasse)
      .filter(s => !s.annulee && s.slotId !== options.exclureSlotId && s.roomId)
      .filter(s => s.debut < fin.slice(0, 5) && s.fin > debut.slice(0, 5))
      .map(s => s.roomId as string),
  )
  return salles.filter(r =>
    r.id === options.salleActuelle || (r.room_type === 'salle_cours' && !occupees.has(r.id)))
}
