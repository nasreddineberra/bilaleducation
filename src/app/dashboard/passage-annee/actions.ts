'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { requireRoleServer } from '@/lib/auth/requireRoleServer'
import { logAudit } from '@/lib/audit'
import { CLOSURE_STEPS, CLOSURE_STEP_BY_KEY } from '@/lib/closure/steps'
import { runAuditFor, type YearCtx, type AuditResult } from '@/lib/closure/audits'
import { generateArchive } from '@/lib/closure/archive'

/**
 * PASSAGE D'ANNÉE — actions serveur.
 *
 * ┌─ LE MODÈLE ─────────────────────────────────────────────────────────────┐
 * │ Il n'y a plus de « lancement ». Les audits sont LIBRES : on les relance  │
 * │ quand on veut, même en cours d'année, pour connaître l'état des données. │
 * │ Ils ne ferment rien, ne créent rien d'irréversible ; relancer un audit   │
 * │ remplace son résultat, c'est tout.                                       │
 * │                                                                          │
 * │ La clôture est un ACTE TERMINAL unique, et elle se défait — tant que la  │
 * │ PURGE n'a pas eu lieu, tout se défait. La purge est le seul point de     │
 * │ non-retour du cycle.                                                     │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * L'état vit sur `school_years` (closed_at, archived_at, purged_at) et les
 * résultats d'audit dans `year_audits`. Voir la migration
 * `rework-year-closure-state.sql`.
 */

const ROLES = ['admin', 'direction'] as const

