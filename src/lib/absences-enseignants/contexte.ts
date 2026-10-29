import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import type { VacationPeriod, JourFerie } from '@/types/database'
import { estJourFerme } from '@/lib/school-year/jours-fermes'
import { affectationsDesClasses, indexTitulaires } from '@/lib/edt/seance'
import { seancesTouchees, type PeriodeAbsence, type SeanceTouchee } from '@/lib/edt/absences'
import { seancesManquees } from './seances-manquees'
import { nomEnseignant, nomEnseignantCivilite, nomInitialeEnseignant } from '@/lib/teachers/nom'
import { libelleMotif, type Decision } from './libelles'

/**
 * Ce qu'il faut pour savoir quelles seances une absence touche, lu une fois
 * par page (liste et fiche des absences) : creneaux de l'annee en cours,
 * annulations de l'EDT, titulaires dates, jours fermes. Rien n'est recalcule
 * ici : `seancesTouchees` (lib/edt/absences.ts) decide.
 */
export async function chargerContexteSeances(supabase: SupabaseClient<Database>) {
  const { data: annee } = await supabase
    .from('school_years')
    .select('id, label, start_date, end_date, vacations, jours_feries')
    .eq('is_current', true)
    .maybeSingle()

  const { data: slots } = annee
    ? await supabase
        .from('schedule_slots')
        .select('id, class_id, day_of_week, start_time, end_time, slot_type, is_recurring, slot_date, effective_from, effective_until, is_active')
        .eq('school_year_id', annee.id)
        .eq('is_active', true)
    : { data: [] }

  const { data: exceptions } = slots?.length
    ? await supabase
        .from('schedule_exceptions')
        .select('schedule_slot_id, exception_date, exception_type')
        .in('schedule_slot_id', slots.map(s => s.id))
    : { data: [] }

  const { data: classes } = annee
    ? await supabase
        .from('classes')
        .select('id, name, class_teachers(teacher_id, is_main_teacher, effective_from, effective_until)')
        .eq('academic_year', annee.label)
    : { data: [] }

  const titulaireDe = indexTitulaires(affectationsDesClasses(classes ?? []))
  const vacances = (annee?.vacations ?? []) as unknown as VacationPeriod[]
  const feries = (annee?.jours_feries ?? []) as unknown as JourFerie[]
  // Hors de l'annee scolaire, ou ferme : pas de seance.
  const estFerme = (date: string) =>
    !annee || (!!annee.start_date && date < annee.start_date) || (!!annee.end_date && date > annee.end_date)
    || estJourFerme(date, vacances, feries)

  const nomClasse = new Map((classes ?? []).map(c => [c.id, c.name]))

  return {
    nomClasse: (classId: string) => nomClasse.get(classId) ?? '·',
    seancesDe: (absence: PeriodeAbsence & { teacherId: string }): SeanceTouchee[] =>
      seancesTouchees(absence, slots ?? [], exceptions ?? [], titulaireDe, estFerme),
  }
}

/**
 * Les absences d'enseignant lisibles par le connecte (la RLS decide : tout
 * pour l'encadrement et le comptable, les siennes pour un enseignant), chacune
 * avec les seances qu'elle fait manquer et leur decision (lot 4). Source unique
 * de la liste des absences, de Temps de presence et de l'assiduite.
 */
export async function chargerAbsencesEtSeances(
  supabase: SupabaseClient<Database>,
  filtre: { teacherId?: string } = {},
) {
  let requete = supabase
    .from('absences_enseignants')
    .select('id, teacher_id, debut, fin, motif, teachers(civilite, first_name, last_name, user_id)')
    .order('debut', { ascending: false })
  if (filtre.teacherId) requete = requete.eq('teacher_id', filtre.teacherId)
  const { data: absences } = await requete

  const ids = (absences ?? []).map(a => a.id)
  const { data: decisions } = ids.length
    ? await supabase
        .from('absences_enseignants_seances')
        .select('absence_id, schedule_slot_id, seance_date, decision, remplacant_profile_id')
        .in('absence_id', ids)
    : { data: [] }

  const ctx = await chargerContexteSeances(supabase)

  return {
    ctx,
    absences: (absences ?? []).map(a => ({
      ...a,
      seances: seancesManquees(a.id, ctx.seancesDe({ debut: a.debut, fin: a.fin, teacherId: a.teacher_id }), decisions ?? []),
    })),
  }
}

