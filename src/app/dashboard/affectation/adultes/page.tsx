import { createClient } from '@/lib/supabase/server'
import AffectationAdultesClient from '@/components/affectation/AffectationAdultesClient'

export default async function AffectationAdultesPage() {
  const supabase = await createClient()

  const { data: currentYear } = await supabase
    .from('school_years')
    .select('label')
    .eq('is_current', true)
    .single()

  const yearLabel = currentYear?.label ?? null

  const [
    { data: classes },
    { data: parents },
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
      .from('parents')
      .select('id, tutor1_last_name, tutor1_first_name, tutor1_relationship, tutor1_adult_courses, tutor2_last_name, tutor2_first_name, tutor2_relationship, tutor2_adult_courses')
      .order('tutor1_last_name')
      .order('tutor1_first_name'),

    supabase
      .from('parent_class_enrollments')
      .select('parent_id, class_id, tutor_number')
      .eq('status', 'active'),
  ])

  // Garder uniquement les classes adultes
  const adultClasses = (classes ?? []).filter((c: any) => c.cotisation_types?.is_adult === true)

  return (
    <div className="h-full animate-fade-in">
      <AffectationAdultesClient
        classes={adultClasses as any[]}
        parents={(parents ?? []) as any[]}
        enrollments={(enrollments ?? []) as any[]}
      />
    </div>
  )
}
