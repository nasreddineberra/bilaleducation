import { canonicalHost } from './canonical-host'

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
/**
 * Domaine racine déduit de `NEXT_PUBLIC_SITE_URL`, débarrassé d'un `www.`.
 *
 * Le `www.` n'est pas une coquetterie à corriger : les deux fonctions ci-dessous
 * PRÉFIXENT ce domaine d'un sous-domaine. Une variable réglée sur
 * `https://www.bilaleducation.fr` produirait `ecole.www.bilaleducation.fr` —
 * trois niveaux, qu'aucun certificat ne couvre, sur des liens envoyés PAR EMAIL
 * et donc découverts trop tard. Voir `canonical-host`.
 */
function domaineRacine(): string | null {
  const site = process.env.NEXT_PUBLIC_SITE_URL
  if (!site) return null
  try {
    const host = canonicalHost(new URL(site).hostname)
    if (host === 'localhost' || host === '127.0.0.1') return null
    return host
  } catch {
    return null
  }
}

export function schoolUrl(slug: string, path = '/dashboard'): string {
  const host = domaineRacine()
  return host ? `https://${slug}.${host}${path}` : path
}

export function consoleUrl(path = '/superadmin'): string {
  const host = domaineRacine()
  return host ? `https://superadmin.${host}${path}` : path
}
