/**
 * Neutralise le HTML d'un texte destiné à être inséré dans du HTML.
 *
 * À NE PAS CONFONDRE AVEC `sanitize()`, qui vit à côté. Les deux protègent de
 * l'injection, mais répondent à des besoins opposés :
 *
 *   · `sanitize()`  — l'entrée EST du HTML (éditeur riche), on la nettoie en
 *                     conservant les balises légitimes ;
 *   · `escapeHtml()` — l'entrée est du TEXTE BRUT (champ de saisie), aucune
 *                     balise n'y est légitime : on les rend toutes inertes.
 *
 * Employer `sanitize()` sur du texte brut laisserait passer ce qui ressemble à
 * une balise autorisée ; employer `escapeHtml()` sur du HTML afficherait les
 * balises à l'écran. Le choix se fait sur la nature de la SOURCE, pas sur la
 * destination.
 *
 * Troisième occurrence de cette fonction dans le projet, d'où l'extraction :
 * elle était recopiée dans `financements/actions.ts` et
 * `communications/signature.ts`.
 */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Texte brut vers HTML : échappé, puis les sauts de ligne rendus visibles. */
export function escapeHtmlMultiline(s: string): string {
  return escapeHtml(s).replace(/\r?\n/g, '<br>')
}
