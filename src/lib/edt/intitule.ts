/**
 * Intitule d'un creneau, affiche en titre (EDT, fiche classe) : la MATIERE d'un
 * cours (unite d'enseignement), le NOM d'une activite. Les deux sont
 * facultatifs : a defaut, le type (« Cours », « Activité »).
 *
 * `cours` (cours du referentiel, chantier Secondaire en veille) reste un repli :
 * aucun ecran ne le remplit aujourd'hui.
 */

export const LIBELLE_TYPE_CRENEAU: Record<string, string> = {
  cours:    'Cours',
  activite: 'Activité',
}

/** Longueur maximale du nom d'une activite (CHECK `schedule_slots_libelle_check`). */
export const NOM_ACTIVITE_MAX = 60

export interface CreneauIntitule {
  slot_type: string
  libelle?: string | null
  unites_enseignement?: { nom_fr: string } | null
  cours?: { nom_fr: string } | null
}

/** Matiere ou nom de l'activite, s'il y en a un (sinon `null`). */
export function intitulePropre(s: CreneauIntitule): string | null {
  if (s.slot_type === 'activite') return s.libelle?.trim() || null
  return s.unites_enseignement?.nom_fr ?? s.cours?.nom_fr ?? null
}

export function intituleCreneau(s: CreneauIntitule): string {
  return intitulePropre(s) ?? LIBELLE_TYPE_CRENEAU[s.slot_type] ?? s.slot_type
}

/** Nom de salle affiche : « Salle 101 » ; un nom qui commence deja par « Salle » reste tel quel. */
export function libelleSalle(nom: string): string {
  return /^salle\b/i.test(nom.trim()) ? nom.trim() : `Salle ${nom.trim()}`
}
