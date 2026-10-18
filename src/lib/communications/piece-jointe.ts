import { createClient } from '@/lib/supabase/client'

/**
 * Ouvre une piece jointe de message (bucket prive `communication-attachments`).
 *
 * L'URL est signee AU CLIC, pour 60 s : signee au rendu de la page, elle
 * devait vivre assez longtemps pour une lecture lente (1 h), et circulait
 * pendant ce temps sans authentification (copie, historique, transfert).
 * Les droits sont ceux de `comm_pj_select`, verifies a la signature.
 *
 * L'onglet est ouvert AVANT l'await (sinon bloque comme popup), puis redirige.
 * Rend `false` si la signature echoue (fichier absent ou droit refuse).
 */
export async function ouvrirPieceJointe(chemin: string): Promise<boolean> {
  const onglet = window.open('', '_blank')
  const { data, error } = await createClient()
    .storage.from('communication-attachments')
    .createSignedUrl(chemin, 60)
  if (error || !data?.signedUrl) {
    onglet?.close()
    return false
  }
  if (onglet) {
    onglet.opener = null
    onglet.location.href = data.signedUrl
  } else {
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
  }
  return true
}
