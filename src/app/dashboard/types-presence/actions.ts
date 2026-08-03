'use server'

import { createClient } from '@/lib/supabase/server'
import { requireRoleServer } from '@/lib/auth/requireRoleServer'
import { logAudit } from '@/lib/audit'
import { revalidatePath } from 'next/cache'

/**
 * Supprime un type de présence.
 *
 * Le contrôle d'usage vivait uniquement dans le formulaire : un appel hors
 * interface supprimait le type malgré des saisies existantes. Il est refait ici,
 * et la base porte en plus un trigger (`trg_guard_presence_type_delete`) — trois
 * niveaux, du plus commode au plus sûr.
 *
 * Le taux horaire éventuel est retiré d'abord : simplement paramétré, il n'est
 * pas un usage, mais sa clé étrangère bloquerait la suppression du type.
 */
export async function deletePresenceType(id: string): Promise<{ error?: string }> {
  const { error: roleError } = await requireRoleServer(['admin', 'direction'])
  if (roleError) return { error: roleError }

  const supabase = await createClient()

  const { data: type } = await supabase
    .from('presence_types')
    .select('id, code, label, etablissement_id, school_year_id, reserved_kind')
    .eq('id', id)
    .maybeSingle()
  if (!type) return { error: 'Type de présence introuvable.' }

  if (type.reserved_kind) {
    return { error: 'Ce type est réservé : il ne peut pas être supprimé.' }
  }

  // Usage réel = au moins une saisie de temps de l'année de ce type.
  const { data: year } = await supabase
    .from('school_years')
    .select('start_date, end_date')
    .eq('id', type.school_year_id)
    .maybeSingle()

  if (year?.start_date && year?.end_date) {
    const { count } = await supabase
      .from('staff_time_entries')
      .select('id', { count: 'exact', head: true })
      .eq('entry_type', type.code)
      .gte('entry_date', year.start_date)
      .lte('entry_date', year.end_date)

    if (count && count > 0) {
      return { error: `Ce type est utilisé dans ${count} saisie(s) de l'année en cours et ne peut pas être supprimé.` }
    }
  }

  // Tracer avant d'effacer : après coup il n'y a plus rien à décrire.
  await logAudit(supabase, {
    action:      'DELETE',
    entityType:  'presence_types',
    entityId:    id,
    description: `Suppression du type de présence ${type.code} · ${type.label}`,
    oldData:     type as Record<string, unknown>,
  })

  const { error: rateError } = await supabase
    .from('presence_type_rates')
    .delete()
    .eq('presence_type_id', id)
  if (rateError) return { error: 'Erreur lors de la suppression du taux horaire associé.' }

  // `.select()` : une suppression filtrée par la RLS ne renvoie pas d'erreur,
  // elle supprime zéro ligne — sans ce contrôle on afficherait un faux succès.
  const { data: deleted, error: delError } = await supabase
    .from('presence_types')
    .delete()
    .eq('id', id)
    .select('id')

  if (delError) {
    // `restrict_violation` = le trigger de garde ; `23503` = une autre clé étrangère.
    if (delError.code === '23001' || delError.code === '23503') {
      return { error: delError.message || 'Ce type est référencé ailleurs et ne peut pas être supprimé.' }
    }
    return { error: 'Erreur lors de la suppression.' }
  }
  if (!deleted || deleted.length === 0) {
    return { error: 'Suppression refusée.' }
  }

  revalidatePath('/dashboard/types-presence')
  return {}
}
