'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireRoleServer } from '@/lib/auth/requireRoleServer'
import { phraseRefusAbsence, type Decision } from '@/lib/absences-enseignants/libelles'
import { prevenirFamilles, phraseEchecs, type SeanceCle } from '@/lib/absences-enseignants/familles'

// Absences enseignants (lot 3). Toute ecriture passe par une fonction de la base
// (add-absences-enseignants.sql), qui juge et trace : chaque refus revient en
// CODE, traduit par `phraseRefusAbsence`. Le journal d'activite est ecrit par
// les declencheurs des deux tables.
//
// FAMILLES (lot 3c) : on ecrit d'abord, on previent ensuite. Une seance annulee
// est annoncee si `prevenir` le demande ; une seance annoncee annulee qui
// redevient ordinaire (autre decision, absence raccourcie ou supprimee) est
// annoncee maintenue. Ce qui etait annonce est lu AVANT l'ecriture : apres, la
// ligne a pu disparaitre. Un envoi en echec ne defait pas l'ecriture, il revient
// en avertissement.

const ENCADREMENT = ['admin', 'direction', 'responsable_pedagogique', 'secretaire'] as const
const HORODATAGE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/

type Client = Awaited<ReturnType<typeof createClient>>
const cle = (s: SeanceCle) => `${s.slotId}|${s.date}`

/** Les seances annulees de l'absence dont les familles ont ete prevenues. */
async function annonceesDe(supabase: Client, absenceId: string): Promise<SeanceCle[]> {
  const { data } = await supabase
    .from('absences_enseignants_seances')
    .select('schedule_slot_id, seance_date')
    .eq('absence_id', absenceId)
    .eq('decision', 'annulee')
    .not('familles_prevenues_le', 'is', null)
  return (data ?? []).map(d => ({ slotId: d.schedule_slot_id, date: d.seance_date }))
}

async function ecoleDe(supabase: Client, absenceId: string): Promise<string | null> {
  const { data } = await supabase.from('absences_enseignants').select('etablissement_id').eq('id', absenceId).maybeSingle()
  return data?.etablissement_id ?? null
}

/** Annonce les seances maintenues ; rend le nombre de foyers non atteints. */
async function annoncerMaintenues(supabase: Client, ecole: string | null, seances: SeanceCle[]): Promise<number> {
  if (!ecole || seances.length === 0) return 0
  return (await prevenirFamilles(supabase, ecole, seances, 'retablie')).echecs
}

export async function enregistrerAbsence(saisie: {
  id: string | null
  teacherId: string
  debut: string   // AAAA-MM-JJTHH:MM, heure de l'ecole
  fin: string
  motif: string
}, prevenir = false): Promise<{ id?: string; error?: string; avertissement?: string }> {
  const { error: roleError } = await requireRoleServer([...ENCADREMENT])
  if (roleError) return { error: roleError }
  if (!HORODATAGE.test(saisie.debut) || !HORODATAGE.test(saisie.fin)) return { error: 'Date ou heure invalide.' }

  const supabase = await createClient()
  // Modification : la base efface les decisions des seances qui SORTENT de la periode.
  const avant = saisie.id && prevenir ? await annonceesDe(supabase, saisie.id) : []
  const { data, error } = await supabase.rpc('enregistrer_absence_enseignant', {
    p_id: saisie.id,
    p_teacher_id: saisie.teacherId,
    p_debut: saisie.debut,
    p_fin: saisie.fin,
    p_motif: saisie.motif,
  })
  if (error || !data) return { error: phraseRefusAbsence(error ?? {}, 'L’absence n’a pas pu être enregistrée.') }
  revalidatePath('/dashboard/absences-enseignants')

  let echecs = 0
  if (avant.length) {
    const restent = new Set((await annonceesDe(supabase, data)).map(cle))
    echecs = await annoncerMaintenues(supabase, await ecoleDe(supabase, data), avant.filter(s => !restent.has(cle(s))))
  }
  return { id: data, avertissement: phraseEchecs(echecs) }
}

