/**
 * Prépare le HTML d'un email juste avant l'envoi : retire ce qui n'a rien à
 * faire chez le destinataire et en dérive la version texte.
 *
 * Lu dans la source d'un envoi réel (20 septembre 2026, classé indésirable
 * par Outlook.com avec une authentification parfaite) :
 *   . les COMMENTAIRES de développement de `shell.mjs` partaient dans chaque
 *     message — poids inutile, notes internes exposées, et un HTML chargé de
 *     commentaires est un signal pour les filtres ;
 *   . le message était en `text/html` SEUL, sans partie `text/plain`. Un
 *     mail légitime est presque toujours en `multipart/alternative` ;
 *     l'absence de texte brut est un signal classique de spam.
 *
 * Un seul point d'application : `sendNotificationEmail` et `sendTestEmail`.
 * `shell.mjs` n'est pas touché — il sert aussi à engendrer les gabarits
 * collés dans Supabase, vérifiés octet par octet.
 *
 * Pas de commentaire conditionnel Outlook (`<!--[if mso]>`) dans nos coques :
 * vérifié avant d'écrire, tous les commentaires peuvent partir.
 */

const ENTITES: Record<string, string> = {
  '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"',
  '&#39;': "'", '&apos;': "'", '&middot;': '·', '&laquo;': '«', '&raquo;': '»',
  '&eacute;': 'é', '&egrave;': 'è', '&agrave;': 'à', '&ccedil;': 'ç',
}

export function retirerCommentaires(html: string): string {
  return html.replace(/<!--[\s\S]*?-->/g, '')
}

/** Version texte brut d'un HTML de mail : ce que lit un client sans HTML. */
export function versTexte(html: string): string {
  return retirerCommentaires(html)
    .replace(/<head[\s\S]*?<\/head>/gi, '')
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, '')
    // Ligne d'aperçu masquée : redite du titre, inutile en texte.
    .replace(/<div style="display:none;[^"]*">[\s\S]*?<\/div>/i, '')
    .replace(/<a\s[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_m, href: string, texte: string) => {
      const t = texte.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
      return t && t !== href ? `${t} (${href})` : href
    })
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|li|h[1-6]|blockquote|table)>/gi, '\n')
    .replace(/<\/td>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&[a-z#0-9]+;/gi, e => ENTITES[e.toLowerCase()] ?? e)
    .split('\n')
    .map(l => l.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** HTML nettoyé + texte brut, prêts pour `sendMail({ html, text })`. */
export function preparerCorps(html: string): { html: string; text: string } {
  return { html: retirerCommentaires(html), text: versTexte(html) }
}
