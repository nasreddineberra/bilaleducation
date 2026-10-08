'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { requireEditor } from '@/lib/auth/requireEditor'
import { revalidatePath } from 'next/cache'

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
