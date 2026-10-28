'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireRoleServer } from '@/lib/auth/requireRoleServer'
import { phraseRefusAbsence, type Decision } from '@/lib/absences-enseignants/libelles'

// Absences enseignants (lot 3). Toute ecriture passe par une fonction de la base
// (add-absences-enseignants.sql), qui juge et trace : chaque refus revient en
// CODE, traduit par `phraseRefusAbsence`. Le journal d'activite est ecrit par
// les declencheurs des deux tables.

const ENCADREMENT = ['admin', 'direction', 'responsable_pedagogique', 'secretaire'] as const
const HORODATAGE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/

export async function enregistrerAbsence(saisie: {
  id: string | null
  teacherId: string
  debut: string   // AAAA-MM-JJTHH:MM, heure de l'ecole
  fin: string
  motif: string
}): Promise<{ id?: string; error?: string }> {
  const { error: roleError } = await requireRoleServer([...ENCADREMENT])
  if (roleError) return { error: roleError }
  if (!HORODATAGE.test(saisie.debut) || !HORODATAGE.test(saisie.fin)) return { error: 'Date ou heure invalide.' }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('enregistrer_absence_enseignant', {
    p_id: saisie.id,
    p_teacher_id: saisie.teacherId,
    p_debut: saisie.debut,
    p_fin: saisie.fin,
    p_motif: saisie.motif,
  })
  if (error || !data) return { error: phraseRefusAbsence(error ?? {}, 'L’absence n’a pas pu être enregistrée.') }
  revalidatePath('/dashboard/absences-enseignants')
  return { id: data }
}

export async function supprimerAbsence(id: string): Promise<{ error?: string }> {
  const { error: roleError } = await requireRoleServer([...ENCADREMENT])
  if (roleError) return { error: roleError }
  const supabase = await createClient()
  const { error } = await supabase.rpc('supprimer_absence_enseignant', { p_id: id })
  if (error) return { error: phraseRefusAbsence(error, 'L’absence n’a pas pu être supprimée.') }
  revalidatePath('/dashboard/absences-enseignants')
  return {}
}

export async function deciderSeances(
  absenceId: string,
  decisions: { slotId: string; date: string; decision: Decision; remplacant: string | null }[],
): Promise<{ retablies?: { slot_id: string; date: string }[]; error?: string }> {
  const { error: roleError } = await requireRoleServer([...ENCADREMENT])
  if (roleError) return { error: roleError }
  const supabase = await createClient()
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
  return { retablies: rendu?.retablies ?? [] }
}
