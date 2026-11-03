import { createHash, randomBytes } from 'node:crypto'

/**
 * JETON D'INVITATION DE L'ESPACE FAMILLE (serveur uniquement).
 *
 * Le jeton part dans l'email ; la base n'en garde que l'EMPREINTE
 * (`invitations_famille.empreinte`) : une fuite de la table ne donne aucun lien
 * utilisable. 32 octets aleatoires, encodes pour une URL.
 */

export function empreinteJeton(jeton: string): string {
  return createHash('sha256').update(jeton, 'utf8').digest('hex')
}

export function nouveauJeton(): { jeton: string; empreinte: string } {
  const jeton = randomBytes(32).toString('base64url')
  return { jeton, empreinte: empreinteJeton(jeton) }
}

/** Forme d'un jeton recu dans une URL : 43 caracteres base64url, rien d'autre. */
export function jetonBienForme(jeton: unknown): jeton is string {
  return typeof jeton === 'string' && /^[A-Za-z0-9_-]{43}$/.test(jeton)
}
