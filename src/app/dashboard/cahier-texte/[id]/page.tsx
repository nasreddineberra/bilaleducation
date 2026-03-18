import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import CahierTexteDetail from '@/components/cahier-texte/CahierTexteDetail'

export default async function CahierTexteDetailPage({ params }: { params: Promise<{ id: string }> }) {
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

  // Fetch journal entry
  const { data: journal } = await supabase
    .from('class_journal')
    .select('*, teachers:teacher_id(first_name, last_name, civilite), classes:class_id(name)')
    .eq('id', id)
    .single()

  if (!journal) notFound()

  // Fetch related homework
  const { data: homeworks } = await supabase
    .from('homework')
    .select('*')
    .eq('journal_entry_id', id)
    .order('due_date')

  // For homework status tracking (enseignant/direction/resp.péda)
  let homeworkStatuses: any[] = []
  let classStudents: any[] = []

  const canViewStatus = ['enseignant', 'direction', 'responsable_pedagogique', 'admin'].includes(role)
  if (canViewStatus && (homeworks ?? []).length > 0) {
    const hwIds = (homeworks ?? []).map(h => h.id)

    const { data: statuses } = await supabase
      .from('homework_status')
      .select('*, students:student_id(first_name, last_name)')
      .in('homework_id', hwIds)

    homeworkStatuses = statuses ?? []

    // Fetch students in the class
    const { data: enrollments } = await supabase
      .from('enrollments')
      .select('student_id, students:student_id(id, first_name, last_name)')
      .eq('class_id', journal.class_id)
      .eq('status', 'active')

    classStudents = ((enrollments ?? []) as any[])
      .filter(e => e.students)
      .map(e => ({ id: e.students.id, first_name: e.students.first_name, last_name: e.students.last_name }))
      .sort((a, b) => a.last_name.localeCompare(b.last_name))
  }

  // For parent: check if they can mark homework
  let parentId: string | null = null
  let parentStudentIds: string[] = []
  if (role === 'parent') {
    const { data: parentLink } = await supabase
      .from('parents')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle()

    if (parentLink) {
      parentId = parentLink.id
      const { data: students } = await supabase
        .from('students')
        .select('id')
        .eq('parent_id', parentLink.id)
        .eq('is_active', true)

      parentStudentIds = (students ?? []).map(s => s.id)
    }

    // Get existing statuses for this parent's children
    if (parentStudentIds.length > 0 && (homeworks ?? []).length > 0) {
      const hwIds = (homeworks ?? []).map(h => h.id)
      const { data: statuses } = await supabase
        .from('homework_status')
        .select('*')
        .in('homework_id', hwIds)
        .in('student_id', parentStudentIds)

      homeworkStatuses = statuses ?? []
    }
  }

  // Check if current user is the author (for edit permission)
  const { data: teacher } = await supabase
    .from('teachers')
    .select('id')
    .eq('user_id', userId)
    .single()

  const isAuthor = teacher?.id === journal.teacher_id
  const canEdit = isAuthor || ['direction', 'responsable_pedagogique'].includes(role)

  return (
    <div className="max-w-3xl mx-auto space-y-4 animate-fade-in">
      <CahierTexteDetail
        journal={journal}
        homeworks={homeworks ?? []}
        homeworkStatuses={homeworkStatuses}
        classStudents={classStudents}
        role={role}
        canEdit={canEdit}
        parentId={parentId}
        parentStudentIds={parentStudentIds}
      />
    </div>
  )
}
