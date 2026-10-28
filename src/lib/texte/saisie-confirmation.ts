/**
 * Saisie de confirmation (mot-cle, nom, slug a retaper avant une action grave).
 * Decision du 28/10 : la saisie se TAPE (collage refuse par le composant
 * `ui/SaisieConfirmation`) et l'espace n'est acceptee qu'ENTRE deux mots :
 * jamais au debut, jamais doublee, jamais a la fin du texte confirme.
 * Casse ignoree, accents compris.
 */

/** Forme canonique du texte attendu (espaces parasites de la base retires). */
function canonique(texte: string): string {
  return texte.trim().replace(/\s+/g, ' ').toLocaleLowerCase('fr')
}

/**
 * La frappe est-elle acceptable en cours de saisie ? Refuse une espace en tete,
 * deux espaces de suite et tout blanc autre que l'espace (tabulation, espace
 * insecable). Une espace finale UNIQUE est toleree le temps de taper le mot
 * suivant ; elle bloque la confirmation (`saisieConforme`).
 */
export function frappeAcceptable(valeur: string): boolean {
  if (/[^\S ]/.test(valeur)) return false
  if (valeur.startsWith(' ')) return false
  return !valeur.includes('  ')
}

/** La saisie confirme-t-elle exactement le texte attendu ? */
export function saisieConforme(valeur: string, attendu: string): boolean {
  if (!frappeAcceptable(valeur) || valeur.endsWith(' ')) return false
  const cible = canonique(attendu)
  return cible !== '' && valeur.toLocaleLowerCase('fr') === cible
}
