// Donnees de la fiche apprenant — LECTURES de la page, deplacees ici pour que
// `StudentDetail` tire ses types de ces requetes (`FicheEleve`) au lieu de les
// recopier (sortie des `any`, lot 5). Rien n'est calcule ici hormis le contexte
// de « Declarer un depart », qui depend des memes lectures.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import { LIBELLES_REGLE, REGLE_PAR_DEFAUT, type RegleAjustement } from '@/lib/financements/compute'

export type FicheEleve = NonNullable<Awaited<ReturnType<typeof chargerFicheEleve>>>

/** Contexte de « Declarer un depart » (onglet Scolarite). */
export interface ContexteDepart {
  classe: string
  /** Notes, absences ou bulletins : le retrait est bloque, le depart possible. */
  aDonnees: boolean
  /** Libelle de la regle de l'etablissement (« Au prorata »...). */
  regle: string
  rentree: string | null
  fin: string | null
  /** Periodes terminees sans bulletin archive (avertissement non bloquant). */
  bulletinsManquants: string[]
}

/** Foyers proposes au rattachement (fiche et creation d'un apprenant). */
export const SELECTION_PARENTS = 'id, tutor1_last_name, tutor1_first_name, tutor1_relationship, tutor1_address, tutor1_city, tutor1_postal_code, tutor1_phone, tutor1_email, tutor2_last_name, tutor2_first_name, tutor2_relationship, tutor2_address, tutor2_city, tutor2_postal_code, tutor2_phone, tutor2_email' as const
const INSCRIPTIONS = 'id, class_id, enrollment_date, status, date_depart, classes(id, name, level, academic_year, day_of_week, start_time, end_time, cotisation_types(label))' as const
const FRATRIE = 'id, last_name, first_name, gender, date_of_birth, is_active, enrollments(class_id, status, classes(id, name, academic_year, day_of_week, start_time, end_time))' as const
const AVERTISSEMENTS = 'id, class_id, period_id, warning_date, severity, motif, issued_by, created_at, student_warning_attachments(id, file_url, file_name)' as const

