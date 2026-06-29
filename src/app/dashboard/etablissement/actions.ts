'use server'

import { updateTag } from 'next/cache'

/**
 * Invalide le cache de l'établissement (nom + logo affichés dans la sidebar).
 * Appelée depuis une Server Action après la mise à jour des informations.
 * `updateTag` (Next 16) : expiration immédiate + read-your-own-writes.
 */
export async function revalidateEtablissement() {
  updateTag('etablissement')
}
