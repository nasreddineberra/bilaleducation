'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { requireRoleServer } from '@/lib/auth/requireRoleServer'
import { logAudit } from '@/lib/audit'
import { CLOSURE_STEPS } from '@/lib/closure/steps'
import { runAuditFor, type YearCtx, type AuditResult } from '@/lib/closure/audits'

// Contexte annee (pour les audits) — partage par runAudit et closeStep.
async function getYearCtx(supabase: any, etablissementId: string): Promise<YearCtx | null> {
  const { data: year } = await supabase
    .from('school_years').select('id, label, start_date, end_date').eq('is_current', true).maybeSingle()
  if (!year) return null
  const { data: periods } = await supabase
    .from('periods').select('id, label').eq('school_year_id', year.id).order('order_index')
  return {
    etablissementId,
    yearId: year.id,
    yearLabel: year.label,
    startDate: year.start_date ?? null,
    endDate: year.end_date ?? null,
    periodIds: (periods ?? []).map((p: any) => p.id),
    periodLabels: Object.fromEntries((periods ?? []).map((p: any) => [p.id, p.label])),
  }
}

/**
 * Demarre la cloture de l'annee en cours : cree l'en-tete `year_closure`
 * (in_progress) + les 6 etapes `year_closure_steps` (pending). Idempotent.
 */
export async function startClosure(): Promise<{ error?: string; closureId?: string }> {
  const { error: roleError } = await requireRoleServer(['admin', 'direction'])
  if (roleError) return { error: roleError }

  const supabase = await createClient()
  const h = await headers()
  const etablissementId = h.get('x-etablissement-id') ?? ''
  const { data: { user } } = await supabase.auth.getUser()

  const { data: year } = await supabase
    .from('school_years').select('id, label').eq('is_current', true).maybeSingle()
  if (!year) return { error: 'Aucune année scolaire en cours.' }

  const { data: existing } = await supabase
    .from('year_closure').select('id').eq('school_year_id', year.id).maybeSingle()
  if (existing) return { closureId: existing.id }

  const { data: created, error } = await supabase
    .from('year_closure')
    .insert({ etablissement_id: etablissementId, school_year_id: year.id, status: 'in_progress', started_by: user?.id ?? null })
    .select('id').single()
  if (error || !created) return { error: error?.message ?? 'Création de la clôture impossible.' }

  const rows = CLOSURE_STEPS.map(s => ({
    etablissement_id: etablissementId,
    closure_id: created.id,
    step_key: s.key,
    order_index: s.order,
    status: 'pending' as const,
  }))
  const { error: sErr } = await supabase.from('year_closure_steps').insert(rows)
  if (sErr) return { error: sErr.message }

  try {
    await logAudit(supabase, { action: 'INSERT', entityType: 'year_closure', entityId: created.id, description: `Clôture de l'année ${year.label} démarrée` })
  } catch { /* non bloquant */ }

  revalidatePath('/dashboard/annee-scolaire', 'layout')
  return { closureId: created.id }
}

/**
 * Lance l'audit d'une etape : calcule les anomalies (live), persiste le recap et
 * le compteur sur l'etape (sauf si deja close), renvoie le resultat a l'ecran.
 */
export async function runAudit(closureId: string, stepKey: string): Promise<{ error?: string; result?: AuditResult }> {
  const { error: roleError } = await requireRoleServer(['admin', 'direction'])
  if (roleError) return { error: roleError }

  const supabase = await createClient()
  const h = await headers()
  const etablissementId = h.get('x-etablissement-id') ?? ''

  const ctx = await getYearCtx(supabase, etablissementId)
  if (!ctx) return { error: 'Aucune année scolaire en cours.' }

  const result = await runAuditFor(stepKey, supabase, ctx)

  await supabase.from('year_closure_steps')
    .update({ anomalies_count: result.anomalies, recap_json: { ...result, auditedAt: new Date().toISOString() } })
    .eq('closure_id', closureId).eq('step_key', stepKey).neq('status', 'closed')

  revalidatePath('/dashboard/annee-scolaire', 'layout')
  return { result }
}

/**
 * Cloture une etape. Gardes SERVEUR (source de verite) :
 *   1) l'etape precedente doit etre `closed` (sequentiel) ;
 *   2) on RE-AUDITE a la volee : une etape BLOQUANTE avec anomalies ne peut pas
 *      etre cloturee (on ne se fie pas au recap client, potentiellement perime) ;
 *   3) on GELE le recap frais dans `recap_json` (preuve de l'etat a la cloture).
 */
