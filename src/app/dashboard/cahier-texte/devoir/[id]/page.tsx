import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import DevoirDetail from '@/components/cahier-texte/DevoirDetail'

export default async function DevoirDetailPage({ params }: { params: Promise<{ id: string }> }) {
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

  // Fetch homework
  const { data: homework } = await supabase
    .from('homework')
    .select('*, teachers:teacher_id(first_name, last_name, civilite), classes:class_id(name)')
    .eq('id', id)
    .single()

  if (!homework) notFound()

  // Suivi (enseignant / direction / resp. péda / admin)
  let homeworkStatuses: any[] = []
  let classStudents: any[] = []

  const canViewStatus = ['enseignant', 'direction', 'responsable_pedagogique', 'admin'].includes(role)
  if (canViewStatus) {
    const { data: statuses } = await supabase
      .from('homework_status')
      .select('*, students:student_id(first_name, last_name)')
      .eq('homework_id', id)

    homeworkStatuses = statuses ?? []

    const { data: enrollments } = await supabase
      .from('enrollments')
      .select('student_id, students:student_id(id, first_name, last_name)')
      .eq('class_id', homework.class_id)
      .eq('status', 'active')

    classStudents = ((enrollments ?? []) as any[])
      .filter(e => e.students)
      .map(e => ({ id: e.students.id, first_name: e.students.first_name, last_name: e.students.last_name }))
      .sort((a, b) => a.last_name.localeCompare(b.last_name))
  }

  // Parent : ses enfants + statuts existants
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
        .select('id, first_name, last_name')
        .eq('parent_id', parentLink.id)
        .eq('is_active', true)

      parentStudentIds = (students ?? []).map(s => s.id)
      classStudents = (students ?? []) as any[]

      if (parentStudentIds.length > 0) {
        const { data: statuses } = await supabase
          .from('homework_status')
          .select('*')
          .eq('homework_id', id)
          .in('student_id', parentStudentIds)

        homeworkStatuses = statuses ?? []
      }
    }
  }

  // Auteur ou staff → édition
  const { data: teacher } = await supabase
    .from('teachers')
    .select('id')
    .eq('user_id', userId)
    .single()

  const isAuthor = teacher?.id === homework.teacher_id
  const canEdit = isAuthor || ['admin', 'direction', 'responsable_pedagogique'].includes(role)

  // Matières de la classe (pour la modale d'édition)
  const { data: cts } = await supabase
    .from('class_teachers')
    .select('subject')
    .eq('class_id', homework.class_id)
  const subjects = [...new Set(((cts ?? []).map((c: { subject: string | null }) => c.subject).filter(Boolean) as string[]))].sort()

  return (
    <div className="max-w-3xl mx-auto space-y-4 animate-fade-in">
      <DevoirDetail
        homework={homework}
        homeworkStatuses={homeworkStatuses}
        classStudents={classStudents}
        role={role}
        canEdit={canEdit}
        parentId={parentId}
        parentStudentIds={parentStudentIds}
        subjects={subjects}
        etablissementId={etablissementId}
      />
    </div>
  )
}
