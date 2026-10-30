// Scolarite adulte de la fiche foyer — LECTURE de la page, deplacee ici pour que
// `ParentDetail` et `ParentAdultHistory` tirent leurs types de cette requete
// (`ScolariteAdulte`) au lieu de les recopier (sortie des `any`, lot 5).

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import type { Parent } from '@/types/database'
import { titulaireActuel } from '@/lib/teachers/titulaire'

export type ScolariteAdulte = Awaited<ReturnType<typeof chargerScolariteAdulte>>[number]

const INSCRIPTIONS = 'tutor_number, class_id, status, enrollment_date, date_depart, classes!inner(id, name, level, day_of_week, start_time, end_time, academic_year, cotisation_types:cotisation_type_id(label, is_adult), class_teachers(is_main_teacher, effective_until, teachers(civilite, first_name, last_name)))' as const

const DAY_FR: Record<string, string> = {
  monday: 'Lundi', tuesday: 'Mardi', wednesday: 'Mercredi',
  thursday: 'Jeudi', friday: 'Vendredi', saturday: 'Samedi', sunday: 'Dimanche',
}

/**
 * Scolarité adulte de l'ANNÉE EN COURS, une entrée par tuteur inscrit.
 *
 * Un adulte inscrit n'est pas un `student` : sa classe vit dans
 * `parent_class_enrollments`, ses notes dans `adult_grades`, ses bulletins dans
 * `adult_bulletin_archives` et son assiduité dans `adult_absences`. On produit ici
 * EXACTEMENT la structure de l'onglet Scolarité de l'apprenant — informations de
 * classe au niveau de l'année, puis une colonne par période — moins la discipline,
 * qui n'a pas d'équivalent adulte (décision du 9 août).
 */
export async function chargerScolariteAdulte(
  supabase: SupabaseClient<Database>,
  parentId: string,
  parent: Pick<Parent, 'tutor1_last_name' | 'tutor1_first_name' | 'tutor2_last_name' | 'tutor2_first_name'>,
  peutDeclarer = false,
) {
  const { data: year } = await supabase
    .from('school_years').select('id, label, start_date, end_date, periods(id, label, order_index)')
    .eq('is_current', true).maybeSingle()
  if (!year) return []

  const periods = [...year.periods].sort((a, b) => a.order_index - b.order_index)

  const { data: enr } = await supabase
    .from('parent_class_enrollments')
    .select(INSCRIPTIONS)
    .eq('parent_id', parentId).in('status', ['active', 'withdrawn'])
    .eq('classes.academic_year', year.label)

  const inscriptions = (enr ?? []).filter(e => e.classes.cotisation_types?.is_adult)
  if (inscriptions.length === 0) return []

  // UNE seule source : le bulletin archivé, qui porte ses propres chiffres.
  // Les requêtes `evaluations`, `grades` et `adult_absences` qui servaient à les
  // recalculer ont disparu — un document publié n'a pas à être reconstitué.
  const { data: bulletins } = await supabase
    .from('adult_bulletin_archives')
    .select('tutor_number, class_id, period_id, file_path, moyenne_generale, absences_count, absences_unjustified, retards_count')
    .eq('parent_id', parentId)

  // Le depart n'est possible qu'avec des donnees (notes, bulletins) : sinon le
  // retrait se fait dans Affectations (meme regle que la base).
  const aDonnees = new Map<string, boolean>()
  if (peutDeclarer) {
    for (const e of inscriptions.filter(x => x.status === 'active')) {
      const { data } = await supabase.rpc('fn_adulte_a_donnees', { p_parent_id: parentId, p_tutor_number: e.tutor_number, p_class_id: e.class_id })
      aDonnees.set(`${e.tutor_number}:${e.class_id}`, !!data)
    }
  }

  return inscriptions.map(e => {
    const t2 = e.tutor_number === 2
    const c  = e.classes

    const mesBull = (bulletins ?? []).filter(b => b.tutor_number === e.tutor_number && b.class_id === e.class_id)

    const colonnes = periods.map(p => {
      const a = mesBull.find(b => b.period_id === p.id)
      return {
        id:    p.id,
        label: p.label,
        // `null` = periode NON ARCHIVEE, ce qui ne se lit pas comme « zero » :
        // la carte affiche « Non archive » plutot qu'un chiffre invente.
        avg:     a ? (a.moyenne_generale != null ? Number(a.moyenne_generale) : null) : null,
        archive: !!a,
        bulletinPath: a?.file_path ?? null,
        abs:     a?.absences_count ?? 0,
        absNJ:   a?.absences_unjustified ?? 0,
        retards: a?.retards_count ?? 0,
      }
    })

    // Annee en cours (temps reel) : le titulaire en poste, jamais un ancien.
    const titulaire = titulaireActuel(c.class_teachers)?.teachers ?? null

    return {
      key: `${parentId}-${e.tutor_number}`,
      year_label: year.label,
      status: e.status,
      last_name:  t2 ? parent.tutor2_last_name  : parent.tutor1_last_name,
      first_name: t2 ? parent.tutor2_first_name : parent.tutor1_first_name,
      tutor_number: e.tutor_number,
      class_name: c.name ?? null,
      level: c.level ?? null,
      cotisation_label: c.cotisation_types?.label ?? null,
      // NOM avant prénom, règle du projet.
      teacher_name: titulaire
        ? [titulaire.civilite, titulaire.last_name, titulaire.first_name].filter(Boolean).join(' ')
        : null,
      schedule: c.day_of_week && c.start_time
        ? `${DAY_FR[c.day_of_week] ?? c.day_of_week} ${c.start_time.slice(0, 5)}-${(c.end_time ?? '').slice(0, 5)}`
        : null,
      enrollment_date: e.enrollment_date,
      date_depart: e.date_depart ?? null,
      class_id: e.class_id,
      // `null` : aucun bouton (role, ou deja parti) ; sinon actif / grise.
      peutPartir: peutDeclarer && e.status === 'active' ? aDonnees.get(`${e.tutor_number}:${e.class_id}`) ?? false : null,
      rentree: year.start_date ?? null,
      fin: year.end_date ?? null,
      periods: colonnes,
    }
  })
}
