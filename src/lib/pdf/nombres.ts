// Nombres et montants dans un PDF jsPDF, SOURCE UNIQUE (02/11).
//
// Le format francais du navigateur separe les milliers par une espace fine
// insecable (U+202F) et colle « € » par une espace insecable (U+00A0). Les
// polices standard de jsPDF (Helvetica) n'ont pas ces glyphes : « 7 990,00 € »
// sortait « 7 /990,00 € », largeur de cellule fausse. Vu sur le bilan financier ;
// l'attestation et le Temps de presence avaient le meme defaut des 1 000 €.

/** Remplace les espaces que les polices standard de jsPDF ne savent pas dessiner. */
export function textePdf(s: string): string {
  return s.replace(/[  ]/g, ' ')
}

/** Montant en euros, 2 decimales. */
export function eurosPdf(n: number): string {
  return textePdf(n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }))
}

/** Nombre a la francaise (virgule decimale), au plus `decimales` decimales. */
export function nombrePdf(n: number, decimales = 2): string {
  return textePdf(n.toLocaleString('fr-FR', { maximumFractionDigits: decimales }))
}