export async function closeStep(closureId: string, stepKey: string): Promise<{ error?: string }> {
  const { error: roleError } = await requireRoleServer(['admin', 'direction'])
  if (roleError) return { error: roleError }

  const supabase = await createClient()
  const h = await headers()
  const etablissementId = h.get('x-etablissement-id') ?? ''
  const { data: { user } } = await supabase.auth.getUser()

  const { data: steps } = await supabase
    .from('year_closure_steps').select('*').eq('closure_id', closureId).order('order_index')
  if (!steps || steps.length === 0) return { error: 'Clôture introuvable.' }

  const target = steps.find((s: any) => s.step_key === stepKey)
  if (!target) return { error: 'Étape introuvable.' }
  if (target.status === 'closed') return {}

  const prev = steps.filter((s: any) => s.order_index < target.order_index).sort((a: any, b: any) => b.order_index - a.order_index)[0]
  if (prev && prev.status !== 'closed') return { error: 'Clôturez d’abord l’étape précédente.' }

  // Re-audit serveur (autoritatif).
  const ctx = await getYearCtx(supabase, etablissementId)
  if (!ctx) return { error: 'Aucune année scolaire en cours.' }
  const result = await runAuditFor(stepKey, supabase, ctx)
  const now = new Date().toISOString()

  // Etape bloquante avec anomalies → refus (on met quand meme a jour le compteur/recap).
  if (result.blocking && result.anomalies > 0) {
    await supabase.from('year_closure_steps')
      .update({ anomalies_count: result.anomalies, recap_json: { ...result, auditedAt: now } })
      .eq('id', target.id)
    revalidatePath('/dashboard/annee-scolaire', 'layout')
    return { error: `Cette étape reste bloquante : ${result.anomalies} anomalie(s) à résoudre avant de clôturer.` }
  }

  // Cloture : on GELE le recap frais.
  const { error } = await supabase
    .from('year_closure_steps')
    .update({
      status: 'closed',
      anomalies_count: result.anomalies,
      recap_json: { ...result, auditedAt: now, frozenAt: now },
      closed_by: user?.id ?? null,
      closed_at: now,
    })
    .eq('id', target.id)
  if (error) return { error: error.message }

  // Toutes les etapes closes → l'annee passe en `closed` (debloque l'archivage, Phase 3).
  const allClosed = steps.every((s: any) => s.id === target.id || s.status === 'closed')
  if (allClosed) {
    await supabase.from('year_closure')
      .update({ status: 'closed', closed_by: user?.id ?? null, closed_at: now })
      .eq('id', closureId)
  }

  try {
    await logAudit(supabase, {
      action: 'UPDATE', entityType: 'year_closure_steps', entityId: target.id,
      description: `Étape « ${stepKey} » clôturée${result.anomalies > 0 ? ` (${result.anomalies} avertissement(s) acquitté(s))` : ''}`,
    })
  } catch { /* non bloquant */ }

  revalidatePath('/dashboard/annee-scolaire', 'layout')
  return {}
}

/**
 * Rouvre une etape ET reverrouille toute l'aval (les etapes suivantes closes
 * repassent en `pending`) : on ne garde pas une cloture aval sur une base amont
 * modifiee. L'annee repasse en `in_progress`.
 */
export async function reopenStep(closureId: string, stepKey: string): Promise<{ error?: string }> {
  const { error: roleError } = await requireRoleServer(['admin', 'direction'])
  if (roleError) return { error: roleError }

  const supabase = await createClient()

  const { data: steps } = await supabase
    .from('year_closure_steps').select('id, step_key, order_index').eq('closure_id', closureId)
  const target = (steps ?? []).find((s: any) => s.step_key === stepKey)
  if (!target) return { error: 'Étape introuvable.' }

  // Reouverture + aval : on vide le recap (la base amont a pu changer → re-audit obligatoire).
  const { error } = await supabase
    .from('year_closure_steps')
    .update({ status: 'pending', closed_by: null, closed_at: null, recap_json: {}, anomalies_count: 0 })
    .eq('closure_id', closureId)
    .gte('order_index', target.order_index)
  if (error) return { error: error.message }

  await supabase.from('year_closure')
    .update({ status: 'in_progress', closed_by: null, closed_at: null })
    .eq('id', closureId)

  try {
    await logAudit(supabase, { action: 'UPDATE', entityType: 'year_closure_steps', entityId: target.id, description: `Étape « ${stepKey} » rouverte (aval reverrouillé)` })
  } catch { /* non bloquant */ }

  revalidatePath('/dashboard/annee-scolaire', 'layout')
  return {}
}
