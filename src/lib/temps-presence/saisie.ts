/**
 * QUELS TYPES DE PRESENCE SE SAISISSENT A LA MAIN.
 *
 * Ni l'absence (page Absences enseignants), ni le cours, ni l'activite : ces
 * heures naissent d'une seance de l'EDT et de sa validation (decision du 28/10).
 * Restent les types libres de l'ecole. Une seule regle pour la modale (types
 * proposes) et pour le bouton « Ajouter » (grise quand il n'en reste aucun).
 */
export function estTypeSaisissable(pt: { is_absence: boolean; reserved_kind?: string | null }): boolean {
  return !pt.is_absence && pt.reserved_kind !== 'absence' && !estHeureDeLEdt(pt)
}

/**
 * Heure de COURS ou d'ACTIVITE : nee d'une seance de l'EDT et de sa validation.
 * Elle ne se modifie ni ne se supprime dans Temps de presence (la retirer
 * laisserait la seance « validee » sans heure).
 */
export function estHeureDeLEdt(pt: { reserved_kind?: string | null } | null | undefined): boolean {
  return pt?.reserved_kind === 'cours' || pt?.reserved_kind === 'activite'
}
