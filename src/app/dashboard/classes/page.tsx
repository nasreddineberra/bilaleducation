import { createClient } from '@/lib/supabase/server'
import ClassesClient from '@/components/classes/ClassesClient'

export default async function ClassesPage() {
  const supabase = await createClient()

  const { data: classes } = await supabase
    .from('classes')
    .select(`
      *,
      class_teachers (
        teacher_id,
        is_main_teacher,
        subject,
        teachers ( first_name, last_name )
      )
    `)
    .order('name')

  return (
    <div className="space-y-6 animate-fade-in">
      <ClassesClient classes={classes ?? []} />
    </div>
  )
}