/** Contexte d'une année donnée, tel que l'attendent les audits et l'archivage. */
async function getYearCtx(supabase: any, etablissementId: string, yearId: string): Promise<YearCtx | null> {
  const { data: year } = await supabase
    .from('school_years').select('id, label, start_date, end_date').eq('id', yearId).maybeSingle()
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

/** Date du jour en composantes LOCALES — jamais `toISOString`, qui bascule en UTC. */
function todayLocal(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function frDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

// ═══════════════════════════════════════════════════════════════════════════
//  AUDITS — libres, relançables, sans effet de bord
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Lance un audit et mémorise son résultat (le précédent est remplacé).
 *
 * Le résultat mémorisé sert l'écran — l'afficher sans tout recalculer à chaque
 * ouverture — et permet de savoir que les six audits ont été passés. Il ne fait
 * JAMAIS office de garde : la clôture ré-audite (voir `closeYear`).
 */
export async function runAudit(yearId: string, stepKey: string): Promise<{ error?: string; result?: AuditResult }> {
  const { error: roleError } = await requireRoleServer([...ROLES])
  if (roleError) return { error: roleError }
  if (!CLOSURE_STEP_BY_KEY[stepKey]) return { error: 'Audit inconnu.' }

  const supabase = await createClient()
  const etablissementId = (await headers()).get('x-etablissement-id') ?? ''
  const { data: { user } } = await supabase.auth.getUser()

  const ctx = await getYearCtx(supabase, etablissementId, yearId)
  if (!ctx) return { error: 'Année introuvable.' }

  const result = await runAuditFor(stepKey, supabase, ctx)

  const { error } = await supabase.from('year_audits').upsert({
    etablissement_id: etablissementId,
    school_year_id: yearId,
    step_key: stepKey,
    anomalies_count: result.anomalies,
    recap_json: result as unknown as Record<string, unknown>,
    audited_at: new Date().toISOString(),
    audited_by: user?.id ?? null,
  }, { onConflict: 'school_year_id,step_key' })
  if (error) return { error: error.message }

  revalidatePath('/dashboard/passage-annee')
  return { result }
}

// ═══════════════════════════════════════════════════════════════════════════
//  CLÔTURE — acte terminal, réversible tant que la purge n'a pas eu lieu
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Clôture l'année. DEUX conditions, et elles se disent :
 *   1. la date de fin est passée — on ne clôture pas une année qui court ;
 *   2. les six audits ont été passés.
 *
 * Puis on RÉ-AUDITE ici même : un audit bloquant passé il y a un mois ne vaut
 * rien, les données ont pu changer depuis. C'est cette passe fraîche qui décide.
 */
export async function closeYear(yearId: string): Promise<{ error?: string; bloquants?: string[] }> {
  const { error: roleError } = await requireRoleServer([...ROLES])
  if (roleError) return { error: roleError }

  const supabase = await createClient()
  const etablissementId = (await headers()).get('x-etablissement-id') ?? ''
  const { data: { user } } = await supabase.auth.getUser()

  const { data: year } = await supabase
    .from('school_years').select('id, label, end_date, closed_at').eq('id', yearId).maybeSingle()
  if (!year) return { error: 'Année introuvable.' }
  if (year.closed_at) return {}   // déjà close : rien à faire

  // 1. L'année doit être TERMINÉE. Le critère est une date, pas un statut :
  //    on clôture bien l'année EN COURS, ce qui interdit de se fonder sur
  //    « n'est plus l'année en cours » — elle ne cesse de l'être qu'après.
  if (!year.end_date) {
    return { error: `L’année ${year.label} n’a pas de date de fin : renseignez-la avant de clôturer.` }
  }
  const today = todayLocal()
  if (today <= year.end_date) {
    return { error: `L’année ${year.label} court jusqu’au ${frDate(year.end_date)}. La clôture sera possible à partir du lendemain.` }
  }

  // 2. Les six audits doivent avoir été passés au moins une fois.
  const { data: passes } = await supabase
    .from('year_audits').select('step_key').eq('school_year_id', yearId)
  const faits = new Set((passes ?? []).map((a: any) => a.step_key))
  const manquants = CLOSURE_STEPS.filter(s => !faits.has(s.key))
  if (manquants.length > 0) {
    return { error: `Audit(s) non passé(s) : ${manquants.map(s => s.label).join(', ')}.` }
  }

  // 3. Passe fraîche, autoritative.
  const ctx = await getYearCtx(supabase, etablissementId, yearId)
  if (!ctx) return { error: 'Année introuvable.' }

  const now = new Date().toISOString()
  const bloquants: string[] = []

  for (const step of CLOSURE_STEPS) {
    const result = await runAuditFor(step.key, supabase, ctx)
    await supabase.from('year_audits').upsert({
      etablissement_id: etablissementId,
      school_year_id: yearId,
      step_key: step.key,
      anomalies_count: result.anomalies,
      recap_json: result as unknown as Record<string, unknown>,
      audited_at: now,
      audited_by: user?.id ?? null,
    }, { onConflict: 'school_year_id,step_key' })

    if (result.blocking && result.anomalies > 0) {
      bloquants.push(`${step.label} : ${result.anomalies} anomalie(s)`)
    }
  }

  if (bloquants.length > 0) {
    revalidatePath('/dashboard/passage-annee')
    return { error: 'Des anomalies bloquantes subsistent.', bloquants }
  }

  const { error } = await supabase
    .from('school_years')
    .update({ closed_at: now, closed_by: user?.id ?? null })
    .eq('id', yearId)
  if (error) return { error: error.message }

  try {
    await logAudit(supabase, {
      action: 'UPDATE', entityType: 'school_years', entityId: yearId,
      description: `Année ${year.label} clôturée`,
    })
  } catch { /* non bloquant */ }

  revalidatePath('/dashboard/passage-annee')
  revalidatePath('/dashboard/annee-scolaire', 'layout')
  return {}
}

/**
 * Défait la clôture — et l'archivage avec elle, puisqu'il en dépend.
 *
 * Les instantanés sont SUPPRIMÉS : les garder afficherait un historique figé
 * pour une année redevenue vivante. Ils se régénèrent au prochain archivage.
 * Refusé après la purge : elle, ne se défait pas.
 */
export async function reopenYear(yearId: string): Promise<{ error?: string }> {
  const { error: roleError } = await requireRoleServer([...ROLES])
  if (roleError) return { error: roleError }

  const supabase = await createClient()

  const { data: year } = await supabase
    .from('school_years').select('id, label, closed_at, purged_at').eq('id', yearId).maybeSingle()
  if (!year) return { error: 'Année introuvable.' }
  if (year.purged_at) {
    return { error: 'Année purgée : la clôture ne peut plus être défaite, les données supprimées ne reviendront pas.' }
  }
  if (!year.closed_at) return {}

  const { error } = await supabase
    .from('school_years')
    .update({ closed_at: null, closed_by: null, archived_at: null, purge_intent: null })
    .eq('id', yearId)
  if (error) return { error: error.message }

  await supabase.from('student_year_history').delete().eq('school_year_id', yearId)
  await supabase.from('family_year_finance').delete().eq('school_year_id', yearId)

  try {
    await logAudit(supabase, {
      action: 'UPDATE', entityType: 'school_years', entityId: yearId,
      description: `Clôture de l’année ${year.label} annulée (archive supprimée)`,
    })
  } catch { /* non bloquant */ }

  revalidatePath('/dashboard/passage-annee')
  revalidatePath('/dashboard/annee-scolaire', 'layout')
  return {}
}

// ═══════════════════════════════════════════════════════════════════════════
//  ARCHIVAGE puis PURGE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Archive l'année : génère les instantanés `student_year_history` et
 * `family_year_finance`, puis pose `archived_at`. Idempotent (on repart de zéro
 * pour cette année). Prérequis : année close.
 */
export async function archiveYear(yearId: string): Promise<{ error?: string; students?: number; families?: number }> {
  const { error: roleError } = await requireRoleServer([...ROLES])
  if (roleError) return { error: roleError }

  const supabase = await createClient()
  const etablissementId = (await headers()).get('x-etablissement-id') ?? ''

  const { data: year } = await supabase
    .from('school_years').select('id, label, closed_at').eq('id', yearId).maybeSingle()
  if (!year) return { error: 'Année introuvable.' }
  if (!year.closed_at) return { error: 'Clôturez l’année avant de l’archiver.' }

  const ctx = await getYearCtx(supabase, etablissementId, yearId)
  if (!ctx) return { error: 'Année introuvable.' }

  const { studentRows, familyRows } = await generateArchive(supabase, ctx)

  await supabase.from('student_year_history').delete().eq('school_year_id', yearId)
  await supabase.from('family_year_finance').delete().eq('school_year_id', yearId)

  if (studentRows.length > 0) {
    const { error } = await supabase.from('student_year_history').insert(studentRows)
    if (error) return { error: `Archivage participants : ${error.message}` }
  }
  if (familyRows.length > 0) {
    const { error } = await supabase.from('family_year_finance').insert(familyRows)
    if (error) return { error: `Archivage foyers : ${error.message}` }
  }

  await supabase.from('school_years').update({ archived_at: new Date().toISOString() }).eq('id', yearId)

  try {
    await logAudit(supabase, {
      action: 'UPDATE', entityType: 'school_years', entityId: yearId,
      description: `Année ${ctx.yearLabel} archivée (${studentRows.length} participant(s), ${familyRows.length} foyer(s))`,
    })
  } catch { /* non bloquant */ }

  revalidatePath('/dashboard/passage-annee')
  revalidatePath('/dashboard/annee-scolaire', 'layout')
  return { students: studentRows.length, families: familyRows.length }
}

/**
 * Mémorise le choix « épurer la base ou non ». Simple drapeau : il met la carte
 * de purge en avant sur la fiche de l'année, rien ne s'exécute tout seul.
 */
export async function setPurgeIntent(yearId: string, intent: 'purge' | 'keep'): Promise<{ error?: string }> {
  const { error: roleError } = await requireRoleServer([...ROLES])
  if (roleError) return { error: roleError }

  const supabase = await createClient()

  const { data: year } = await supabase
    .from('school_years').select('id, archived_at').eq('id', yearId).maybeSingle()
  if (!year) return { error: 'Année introuvable.' }
  if (!year.archived_at) return { error: 'Archivez l’année avant de choisir l’épuration.' }

  const { error } = await supabase.from('school_years').update({ purge_intent: intent }).eq('id', yearId)
  if (error) return { error: error.message }

  try {
    await logAudit(supabase, {
      action: 'UPDATE', entityType: 'school_years', entityId: yearId,
      description: `Choix de fin de clôture : ${intent === 'purge' ? 'épurer la base' : 'conserver toutes les données'}`,
    })
  } catch { /* non bloquant */ }

  revalidatePath('/dashboard/passage-annee')
  revalidatePath('/dashboard/annee-scolaire', 'layout')
  return {}
}

/**
 * PURGE (DESTRUCTIF, sans retour) : supprime les lignes transactionnelles d'une
 * année archivée et NON courante — foyers soldés uniquement. Confirmation par
 * saisie du libellé. Appelle la RPC atomique `purge_school_year`.
 */
export async function purgeYear(yearId: string, typedLabel: string): Promise<{ error?: string; summary?: any }> {
  const { error: roleError } = await requireRoleServer([...ROLES])
  if (roleError) return { error: roleError }

  const supabase = await createClient()

  const { data: year } = await supabase
    .from('school_years').select('id, label, is_current, archived_at').eq('id', yearId).maybeSingle()
  if (!year) return { error: 'Année introuvable.' }
  if (year.is_current) return { error: 'Impossible de purger l’année en cours. Basculez d’abord sur l’année suivante.' }
  if (!year.archived_at) return { error: 'Année non archivée : purge interdite.' }
  if (typedLabel.trim() !== year.label) return { error: 'Le libellé saisi ne correspond pas à l’année.' }

  const { data, error } = await supabase.rpc('purge_school_year', { p_year_id: yearId })
  if (error) return { error: error.message }

  try {
    await logAudit(supabase, {
      action: 'DELETE', entityType: 'school_years', entityId: yearId,
      description: `Année ${year.label} purgée (${data?.notes ?? 0} notes, ${data?.absences ?? 0} absences, ${data?.fees_paid ?? 0} foyer(s) soldé(s))`,
    })
  } catch { /* non bloquant */ }

  revalidatePath('/dashboard/passage-annee')
  revalidatePath('/dashboard/annee-scolaire', 'layout')
  return { summary: data }
}
