import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import ClassForm from '@/components/classes/ClassForm'
import type { AssignmentData } from '@/components/classes/ClassForm'

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditClassPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const [
    { data: cls },
    { data: classTeachers },
    { data: schoolYears },
    { data: teachers },
    { data: ues },
  ] = await Promise.all([
    supabase.from('classes').select('*').eq('id', id).single(),
    supabase
      .from('class_teachers')
      .select('teacher_id, is_main_teacher, subject, teachers ( first_name, last_name )')
      .eq('class_id', id),
    supabase
      .from('school_years')
      .select('*')
      .order('label', { ascending: false }),
    supabase
      .from('teachers')
      .select('id, first_name, last_name, employee_number, is_active')
      .eq('is_active', true)
      .order('last_name')
      .order('first_name'),
    supabase
      .from('unites_enseignement')
      .select('id, nom_fr, nom_ar, code')
      .order('order_index', { ascending: true })
      .order('nom_fr'),
  ])

  if (!cls) notFound()

  const initialAssignments: AssignmentData[] = (classTeachers ?? []).map(ct => ({
    teacher_id:      ct.teacher_id,
    teacher_name:    ct.teachers
      ? `${(ct.teachers as any).last_name} ${(ct.teachers as any).first_name}`
      : ct.teacher_id,
    is_main_teacher: ct.is_main_teacher,
    subject:         ct.subject ?? '',
  }))

  return (
    <div className="space-y-6 animate-fade-in">

      <Link
        href="/dashboard/classes"
        className="inline-flex items-center gap-1.5 text-sm text-warm-500 hover:text-secondary-700 transition-colors"
      >
        <ChevronLeft size={15} />
        Retour à la liste
      </Link>

      <ClassForm
        cls={cls}
        initialAssignments={initialAssignments}
        schoolYears={schoolYears ?? []}
        teachers={teachers ?? []}
        ues={ues ?? []}
      />

    </div>
  )
}
