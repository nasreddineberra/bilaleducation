'use server'

import { createClient } from '@/lib/supabase/server'

/**
 * Le mot de passe vient d'etre choisi : pour un compte PARENT, la base pose la
 * date de configuration de SA place (badge « Acces en ligne »). Sans effet pour
 * tout autre compte (`marquer_acces_configure` ne trouve pas de foyer).
 * Non bloquant : le mot de passe est deja enregistre.
 */
export async function marquerAccesConfigure(): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('marquer_acces_configure')
  if (error) console.error('[marquerAccesConfigure]', error.message)
}
