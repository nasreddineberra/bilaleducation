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

/** Montant a l'ecran, 2 decimales (dans un PDF : `eurosPdf` de `lib/pdf/nombres`). */
export function fmtEuro(n: number): string {
  return n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']

/** AAAA-MM -> « septembre 2025 ». */
export function libelleMois(mois: string): string {
  const [a, m] = mois.split('-').map(Number)
  return `${MOIS[m - 1] ?? mois} ${a}`
}

/** Cotisation d'une classe adulte : « (adultes) » ajoute si le libelle ne le dit pas deja. */
export function libelleCotisation(libelle: string, adulte: boolean): string {
  return adulte && !/adulte/i.test(libelle) ? `${libelle} (adultes)` : libelle
}
