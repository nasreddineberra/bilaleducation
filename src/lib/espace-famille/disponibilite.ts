/**
 * VERROU DE DEVELOPPEMENT DE L'ESPACE FAMILLE (docs/ESPACE-FAMILLE.md, lot 7).
 *
 * Tant qu'il est faux, l'option ne s'active QUE sur l'ecole de demonstration
 * (console : bascule grisee ailleurs, refus aussi cote serveur). Jour J : un
 * commit qui le passe a `true` ; l'option se vend alors ecole par ecole.
 * Module sans dependance : lu par la console (client) et ses actions (serveur).
 */
export const ESPACE_FAMILLE_DISPONIBLE = false

/** L'option peut-elle etre activee sur cette ecole ? */
export function optionActivable(estDemo: boolean): boolean {
  return ESPACE_FAMILLE_DISPONIBLE || estDemo
}

export const RAISON_VERROU = 'L’espace famille est en développement : il ne s’active que sur l’école de démonstration.'

/** Decision 17 : la console ne desactive pas l'option tant que l'ecole a ouvert l'espace. */
export const RAISON_ECOLE_OUVERTE = 'L’établissement doit d’abord désactiver l’espace famille (Paramètres · Établissement).'
