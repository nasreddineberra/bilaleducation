/**
 * CSV de l'export remis a une ecole qui part (console de l'editeur).
 *
 * Fait pour s'ouvrir dans EXCEL en francais, sans manipulation :
 *   · separateur `;` (la virgule est le separateur DECIMAL en francais) ;
 *   · BOM UTF-8 en tete, sans quoi Excel lit les accents en Windows-1252 ;
 *   · fins de ligne CRLF.
 *
 * Module pur, sans dependance : il est eprouve par `node --test`.
 */

const BOM = '﻿'

/**
 * Une cellule qui commence par `=` ou `@` serait EXECUTEE comme une formule a
 * l'ouverture (injection de formule). On la prefixe d'une apostrophe. `+` et `-`
 * restent tels quels : ils ouvrent des numeros de telephone (+33…) et des
 * montants negatifs, que l'apostrophe denaturerait.
 */
function neutraliser(v: string): string {
  return /^[=@]/.test(v) ? `'${v}` : v
}

export function celluleCsv(valeur: unknown): string {
  if (valeur === null || valeur === undefined) return ''
  const texte = typeof valeur === 'object' ? JSON.stringify(valeur) : neutraliser(String(valeur))
  return /[;"\r\n]/.test(texte) ? `"${texte.replace(/"/g, '""')}"` : texte
}

/**
 * Lignes -> CSV. Les colonnes suivent l'ordre de la PREMIERE ligne (celui de la
 * table, conserve par le `json` de la fonction d'export) ; une colonne absente
 * de la premiere mais presente plus loin est ajoutee a la suite plutot que
 * perdue. Une table vide rend le BOM seul : le fichier existe, il dit « aucune
 * ligne », ce qui vaut mieux qu'un fichier manquant.
 */
export function versCsv(lignes: Record<string, unknown>[]): string {
  const colonnes: string[] = []
  for (const l of lignes) for (const c of Object.keys(l)) if (!colonnes.includes(c)) colonnes.push(c)
  if (colonnes.length === 0) return BOM
  const corps = [
    colonnes.map(celluleCsv).join(';'),
    ...lignes.map(l => colonnes.map(c => celluleCsv(l[c])).join(';')),
  ]
  return BOM + corps.join('\r\n') + '\r\n'
}
