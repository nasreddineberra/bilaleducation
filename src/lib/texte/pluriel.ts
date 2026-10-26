// Accords en nombre — SOURCE UNIQUE.
//
// Un texte affiche ne porte jamais « (s) » : « 3 emails envoyes sur 2 foyers »,
// pas « 3 email(s) envoye(s) sur 2 foyer(s) ». Regle francaise : 0 et 1 au
// singulier, pluriel a partir de 2. Un compteur absent (`undefined`, `null`)
// vaut 0 : jamais « undefined fichiers ». Module PUR, eprouve par `node --test`.

type Nombre = number | null | undefined

/** Le mot accorde seul : `accord(2, 'soldé')` → « soldés », `accord(2, 'travail', 'travaux')`. */
export function accord(n: Nombre, singulier: string, pluriel = `${singulier}s`): string {
  return (n ?? 0) > 1 ? pluriel : singulier
}

/** Le nombre et son mot : `pluriel(3, 'foyer')` → « 3 foyers ». */
export function pluriel(n: Nombre, singulier: string, pluriel_ = `${singulier}s`): string {
  return `${n ?? 0} ${accord(n, singulier, pluriel_)}`
}
