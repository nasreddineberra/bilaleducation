'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit'
import { requireEditor } from '@/lib/auth/requireEditor'
import { revalidatePath } from 'next/cache'
import type { FacturationEcole } from '@/lib/tenant/facturation'

/**
 * Prend le releve du mois courant pour TOUTES les ecoles, sans attendre la
 * tache pg_cron. Un releve deja pris n'est jamais reecrit (la fonction fait
 * ON CONFLICT DO NOTHING) : relancer est sans risque.
 */
export async function releverMaintenant(): Promise<{ error?: string; crees?: number }> {
  const { error: garde } = await requireEditor()
  if (garde) return { error: garde }

  const { data, error } = await createAdminClient().rpc('fn_releve_facturation')
  if (error) {
    console.error('[facturation] releve impossible :', error.message)
    return { error: 'Le relevé n’a pas pu être pris.' }
  }
  revalidatePath('/superadmin/facturation')
  return { crees: (data as number) ?? 0 }
}

/**
 * Enregistre le payeur et le tarif d'une ecole. Le releve du mois EN COURS suit
 * le nouveau tarif (le mois n'est pas encore facture) ; les mois passes gardent
 * le tarif fige dans leur releve.
 */
export async function enregistrerFacturation(
  etablissementId: string,
  donnees: FacturationEcole,
): Promise<{ error?: string }> {
  const { error: garde } = await requireEditor()
  if (garde) return { error: garde }

  const montant = (v: number | null) => v === null || (Number.isFinite(v) && v >= 0)
  if (!montant(donnees.prix_inscrit) || !montant(donnees.forfait)) {
    return { error: 'Les montants doivent être positifs.' }
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('etablissement_facturation')
    .upsert({ etablissement_id: etablissementId, ...donnees, updated_at: new Date().toISOString() }, { onConflict: 'etablissement_id' })
  if (error) {
    console.error('[facturation] enregistrement :', error.message)
    return { error: 'La facturation n’a pas pu être enregistrée.' }
  }

  const mois = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit' })
    .format(new Date()) + '-01'
  const { error: errReleve } = await admin
    .from('releves_facturation')
    .update({ prix_inscrit: donnees.prix_inscrit, forfait: donnees.forfait })
    .eq('etablissement_id', etablissementId)
    .eq('mois', mois)
  if (errReleve) console.error('[facturation] tarif du releve en cours :', errReleve.message)

  await logAudit(await createClient(), {
    action: 'UPDATE',
    entityType: 'etablissements',
    entityId: etablissementId,
    description: `Console éditeur · facturation mise à jour (prix par inscrit ${donnees.prix_inscrit ?? 'aucun'}, forfait ${donnees.forfait ?? 'aucun'})`,
    etablissementId,
  })

  revalidatePath(`/superadmin/ecoles/${etablissementId}`)
  revalidatePath('/superadmin/facturation')
  return {}
}
