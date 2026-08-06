/**
 * Validation du slug d'un établissement.
 *
 * Le slug DEVIENT le sous-domaine : `bilal-neuville` → `bilal-neuville.bilaleducation.fr`.
 * Il n'est pas modifiable après création — le changer casserait les favoris, les
 * liens des emails déjà envoyés et les raccourcis posés sur les téléphones. Il
 * faut donc le refuser avant, pas le corriger après.
 *
 * Module isomorphe : utilisé par le formulaire (retour immédiat) ET par la
 * server action (autorité). Le formulaire seul ne protège de rien — un appel
 * direct à l'API le contourne.
 */

/**
 * Sous-domaines que l'application, la messagerie ou l'infrastructure utilisent
 * — ou pourraient utiliser. Une école qui en obtiendrait un capterait une
 * adresse système, **définitivement** puisqu'un slug ne se modifie pas.
 *
 * `autodiscover` et `autoconfig` méritent une mention : ce sont les noms que les
 * logiciels de messagerie interrogent pour se configurer seuls. Une école qui
 * les occuperait perturberait la messagerie de tout le domaine.
 */
export const RESERVED_SLUGS = [
  // Infrastructure et messagerie
  'www', 'mail', 'smtp', 'imap', 'pop', 'webmail', 'ftp', 'mx',
  'ns', 'ns1', 'ns2', 'autodiscover', 'autoconfig', 'dmarc',
  // Application et espace opérateur
  'superadmin', 'admin', 'console', 'api', 'app', 'auth', 'login',
  'dashboard', 'static', 'assets', 'cdn', 'files', 'storage',
  // Éditorial et support
  'blog', 'docs', 'help', 'support', 'status', 'contact',
  // Environnements
  'dev', 'staging', 'preprod', 'test', 'demo', 'sandbox', 'local',
] as const

export const SLUG_MIN = 2
export const SLUG_MAX = 30

/**
 * Renvoie un message d'erreur, ou `null` si le slug est acceptable.
 *
 * Les règles de forme viennent du DNS, pas d'une préférence : une étiquette ne
 * peut contenir que lettres, chiffres et tirets, et ne peut ni commencer ni
 * finir par un tiret. Le préfixe `xn--` est réservé aux noms internationalisés.
 */
export function validateSlug(raw: string): string | null {
  // On valide la forme NORMALISEE, celle qui sera reellement enregistree :
  // `Ecole` est donc accepte, puisqu'il deviendra `ecole`. La contrainte en base
  // refuse `Ecole` telle quelle — ce n'est pas une contradiction, l'application
  // normalise toujours avant d'ecrire.
  const slug = raw.trim().toLowerCase()

  if (slug.length < SLUG_MIN) return `Le sous-domaine doit faire au moins ${SLUG_MIN} caractères.`
  if (slug.length > SLUG_MAX) return `Le sous-domaine ne peut pas dépasser ${SLUG_MAX} caractères.`
  if (!/^[a-z0-9-]+$/.test(slug)) return 'Seuls les lettres minuscules, les chiffres et le tiret sont autorisés.'
  if (slug.startsWith('-') || slug.endsWith('-')) return 'Le sous-domaine ne peut ni commencer ni finir par un tiret.'
  if (slug.startsWith('xn--')) return 'Le préfixe « xn-- » est réservé aux noms de domaine internationalisés.'
  if ((RESERVED_SLUGS as readonly string[]).includes(slug)) {
    return `« ${slug} » est réservé à l'infrastructure et ne peut pas être attribué à un établissement.`
  }

  return null
}
