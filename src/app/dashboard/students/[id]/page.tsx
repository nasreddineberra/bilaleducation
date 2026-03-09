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

  // Récupérer les class_ids pour les requêtes suivantes
  const classIds = (enrollments ?? []).map((e: any) => e.class_id)

  // Professeur principal de chaque classe
  type CTRow = { class_id: string; teachers: { civilite: string | null; first_name: string; last_name: string } | null }
  let mainTeachers: CTRow[] = []
  if (classIds.length > 0) {
    const { data } = await supabase
      .from('class_teachers')
      .select('class_id, teachers(civilite, first_name, last_name)')
      .eq('is_main_teacher', true)
      .in('class_id', classIds) as { data: CTRow[] | null }
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

  // Absences résumé
  const { data: absences } = classIds.length > 0
    ? await supabase
        .from('absences')
        .select('class_id, period_id, absence_type, is_justified')
        .eq('student_id', id)
    : { data: [] }

  // Bulletins archivés
  const { data: bulletinArchives } = await supabase
    .from('bulletin_archives')
    .select('class_id, period_id, file_url')
    .eq('student_id', id)

  // Frères et soeurs (même parent_id)
  type SiblingRow = {
    id: string; first_name: string; last_name: string
    gender: string | null; date_of_birth: string | null
    class_name: string | null; class_level: string | null
    day_of_week: string | null; start_time: string | null; end_time: string | null
    teacher_name: string | null
  }
  let siblings: SiblingRow[] = []
  if (student.parent_id) {
    const { data: siblingStudents } = await supabase
      .from('students')
      .select('id, first_name, last_name, gender, date_of_birth')
      .eq('parent_id', student.parent_id)
      .neq('id', id)
      .eq('is_active', true)

    if (siblingStudents && siblingStudents.length > 0) {
      const siblingIds = siblingStudents.map(s => s.id)
      const { data: sibEnrollments } = await supabase
        .from('enrollments')
        .select('student_id, class_id, classes(name, level, day_of_week, start_time, end_time)')
        .in('student_id', siblingIds)
        .eq('status', 'active')

      const sibClassIds = [...new Set((sibEnrollments ?? []).map((e: any) => e.class_id).filter(Boolean))]
      const sibTeacherMap = new Map<string, string>()
      if (sibClassIds.length > 0) {
        const { data: sibTeachers } = await supabase
          .from('class_teachers')
          .select('class_id, teachers(civilite, first_name, last_name)')
          .eq('is_main_teacher', true)
          .in('class_id', sibClassIds) as { data: CTRow[] | null }
        for (const ct of (sibTeachers ?? [])) {
          if (ct.teachers) {
            sibTeacherMap.set(ct.class_id, [ct.teachers.civilite, ct.teachers.first_name, ct.teachers.last_name].filter(Boolean).join(' '))
          }
        }
      }

      const enrollMap = new Map<string, any>()
      for (const e of (sibEnrollments ?? []) as any[]) enrollMap.set(e.student_id, e)

      siblings = siblingStudents.map(s => {
        const enr = enrollMap.get(s.id)
        const cls = enr?.classes
        return {
          id: s.id, first_name: s.first_name, last_name: s.last_name, gender: s.gender ?? null, date_of_birth: s.date_of_birth ?? null,
          class_name: cls?.name ?? null, class_level: cls?.level ?? null,
          day_of_week: cls?.day_of_week ?? null, start_time: cls?.start_time ?? null, end_time: cls?.end_time ?? null,
          teacher_name: enr ? (sibTeacherMap.get(enr.class_id) ?? null) : null,
        }
      })
    }
  }

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
        parents={parents ?? []}
        backHref={backHref}
        etablissementId={student.etablissement_id}
        enrollments={(enrollments ?? []) as any[]}
        evaluations={(evalResult.data ?? []) as any[]}
        grades={(gradeResult.data ?? []) as any[]}
        periods={(periodResult.data ?? []) as any[]}
        absences={(absences ?? []) as any[]}
        bulletinArchives={(bulletinArchives ?? []) as any[]}
        mainTeachers={mainTeachers as any[]}
        siblings={siblings}
      />

    </div>
  )
}
