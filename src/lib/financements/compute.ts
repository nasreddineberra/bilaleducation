// Calcul financier des cotisations — SOURCE UNIQUE.
//
// Partage par les sous-menus Financements « Reglements » (plan de travail) et
// « Stats reglements » (vue globale), qui calculaient chacun de leur cote et
// divergeaient (bug du 16/07 : reductions retranchees du percu au lieu du du).
// Toute evolution du modele comptable se fait ICI, pas dans une page.
//
// Isomorphe (aucune dependance serveur) : importable en Server ET Client Component.

import type { FeeStatus } from '@/types/database'

export interface CotisationLike {
  id?: string | null
  amount?: number | null
  registration_fee?: number | null
  sibling_discount?: number | null
  sibling_discount_same_type?: boolean | null
}

export interface FeeLike {
  fee_adjustments?: Array<{ amount?: number | null }> | null
  fee_installments?: Array<{ amount_paid?: number | null }> | null
}

export interface FamilyFinancials {
  subtotal: number
  totalDue: number
  adjustmentsTotal: number   // negatif pour les reductions / avoirs / remboursements
  totalPaid: number
  netPercu: number
  remaining: number
  status: FeeStatus
}

/** Statut d'un dossier a partir du percu et du du. */
export function feeStatus(paid: number, due: number): FeeStatus {
  if (paid > due && due > 0) return 'overpaid'
  if (due <= 0)             return 'paid'
  if (paid >= due)          return 'paid'
  if (paid > 0)             return 'partial'
  return 'pending'
}

/**
 * Remise fratrie appliquee a une liste d'inscriptions eleves, DANS L'ORDRE reçu.
 * Renvoie la remise de chaque eleve (0 si aucune), alignee sur l'entree.
 *
 * `sibling_discount_same_type` : remise des le 2e enfant du MEME type de
 * cotisation ; sinon des le 2e enfant, tous types confondus.
 *
 * NB : un eleve sans cotisation compte quand meme dans l'ordre de la fratrie
 * (comportement de la fiche Reglements, qui fait foi).
 */
export function siblingDiscounts(cotisations: Array<CotisationLike | null | undefined>): number[] {
  const indexByType: Record<string, number> = {}
  let globalIndex = 0

  return cotisations.map(ct => {
    const ctId = ct?.id ?? ''
    const sameTypeOnly = ct?.sibling_discount_same_type ?? false
    const sib = Number(ct?.sibling_discount ?? 0)
    let discount = 0

    if (sib > 0) {
      if (sameTypeOnly) {
        const typeIdx = indexByType[ctId] ?? 0
        if (typeIdx > 0) discount = sib
        indexByType[ctId] = typeIdx + 1
      } else if (globalIndex > 0) {
        discount = sib
      }
    } else if (sameTypeOnly) {
      // Pas de remise configuree : on tient quand meme le compteur du type.
      indexByType[ctId] = (indexByType[ctId] ?? 0) + 1
    }

    globalIndex++
    return discount
  })
}

/** Total du d'une inscription : cotisation + frais de dossier - remise fratrie. */
export function lineTotal(ct: CotisationLike | null | undefined, discount = 0): number {
  return Number(ct?.amount ?? 0) + Number(ct?.registration_fee ?? 0) - discount
}

/**
 * Financier d'une famille.
 * `subtotal` = somme des lignes deja totalisees (eleves + adultes).
 * `fee`      = ligne(s) `family_fees` de l'annee (une seule en pratique).
 *
 * REGLE COMPTABLE : les reductions / avoirs / remboursements (ajustements < 0)
 * reduisent ce que la famille DOIT, jamais ce qu'elle a paye. Payer la cotisation
 * entiere solde toujours (un remboursement de 20 ne remet pas 20 a devoir).
 */
export function computeFamilyFinancials(
  subtotal: number,
  fee: FeeLike | FeeLike[] | null | undefined,
): FamilyFinancials {
  const fees = fee == null ? [] : Array.isArray(fee) ? fee : [fee]

  let adjustmentsTotal = 0
  let totalPaid = 0
  for (const f of fees) {
    for (const a of (f?.fee_adjustments ?? [])) adjustmentsTotal += Number(a?.amount ?? 0)
    for (const i of (f?.fee_installments ?? [])) totalPaid += Number(i?.amount_paid ?? 0)
  }

  const totalDue  = subtotal + adjustmentsTotal
  const netPercu  = totalPaid
  const remaining = totalDue - netPercu

  return { subtotal, totalDue, adjustmentsTotal, totalPaid, netPercu, remaining, status: feeStatus(netPercu, totalDue) }
}
