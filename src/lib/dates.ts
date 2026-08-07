/**
 * Formatage des dates, dans le fuseau de l'établissement.
 *
 * POURQUOI CE MODULE EXISTE. `toLocaleString('fr-FR')` choisit la LANGUE, pas le
 * FUSEAU : celui-ci vient de la machine qui exécute le code. Dans un composant
 * client, c'est le navigateur — donc l'heure que l'utilisateur a sous les yeux.
 * Mais dans un composant SERVEUR, c'est l'hébergeur, qui tourne en UTC : une
 * intervention ouverte à 01 h 38 à Paris s'affichait « 23:38 ».
 *
 * Le décalage passe inaperçu l'essentiel du temps — deux heures d'écart sur une
 * date lue de loin — et devient franchement faux au voisinage de minuit, où il
 * change le JOUR. « Absent le 7 août » pour une absence du 8.
 *
 * On fixe donc le fuseau explicitement. `Europe/Paris` et non un décalage en
 * dur : l'heure d'été et l'heure d'hiver ne se devinent pas, et un `+02:00`
 * écrit à la main serait faux la moitié de l'année.
 *
 * LIMITE ASSUMÉE : la valeur est la même pour tous les établissements. Le jour
 * où l'éditeur vendra hors de France métropolitaine — outre-mer compris —, il
 * faudra une colonne `timezone` sur `etablissements` et la lire ici.
 */
export const FUSEAU = 'Europe/Paris'

/** « 07 août 2026 ». */
export function formatDateFr(date: string | Date): string {
  return new Date(date).toLocaleDateString('fr-FR', {
    timeZone: FUSEAU, day: '2-digit', month: 'short', year: 'numeric',
  })
}

/** « 07 août, 23:38 » — sans l'année, pour les listes récentes. */
export function formatDateHeureFr(date: string | Date): string {
  return new Date(date).toLocaleString('fr-FR', {
    timeZone: FUSEAU, day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

/** « jeudi 7 août 2026 » — pour les emails et les en-têtes. */
export function formatJourLongFr(date: string | Date): string {
  return new Date(date).toLocaleDateString('fr-FR', {
    timeZone: FUSEAU, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}
