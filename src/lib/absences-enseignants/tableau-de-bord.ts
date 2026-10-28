import type { SupabaseClient } from '@supabase/supabase-js'
import { fusionnerDecisions, type DecisionSeance, type TitulaireDe } from '@/lib/edt/seance'
import { absenceDeSeance, seancesTouchees, type AbsenceEnseignant } from '@/lib/edt/absences'
import type { CreneauSource } from '@/lib/edt/creneaux-du-jour'
import { nomEnseignantCivilite } from '@/lib/teachers/nom'

/**
 * ABSENCES D'ENSEIGNANT VUES PAR LES TABLEAUX DE BORD (lot 3b-2b).
 *
 * Les tableaux de bord lisaient les absences dans Temps de presence : elles se
 * declarent desormais dans « Absences enseignants », et leurs decisions disent
 * qui assure une seance. Ce module lit les deux sur la fenetre du tableau de
 * bord et rend ce dont `lib/dashboard/seances.ts` a besoin (exceptions fondues,
 * « l'enseignant est-il absent »), sans recopier aucune regle : la fusion est
 * `fusionnerDecisions`, le chevauchement `absenceDeSeance` / `seancesTouchees`.
 *
 * Tout passe par le client de SESSION : la RLS rend les absences de l'ecole a
 * l'encadrement, ses propres absences a l'enseignant.
 */

export async function chargerAbsencesFenetre(
  supabase: SupabaseClient,
  slotIds: string[],
  du: string,
  au: string,
) {
  const [absRes, decRes] = await Promise.all([
    supabase.from('absences_enseignants').select('id, teacher_id, debut, fin')
      .gte('fin', `${du}T00:00`).lte('debut', `${au}T23:59`),
    slotIds.length
      ? supabase.from('absences_enseignants_seances')
          .select('absence_id, schedule_slot_id, seance_date, decision, remplacant_profile_id')
          .in('schedule_slot_id', slotIds).gte('seance_date', du).lte('seance_date', au)
      : Promise.resolve({ data: [] }),
  ])
  const absences = (absRes.data ?? []) as AbsenceEnseignant[]
  const decisions = (decRes.data ?? []) as DecisionSeance[]

  // Noms des remplacants qui n'ont pas de fiche enseignant (secretaire, direction).
  const ids = [...new Set(decisions.map(d => d.remplacant_profile_id).filter((id): id is string => !!id))]
  const { data: profils } = ids.length
    ? await supabase.from('profiles').select('id, civilite, first_name, last_name').in('id', ids)
    : { data: [] }
  const nomParProfil = new Map(((profils ?? []) as { id: string; civilite: string | null; first_name: string; last_name: string }[])
    .map(p => [p.id, nomEnseignantCivilite(p)]))

  return {
    /** Le titulaire (ou celui qui assure) est-il absent sur cette seance ? */
    estAbsent: (teacherId: string | null, date: string, debut: string, fin: string) =>
      !!absenceDeSeance(absences, teacherId, date, debut, fin),
    /** Exceptions de l'EDT, decisions d'absence fondues (`profileId -> teachers.id`). */
    fusionner: <E extends { schedule_slot_id: string; exception_date: string; exception_type: string; override_teacher_id: string | null }>(
      exceptions: E[],
      enseignantDuProfil: (profileId: string) => string | null,
    ) => fusionnerDecisions(exceptions, decisions, enseignantDuProfil),
    /** Nom d'un remplacant (`profiles.id`), fiche enseignant ou non. */
    nomRemplacant: (profileId: string | null) => (profileId ? nomParProfil.get(profileId) ?? '' : ''),
  }
}

export interface AlerteAbsences {
  /** Absences pas encore finies (en cours ou a venir). */
  nbAbsences: number
  /** Leurs seances encore « a decider » (jours fermes et seances annulees de l'EDT ecartes). */
  nbADecider: number
}

/**
 * L'alerte des tableaux de bord de l'encadrement (decision du 28/10) : de la
 * saisie de l'absence a son dernier jour, et combien de ses seances attendent
 * une decision. `maintenant` : horodatage de Paris `AAAA-MM-JJTHH:MM`.
 */
export async function chargerAlerteAbsences(
  supabase: SupabaseClient,
  slots: CreneauSource[],
  titulaireDe: TitulaireDe,
  estFerme: (date: string) => boolean,
  maintenant: string,
): Promise<AlerteAbsences | null> {
  const { data: absRes, error } = await supabase
    .from('absences_enseignants').select('id, teacher_id, debut, fin').gte('fin', maintenant)
  if (error) return null
  const absences = (absRes ?? []) as AbsenceEnseignant[]
  if (absences.length === 0) return { nbAbsences: 0, nbADecider: 0 }

  const du = absences.reduce((m, a) => (a.debut < m ? a.debut : m), absences[0].debut).slice(0, 10)
  const au = absences.reduce((m, a) => (a.fin > m ? a.fin : m), absences[0].fin).slice(0, 10)
  const slotIds = slots.map(s => s.id)
  const [decRes, exRes] = await Promise.all([
    supabase.from('absences_enseignants_seances').select('schedule_slot_id, seance_date').in('absence_id', absences.map(a => a.id)),
    slotIds.length
      ? supabase.from('schedule_exceptions').select('schedule_slot_id, exception_date, exception_type, override_teacher_id')
          .in('schedule_slot_id', slotIds).eq('exception_type', 'cancelled').gte('exception_date', du).lte('exception_date', au)
      : Promise.resolve({ data: [] }),
  ])
  const decidees = new Set(((decRes.data ?? []) as { schedule_slot_id: string; seance_date: string }[])
    .map(d => `${d.schedule_slot_id}|${String(d.seance_date).slice(0, 10)}`))
  const exceptions = (exRes.data ?? []) as { schedule_slot_id: string; exception_date: string; exception_type: string; override_teacher_id: string | null }[]

  let nbADecider = 0
  for (const a of absences) {
    for (const s of seancesTouchees({ ...a, teacherId: a.teacher_id }, slots, exceptions, titulaireDe, estFerme)) {
      if (!decidees.has(`${s.slotId}|${s.date}`)) nbADecider++
    }
  }
  return { nbAbsences: absences.length, nbADecider }
}
