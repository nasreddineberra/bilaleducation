'use server'

import { createClient } from '@/lib/supabase/server'
import { requireRoleServer } from '@/lib/auth/requireRoleServer'
import { FINANCE_ROLES } from '@/lib/financements/roles'
import { chargerDetailBilan, type DetailBilan } from '@/lib/financements/bilan-donnees'

/**
 * Lignes de l'Excel d'un bilan : `cle` = id d'un bilan fige, ou « provisoire »
 * (annee en cours, lue en direct). Un bilan fige se lit dans l'historique des
 * foyers, que la purge ne touche pas.
 */
export async function detailBilan(cle: string): Promise<{ error?: string; detail?: DetailBilan }> {
  const { error: roleError } = await requireRoleServer(FINANCE_ROLES)
  if (roleError) return { error: roleError }
  const supabase = await createClient()

  if (cle === 'provisoire') {
    const { data: annee } = await supabase.from('school_years').select('id').eq('is_current', true).maybeSingle()
    if (!annee) return { error: 'Aucune année scolaire en cours.' }
    return { detail: await chargerDetailBilan(supabase, annee.id, false) }
  }

  const { data: bilan } = await supabase.from('bilans_financiers').select('school_year_id').eq('id', cle).maybeSingle()
  if (!bilan) return { error: 'Bilan introuvable.' }
  if (!bilan.school_year_id) return { error: 'L’année de ce bilan a été supprimée : le détail n’est plus disponible.' }
  return { detail: await chargerDetailBilan(supabase, bilan.school_year_id, true) }
}
