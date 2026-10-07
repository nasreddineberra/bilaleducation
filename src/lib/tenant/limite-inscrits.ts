/**
 * LIMITE D'INSCRITS — traduction du refus de la base.
 *
 * Le declencheur `fn_guard_limite_inscrits` (migration `guard-limite-inscrits`)
 * refuse tout geste qui ferait depasser `etablissements.max_students` a la base
 * facturable (eleves actifs + adultes inscrits). Son message est en SQL, donc
 * sans accents ; il porte un repere stable (`hint = 'limite_inscrits'`) et les
 * chiffres dans `details`. On reconnait le refus au REPERE, jamais au texte.
 *
 * Rend `null` si l'erreur n'est pas ce refus : l'appelant garde alors son propre
 * message. Module PUR, eprouve par `node --test`.
 */

type ErreurBase = { message?: string; details?: string | null; hint?: string | null; code?: string } | null | undefined

export const REPERE_LIMITE = 'limite_inscrits'

export function messageLimiteInscrits(err: ErreurBase): string | null {
  if (!err || err.hint !== REPERE_LIMITE) return null

  const chiffres = Object.fromEntries(
    (err.details ?? '').split(';').map(p => p.split('=')).filter(p => p.length === 2)
      .map(([k, v]) => [k.trim(), Number(v)]),
  ) as Record<string, number>

  const { max, eleves, adultes } = chiffres
  if (![max, eleves, adultes].every(Number.isFinite)) {
    return "Limite d'inscrits de l'abonnement atteinte. Contactez l'éditeur pour l'augmenter."
  }

  const pl = (n: number, s: string, p: string) => (n > 1 ? p : s)
  return `Limite de l'abonnement atteinte : ${max} ${pl(max, 'inscrit', 'inscrits')} au maximum `
    + `(${eleves} ${pl(eleves, 'élève actif', 'élèves actifs')} + ${adultes} ${pl(adultes, 'adulte inscrit', 'adultes inscrits')}). `
    + "Contactez l'éditeur pour l'augmenter."
}
