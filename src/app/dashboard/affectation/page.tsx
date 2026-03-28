import { createClient } from '@/lib/supabase/server'
import AffectationClient from '@/components/affectation/AffectationClient'

export default async function AffectationPage() {
  const supabase = await createClient()

  const { data: currentYear } = await supabase
    .from('school_years')
    .select('id, label')
    .eq('is_current', true)
    .single()

  const yearLabel  = currentYear?.label ?? null
  const yearId     = currentYear?.id    ?? null

  const [
    { data: classes },
    { data: students },
    { data: enrollments },
  ] = await Promise.all([
    yearLabel
      ? supabase
          .from('classes')
          .select(`
            id, name, level, max_students, day_of_week, start_time, end_time, room_number,
            cotisation_types(label, is_adult),
            class_teachers (
              is_main_teacher,
              subject,
              teachers ( civilite, first_name, last_name )
            )
          `)
          .eq('academic_year', yearLabel)
          .order('name')
      : Promise.resolve({ data: [] }),

    supabase
      .from('students')
      .select('id, first_name, last_name, student_number, has_pai, date_of_birth, gender, city, medical_notes')
      .eq('is_active', true)
      .order('last_name')
      .order('first_name'),

    yearLabel
      ? supabase
          .from('enrollments')
          .select('student_id, class_id')
          .eq('status', 'active')
          .in(
            'class_id',
            // sous-requête inline : on récupère les IDs des classes de l'année
            (await supabase
              .from('classes')
              .select('id')
              .eq('academic_year', yearLabel)
            ).data?.map(c => c.id) ?? []
          )
      : Promise.resolve({ data: [] }),
  ])

  // Exclure les classes de type adulte
  const apprenantClasses = (classes ?? []).filter((c: any) => !c.cotisation_types?.is_adult)

  return (
    <div className="h-full animate-fade-in">
      <AffectationClient
        classes={apprenantClasses as any[]}
        students={students ?? []}
        enrollments={enrollments ?? []}
        currentYearId={yearId}
      />
    </div>
  )
}
