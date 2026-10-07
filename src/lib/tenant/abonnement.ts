/**
 * ECHEANCE D'ABONNEMENT — source unique de « l'abonnement est-il expire ? ».
 *
 * REGLE (arbitrage du 7 octobre) : le JOUR D'ECHEANCE EST INCLUS. Une ecole
 * dont l'abonnement finit le 31/07 travaille tout le 31 ; l'acces tombe le
 * 01/08 a 0 h, HEURE DE PARIS.
 *
 * Pourquoi c'etait faux avant : la console enregistre une date seule, que la
 * base range en `timestamptz` a minuit UTC — soit 2 h (ete) ou 1 h (hiver) a
 * Paris, LE JOUR MEME. Comparer cet instant a `new Date()` coupait l'ecole le
 * 31 au petit matin, alors que la barre laterale annonce « Fin abonnement au
 * 31/07 », qu'on lit « jusqu'au 31 inclus ».
 *
 * On raisonne donc en JOURS CALENDAIRES de Paris, jamais en instants : le jour
 * de l'echeance et le jour courant sont ramenes a `AAAA-MM-JJ` a l'heure de
 * Paris, puis compares comme des chaines. Aucune arithmetique de fuseau, donc
 * aucun piege aux changements d'heure.
 *
 * Module PUR (aucun import) : il sert au middleware, a la console et a la barre
 * laterale, et il s'eprouve par `node --test`.
 */

const FUSEAU = 'Europe/Paris'

const formatJour = new Intl.DateTimeFormat('en-CA', {
  timeZone: FUSEAU, year: 'numeric', month: '2-digit', day: '2-digit',
})

/** Jour calendaire a Paris, au format `AAAA-MM-JJ`. */
export function jourParis(instant: Date): string {
  return formatJour.format(instant)
}

function lireEcheance(valeur: string | null | undefined): Date | null {
  if (!valeur) return null
  const d = new Date(valeur)
  return Number.isNaN(d.getTime()) ? null : d
}

/** Vrai a partir du LENDEMAIN de l'echeance, 0 h a Paris. Sans echeance : jamais. */
export function abonnementExpire(valeur: string | null | undefined, maintenant: Date = new Date()): boolean {
  const fin = lireEcheance(valeur)
  if (!fin) return false
  return jourParis(maintenant) > jourParis(fin)
}

/**
 * Jours restants, en jours calendaires de Paris : 0 = dernier jour d'acces,
 * 1 = la veille, -1 = expire depuis hier. `null` sans echeance.
 */
export function joursRestants(valeur: string | null | undefined, maintenant: Date = new Date()): number | null {
  const fin = lireEcheance(valeur)
  if (!fin) return null
  const enJours = (jour: string) => {
    const [a, m, j] = jour.split('-').map(Number)
    return Date.UTC(a, m - 1, j) / 86_400_000
  }
  return enJours(jourParis(fin)) - enJours(jourParis(maintenant))
}
