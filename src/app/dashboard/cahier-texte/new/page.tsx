import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import CahierTexteForm from '@/components/cahier-texte/CahierTexteForm'

export default async function NewCahierTextePage() {
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

  if (!['enseignant', 'direction', 'responsable_pedagogique'].includes(role)) {
    redirect('/dashboard/cahier-texte')
  }

  // Année scolaire courante
  const { data: schoolYear } = await supabase
    .from('school_years')
    .select('id, label')
    .eq('is_current', true)
    .single()

  const yearLabel = schoolYear?.label ?? null

  // Teacher record
  const { data: teacher } = await supabase
    .from('teachers')
    .select('id, first_name, last_name')
    .eq('user_id', userId)
    .single()

  const teacherId = teacher?.id ?? null

  // Classes et assignments selon le rôle
  let classes: { id: string; name: string }[] = []
  let teacherAssignments: { class_id: string; is_main_teacher: boolean; subject: string | null }[] = []
  let allTeachers: { id: string; first_name: string; last_name: string }[] = []
  let allAssignments: { class_id: string; teacher_id: string; is_main_teacher: boolean; subject: string | null }[] = []

  if (['direction', 'responsable_pedagogique'].includes(role)) {
    // Accès complet
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
    // Enseignant : ses affectations uniquement
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
    }

    // Aussi charger les matieres des autres enseignants de ses classes (pour prof principal)
    if (classIds.length > 0) {
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
      />
    </div>
  )
}
