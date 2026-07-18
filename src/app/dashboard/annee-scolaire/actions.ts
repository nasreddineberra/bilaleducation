'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireRoleServer } from '@/lib/auth/requireRoleServer'
import { logAudit } from '@/lib/audit'

export interface SetCurrentPeriodResult {
  error?: string
}

/**
 * Marque UNE periode comme « en cours » pour son annee scolaire (les autres
 * repassent a false). Sert de valeur par defaut du selecteur de periode sur
 * tous les ecrans. Reserve admin/direction (la RLS periods fait foi).
 */
export async function setCurrentPeriod(schoolYearId: string, periodId: string): Promise<SetCurrentPeriodResult> {
  const { error: roleError } = await requireRoleServer(['admin', 'direction'])
  if (roleError) return { error: roleError }

  const supabase = await createClient()

  // Coherence : la periode doit appartenir a l'annee indiquee.
  const { data: period } = await supabase
    .from('periods')
    .select('id, label, school_year_id')
    .eq('id', periodId)
    .single()
  if (!period || period.school_year_id !== schoolYearId) {
    return { error: 'Période introuvable pour cette année.' }
  }

  // Une seule courante par annee : on decoche tout, puis on coche la choisie
  // (l'ordre respecte l'index d'unicite partiel `WHERE is_current`).
  const { error: clearErr } = await supabase
    .from('periods')
    .update({ is_current: false })
    .eq('school_year_id', schoolYearId)
  if (clearErr) return { error: clearErr.message }

  const { error: setErr } = await supabase
    .from('periods')
    .update({ is_current: true })
    .eq('id', periodId)
  if (setErr) return { error: setErr.message }

  try {
    await logAudit(supabase, {
      action: 'UPDATE',
      entityType: 'periods',
      entityId: periodId,
      description: `Période en cours définie sur « ${period.label} »`,
    })
  } catch { /* non bloquant */ }

  revalidatePath(`/dashboard/annee-scolaire/${schoolYearId}`)
  return {}
}
