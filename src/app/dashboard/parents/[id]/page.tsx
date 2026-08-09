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
      />

    </div>
  )
}

/**
 * Scolarité adulte de l'ANNÉE EN COURS, une entrée par tuteur inscrit.
 *
 * Un adulte inscrit n'est pas un `student` : sa classe vit dans
 * `parent_class_enrollments`, ses notes dans `adult_grades`, ses bulletins dans
 * `adult_bulletin_archives` et son assiduité dans `adult_absences`. On rassemble
 * ici ce que la fiche élève affiche dans son onglet Scolarité — moins la
 * discipline, qui n'a pas d'équivalent pour un adulte (décision du 9 août).
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
    .select('tutor_number, class_id, classes!inner(id, name, level, day_of_week, start_time, end_time, academic_year, cotisation_types:cotisation_type_id(label, is_adult), class_teachers(is_main_teacher, teachers(civilite, first_name, last_name)))')
    .eq('parent_id', parentId).eq('status', 'active')
    .eq('classes.academic_year', year.label)

  const inscriptions = (enr ?? []).filter((e: any) => e.classes?.cotisation_types?.is_adult)
  if (inscriptions.length === 0) return []

  const classIds = inscriptions.map((e: any) => e.class_id)

  const [{ data: evals }, { data: grades }, { data: bulletins }, { data: absences }] = await Promise.all([
    periodIds.length
      ? supabase.from('evaluations').select('id, title, class_id, period_id').in('class_id', classIds).in('period_id', periodIds)
      : Promise.resolve({ data: [] }),
    supabase.from('adult_grades').select('evaluation_id, tutor_number, score, is_absent').eq('parent_id', parentId),
    supabase.from('adult_bulletin_archives').select('id, tutor_number, class_id, period_id, file_path').eq('parent_id', parentId),
    periodIds.length
      ? supabase.from('adult_absences').select('tutor_number, absence_type, is_justified').eq('parent_id', parentId).in('period_id', periodIds)
      : Promise.resolve({ data: [] }),
  ])

  const evalById   = new Map<string, any>((evals ?? []).map((e: any) => [e.id, e]))
  const periodById = new Map(periods.map((p: any) => [p.id, p.label]))

  return inscriptions.map((e: any) => {
    const t2 = e.tutor_number === 2
    const c  = e.classes
    const mine = (rows: any[]) => rows.filter(r => r.tutor_number === e.tutor_number)

    // Notes de CE tuteur, regroupées par période dans l'ordre de l'année.
    const mesNotes = mine(grades ?? []).filter((g: any) => evalById.has(g.evaluation_id))
    const parPeriode = periods
      .map((p: any) => ({
        period_label: p.label,
        items: mesNotes
          .filter((g: any) => evalById.get(g.evaluation_id).period_id === p.id)
          .map((g: any) => ({ title: evalById.get(g.evaluation_id).title, score: g.score, is_absent: !!g.is_absent })),
      }))
      .filter((p: any) => p.items.length > 0)

    // Moyenne des notes SAISIES, absences exclues. Libellé volontairement
    // distinct de la « moyenne générale » des archives, qui est pondérée : deux
    // calculs différents ne doivent pas porter le même nom.
    const chiffrees = mesNotes.filter((g: any) => !g.is_absent && g.score != null)
    const moyenne = chiffrees.length > 0
      ? chiffrees.reduce((s: number, g: any) => s + Number(g.score), 0) / chiffrees.length
      : null

    const mesAbs = mine(absences ?? [])
    const titulaire = (c.class_teachers ?? []).find((ct: any) => ct.is_main_teacher)?.teachers ?? null

    return {
      key: `${parentId}-${e.tutor_number}`,
      year_label: year.label,
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
      moyenne,
      absences_justified:   mesAbs.filter((a: any) => a.absence_type === 'absence' && a.is_justified).length,
      absences_unjustified: mesAbs.filter((a: any) => a.absence_type === 'absence' && !a.is_justified).length,
      retards:              mesAbs.filter((a: any) => a.absence_type === 'retard').length,
      bulletin_refs: mine(bulletins ?? [])
        .filter((b: any) => b.class_id === e.class_id)
        .map((b: any) => ({ period_label: periodById.get(b.period_id) ?? '·', archive_id: b.id, file_path: b.file_path }))
        .filter((b: any) => b.file_path),
      grades: parPeriode,
    }
  })
}

const DAY_FR: Record<string, string> = {
  monday: 'Lundi', tuesday: 'Mardi', wednesday: 'Mercredi',
  thursday: 'Jeudi', friday: 'Vendredi', saturday: 'Samedi', sunday: 'Dimanche',
}
