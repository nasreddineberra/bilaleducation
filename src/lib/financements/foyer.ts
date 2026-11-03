import { lignesCotisation, type AnneeLike, type LigneCotisation, type ParticipantLike } from './compute.ts'

/**
 * SOUS-TOTAL D'UN FOYER : SOURCE UNIQUE, pour l'ecole (`family-financials.ts`,
 * toutes les familles) et pour l'espace famille (`lib/espace-famille/finances.ts`,
 * son seul foyer). Enfants avec remise de fratrie, cours adultes sans ; un
 * participant sans cotisation ne compte pas. Les lignes rendues sont alignees
 * sur l'entree (detail affiche).
 */
export function sousTotalFoyer(
  eleves: ParticipantLike[],
  adultes: ParticipantLike[],
  annee: AnneeLike,
): { lignesEleves: LigneCotisation[]; lignesAdultes: LigneCotisation[]; subtotal: number } {
  const lignesEleves = lignesCotisation(eleves, annee)
  const lignesAdultes = lignesCotisation(adultes, annee, { fratrie: false })
  let subtotal = 0
  eleves.forEach((p, i) => { if (p.ct) subtotal += lignesEleves[i].total })
  adultes.forEach((p, i) => { if (p.ct) subtotal += lignesAdultes[i].total })
  return { lignesEleves, lignesAdultes, subtotal }
}
