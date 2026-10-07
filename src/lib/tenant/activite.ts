/**
 * « Aujourd'hui », « Hier », « Il y a 3 j », « Il y a 2 mois », « Jamais ».
 *
 * Une date brute obligerait a compter mentalement : ce qu'on veut savoir, c'est
 * si l'ecole s'est connectee recemment, pas le jour exact. `jours` sert au seuil
 * d'alerte (30 j sans connexion), `null` = jamais connectee.
 *
 * Partage par la liste des etablissements et la page Sante de la console.
 */
export const SEUIL_INACTIVITE_JOURS = 30

export function depuis(date: string | null, maintenant: number = Date.now()): { texte: string; jours: number | null } {
  if (!date) return { texte: 'Jamais', jours: null }
  const jours = Math.floor((maintenant - new Date(date).getTime()) / 86_400_000)
  if (jours <= 0) return { texte: "Aujourd'hui", jours }
  if (jours === 1) return { texte: 'Hier', jours }
  if (jours < 31) return { texte: `Il y a ${jours} j`, jours }
  const mois = Math.floor(jours / 30)
  return { texte: `Il y a ${mois} mois`, jours }
}
