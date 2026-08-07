/**
 * Mot de passe temporaire, à remettre à la personne pour sa première connexion.
 *
 * COMPOSITION GARANTIE : au moins une majuscule, une minuscule, un chiffre et un
 * caractère spécial — les règles mêmes que `PASSWORD_RULES` impose. Tirer douze
 * caractères au hasard dans un alphabet mélangé ne suffit pas : rien n'empêche
 * alors le tirage de ne produire aucun chiffre. On impose donc un caractère de
 * chaque famille, on complète, puis on mélange.
 *
 * ISOMORPHE : `globalThis.crypto` existe des deux côtés (Node 18+ et navigateur),
 * ce qui permet au bouton « Générer » de fonctionner dans le formulaire ET aux
 * server actions d'en produire un.
 *
 * ALÉA CRYPTOGRAPHIQUE et non `Math.random()` : ce mot de passe ouvre un compte.
 *
 * Caractères ambigus écartés — ni `O`/`0`, ni `l`/`1`/`I` : ce mot de passe se
 * lit, se dicte au téléphone et se recopie à la main. Une confusion à la lecture
 * coûte un appel au support.
 *
 * NB — deux copies d'un générateur plus ancien subsistent dans
 * `dashboard/teachers/actions.ts` et `dashboard/parents/actions.ts`
 * (`crypto.randomBytes(9).toString('base64url')`). Elles ne garantissent aucune
 * composition : leur sortie peut échouer aux règles que l'application impose
 * ensuite à l'utilisateur. À faire converger ici.
 */

const MAJUSCULES = 'ABCDEFGHJKLMNPQRSTUVWXYZ'   // sans I ni O
const MINUSCULES = 'abcdefghijkmnpqrstuvwxyz'   // sans l ni o
const CHIFFRES   = '23456789'                   // sans 0 ni 1
const SPECIAUX   = '!@#$%&*+=?'

/** Entier aléatoire dans [0, max[, sans biais de modulo. */
function entierAleatoire(max: number): number {
  const limite = Math.floor(0xffffffff / max) * max
  const buf = new Uint32Array(1)
  let v: number
  do {
    globalThis.crypto.getRandomValues(buf)
    v = buf[0]
  } while (v >= limite)
  return v % max
}

const tirer = (alphabet: string) => alphabet[entierAleatoire(alphabet.length)]

export function generateTempPassword(longueur = 12): string {
  const familles = [MAJUSCULES, MINUSCULES, CHIFFRES, SPECIAUX]
  const tout = familles.join('')

  // Une garantie par famille, puis on complète.
  const caracteres = familles.map(tirer)
  while (caracteres.length < longueur) caracteres.push(tirer(tout))

  // Mélange de Fisher-Yates : sans lui, les quatre premiers caractères
  // trahiraient toujours l'ordre des familles.
  for (let i = caracteres.length - 1; i > 0; i--) {
    const j = entierAleatoire(i + 1)
    ;[caracteres[i], caracteres[j]] = [caracteres[j], caracteres[i]]
  }

  return caracteres.join('')
}
