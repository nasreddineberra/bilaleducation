import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { logAudit } from '@/lib/audit'

/**
 * Historique des actions de l'EDITEUR (`actions_editeur`), par etablissement.
 *
 * Module ORDINAIRE et non `'use server'` : appele depuis les server actions de
 * la console, il ne doit pas devenir un point d'entree appelable du navigateur.
 * La table est en regime serveur uniquement : ecriture par le service-role.
 *
 * NON BLOQUANT, comme le journal : une trace qui echoue ne doit jamais annuler
 * l'action qu'elle decrit. L'echec part au journal du serveur.
 */
export async function tracerActionEditeur(
  session: SupabaseClient,
  params: { etablissementId: string; description: string; estPurge?: boolean },
): Promise<void> {
  try {
    const { data: { user } } = await session.auth.getUser()
    const { error } = await createAdminClient().from('actions_editeur').insert({
      etablissement_id:  params.etablissementId,
      super_admin_id:    user?.id ?? null,
      super_admin_email: user?.email ?? null,
      // Le prefixe « Console editeur · » sert le journal de l'ECOLE, ou il
      // distingue l'editeur du personnel. Ici tout vient de l'editeur.
      description:       params.description.replace(/^Console éditeur · /, ''),
      est_purge:         params.estPurge ?? false,
    })
    if (error) console.error('[actions_editeur]', error)
  } catch (e) {
    console.error('[actions_editeur]', e)
  }
}

type ParamsJournal = Parameters<typeof logAudit>[1] & { etablissementId: string }

/**
 * Trace une action de la console a ses DEUX destinations : le journal de l'ecole
 * (qui reste informee de ce que l'editeur fait chez elle) et l'historique de
 * l'editeur (qui survit a une purge de ce journal par l'ecole).
 */
export async function tracerConsole(session: SupabaseClient, params: ParamsJournal): Promise<void> {
  await logAudit(session, params)
  await tracerActionEditeur(session, { etablissementId: params.etablissementId, description: params.description })
}
