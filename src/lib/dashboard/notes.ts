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
