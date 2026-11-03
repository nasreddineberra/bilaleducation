import { createClient } from '@/lib/supabase/server'
import { chargerParticipants, choixParticipants } from '@/lib/espace-famille/donnees'
import { decalerJour, joursDeLaSemaine, semaineFamille, type CreneauFamille } from '@/lib/espace-famille/semaine'
import { indexTitulaires } from '@/lib/edt/seance'
import { nomCompletEnseignant } from '@/lib/teachers/nom'
import { jourParis } from '@/lib/tenant/abonnement'
import FamilleSemaineClient from '@/components/famille/FamilleSemaineClient'

/**
 * Espace famille · Emploi du temps : la semaine de ses participants (enfants et
 * cours adulte, fusionnes). Lectures du lot 2 (creneaux et exceptions des
 * classes du compte, seances modifiees sans motif, titulaires) ; calcul pur
 * `lib/espace-famille/semaine.ts`, celui de l'EDT de l'ecole.
 */
export default async function FamilleEmploiDuTempsPage({ searchParams }: { searchParams: Promise<{ semaine?: string }> }) {
  const { semaine } = await searchParams
  const aujourdhui = jourParis(new Date())
  const reference = /^\d{4}-\d{2}-\d{2}$/.test(semaine ?? '') ? (semaine as string) : aujourdhui

  const supabase = await createClient()
  const [{ data: etab }, { participants }] = await Promise.all([
    supabase.from('etablissements').select('week_start_day, working_days').maybeSingle(),
    chargerParticipants(supabase),
  ])
  const jours = joursDeLaSemaine(reference, Number(etab?.week_start_day ?? 1), Number(etab?.working_days ?? 5))
  const debut = jours[0]
  const fin = jours[jours.length - 1]

  const [{ data: creneaux }, { data: exceptions }, { data: decisions }, { data: enseignants }, { data: classes }, { data: salles }, { data: annee }] = await Promise.all([
    supabase.from('schedule_slots')
      .select('id, class_id, day_of_week, start_time, end_time, slot_type, is_recurring, slot_date, effective_from, effective_until, is_active, room_id, libelle, unites_enseignement(nom_fr)'),
    supabase.from('schedule_exceptions')
      .select('schedule_slot_id, exception_date, exception_type, override_room_id')
      .gte('exception_date', debut).lte('exception_date', fin),
    supabase.rpc('famille_seances_modifiees', { p_debut: debut, p_fin: fin }),
    supabase.rpc('famille_enseignants'),
    supabase.from('classes').select('id, room_id'),
    supabase.from('rooms').select('id, name'),
    supabase.from('school_years').select('vacations, jours_feries').eq('is_current', true).maybeSingle(),
  ])

  const titulaireDe = indexTitulaires((enseignants ?? []).map(t => ({
    class_id: t.class_id, teacher_id: t.teacher_id, is_main_teacher: t.is_main_teacher,
    effective_from: t.effective_from, effective_until: t.effective_until,
  })))
  const noms = new Map((enseignants ?? []).map(t => [t.teacher_id, nomCompletEnseignant(t)]))
  const salleClasse = new Map((classes ?? []).map(c => [c.id, c.room_id]))
  const nomsSalles = new Map((salles ?? []).map(r => [r.id, r.name]))

  const libelle = new Map(choixParticipants(participants).map(c => [c.valeur, c.libelle]))
  const jourAJour = semaineFamille({
    jours,
    creneaux: (creneaux ?? []) as CreneauFamille[],
    exceptions: exceptions ?? [],
    decisions: decisions ?? [],
    titulaireDe,
    nomEnseignant: id => noms.get(id) ?? null,
    salleDeLaClasse: id => salleClasse.get(id) ?? null,
    nomSalle: id => nomsSalles.get(id) ?? null,
    vacances: annee?.vacations ?? [],
    feries: annee?.jours_feries ?? [],
    participants: participants.map(p => ({ classId: p.classId, libelle: libelle.get(p.groupe) ?? p.libelle })),
  })

  return (
    <FamilleSemaineClient
      jours={jourAJour}
      aujourdhui={aujourdhui}
      precedente={decalerJour(debut, -7)}
      suivante={decalerJour(debut, 7)}
      choix={choixParticipants(participants)}
    />
  )
}

