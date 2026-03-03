import { createClient } from '@/lib/supabase/server'
import SchoolYearsClient from '@/components/annee-scolaire/SchoolYearsClient'

export default async function AnneeScolairePage() {
  const supabase = await createClient()

  const { data: schoolYears } = await supabase
    .from('school_years')
    .select(`
      *,
      periods ( * ),
      eval_type_configs ( * )
    `)
    .order('label', { ascending: false })

  return <SchoolYearsClient schoolYears={schoolYears ?? []} />
}
