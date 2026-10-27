/**
 * Participant ADULTE d'une classe : le tuteur 1 ou 2 d'un foyer, designe par la
 * cle composite `${parent_id}-${tutor_number}` (ecrans d'appel, de notes, de
 * bulletins, d'affectation). Colonnes `parent_id` + `tutor_number` en base.
 *
 * On coupe au DERNIER tiret : un uuid en contient deja quatre, un `split('-')`
 * naif le mettrait en pieces.
 */

export type NumeroTuteur = 1 | 2

export function cleAdulte(parentId: string, tutorNumber: NumeroTuteur): string {
  return `${parentId}-${tutorNumber}`
}

export function lireCleAdulte(cle: string): { parent_id: string; tutor_number: NumeroTuteur } {
  const i = cle.lastIndexOf('-')
  const n = Number(cle.slice(i + 1))
  // La base refuserait de toute facon (CHECK tutor_number IN (1, 2)) : on le dit
  // ici, avant d'ecrire, plutot que d'envoyer NaN.
  if (i <= 0 || (n !== 1 && n !== 2)) throw new Error(`Clé de participant adulte invalide : ${cle}`)
  return { parent_id: cle.slice(0, i), tutor_number: n }
}
