'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireEditor } from '@/lib/auth/requireEditor'
import { tracerActionEditeur } from '@/lib/support/actions-editeur'

/**
 * Purge de l'historique de l'editeur d'un etablissement (console).
 *
 * Porte sur les DEUX listes de la colonne Console editeur : `actions_editeur` et
 * `support_interventions`. Deux regles de prudence :
 *   · une intervention encore OUVERTE n'est jamais supprimee ;
 *   · une ligne de PURGE (`est_purge`) n'est jamais supprimee — sinon la purge
 *     suivante effacerait la preuve de la precedente.
 * La purge laisse sa propre trace dans l'historique.
 *
 * Service-role (tables en regime serveur uniquement) : garde `requireEditor`, et
 * chaque requete porte son cloisonnement par etablissement.
 */

const PERIODES = [1, 6, 12] as const

function seuil(mois: number): string {
  const d = new Date()
  d.setMonth(d.getMonth() - mois)
  return d.toISOString()
}

/** Nombre de lignes que chaque choix supprimerait, pour l'afficher avant. */
export async function compterPurgeHistorique(etablissementId: string): Promise<{
  error?: string
  comptes?: { mois: number; actions: number; interventions: number }[]
}> {
  const { error: refus } = await requireEditor()
  if (refus) return { error: refus }

  const admin = createAdminClient()
  const comptes = await Promise.all(PERIODES.map(async mois => {
    const limite = seuil(mois)
    const [a, i] = await Promise.all([
      admin.from('actions_editeur').select('id', { count: 'exact', head: true })
        .eq('etablissement_id', etablissementId).eq('est_purge', false).lt('created_at', limite),
      admin.from('support_interventions').select('id', { count: 'exact', head: true })
        .eq('etablissement_id', etablissementId).not('closed_at', 'is', null).lt('opened_at', limite),
    ])
    // Un comptage `head` impossible rend `count: null` SANS erreur : on refuse de
    // conclure plutot que d'annoncer « 0 ligne » sur une panne.
    if (a.count === null || i.count === null) throw new Error('comptage impossible')
    return { mois, actions: a.count, interventions: i.count }
  })).catch(() => null)

  if (!comptes) return { error: 'Comptage impossible. Réessayez.' }
  return { comptes }
}

export async function purgerHistorique(etablissementId: string, mois: number): Promise<{
  error?: string
  actions?: number
  interventions?: number
}> {
  const { error: refus } = await requireEditor()
  if (refus) return { error: refus }
  if (!(PERIODES as readonly number[]).includes(mois)) return { error: 'Période non autorisée.' }

  const admin = createAdminClient()
  const limite = seuil(mois)

  const a = await admin.from('actions_editeur').delete()
    .eq('etablissement_id', etablissementId).eq('est_purge', false).lt('created_at', limite)
    .select('id')
  if (a.error) return { error: `Purge des actions : ${a.error.message}` }

  const i = await admin.from('support_interventions').delete()
    .eq('etablissement_id', etablissementId).not('closed_at', 'is', null).lt('opened_at', limite)
    .select('id')
  if (i.error) return { error: `Purge des interventions : ${i.error.message}` }

  const nA = a.data?.length ?? 0
  const nI = i.data?.length ?? 0
  const libelle = mois === 1 ? "plus d'1 mois" : `plus de ${mois} mois`
  await tracerActionEditeur(await createClient(), {
    etablissementId,
    description: `Purge de l'historique de ${libelle} · ${nA} action${nA > 1 ? 's' : ''}, ${nI} intervention${nI > 1 ? 's' : ''}`,
    estPurge: true,
  })

  revalidatePath(`/superadmin/ecoles/${etablissementId}`)
  return { actions: nA, interventions: nI }
}