/** `null` si l'apprenant n'existe pas (ou n'est pas lisible pour ce role). */
export async function chargerFicheEleve(
  supabase: SupabaseClient<Database>,
  id: string,
  lectureSeule: boolean,
) {
  // Donnees identite + parents
  const [{ data: student }, { data: parents }] = await Promise.all([
    supabase.from('students').select('*').eq('id', id).single(),
    supabase
      .from('parents')
      .select(SELECTION_PARENTS)
      .order('tutor1_last_name')
      .order('tutor1_first_name'),
  ])
  if (!student) return null

  // Donnees scolarite : inscriptions avec classe + annee scolaire
  const { data: enrollments } = await supabase
    .from('enrollments')
    .select(INSCRIPTIONS)
    .eq('student_id', id)
    .order('enrollment_date', { ascending: false })

  // Freres / soeurs (meme parent_id)
  const { data: siblings } = student.parent_id
    ? await supabase
        .from('students')
        .select(FRATRIE)
        .eq('parent_id', student.parent_id)
        .neq('id', id)
        .order('date_of_birth')
    : { data: [] }

  // Classes de l'eleve et de ses freres et soeurs, pour les requetes suivantes
  const classIds = (enrollments ?? []).map(e => e.class_id)
  const siblingClassIds = (siblings ?? []).flatMap(s => s.enrollments.map(e => e.class_id))
  const allClassIds = [...new Set([...classIds, ...siblingClassIds])]

  // Titulaires de chaque classe, AVEC leurs dates d'effet : l'ecran en temps reel
  // nomme le titulaire en poste (`titulaireActuel`), l'historique des annees
  // passees « initial puis remplacant » (`libelleTitulaires`, decision du 30/10).
  const { data: mainTeachers } = allClassIds.length > 0
    ? await supabase
        .from('class_teachers')
        .select('class_id, is_main_teacher, effective_from, effective_until, teachers(civilite, first_name, last_name)')
        .eq('is_main_teacher', true)
        .in('class_id', allClassIds)
    : { data: [] }

  // Periodes (onglets Scolarite et Discipline).
  //
  // Les requetes `evaluations`, `grades` et `absences` qui vivaient ici ont ete
  // SUPPRIMEES : elles ne servaient qu'a recalculer la moyenne et l'assiduite de
  // l'onglet Scolarite, que le bulletin archive porte desormais lui-meme. Trois
  // tables interrogees en moins, et plus aucun risque de voir l'ecran annoncer
  // un chiffre different de celui recu par la famille.
  const { data: periods } = await supabase
    .from('periods')
    .select('id, label, order_index, is_current, school_years(label)')
    .order('order_index')

  // Absences detaillees (onglet Discipline)
  const { data: absencesFull } = classIds.length > 0
    ? await supabase
        .from('absences')
        .select('id, class_id, period_id, absence_date, absence_type, comment, is_justified')
        .eq('student_id', id)
        .order('absence_date', { ascending: false })
    : { data: [] }

  // Avertissements (onglet Discipline)
  const { data: warnings } = classIds.length > 0
    ? await supabase
        .from('student_warnings')
        .select(AVERTISSEMENTS)
        .eq('student_id', id)
        .order('warning_date', { ascending: false })
    : { data: [] }

  // Bulletins archives
  const { data: bulletinArchives } = await supabase
    .from('bulletin_archives')
    .select('class_id, period_id, file_path, moyenne_generale, absences_count, absences_unjustified, retards_count')
    .eq('student_id', id)

  // Annee scolaire en cours (pour filtrer l'onglet Discipline)
  const { data: currentYear } = await supabase
    .from('school_years')
    .select('label, start_date, end_date')
    .eq('is_current', true)
    .single()
  const currentYearLabel = currentYear?.label ?? ''

  // « Declarer un depart » : seulement pour un eleve affecte cette annee, et
  // seulement s'il a des donnees qui bloquent son retrait (meme regle que la
  // base, `fn_eleve_a_donnees`). Sans donnees, le retrait se fait dans
  // Affectations : le bouton est alors grise.
  const enCours = (enrollments ?? []).find(e => e.status === 'active' && e.classes?.academic_year === currentYearLabel)
  let depart: ContexteDepart | null = null
  if (enCours && !lectureSeule && currentYear) {
    const [{ data: aDonnees }, { data: etab }] = await Promise.all([
      supabase.rpc('fn_eleve_a_donnees', { p_student_id: id, p_class_id: enCours.class_id }),
      supabase.from('etablissements').select('regle_ajustement').maybeSingle(),
    ])
    // Periodes TERMINEES (avant la periode en cours) sans bulletin archive :
    // l'avertissement de la fenetre, non bloquant (decision du 26/10).
    const periodesAnnee = (periods ?? []).filter(p => p.school_years?.label === currentYearLabel)
    const rangCourant = periodesAnnee.find(p => p.is_current)?.order_index ?? -1
    const archivees = new Set((bulletinArchives ?? []).filter(b => b.class_id === enCours.class_id).map(b => b.period_id))
    depart = {
      classe:     enCours.classes?.name ?? '',
      aDonnees:   !!aDonnees,
      regle:      LIBELLES_REGLE[(etab?.regle_ajustement ?? REGLE_PAR_DEFAUT) as RegleAjustement],
      rentree:    currentYear.start_date,
      fin:        currentYear.end_date,
      bulletinsManquants: periodesAnnee
        .filter(p => p.order_index < rangCourant && !archivees.has(p.id))
        .sort((a, b) => a.order_index - b.order_index)
        .map(p => p.label),
    }
  }

  // Documents administratifs (onglet Documents) et historique archive
  // (instantanes de cloture d'annee), plus recent en premier.
  const [{ data: docTypeConfigs }, { data: studentDocuments }, { data: history }] = await Promise.all([
    supabase.from('document_type_configs').select('id, category, doc_key, label, is_required, order_index').order('order_index'),
    supabase.from('student_documents').select('id, doc_type_key, category, file_url, file_name, expires_at, created_at').eq('student_id', id),
    supabase.from('student_year_history').select('*').eq('student_id', id).order('year_label', { ascending: false }),
  ])

  return {
    student,
    parents:          parents ?? [],
    enrollments:      enrollments ?? [],
    siblings:         siblings ?? [],
    mainTeachers:     mainTeachers ?? [],
    periods:          periods ?? [],
    absencesFull:     absencesFull ?? [],
    studentWarnings:  (warnings ?? []).map(({ student_warning_attachments, ...w }) => ({ ...w, attachments: student_warning_attachments })),
    bulletinArchives: bulletinArchives ?? [],
    currentYearLabel,
    depart,
    docTypeConfigs:   docTypeConfigs ?? [],
    studentDocuments: studentDocuments ?? [],
    history:          history ?? [],
  }
}
