import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import CahierTexteForm from '@/components/cahier-texte/CahierTexteForm'

export default async function EditCahierTextePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
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

  if (!['admin', 'enseignant', 'direction', 'responsable_pedagogique'].includes(role)) {
    redirect('/dashboard/cahier-texte')
  }

  // Séance à éditer
  const { data: journal } = await supabase
    .from('class_journal')
    .select('*')
    .eq('id', id)
    .single()

  if (!journal) notFound()

  // Teacher record
  const { data: teacher } = await supabase
    .from('teachers')
    .select('id, first_name, last_name')
    .eq('user_id', userId)
    .single()

  const teacherId = teacher?.id ?? null

  // Droit d'édition : auteur ou direction / responsable pédagogique
  const isAuthor = teacher?.id === journal.teacher_id
  if (!isAuthor && !['admin', 'direction', 'responsable_pedagogique'].includes(role)) {
    redirect(`/dashboard/cahier-texte/${id}`)
  }

  // Devoir associé (le formulaire en gère un)
  const { data: homeworks } = await supabase
    .from('homework')
    .select('*')
    .eq('journal_entry_id', id)
    .order('due_date')
    .limit(1)
  const homework = homeworks?.[0] ?? null

  // Année scolaire courante
  const { data: schoolYear } = await supabase
    .from('school_years')
    .select('label')
    .eq('is_current', true)
    .single()
  const yearLabel = schoolYear?.label ?? null

  // Classes et assignments selon le rôle (identique à la page « new »)
  let classes: { id: string; name: string }[] = []
  let teacherAssignments: { class_id: string; is_main_teacher: boolean; subject: string | null }[] = []
  let allTeachers: { id: string; first_name: string; last_name: string }[] = []
  let allAssignments: { class_id: string; teacher_id: string; is_main_teacher: boolean; subject: string | null }[] = []

  if (['admin', 'direction', 'responsable_pedagogique'].includes(role)) {
    const query = supabase.from('classes').select('id, name').order('name')
    if (yearLabel) query.eq('academic_year', yearLabel)
    const { data: c } = await query
    classes = (c ?? []) as any[]

    const { data: t } = await supabase
      .from('teachers')
      .select('id, first_name, last_name')
      .eq('is_active', true)
      .order('last_name')
    allTeachers = (t ?? []) as any[]

    const classIds = classes.map(cl => cl.id)
    if (classIds.length > 0) {
      const { data: a } = await supabase
        .from('class_teachers')
        .select('class_id, teacher_id, is_main_teacher, subject')
        .in('class_id', classIds)
      allAssignments = (a ?? []) as any[]
    }
  } else if (role === 'enseignant' && teacherId) {
    const { data: assignments } = await supabase
      .from('class_teachers')
      .select('class_id, is_main_teacher, subject')
      .eq('teacher_id', teacherId)

    teacherAssignments = (assignments ?? []) as any[]
    const classIds = [...new Set(teacherAssignments.map(a => a.class_id))]

    if (classIds.length > 0) {
      const query = supabase.from('classes').select('id, name').in('id', classIds).order('name')
      if (yearLabel) query.eq('academic_year', yearLabel)
      const { data: c } = await query
      classes = (c ?? []) as any[]

      const { data: a } = await supabase
        .from('class_teachers')
        .select('class_id, teacher_id, is_main_teacher, subject')
        .in('class_id', classIds)
      allAssignments = (a ?? []) as any[]
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4 animate-fade-in">
      <CahierTexteForm
        role={role}
        classes={classes}
        teacherId={teacherId}
        teacherAssignments={teacherAssignments}
        allTeachers={allTeachers}
        allAssignments={allAssignments}
        etablissementId={etablissementId}
        initialData={{
          id: journal.id,
          class_id: journal.class_id,
          subject: journal.subject,
          teacher_id: journal.teacher_id,
          session_date: (journal.session_date ?? '').slice(0, 10),
          title: journal.title,
          content_html: journal.content_html,
          homework: homework
            ? {
                id: homework.id,
                title: homework.title,
                homework_type: homework.homework_type,
                due_date: (homework.due_date ?? '').slice(0, 10),
                description_html: homework.description_html,
              }
            : undefined,
        }}
      />
    </div>
  )
}
