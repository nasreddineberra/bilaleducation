import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import CahierTexteClient from '@/components/cahier-texte/CahierTexteClient'

export default async function CahierTextePage() {
  const supabase = await createClient()
  const h = await headers()
  const etablissementId = h.get('x-etablissement-id') ?? ''

  const { data: { user } } = await supabase.auth.getUser()
  const userId = user?.id ?? ''

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single()

  const role = profile?.role ?? 'enseignant'

  // Année scolaire courante
  const { data: schoolYear } = await supabase
    .from('school_years')
    .select('id, label')
    .eq('is_current', true)
    .single()

  const yearLabel = schoolYear?.label ?? null

  // Teacher record + assignments (pour enseignant)
  let teacherId: string | null = null
  let teacherAssignments: { class_id: string; is_main_teacher: boolean; subject: string | null }[] = []

  const { data: teacher } = await supabase
    .from('teachers')
    .select('id')
    .eq('user_id', userId)
    .single()

  if (teacher) {
    teacherId = teacher.id
    const { data: assignments } = await supabase
      .from('class_teachers')
      .select('class_id, is_main_teacher, subject')
      .eq('teacher_id', teacher.id)

    teacherAssignments = (assignments ?? []) as any[]
  }

  // Classes selon le rôle
  const classSelect = 'id, name, level, day_of_week, start_time, end_time, class_teachers(is_main_teacher, subject, teachers(civilite, first_name, last_name)), cotisation_types(label)'

  let classIds: string[] = []
  let classes: any[] = []

  if (['admin', 'direction', 'responsable_pedagogique'].includes(role)) {
    const query = supabase.from('classes').select(classSelect).order('name')
    if (yearLabel) query.eq('academic_year', yearLabel)
    const { data } = await query
    classes = (data ?? []) as any[]
    classIds = classes.map((c: any) => c.id)

  } else if (role === 'enseignant' && teacherAssignments.length > 0) {
    classIds = [...new Set(teacherAssignments.map(a => a.class_id))]
    const { data } = await supabase
      .from('classes')
      .select(classSelect)
      .in('id', classIds)
      .order('name')
    classes = (data ?? []) as any[]

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

      classIds = [...new Set(((studentEnrollments ?? []) as any[]).flatMap(s => s.enrollments.map((e: any) => e.class_id)))]
      if (classIds.length > 0) {
        const { data } = await supabase
          .from('classes')
          .select(classSelect)
          .in('id', classIds)
          .order('name')
        classes = (data ?? []) as any[]
      }
    }
  }

  // Journal entries
  let journalEntries: any[] = []
  if (classIds.length > 0) {
    const { data } = await supabase
      .from('class_journal')
      .select('*, teachers:teacher_id(first_name, last_name, civilite), classes:class_id(name)')
      .in('class_id', classIds)
      .order('session_date', { ascending: false })
      .limit(100)

    journalEntries = data ?? []
  }

  // Homework entries
  let homeworkEntries: any[] = []
  if (classIds.length > 0) {
    const { data } = await supabase
      .from('homework')
      .select('*, teachers:teacher_id(first_name, last_name, civilite), classes:class_id(name)')
      .in('class_id', classIds)
      .order('due_date', { ascending: false })
      .limit(100)

    homeworkEntries = data ?? []
  }

  // All teachers for direction/resp_pedagogique (for the create form)
  let allTeachers: { id: string; first_name: string; last_name: string }[] = []
  let allAssignments: { class_id: string; teacher_id: string; is_main_teacher: boolean; subject: string | null }[] = []

  if (['direction', 'responsable_pedagogique'].includes(role)) {
    const { data: t } = await supabase
      .from('teachers')
      .select('id, first_name, last_name')
      .eq('is_active', true)
      .order('last_name')
    allTeachers = (t ?? []) as any[]

    if (classIds.length > 0) {
      const { data: a } = await supabase
        .from('class_teachers')
        .select('class_id, teacher_id, is_main_teacher, subject')
        .in('class_id', classIds)
      allAssignments = (a ?? []) as any[]
    }
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <CahierTexteClient
        role={role}
        classes={classes}
        journalEntries={journalEntries}
        homeworkEntries={homeworkEntries}
        teacherId={teacherId}
        teacherAssignments={teacherAssignments}
        allTeachers={allTeachers}
        allAssignments={allAssignments}
        etablissementId={etablissementId}
      />
    </div>
  )
}
