import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import type { VacationPeriod, JourFerie } from '@/types/database'
import { estJourFerme } from '@/lib/school-year/jours-fermes'
import { affectationsDesClasses, indexTitulaires } from '@/lib/edt/seance'
import { seancesTouchees, type PeriodeAbsence, type SeanceTouchee } from '@/lib/edt/absences'

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
        .select('schedule_slot_id, exception_date, exception_type, override_teacher_id')
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
