import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import AbsencesClient from '@/components/absences/AbsencesClient'
import type { Period, Absence } from '@/types/database'

type ClassRow = {
  id: string
  name: string
  level: string
  day_of_week: string | null
  start_time: string | null
  end_time: string | null
  main_teacher_name: string | null
  main_teacher_civilite: string | null
}

type StudentRow = {
  student_id: string
  class_id: string
  first_name: string
  last_name: string
  student_number: string
}

export default async function AbsencesPage() {
  const supabase        = await createClient()
  const h               = await headers()
  const etablissementId = h.get('x-etablissement-id') ?? ''

  // 1. Profil courant
  const { data: { user } } = await supabase.auth.getUser()
  const userId = user?.id ?? ''

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single()

  const role = profile?.role ?? 'enseignant'

  // 2. Année scolaire + périodes
  const { data: schoolYear } = await supabase
    .from('school_years')
    .select('id, label, periods(*)')
    .eq('is_current', true)
    .single() as { data: ({ id: string; label: string; periods: Period[] }) | null }

  const periods      = (schoolYear?.periods ?? []).sort((a, b) => a.order_index - b.order_index)
  const schoolYearId = schoolYear?.id ?? null
  const yearLabel    = schoolYear?.label ?? null

  // 3. Classes (filtrées selon le rôle)
  let classes: ClassRow[] = []

  if (['admin', 'direction', 'responsable_pedagogique'].includes(role)) {
    const query = supabase
      .from('classes')
      .select('id, name, level, day_of_week, start_time, end_time')
      .order('name')
    if (yearLabel) query.eq('academic_year', yearLabel)
    const { data } = await query
    classes = (data ?? []).map((c: any) => ({ ...c, main_teacher_name: null, main_teacher_civilite: null })) as ClassRow[]

  } else if (role === 'enseignant') {
    const { data: teacher } = await supabase
      .from('teachers')
      .select('id')
      .eq('user_id', userId)
      .single()

    if (teacher) {
      const { data: assignments } = await supabase
        .from('class_teachers')
        .select('class_id')
        .eq('teacher_id', teacher.id)
        .eq('is_main_teacher', true)

      const classIds = (assignments ?? []).map((a: { class_id: string }) => a.class_id)
      if (classIds.length > 0) {
        const query = supabase
          .from('classes')
          .select('id, name, level, day_of_week, start_time, end_time')
          .in('id', classIds)
          .order('name')
        if (yearLabel) query.eq('academic_year', yearLabel)
        const { data } = await query
        classes = (data ?? []).map((c: any) => ({ ...c, main_teacher_name: null, main_teacher_civilite: null })) as ClassRow[]
      }
    }
  }

  // 3b. Professeur principal de chaque classe (avec civilité)
  if (classes.length > 0) {
    type CTRow = { class_id: string; teachers: { civilite: string | null; first_name: string; last_name: string } | null }
    const { data: mainTeacherRows } = await supabase
      .from('class_teachers')
      .select('class_id, teachers(civilite, first_name, last_name)')
      .eq('is_main_teacher', true)
      .in('class_id', classes.map(c => c.id)) as { data: CTRow[] | null }

    const teacherMap = new Map(
      (mainTeacherRows ?? []).map(ct => [
        ct.class_id,
        ct.teachers
          ? { name: `${ct.teachers.first_name} ${ct.teachers.last_name}`, civilite: ct.teachers.civilite }
          : null,
      ])
    )
    classes = classes.map(c => {
      const t = teacherMap.get(c.id)
      return { ...c, main_teacher_name: t?.name ?? null, main_teacher_civilite: t?.civilite ?? null }
    })
  }

  const classIds = classes.map(c => c.id)

  // 4. Élèves inscrits (actifs)
  let students: StudentRow[] = []
  if (classIds.length > 0) {
    const { data: enrollments } = await supabase
      .from('enrollments')
      .select('student_id, class_id, students(id, first_name, last_name, student_number)')
      .in('class_id', classIds)
      .eq('status', 'active')

    students = ((enrollments ?? []) as any[])
      .filter(e => e.students)
      .map(e => ({
        student_id:     e.student_id,
        class_id:       e.class_id,
        first_name:     e.students.first_name,
        last_name:      e.students.last_name,
        student_number: e.students.student_number,
      }))
      .sort((a, b) =>
        a.last_name.localeCompare(b.last_name) || a.first_name.localeCompare(b.first_name)
      )
  }

  // 5. Absences existantes
  let absences: Absence[] = []
  if (classIds.length > 0) {
    const { data } = await supabase
      .from('absences')
      .select('*')
      .eq('etablissement_id', etablissementId)
      .in('class_id', classIds)
    absences = (data ?? []) as Absence[]
  }

  return (
    <div className="h-full animate-fade-in">
      <AbsencesClient
        classes={classes}
        periods={periods}
        students={students}
        initialAbsences={absences}
        etablissementId={etablissementId}
        schoolYearId={schoolYearId}
      />
    </div>
  )
}
