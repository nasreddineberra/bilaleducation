/**
 * Conversion « HH:MM » → minutes depuis minuit.
 *
 * Extraite de `DayColumn` a son 2e usage (motif de `fmtDuration` et de
 * `TruncatedText`) : `SlotCapsule` en a besoin pour connaitre la DUREE d'un
 * creneau, et ne peut pas l'importer de `DayColumn` — qui l'importe deja, le
 * cycle serait immediat.
 */
export function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

/**
 * Duree d'un creneau, en minutes.
 *
 * Elle commande la hauteur affichee, et donc ce qui tient dans la capsule :
 * l'amplitude de la grille est FIXE (7h-19h), une heure vaut donc toujours un
 * douzieme de la colonne. La duree est a la hauteur ce que `groupSize` est a la
 * largeur.
 */
export function dureeMinutes(debut: string, fin: string): number {
  return timeToMinutes(fin) - timeToMinutes(debut)
}
