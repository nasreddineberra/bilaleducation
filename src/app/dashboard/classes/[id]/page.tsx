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
    { data: currentYearRow },
    { data: rooms },
    { data: etablissement },
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
    supabase
      .from('school_years')
      .select('id, start_date, end_date, vacations')
      .eq('is_current', true)
      .single(),
    supabase
      .from('rooms')
      .select('id, name, capacity')
      .eq('is_available', true)
      .in('room_type', ['salle_cours', 'salle_informatique', 'salle_sport', 'autre'])
      .order('name'),
    supabase
      .from('etablissements')
      .select('week_start_day')
      .single(),
  ])

  const { data: cotisationTypes } = currentYearRow
    ? await supabase
        .from('cotisation_types')
        .select('*')
        .eq('school_year_id', currentYearRow.id)
        .order('order_index')
    : { data: [] }

  // Créneau récurrent existant pour cette classe
  const { data: existingSlot } = currentYearRow
    ? await supabase
        .from('schedule_slots')
        .select('id, day_of_week, start_time, end_time, teacher_id')
        .eq('class_id', id)
        .eq('school_year_id', currentYearRow.id)
        .eq('is_recurring', true)
        .eq('is_active', true)
        .maybeSingle()
    : { data: null }

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
        cotisationTypes={(cotisationTypes ?? []) as any[]}
        rooms={(rooms ?? []) as any[]}
        currentSchoolYear={currentYearRow as any}
        existingScheduleSlot={existingSlot as any}
        weekStartDay={etablissement?.week_start_day ?? 1}
      />

    </div>
  )
}
