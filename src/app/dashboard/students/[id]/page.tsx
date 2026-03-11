import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import StudentDetail from '@/components/students/StudentDetail'

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ from?: string }>
}

const PARENTS_SELECT = [
  'id',
  'tutor1_last_name', 'tutor1_first_name', 'tutor1_relationship',
  'tutor1_address', 'tutor1_city', 'tutor1_postal_code', 'tutor1_phone', 'tutor1_email',
  'tutor2_last_name', 'tutor2_first_name', 'tutor2_relationship',
  'tutor2_address', 'tutor2_city', 'tutor2_postal_code', 'tutor2_phone', 'tutor2_email',
].join(', ')

export default async function EditStudentPage({ params, searchParams }: Props) {
  const { id } = await params
  const { from } = await searchParams
  const backHref  = from === 'parents' ? '/dashboard/parents' : '/dashboard/students'
  const backLabel = from === 'parents' ? 'Retour aux parents' : 'Retour à la liste'
  const supabase = await createClient()

  // Données identité + parents
  const [{ data: student }, { data: parents }] = await Promise.all([
    supabase.from('students').select('*').eq('id', id).single(),
    supabase
      .from('parents')
      .select(PARENTS_SELECT)
      .order('tutor1_last_name')
      .order('tutor1_first_name'),
  ])

  if (!student) notFound()

  // Données scolarité : inscriptions avec classe + année scolaire
  const { data: enrollments } = await supabase
    .from('enrollments')
    .select('id, class_id, enrollment_date, status, classes(id, name, level, academic_year, day_of_week, start_time, end_time)')
    .eq('student_id', id)
    .order('enrollment_date', { ascending: false })

  // Frères / Sœurs (même parent_id)
  let siblings: any[] = []
  if (student.parent_id) {
    const { data } = await supabase
      .from('students')
      .select('id, last_name, first_name, gender, date_of_birth, enrollments(class_id, classes(id, name, day_of_week, start_time, end_time))')
      .eq('parent_id', student.parent_id)
      .neq('id', id)
      .eq('is_active', true)
      .order('date_of_birth')
    siblings = (data ?? []) as any[]
  }

  // Récupérer les class_ids (élève + frères/sœurs) pour les requêtes suivantes
  const classIds = (enrollments ?? []).map((e: any) => e.class_id)
  const siblingClassIds = siblings.flatMap((s: any) => s.enrollments?.map((e: any) => e.class_id) ?? [])
  const allClassIds = [...new Set([...classIds, ...siblingClassIds])]

  // Professeur principal de chaque classe
  type CTRow = { class_id: string; teachers: { civilite: string | null; first_name: string; last_name: string } | null }
  let mainTeachers: CTRow[] = []
  if (allClassIds.length > 0) {
    const { data } = await supabase
      .from('class_teachers')
      .select('class_id, teachers(civilite, first_name, last_name)')
      .eq('is_main_teacher', true)
      .in('class_id', allClassIds) as { data: CTRow[] | null }
    mainTeachers = data ?? []
  }

  // Évaluations + notes + périodes pour ces classes
  const [evalResult, gradeResult, periodResult] = classIds.length > 0
    ? await Promise.all([
        supabase
          .from('evaluations')
          .select('id, class_id, period_id, cours_id, eval_kind, max_score, coefficient, cours(nom_fr)')
          .in('class_id', classIds)
          .not('cours_id', 'is', null),
        supabase
          .from('grades')
          .select('id, evaluation_id, score, is_absent, comment')
          .eq('student_id', id),
        supabase
          .from('periods')
          .select('id, label, order_index, school_years(label)')
          .order('order_index'),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }]

  // Absences résumé (pour onglet Scolarité)
  const { data: absences } = classIds.length > 0
    ? await supabase
        .from('absences')
        .select('class_id, period_id, absence_type, is_justified')
        .eq('student_id', id)
    : { data: [] }

  // Absences détaillées (pour onglet Discipline)
  const { data: absencesFull } = classIds.length > 0
    ? await supabase
        .from('absences')
        .select('id, class_id, period_id, absence_date, absence_type, comment, is_justified')
        .eq('student_id', id)
        .order('absence_date', { ascending: false })
    : { data: [] }

  // Avertissements (pour onglet Discipline)
  type WarningRow = {
    id: string; class_id: string; period_id: string; warning_date: string
    severity: string; motif: string; issued_by: string | null; created_at: string
    student_warning_attachments: { id: string; file_url: string; file_name: string }[]
  }
  let studentWarnings: WarningRow[] = []
  if (classIds.length > 0) {
    const { data } = await supabase
      .from('student_warnings')
      .select('id, class_id, period_id, warning_date, severity, motif, issued_by, created_at, student_warning_attachments(id, file_url, file_name)')
      .eq('student_id', id)
      .order('warning_date', { ascending: false })
    studentWarnings = (data ?? []) as WarningRow[]
  }

  // Bulletins archivés
  const { data: bulletinArchives } = await supabase
    .from('bulletin_archives')
    .select('class_id, period_id, file_url')
    .eq('student_id', id)

  // Documents administratifs (onglet Documents)
  const [{ data: docTypeConfigs }, { data: studentDocs }] = await Promise.all([
    supabase.from('document_type_configs').select('id, category, doc_key, label, is_required, order_index').order('order_index'),
    supabase.from('student_documents').select('id, doc_type_key, category, file_url, file_name, expires_at, created_at').eq('student_id', id),
  ])

  return (
    <div className="space-y-6 animate-fade-in">

      <Link
        href={backHref}
        className="inline-flex items-center gap-1.5 text-sm text-warm-500 hover:text-secondary-700 transition-colors"
      >
        <ChevronLeft size={15} />
        {backLabel}
      </Link>

      <StudentDetail
        student={student}
        parents={(parents ?? []) as any[]}
        backHref={backHref}
        etablissementId={student.etablissement_id}
        enrollments={(enrollments ?? []) as any[]}
        evaluations={(evalResult.data ?? []) as any[]}
        grades={(gradeResult.data ?? []) as any[]}
        periods={(periodResult.data ?? []) as any[]}
        absences={(absences ?? []) as any[]}
        absencesFull={(absencesFull ?? []) as any[]}
        studentWarnings={studentWarnings.map(w => ({ ...w, attachments: w.student_warning_attachments })) as any[]}
        bulletinArchives={(bulletinArchives ?? []) as any[]}
        mainTeachers={mainTeachers as any[]}
        docTypeConfigs={(docTypeConfigs ?? []) as any[]}
        studentDocuments={(studentDocs ?? []) as any[]}
        siblings={siblings as any[]}
      />

    </div>
  )
}