/** Une seance manquee, telle que le calendrier de Temps de presence l'affiche. */
export interface SeanceInformation {
  date: string
  start: string
  end: string
  minutes: number
  classe: string
  decision: Decision
  /** `NOM Prenom` du remplacant. */
  remplacant: string | null
}

/** Toutes les dates : la liste et la fiche des absences ne sont pas bornees a une annee. */
export const TOUTES_DATES = { debut: '2000-01-01', fin: '2100-12-31' } as const

/** Une absence d'enseignant pour information (motif compris, decision du 29/10). */
export interface AbsenceInformation {
  id: string
  teacherId: string
  /** Compte de l'enseignant (`teachers.user_id`), pour les heures et le filtre par membre. */
  profileId: string | null
  /** `NOM Prenom`. */
  nom: string
  /** `NOM P.` */
  nomCourt: string
  /** `Civilite NOM Prenom`. */
  nomCivilite: string
  civilite: string | null
  /** Libelle du motif (« Congé »...), visible de tout le personnel. */
  motif: string
  /** Cle du motif (`conge`...). */
  motifCle: string
  /** `AAAA-MM-JJTHH:MM`. */
  debut: string
  fin: string
  seances: SeanceInformation[]
}

/**
 * Les absences d'enseignant de la periode [`debut`, `fin`] (`AAAA-MM-JJ`), pour
 * TOUT le personnel (decision du 29/10), motif compris :
 * `absences_enseignants_information` (jamais aux parents). Seances touchees, decisions et
 * remplacants : memes sources que la page Absences enseignants.
 */
export async function chargerAbsencesInformation(
  supabase: SupabaseClient<Database>,
  debut: string,
  fin: string,
): Promise<AbsenceInformation[]> {
  const { data: absences } = await supabase.rpc('absences_enseignants_information', { p_debut: debut, p_fin: fin })
  if (!absences?.length) return []

  const { data: decisions } = await supabase
    .from('absences_enseignants_seances')
    .select('absence_id, schedule_slot_id, seance_date, decision, remplacant_profile_id')
    .in('absence_id', absences.map(a => a.id))

  const remplacantsIds = Array.from(new Set((decisions ?? []).map(d => d.remplacant_profile_id).filter((x): x is string => !!x)))
  const { data: remplacants } = remplacantsIds.length
    ? await supabase.from('profiles').select('id, first_name, last_name').in('id', remplacantsIds)
    : { data: [] }
  const nomRemplacant = new Map((remplacants ?? []).map(p => [p.id, `${p.last_name ?? ''} ${p.first_name ?? ''}`.trim()]))

  const ctx = await chargerContexteSeances(supabase)
  const horodatage = (h: string) => h.slice(0, 16).replace(' ', 'T')

  return absences.map(a => {
    const personne = { first_name: a.first_name, last_name: a.last_name, civilite: a.civilite }
    const seances = seancesManquees(
      a.id,
      ctx.seancesDe({ debut: a.debut, fin: a.fin, teacherId: a.teacher_id }),
      decisions ?? [],
    )
    return {
      id: a.id,
      teacherId: a.teacher_id,
      profileId: a.user_id,
      nom: nomEnseignant(personne),
      nomCourt: nomInitialeEnseignant(personne),
      nomCivilite: nomEnseignantCivilite(personne),
      civilite: a.civilite,
      motif: libelleMotif(a.motif),
      motifCle: a.motif,
      debut: horodatage(a.debut),
      fin: horodatage(a.fin),
      seances: seances.map(s => ({
        date: s.date,
        start: s.startTime.slice(0, 5),
        end: s.endTime.slice(0, 5),
        minutes: s.minutes,
        classe: ctx.nomClasse(s.classId),
        decision: s.decision,
        remplacant: s.remplacantProfileId ? (nomRemplacant.get(s.remplacantProfileId) ?? null) : null,
      })),
    }
  })
}
