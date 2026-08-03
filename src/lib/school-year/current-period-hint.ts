/**
 * Rappel de bascule de période, pour l'encadrement (admin / direction).
 *
 * Les périodes n'ont PAS de dates en base — c'est précisément pourquoi la
 * période « en cours » est choisie à la main. Le rappel se déduit donc du MOIS
 * courant, selon le calendrier scolaire habituel.
 *
 * Ce n'est qu'un rappel : l'action reste manuelle, rien n'est bloqué.
 */

const PERIOD_LABELS: Record<string, string> = {
  T1: 'Trimestre 1', T2: 'Trimestre 2', T3: 'Trimestre 3',
  S1: 'Semestre 1', S2: 'Semestre 2',
}

export const expandPeriodLabel = (label: string) =>
  PERIOD_LABELS[label.toUpperCase()] ?? label

export interface PeriodLike {
  id: string
  label: string
  order_index: number
  is_current?: boolean | null
}

/**
 * Mois → index de la période attendue (0 = première).
 *
 * Trimestres : T1 sept.-déc., T2 janv.-mars, T3 avril-juin. Juillet et août
 * sont hors trimestres : aucune attente, donc aucun rappel — c'est l'intersaison.
 * Semestres : S1 sept.-janv., S2 févr.-août.
 */
const EXPECTED_BY_MONTH: Record<number, Record<number, number | undefined>> = {
  // 3 périodes : trimestriel
  3: { 9: 0, 10: 0, 11: 0, 12: 0, 1: 1, 2: 1, 3: 1, 4: 2, 5: 2, 6: 2 },
  // 2 périodes : semestriel
  2: { 9: 0, 10: 0, 11: 0, 12: 0, 1: 0, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1 },
}

/** Dernier mois de chaque période, par découpage. */
const LAST_MONTH: Record<number, number[]> = {
  3: [12, 3, 6],
  2: [1, 8],
}

export interface PeriodHint {
  /** Message prêt à afficher. */
  message: string
  /** Vrai quand aucune période n'est marquée en cours. */
  missing: boolean
}

/**
 * Renvoie le rappel à afficher, ou `null` s'il n'y a rien à signaler.
 *
 * Règles :
 * - aucune période en cours → on le signale ;
 * - on entre dans le DERNIER mois de la période en cours → on invite à préparer
 *   la suivante ;
 * - la période enregistrée ne correspond pas au mois → on invite à corriger ;
 * - TOLÉRANCE : pendant le dernier mois d'une période, la SUIVANTE est acceptée
 *   sans rien dire. Sans quoi le rappel se déclencherait contre celui qui vient
 *   justement de faire ce qu'on lui demandait.
 */
export function getPeriodHint(periods: PeriodLike[], now: Date = new Date()): PeriodHint | null {
  const sorted = [...periods].sort((a, b) => a.order_index - b.order_index)
  if (sorted.length === 0) return null

  const mapping = EXPECTED_BY_MONTH[sorted.length]
  const lastMonths = LAST_MONTH[sorted.length]
  if (!mapping || !lastMonths) return null // découpage inconnu : on se tait

  const current = sorted.find(p => p.is_current)
  if (!current) {
    return { message: 'Aucune période en cours définie.', missing: true }
  }

  const month = now.getMonth() + 1
  const expectedIdx = mapping[month]
  if (expectedIdx === undefined) return null // hors périodes (juillet-août)

  const currentIdx = sorted.findIndex(p => p.id === current.id)
  const isLastMonth = lastMonths[expectedIdx] === month

  // Sur la bonne période : on ne parle que dans son dernier mois, et seulement
  // s'il existe une suite (en fin d'année il n'y a rien vers quoi basculer).
  if (currentIdx === expectedIdx) {
    const next = sorted[expectedIdx + 1]
    if (!isLastMonth || !next) return null
    return {
      message: `Période en cours : ${expandPeriodLabel(current.label)}, pensez à passer en ${expandPeriodLabel(next.label)}.`,
      missing: false,
    }
  }

  // Bascule anticipée pendant le dernier mois : c'est exactement ce qu'on
  // demandait, on n'insiste pas.
  if (isLastMonth && currentIdx === expectedIdx + 1) return null

  const expected = sorted[expectedIdx]
  return {
    message: `Période en cours : ${expandPeriodLabel(current.label)}, pensez à passer en ${expandPeriodLabel(expected.label)}.`,
    missing: false,
  }
}