export async function supprimerAbsence(id: string, prevenir = false): Promise<{ error?: string; avertissement?: string }> {
  const { error: roleError } = await requireRoleServer([...ENCADREMENT])
  if (roleError) return { error: roleError }
  const supabase = await createClient()
  const avant = prevenir ? await annonceesDe(supabase, id) : []
  const ecole = avant.length ? await ecoleDe(supabase, id) : null
  const { error } = await supabase.rpc('supprimer_absence_enseignant', { p_id: id })
  if (error) return { error: phraseRefusAbsence(error, 'L’absence n’a pas pu être supprimée.') }
  revalidatePath('/dashboard/absences-enseignants')
  return { avertissement: phraseEchecs(await annoncerMaintenues(supabase, ecole, avant)) }
}

export async function deciderSeances(
  absenceId: string,
  decisions: { slotId: string; date: string; decision: Decision; remplacant: string | null }[],
  prevenir: { annulees: boolean; maintenues: boolean; remplacees?: boolean } = { annulees: false, maintenues: false },
): Promise<{ error?: string; avertissement?: string }> {
  const { error: roleError } = await requireRoleServer([...ENCADREMENT])
  if (roleError) return { error: roleError }
  const supabase = await createClient()
  const dejaAnnoncees = new Set((await annonceesDe(supabase, absenceId)).map(cle))
  const { data, error } = await supabase.rpc('decider_seances_absence', {
    p_absence_id: absenceId,
    p_decisions: decisions.map(d => ({
      slot_id: d.slotId, date: d.date, decision: d.decision, remplacant: d.remplacant,
    })),
  })
  if (error) return { error: phraseRefusAbsence(error, 'Les décisions n’ont pas pu être enregistrées.') }
  revalidatePath(`/dashboard/absences-enseignants/${absenceId}`)
  revalidatePath('/dashboard/absences-enseignants')

  const rendu = data as unknown as { retablies: { slot_id: string; date: string }[] } | null
  const maintenues = prevenir.maintenues ? (rendu?.retablies ?? []).map(r => ({ slotId: r.slot_id, date: r.date })) : []
  // Annulee maintenant, et pas deja annoncee (une annulee re-enregistree garde son annonce).
  const annulees = prevenir.annulees
    ? decisions.filter(d => d.decision === 'annulee' && !dejaAnnoncees.has(cle(d))).map(({ slotId, date }) => ({ slotId, date }))
    : []
  // Remplacee maintenant (nouvelle decision ou autre remplacant) : annonce
  // facultative (29/10). Une seance annoncee annulee qui passe a « remplacee »
  // est deja dite maintenue : pas de second email.
  const retablies = new Set((rendu?.retablies ?? []).map(r => `${r.slot_id}|${r.date}`))
  const remplacees = prevenir.remplacees
    ? decisions.filter(d => d.decision === 'remplacee' && !retablies.has(cle(d))).map(({ slotId, date }) => ({ slotId, date }))
    : []
  if (annulees.length === 0 && maintenues.length === 0 && remplacees.length === 0) return {}

  const ecole = await ecoleDe(supabase, absenceId)
  if (!ecole) return {}
  let echecs = await annoncerMaintenues(supabase, ecole, maintenues)
  if (remplacees.length) echecs += (await prevenirFamilles(supabase, ecole, remplacees, 'remplacee')).echecs
  if (annulees.length) {
    const envoi = await prevenirFamilles(supabase, ecole, annulees, 'annulee')
    echecs += envoi.echecs
    if (envoi.prevenues.length) {
      const { error: marque } = await supabase.rpc('marquer_familles_prevenues', {
        p_absence_id: absenceId,
        p_seances: envoi.prevenues.map(s => ({ slot_id: s.slotId, date: s.date })),
      })
      if (marque) console.error('[deciderSeances] annonce non notee :', marque.message)
    }
  }
  return { avertissement: phraseEchecs(echecs) }
}
