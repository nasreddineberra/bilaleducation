/**
 * HELPERS PARTAGES DU TEMPS DE PRESENCE.
 *
 * Extraits de `TempsPresenceClient` a leur SECOND usage (onglet Assiduite de la
 * fiche enseignant), comme `TruncatedText` et `escapeHtml` avant eux.
 *
 * Ce n'est pas de la cosmetique : une duree recopiee, c'est le motif exact qui a
 * produit le calcul comptable divergent dans trois sous-menus de Financements —
 * corrige dans un seul pendant un mois. Deux ecrans qui affichent les heures d'un
 * meme enseignant doivent les afficher a l'identique, par CONSTRUCTION.
 */

/** Un type de presence, reduit a ce dont la mise en forme a besoin. */
export interface PresenceTypeLike {
  code: string
  is_absence: boolean
}

/**
 * Duree en minutes vers `2h30` / `3h`.
 *
 * Les minutes sont completees a deux chiffres (`2h05`) : `2h5` se lit mal et
 * s'aligne mal en colonne.
 */
export function fmtDuration(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${h}h`
}

/**
 * Le type de presence correspondant au CODE porte par `staff_time_entries.entry_type`.
 *
 * La comparaison est insensible a la casse : le code est saisi en majuscules mais
 * d'anciennes lignes peuvent porter autre chose.
 *
 * Renvoie `undefined` quand le code n'existe plus parmi les types de l'annee — un
 * type retire en cours d'annee laisse derriere lui des saisies qu'il ne faut ni
 * perdre ni faire passer pour des absences. C'est pourquoi l'appelant doit tester
 * `?.is_absence` et non l'inverse.
 */
export function findPresenceType<T extends PresenceTypeLike>(
  presenceTypes: T[],
  code: string,
): T | undefined {
  return presenceTypes.find(pt => pt.code.toUpperCase() === code.toUpperCase())
}
