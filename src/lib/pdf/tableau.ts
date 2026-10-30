import type { jsPDF } from 'jspdf'

/**
 * Ordonnee de fin du dernier tableau `autoTable`. Le greffon la pose sur le
 * document (`lastAutoTable`) sans la declarer dans les types de jsPDF.
 */
export function finDuTableau(doc: jsPDF): number {
  return (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY
}
