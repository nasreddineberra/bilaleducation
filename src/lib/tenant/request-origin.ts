import { headers } from 'next/headers'
import { canonicalHost } from './canonical-host'

/**
 * Origine de la requête en cours — `https://ecole.bilaleducation.fr`.
 *
 * POURQUOI PAS `NEXT_PUBLIC_SITE_URL`. Cette variable vaut le domaine RACINE,
 * devenu la vitrine : un lien de réinitialisation construit avec elle envoie
 * l'utilisateur hors de toute école, là où le middleware ne résout aucun
 * établissement. Le lien partait, et menait nulle part — le pire mode d'échec,
 * puisqu'il ne produit aucune erreur.
 *
 * L'en-tête `host` dit sur quel sous-domaine on se trouve : un lien fabriqué
 * ainsi ramène toujours l'utilisateur chez LUI. C'est ce que fait déjà l'écran
 * « mot de passe oublié » côté navigateur (`window.location.origin`) ; ceci en
 * est l'équivalent côté serveur.
 *
 * L'hôte est NORMALISÉ avant usage : recopié tel quel, un `www.` de tête se
 * propagerait dans le lien envoyé, et le destinataire — qui n'a rien tapé —
 * tomberait sur un avertissement de certificat. Voir `canonical-host`.
 */
export async function requestOrigin(): Promise<string> {
  const h = await headers()
  const host = canonicalHost(h.get('host') ?? '')
  // `x-forwarded-proto` est posé par l'hébergeur ; en local il est absent et
  // l'adresse est en clair.
  const proto = h.get('x-forwarded-proto')
    ?? (host.includes('localhost') || host.includes('127.0.0.1') ? 'http' : 'https')
  return `${proto}://${host}`
}
