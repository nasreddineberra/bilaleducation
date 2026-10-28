/**
 * Nom d'un enseignant, pour l'AFFICHAGE.
 *
 * ── LA RÈGLE DU PROJET ─────────────────────────────────────────────────────
 *
 * Le NOM vient TOUJOURS avant le prénom. Le nommage des colonnes
 * (`first_name`, `last_name`) invite au piège inverse, et il a été payé : le
 * 18 juillet, TREIZE constructeurs écrivaient `${civ} ${first_name}
 * ${last_name}` et ont dû être repris un par un. Un `.select()` SQL n'est pas
 * un ordre d'affichage.
 *
 * ── DEUX FORMES, ET LE CHOIX SE FAIT SUR LE CONTEXTE ────────────────────────
 *
 * `nomEnseignant` — NOM Prénom, SANS civilité. Pour désigner la personne dans
 * une zone dense où chaque caractère compte : capsule d'emploi du temps,
 * cellule de tableau. La civilité y coûte quatre caractères pour n'apprendre
 * rien que le prénom ne dise déjà, et elle évinçait justement le prénom —
 * « Mme BELAÏD » ne distingue pas deux sœurs, « BELAÏD Djamila » si.
 *
 * `nomEnseignantCivilite` — Civilité NOM Prénom. Pour s'adresser à la personne
 * ou la nommer dans une phrase : sélecteurs, messages de confirmation,
 * courriers. C'est la forme arrêtée le 18 juillet.
 *
 * `nomCourtEnseignant` — Civilité NOM, sans prénom. Pour la CAPSULE de l'emploi
 * du temps (décision du 27/10, qui revient sur `nomEnseignant` à cet endroit) :
 * une ligne, quelle que soit la durée du créneau. Le nom complet reste dans
 * l'infobulle, ce qui lève l'ambiguïté de deux homonymes. Civilité absente ou
 * non reconnue : le NOM seul (jamais « M. » par défaut).
 *
 * ── CIVILITÉ ───────────────────────────────────────────────────────────────
 *
 * La colonne est libre en base ; seul « Mme » est reconnu, tout le reste
 * retombe sur « M. ». C'est le comportement qui existait dans les cinq copies
 * de l'EDT, repris à l'identique — le changer ici modifierait silencieusement
 * l'affichage de fiches qu'on n'a pas regardées.
 */

type Personne = {
  first_name: string
  last_name:  string
  civilite?:  string | null
} | null | undefined

/** NOM Prénom, sans civilité. Chaîne vide si la personne est absente. */
export function nomEnseignant(p: Personne): string {
  if (!p) return ''
  return `${p.last_name} ${p.first_name}`.trim()
}

/** Civilité NOM (sans prénom), ou NOM seul sans civilité reconnue. Chaîne vide si absente. */
export function nomCourtEnseignant(p: Personne): string {
  if (!p) return ''
  const civ = p.civilite === 'Mme' || p.civilite === 'M.' ? p.civilite : null
  return civ ? `${civ} ${p.last_name}`.trim() : p.last_name.trim()
}

/** Civilité NOM Prénom, ou NOM Prénom sans civilité reconnue (infobulles de l'EDT). */
export function nomCompletEnseignant(p: Personne): string {
  if (!p) return ''
  return `${nomCourtEnseignant(p)} ${p.first_name}`.trim()
}

/** Genre lu de la civilite, pour `accordGenre` (lib/texte/genre) : `null` hors M. / Mme. */
export function genreCivilite(civilite: string | null | undefined): 'male' | 'female' | null {
  return civilite === 'M.' ? 'male' : civilite === 'Mme' ? 'female' : null
}

/** Civilité NOM Prénom. Chaîne vide si la personne est absente. */
export function nomEnseignantCivilite(p: Personne): string {
  if (!p) return ''
  const civ = p.civilite === 'Mme' ? 'Mme' : 'M.'
  return `${civ} ${p.last_name} ${p.first_name}`.trim()
}
