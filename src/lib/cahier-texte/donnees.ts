// Donnees du cahier de texte — LECTURES de la page, deplacees ici pour que
// `CahierTexteClient` et ses fenetres tirent leurs types de ces requetes
// (`DonneesCahierTexte`) au lieu de les recopier (sortie des `any`, lot 6).

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import { horodatageParis } from '@/lib/dates'

export type DonneesCahierTexte = Awaited<ReturnType<typeof chargerCahierTexte>>
export type ClasseCahier = DonneesCahierTexte['classes'][number]
export type SeanceCahier = DonneesCahierTexte['journalEntries'][number]
export type DevoirCahier = DonneesCahierTexte['homeworkEntries'][number]

// `effective_until` : le titulaire propose comme auteur est celui EN POSTE
// (`titulaireActuel`), jamais un ancien.
const CLASSE = 'id, name, level, day_of_week, start_time, end_time, class_teachers(is_main_teacher, effective_until, subject, teachers(id, civilite, first_name, last_name)), cotisation_types(label, is_adult)' as const
const SEANCE = '*, teachers:teacher_id(first_name, last_name, civilite), classes:class_id(name, level, day_of_week, start_time, end_time, cotisation_types(label))' as const
const DEVOIR = '*, teachers:teacher_id(first_name, last_name, civilite), classes:class_id(name, level, day_of_week, start_time, end_time, cotisation_types(label))' as const

const ENCADREMENT = ['admin', 'direction', 'responsable_pedagogique']

/** Jour de Paris decale de `jours` (chaine AAAA-MM-JJ, jamais `toISOString`). */
function jourParisDecale(jours: number): string {
  const [y, m, d] = horodatageParis(new Date()).slice(0, 10).split('-').map(Number)
  const x = new Date(y, m - 1, d + jours)
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
}

export async function chargerCahierTexte(
  supabase: SupabaseClient<Database>,
  userId: string,
  role: string,
) {
  // Année scolaire courante
  const { data: schoolYear } = await supabase
    .from('school_years')
    .select('id, label')
    .eq('is_current', true)
    .single()
  const yearLabel = schoolYear?.label ?? null

  // Fiche enseignant du connecte + ses affectations
  const { data: teacher } = await supabase
    .from('teachers')
    .select('id, civilite, first_name, last_name')
    .eq('user_id', userId)
    .single()

  const { data: assignments } = teacher
    ? await supabase
        .from('class_teachers')
        .select('class_id, is_main_teacher, subject, effective_from, effective_until')
        .eq('teacher_id', teacher.id)
    : { data: [] }
  const teacherAssignments = assignments ?? []

  // Fenêtre de LECTURE (Phase B) : classes où je suis affecté, avec préparation 7 j
  // avant le début (effective_from − 7 j <= aujourd'hui <= effective_until). Aligné sur la RLS.
  const aujourdhui = jourParisDecale(0)
  const dansSept   = jourParisDecale(7)
  const inReadWindow = (a: { effective_from: string | null; effective_until: string | null }) =>
    (!a.effective_from || a.effective_from <= dansSept) &&
    (!a.effective_until || a.effective_until >= aujourdhui)

  // Classes selon le rôle
  const lireClasses = async (ids?: string[]) => {
    let q = supabase.from('classes').select(CLASSE).order('name')
    if (ids) q = q.in('id', ids)
    else if (yearLabel) q = q.eq('academic_year', yearLabel)
    return (await q).data ?? []
  }
  let classIds: string[] = []
  let classes: Awaited<ReturnType<typeof lireClasses>> = []

  if (ENCADREMENT.includes(role)) {
    classes = await lireClasses()
    classIds = classes.map(c => c.id)

  } else if (role === 'enseignant' && teacher) {
    // Classes ou il REMPLACE une seance (absence d'un collegue, lot 3) : de 7 jours
    // avant la seance a 7 jours apres, comme la RLS (`fn_remplace_classe`).
    const { data: remplacements } = await supabase
      .from('absences_enseignants_seances')
      .select('schedule_slots!inner(class_id)')
      .eq('decision', 'remplacee')
      .eq('remplacant_profile_id', userId)
      .gte('seance_date', jourParisDecale(-7))
      .lte('seance_date', jourParisDecale(7))
    const classesRemplacees = (remplacements ?? []).map(r => r.schedule_slots.class_id)

    classIds = [...new Set([...teacherAssignments.filter(inReadWindow).map(a => a.class_id), ...classesRemplacees])]
    if (classIds.length) classes = await lireClasses(classIds)

  } else if (role === 'parent') {
    const { data: parentLink } = await supabase
      .from('parents')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle()

    if (parentLink) {
      const { data: studentEnrollments } = await supabase
        .from('students')
        .select('enrollments!inner(class_id)')
        .eq('parent_id', parentLink.id)
        .eq('is_active', true)
        .eq('enrollments.status', 'active')

      classIds = [...new Set((studentEnrollments ?? []).flatMap(s => s.enrollments.map(e => e.class_id)))]
      if (classIds.length > 0) classes = await lireClasses(classIds)
    }
  }

  // Séances et devoirs des classes lisibles
  const [{ data: journalEntries }, { data: homeworkEntries }] = classIds.length > 0
    ? await Promise.all([
        supabase.from('class_journal').select(SEANCE).in('class_id', classIds)
          .order('session_date', { ascending: false }).limit(100),
        supabase.from('homework').select(DEVOIR).in('class_id', classIds)
          .order('due_date', { ascending: false }).limit(100),
      ])
    : [{ data: [] }, { data: [] }]

  // Enseignants et affectations, pour le formulaire de création de l'encadrement
  const [{ data: allTeachers }, { data: allAssignments }] = ENCADREMENT.includes(role)
    ? await Promise.all([
        supabase.from('teachers').select('id, first_name, last_name').eq('is_active', true).order('last_name'),
        classIds.length > 0
          ? supabase.from('class_teachers').select('class_id, teacher_id, is_main_teacher, subject').in('class_id', classIds)
          : Promise.resolve({ data: [] }),
      ])
    : [{ data: [] }, { data: [] }]

  return {
    teacher,
    teacherAssignments,
    classes,
    journalEntries:  journalEntries ?? [],
    homeworkEntries: homeworkEntries ?? [],
    allTeachers:     allTeachers ?? [],
    allAssignments:  allAssignments ?? [],
  }
}
