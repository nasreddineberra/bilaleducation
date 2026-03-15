import { createClient } from '@/lib/supabase/server'
import CotisationsClient from '@/components/cotisations/CotisationsClient'

export default async function CotisationsPage() {
  const supabase = await createClient()

  const { data: currentYear } = await supabase
    .from('school_years')
    .select('id, label')
    .eq('is_current', true)
    .single()

  const { data: cotisationTypes } = currentYear
    ? await supabase
        .from('cotisation_types')
        .select('*')
        .eq('school_year_id', currentYear.id)
        .order('order_index')
        .order('label')
    : { data: [] }

  // Nombre de classes sans cotisation affectée (année en cours)
  const { count: classesWithout } = currentYear
    ? await supabase
        .from('classes')
        .select('id', { count: 'exact', head: true })
        .eq('academic_year', currentYear.label)
        .is('cotisation_type_id', null)
    : { count: 0 }

  // Taux horaires pour l'annee en cours
  const { data: hourlyRates } = currentYear
    ? await supabase
        .from('staff_hourly_rates')
        .select('*')
        .eq('school_year_id', currentYear.id)
        .maybeSingle()
    : { data: null }

  return (
    <div className="h-full animate-fade-in">
      <CotisationsClient
        currentYear={currentYear}
        cotisationTypes={(cotisationTypes ?? []) as any[]}
        classesWithoutCount={classesWithout ?? 0}
        hourlyRates={hourlyRates as any}
      />
    </div>
  )
}
