/**
 * MOYENNE SUR 20 D'UN ENSEMBLE DE NOTES, VUE PAR LE TABLEAU DE BORD.
 *
 * Chaque note est ramenee sur 20 d'apres le bareme de son evaluation, puis la
 * moyenne est simple (sans coefficient) : un indicateur d'allure, pas le
 * calcul du bulletin. Partagee par les tableaux de bord Enseignant et
 * Responsable pedagogique.
 *
 * Module PUR, sans import : eprouvable par `node --test`.
 */

export interface NoteSource {
  evaluation_id: string
  score: number | string | null
  is_absent: boolean | null
}

/** `null` sans aucune note exploitable : jamais un « 0 » invente. */
export function moyenneSur20(notes: NoteSource[], baremeParEval: Map<string, number>): number | null {
  const sur20: number[] = []
  for (const n of notes) {
    if (n.is_absent || n.score === null) continue
    const max = baremeParEval.get(n.evaluation_id) ?? 0
    if (max > 0) sur20.push((Number(n.score) / max) * 20)
  }
  if (sur20.length === 0) return null
  return Math.round((sur20.reduce((s, v) => s + v, 0) / sur20.length) * 10) / 10
}

export interface EvalSaisie {
  id: string
  class_id: string
  evaluation_date: string | null
}

export interface NoteSaisie {
  evaluation_id: string
  /** Cle de l'apprenant : `student_id`, ou `parent_id-tutor_number` pour un adulte. */
  apprenant: string
  score: number | string | null
  /** Appreciation (evaluation diagnostic) ou commentaire. */
  comment?: string | null
  is_absent: boolean | null
}

export interface AvancementSaisie {
  /** Evaluations de l'ensemble (passees et a venir). */
  evaluations: number
  /** Notes attendues : un apprenant inscrit x une evaluation passee. */
  attendues: number
  /** Parmi elles, saisies : une note, une appreciation, ou « absent ». */
  saisies: number
  /** `null` sans note attendue : jamais un 100 % invente. */
  taux: number | null
  /** Evaluations passees ou il manque au moins une note, sans etre vides. */
  incompletes: number
  /** Evaluations passees sans aucune note saisie. */
  passeesSansNote: number
  aVenir: number
}

/**
 * Avancement de la saisie des notes.
 *
 * Une note n'est ATTENDUE que pour une evaluation passee (date <= aujourd'hui ;
 * sans date, elle est tenue pour passee) et pour un apprenant INSCRIT dans la
 * classe a ce jour : la note d'un eleve parti ne compte ni en attendu ni en
 * saisi. Est SAISI ce que l'ecran Saisie des notes tient pour saisi : une note
 * chiffree, une appreciation (evaluation diagnostic : `comment`, sans note) ou
 * « absent ».
 */
export function avancementSaisie(
  evals: EvalSaisie[],
  notes: NoteSaisie[],
  inscritsParClasse: Map<string, Set<string>>,
  aujourdhui: string,
): AvancementSaisie {
  const saisiesParEval = new Map<string, Set<string>>()
  for (const n of notes) {
    const appreciation = typeof n.comment === 'string' && n.comment.trim() !== ''
    if (n.score === null && !n.is_absent && !appreciation) continue
    if (!saisiesParEval.has(n.evaluation_id)) saisiesParEval.set(n.evaluation_id, new Set())
    saisiesParEval.get(n.evaluation_id)!.add(n.apprenant)
  }

  let attendues = 0, saisies = 0, incompletes = 0, passeesSansNote = 0, aVenir = 0
  for (const e of evals) {
    if (e.evaluation_date && e.evaluation_date > aujourdhui) { aVenir++; continue }
    const inscrits = inscritsParClasse.get(e.class_id) ?? new Set<string>()
    if (inscrits.size === 0) continue
    const faites = saisiesParEval.get(e.id) ?? new Set<string>()
    let n = 0
    for (const a of inscrits) if (faites.has(a)) n++
    attendues += inscrits.size
    saisies += n
    if (n === 0) passeesSansNote++
    else if (n < inscrits.size) incompletes++
  }

  return {
    evaluations: evals.length,
    attendues,
    saisies,
    taux: attendues > 0 ? Math.round((saisies / attendues) * 100) : null,
    incompletes,
    passeesSansNote,
    aVenir,
  }
}
