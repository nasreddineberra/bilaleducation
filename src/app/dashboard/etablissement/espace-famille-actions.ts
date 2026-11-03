'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireRoleServer } from '@/lib/auth/requireRoleServer'
import { erreurEcriture } from '@/lib/supabase/ecriture'
import { logAudit } from '@/lib/audit'

/**
 * Interrupteur de l'ETABLISSEMENT (decision 17) : la direction ouvre ou coupe
 * l'acces des familles, l'option de la console etant active. Couper est
 * temporaire : les comptes restent, une reouverture rend l'acces tel quel. La
 * base refuse d'ouvrir sans l'option (contrainte `etablissements_espace_famille_coherent`).
 */
export async function basculerEspaceFamille(ouvert: boolean): Promise<{ error?: string }> {
  const { error: roleError } = await requireRoleServer(['admin', 'direction'])
  if (roleError) return { error: roleError }
  const etablissementId = (await headers()).get('x-etablissement-id')
  if (!etablissementId) return { error: 'Établissement non identifié.' }

  const supabase = await createClient()
  const resultat = await supabase
    .from('etablissements')
    .update({ espace_famille_ouvert: ouvert })
    .eq('id', etablissementId)
    .select('id')
  if (resultat.error?.code === '23514') return { error: 'L’espace famille n’est pas souscrit pour cet établissement.' }
  const echec = erreurEcriture(resultat, 'L’espace famille')
  if (echec) return { error: echec }

  await logAudit(supabase, {
    action: 'UPDATE',
    entityType: 'etablissements',
    entityId: etablissementId,
    description: ouvert ? 'Espace famille activé par l’établissement' : 'Espace famille désactivé par l’établissement',
  }).catch(() => { /* non bloquant */ })

  revalidatePath('/dashboard/etablissement')
  revalidatePath('/dashboard/utilisateurs')
  return {}
}
