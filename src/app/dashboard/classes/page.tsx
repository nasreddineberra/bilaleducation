import { createClient } from '@/lib/supabase/server'
import ClassesClient from '@/components/classes/ClassesClient'

export default async function ClassesPage() {
  const supabase = await createClient()

  const { data: currentYear } = await supabase
    .from('school_years')
    .select('label')
    .eq('is_current', true)
    .single()

  const query = supabase
    .from('classes')
    .select(`
      *,
      cotisation_types ( id, label, is_adult ),
      class_teachers (
        teacher_id,
        is_main_teacher,
        subject,
        teachers ( first_name, last_name )
      )
    `)
    .order('name')

  if (currentYear) {
    query.eq('academic_year', currentYear.label)
  }

  const { data: classes } = await query

  return (
    <div className="space-y-6 animate-fade-in">
      <ClassesClient classes={classes ?? []} />
    </div>
  )
}
