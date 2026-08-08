/**
 * Hôte canonique : le sous-domaine de l'école, sans `www.` de tête.
 *
 * POURQUOI CE MODULE EXISTE — une contrainte des CERTIFICATS, pas un caprice
 * d'esthétique d'URL. Le certificat générique servi par l'hébergeur est
 * `*.bilaleducation.fr`, et un joker TLS couvre EXACTEMENT UN niveau :
 *
 *   bilal-neuville.bilaleducation.fr        → couvert
 *   www.bilal-neuville.bilaleducation.fr    → DEUX niveaux, aucun certificat
 *
 * Le second déclenche `ERR_CERT_COMMON_NAME_INVALID` : « votre connexion n'est
 * pas privée », grand panneau rouge. Et le défaut est INRATTRAPABLE côté
 * application — l'échec survient pendant la poignée de main TLS, avant qu'une
 * requête HTTP n'existe, donc avant tout middleware.
 *
 * Le risque n'est pas la faute de frappe de celui qui la commet : il est que
 * l'application FABRIQUE un lien à partir de l'hôte courant. Un `www.` entré
 * une fois se propage alors à un lien de réinitialisation de mot de passe, et
 * c'est le DESTINATAIRE — qui n'a rien tapé — qui reçoit l'avertissement.
 *
 * On normalise donc partout où un lien naît de l'hôte de la requête. Le
 * domaine racine supporte le même traitement : `www.bilaleducation.fr` et
 * `bilaleducation.fr` disposent chacun d'un certificat valide, et n'en garder
 * qu'un est la pratique courante.
 *
 * NB : aucune école ne peut se nommer `www` — le middleware traite
 * `www.bilaleducation.fr` comme le domaine racine, jamais comme un tenant.
 */

/** `www.ecole.domaine.fr` → `ecole.domaine.fr`. Idempotent. */
export function canonicalHost(host: string): string {
  return host.replace(/^www\./i, '')
}

/** `https://www.ecole.domaine.fr` → `https://ecole.domaine.fr`. */
export function canonicalOrigin(origin: string): string {
  try {
    const url = new URL(origin)
    url.hostname = canonicalHost(url.hostname)
    // `origin` ne porte ni chemin ni requête : on le reconstruit tel quel.
    return url.origin
  } catch {
    return origin
  }
}
