/**
 * MATIERE D'UNE SEANCE OU D'UN DEVOIR DU CAHIER DE TEXTE (02/11).
 *
 * Elle n'est plus forcee a « Général » : elle se DEDUIT des creneaux de la
 * classe dans l'EDT (matiere d'un creneau de cours = son unite d'enseignement).
 * Une information = un ecran qui l'ecrit : la matiere se regle sur le creneau,
 * le cahier de texte la reprend.
 *
 *   - aucune matiere dans l'EDT de la classe -> « Général », verrouille ;
 *   - une seule                              -> celle-ci, verrouillee ;
 *   - plusieurs                              -> choix, propose sur celle du JOUR
 *     (date de la seance ; jour de saisie pour un devoir), « Général » possible.
 *
 * Valeurs stockees inchangees : `homework.subject` est NOT NULL et porte le
 * litteral 'General' ; `class_journal.subject` accepte NULL pour « Général ».
 * Module pur, sans alias (teste par `node --test`).
 */

/** Valeur stockee pour « Général » (sans accent : sentinelle historique). */
export const MATIERE_GENERALE = 'General'
export const LIBELLE_MATIERE_GENERALE = 'Général'

/** Creneau de la classe, reduit a ce dont la matiere a besoin. */
export interface CreneauMatiere {
  slot_type: string
  day_of_week: number | null
  is_recurring: boolean
  slot_date: string | null
  effective_from: string | null
  effective_until: string | null
  is_active: boolean
  unites_enseignement: { nom_fr: string } | null
}

export interface ChoixMatiere {
  /** Matieres de la classe a la date, triees ; vide = « Général » seul. */
  options: string[]
  /** Matiere proposee : celle du jour s'il n'y en a qu'une, sinon '' (= « Général »). */
  proposee: string
}

/** Jour de la semaine de `AAAA-MM-JJ`, au format de `day_of_week` (0 = dimanche). */
function jourSemaine(date: string): number {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d).getDay()
}

/** Le creneau est-il en vigueur a `date` (dates d'effet ; ponctuel = sa date) ? */
function enVigueur(c: CreneauMatiere, date: string): boolean {
  if (!c.is_active) return false
  if (!c.is_recurring) return c.slot_date === date
  return (!c.effective_from || c.effective_from <= date) && (!c.effective_until || c.effective_until >= date)
}

export function choixMatiere(creneaux: CreneauMatiere[], date: string): ChoixMatiere {
  const cours = creneaux.filter(c => c.slot_type === 'cours' && c.unites_enseignement && enVigueur(c, date))
  const nom = (c: CreneauMatiere) => c.unites_enseignement!.nom_fr
  const options = [...new Set(cours.map(nom))].sort((a, b) => a.localeCompare(b, 'fr'))
  const jour = jourSemaine(date)
  const duJour = [...new Set(cours.filter(c => c.is_recurring ? c.day_of_week === jour : true).map(nom))]
  const proposee = options.length === 1 ? options[0] : duJour.length === 1 ? duJour[0] : ''
  return { options, proposee }
}

/** Libelle affiche d'une matiere stockee : `null` pour « Général » (rien a afficher). */
export function libelleMatiere(subject: string | null | undefined): string | null {
  return subject && subject !== MATIERE_GENERALE ? subject : null
}
