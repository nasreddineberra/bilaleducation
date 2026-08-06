/**
 * Adresse de la console de l'éditeur.
 *
 * En production elle vit sur son PROPRE sous-domaine — `superadmin.` — et non
 * sur le domaine racine, réservé à la vitrine. Un lien relatif `/superadmin`
 * depuis l'école mènerait donc au mauvais endroit : il faut l'adresse absolue.
 *
 * En local il n'y a qu'un hôte : le chemin relatif suffit, et une adresse
 * absolue serait fausse.
 *
 * `NEXT_PUBLIC_SITE_URL` est inlinée à la compilation : ce module vaut pour le
 * navigateur comme pour le serveur.
 */
/**
 * Adresse d'une école à partir de son slug.
 *
 * En local il n'y a qu'un hôte et le sous-domaine ne peut pas être simulé : on
 * renvoie le chemin, qui mène à l'établissement de `DEFAULT_TENANT_SLUG`. C'est
 * une limite du développement, pas un comportement à reproduire.
 */
export function schoolUrl(slug: string, path = '/dashboard'): string {
  const site = process.env.NEXT_PUBLIC_SITE_URL
  if (!site) return path
  try {
    const host = new URL(site).hostname
    if (host === 'localhost' || host === '127.0.0.1') return path
    return `https://${slug}.${host}${path}`
  } catch {
    return path
  }
}

export function consoleUrl(path = '/superadmin'): string {
  const site = process.env.NEXT_PUBLIC_SITE_URL
  if (!site) return path
  try {
    const host = new URL(site).hostname
    if (host === 'localhost' || host === '127.0.0.1') return path
    return `https://superadmin.${host}${path}`
  } catch {
    return path
  }
}
