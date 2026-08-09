import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import ParentDetail from '@/components/parents/ParentDetail'

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditParentPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const { data: parent } = await supabase
    .from('parents')
    .select('*')
    .eq('id', id)
    .single()

  if (!parent) notFound()

  // Tuteurs inscrits a une classe adulte → la case « Inscrit aux cours adultes »
  // est grisee (on ne peut pas la decocher tant qu'inscrit).
  const { data: adultEnr } = await supabase
    .from('parent_class_enrollments')
    .select('tutor_number, classes!inner(cotisation_types:cotisation_type_id(is_adult))')
    .eq('parent_id', id).eq('status', 'active')
  const enrolledTutors = new Set(
    (adultEnr ?? []).filter((r: any) => r.classes?.cotisation_types?.is_adult).map((r: any) => r.tutor_number)
  )

  // Historique « scolarité adulte » (snapshots de clôture), plus récent en premier.
  const { data: adultHistory } = await supabase
    .from('student_year_history')
    .select('*')
    .eq('parent_id', id)
    .eq('participant_type', 'adult')
    .order('year_label', { ascending: false })

  // ── ANNÉE EN COURS ──
  // L'onglet ne montrait que les ARCHIVES : un adulte inscrit cette année y lisait
  // « aucun cours archivé », alors que sa classe, ses notes et son assiduité
  // existent bel et bien. On construit donc la scolarité VIVANTE, une carte par
  // tuteur inscrit — un foyer peut en compter deux.
  const adultCurrent = await buildAdultCurrent(supabase, id, parent)

  // Tuteurs INSCRITS aux cours adultes mais AFFECTÉS À AUCUNE classe. Le cas est
  // exactement celui de l'apprenant sans classe, et il se nomme : un foyer peut
  // compter deux tuteurs, dont un seul concerné.
  const affectes = new Set(adultCurrent.map((c: any) => c.tutor_number))
  const adultsNonAffectes = [
    parent.tutor1_adult_courses && !affectes.has(1)
      ? { tutor_number: 1, last_name: parent.tutor1_last_name, first_name: parent.tutor1_first_name }
      : null,
    parent.tutor2_adult_courses && !affectes.has(2) && parent.tutor2_last_name
      ? { tutor_number: 2, last_name: parent.tutor2_last_name, first_name: parent.tutor2_first_name }
      : null,
  ].filter(Boolean) as { tutor_number: number; last_name: string; first_name: string }[]

  return (
    <div className="space-y-6 animate-fade-in">

      <Link
        href="/dashboard/parents"
        className="inline-flex items-center gap-1.5 text-sm text-warm-700 hover:text-secondary-700 transition-colors"
      >
        <ChevronLeft size={15} />
        Retour à la liste
      </Link>

      <ParentDetail
        parent={parent}
        tutor1AdultEnrolled={enrolledTutors.has(1)}
        tutor2AdultEnrolled={enrolledTutors.has(2)}
        adultHistory={(adultHistory ?? []) as any[]}
        adultCurrent={adultCurrent}
        adultsNonAffectes={adultsNonAffectes}
      />

    </div>
  )
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
async function buildAdultCurrent(supabase: any, parentId: string, parent: any) {
  const { data: year } = await supabase
    .from('school_years').select('id, label, periods(id, label, order_index)')
    .eq('is_current', true).maybeSingle()
  if (!year) return []

  const periods = (year.periods ?? []).sort((a: any, b: any) => a.order_index - b.order_index)
  const periodIds = periods.map((p: any) => p.id)

  const { data: enr } = await supabase
    .from('parent_class_enrollments')
    .select('tutor_number, class_id, status, enrollment_date, classes!inner(id, name, level, day_of_week, start_time, end_time, academic_year, cotisation_types:cotisation_type_id(label, is_adult), class_teachers(is_main_teacher, teachers(civilite, first_name, last_name)))')
    .eq('parent_id', parentId).eq('status', 'active')
    .eq('classes.academic_year', year.label)

  const inscriptions = (enr ?? []).filter((e: any) => e.classes?.cotisation_types?.is_adult)
  if (inscriptions.length === 0) return []

  const classIds = inscriptions.map((e: any) => e.class_id)

  // UNE seule source : le bulletin archivé, qui porte ses propres chiffres.
  // Les requêtes `evaluations`, `grades` et `adult_absences` qui servaient à les
  // recalculer ont disparu — un document publié n'a pas à être reconstitué.
  const { data: bulletins } = await supabase
    .from('adult_bulletin_archives')
    .select('tutor_number, class_id, period_id, file_path, moyenne_generale, absences_count, absences_unjustified, retards_count')
    .eq('parent_id', parentId)

  return inscriptions.map((e: any) => {
    const t2 = e.tutor_number === 2
    const c  = e.classes
    const mien = (rows: any[]) => rows.filter(r => r.tutor_number === e.tutor_number)

    const mesBull = mien(bulletins ?? []).filter((b: any) => b.class_id === e.class_id)

    const colonnes = periods.map((p: any) => {
      const a = mesBull.find((b: any) => b.period_id === p.id)
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

    const titulaire = (c.class_teachers ?? []).find((ct: any) => ct.is_main_teacher)?.teachers ?? null

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
      periods: colonnes,
    }
  })
}

const DAY_FR: Record<string, string> = {
  monday: 'Lundi', tuesday: 'Mardi', wednesday: 'Mercredi',
  thursday: 'Jeudi', friday: 'Vendredi', saturday: 'Samedi', sunday: 'Dimanche',
}
