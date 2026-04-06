import { createClient } from '@/lib/supabase/server'
import ClassesClient from '@/components/classes/ClassesClient'
import { AlertTriangle } from 'lucide-react'

export default async function ClassesPage() {
  const supabase = await createClient()

  const { data: currentYear } = await supabase
    .from('school_years')
    .select('label')
    .eq('is_current', true)
    .single()

  if (!currentYear) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center animate-fade-in">
        <AlertTriangle size={36} className="text-warm-400" />
        <p className="text-sm text-warm-500">Aucune annee scolaire en cours.</p>
      </div>
    )
  }

  const { data: classes } = await supabase
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
    .eq('academic_year', currentYear.label)
    .order('name')

  return (
    <div className="space-y-6 animate-fade-in">
      <ClassesClient classes={classes ?? []} />
    </div>
  )
}
