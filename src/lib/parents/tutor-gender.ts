/**
 * Genre d'un tuteur, déduit de son lien de parenté.
 *
 * La table `parents` ne porte PAS de colonne de genre : elle décrit un foyer, pas
 * des personnes. Le lien de parenté est donc la seule information disponible, et
 * elle ne tranche pas toujours (« tuteur » est masculin par convention de
 * libellé, « responsable légal » ne dit rien) — d'où le `null`, qui vaut avatar
 * neutre plutôt que supposition.
 *
 * Extrait de `AffectationAdultesClient` à son deuxième usage (feuille d'appel
 * adultes) : ce projet a déjà payé le prix d'un calcul recopié dans trois écrans.
 */
export function genderFromRelationship(rel: string | null): 'male' | 'female' | null {
  if (rel === 'père' || rel === 'tuteur') return 'male'
  if (rel === 'mère') return 'female'
  return null
}
