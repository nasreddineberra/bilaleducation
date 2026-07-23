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

/**
 * Prepare l'annee suivante (bascule N+1, non destructif) : cree l'annee N+1
 * (libelle auto, period_type + dates decalees, PAS « en cours »), copie les
 * periodes et REPORTE les cotisations. Les types de presence sont crees par le
 * trigger sur school_years. Classes / EDT / ré-affectation restent manuels.
 */
export async function prepareNextYear(currentYearId: string): Promise<{ error?: string; newYearId?: string }> {
  const { error: roleError } = await requireRoleServer(['admin', 'direction'])
  if (roleError) return { error: roleError }

  const supabase = await createClient()

  const { data: year } = await supabase
    .from('school_years')
    .select('id, etablissement_id, label, period_type, start_date, end_date')
    .eq('id', currentYearId).single()
  if (!year) return { error: 'Année introuvable.' }

  // Libelle suivant (attendu « AAAA-AAAA »).
  const m = /^(\d{4})-(\d{4})$/.exec(year.label.trim())
  if (!m) return { error: `Libellé « ${year.label} » non standard (attendu « AAAA-AAAA »). Créez l'année suivante manuellement.` }
  const nextLabel = `${Number(m[1]) + 1}-${Number(m[2]) + 1}`

  const { data: existing } = await supabase
    .from('school_years').select('id')
    .eq('etablissement_id', year.etablissement_id).eq('label', nextLabel).maybeSingle()
  if (existing) return { error: `L'année ${nextLabel} existe déjà.` }

  const addYear = (d: string | null) => {
    if (!d) return null
    const dt = new Date(d + 'T00:00:00')
    dt.setFullYear(dt.getFullYear() + 1)
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
  }

  // Créer N+1 (pas « en cours »).
  const { data: created, error } = await supabase
    .from('school_years')
    .insert({
      etablissement_id: year.etablissement_id,
      label: nextLabel,
      period_type: year.period_type,
      start_date: addYear(year.start_date),
      end_date: addYear(year.end_date),
      is_current: false,
    })
    .select('id').single()
  if (error || !created) return { error: error?.message ?? 'Création de l\'année impossible.' }
  const newYearId = created.id

  // Périodes (copie des libellés/ordre ; is_current reste false).
  const { data: periods } = await supabase
    .from('periods').select('label, order_index').eq('school_year_id', currentYearId).order('order_index')
  if (periods && periods.length > 0) {
    await supabase.from('periods').insert(periods.map((p: any) => ({ school_year_id: newYearId, label: p.label, order_index: p.order_index })))
  }

  // Report des cotisations.
  const { data: cotis } = await supabase
    .from('cotisation_types')
    .select('label, amount, registration_fee, sibling_discount, max_installments, order_index, sibling_discount_same_type, is_adult')
    .eq('school_year_id', currentYearId)
  if (cotis && cotis.length > 0) {
    await supabase.from('cotisation_types').insert(cotis.map((c: any) => ({ ...c, etablissement_id: year.etablissement_id, school_year_id: newYearId })))
  }

  // Types de présence : créés automatiquement par le trigger AFTER INSERT sur school_years.

  try {
    await logAudit(supabase, {
      action: 'INSERT', entityType: 'school_years', entityId: newYearId,
      description: `Année suivante ${nextLabel} préparée depuis ${year.label} (périodes + cotisations reportées)`,
    })
  } catch { /* non bloquant */ }

  revalidatePath('/dashboard/annee-scolaire', 'layout')
  return { newYearId }
}
