/**
 * Durées de conservation proposées à la direction lors d'une purge du journal.
 *
 * SOURCE UNIQUE, partagée par l'écran et la route : celle-ci valide la valeur
 * reçue contre cette liste. Sans quoi une valeur libre venue du navigateur
 * pourrait effacer la période qu'on croyait garder — et une suppression de
 * journal ne se rattrape pas.
 *
 * `0` signifie « tout purger » et non « garder zéro jour à partir de » : la
 * route omet alors la borne de date, sans quoi la comparaison porterait sur
 * l'instant présent et ne supprimerait rien de ce qui vient d'arriver.
 */
export const PURGE_OPTIONS = [
  { jours: 30, label: 'Conserver le dernier mois',      detail: 'Les traces de plus de 30 jours sont supprimées.' },
  { jours: 15, label: 'Conserver les 15 derniers jours', detail: 'Les traces de plus de 15 jours sont supprimées.' },
  { jours: 7,  label: 'Conserver la dernière semaine',   detail: 'Les traces de plus de 7 jours sont supprimées.' },
  { jours: 0,  label: 'Tout purger',                     detail: 'L\'intégralité du journal est supprimée, y compris les traces du jour.' },
] as const

export type PurgeJours = (typeof PURGE_OPTIONS)[number]['jours']
