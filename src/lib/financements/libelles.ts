// Libelles du module Financements, source unique (02/11) : la table des moyens de
// paiement etait recopiee dans Reglements, Statistiques et le tableau de bord
// comptable ; le bilan annuel (PDF, Excel) en a besoin aussi.

export const METHOD_LABELS: Record<string, string> = {
  cash: 'Espèces', check: 'Chèque', card: 'CB', transfer: 'Virement', online: 'En ligne',
}

/** Moyen de paiement lisible ; valeur inconnue rendue telle quelle, absente = « Non précisé ». */
export function libelleMoyen(moyen: string | null | undefined): string {
  if (!moyen) return 'Non précisé'
  return METHOD_LABELS[moyen] ?? moyen
}

const AJUSTEMENT_LABELS: Record<string, string> = {
  reduction: 'Réduction', avoir: 'Avoir', remboursement: 'Remboursement',
}

export function libelleAjustement(type: string): string {
  return AJUSTEMENT_LABELS[type] ?? type
}
