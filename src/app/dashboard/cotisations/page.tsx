import { createClient } from '@/lib/supabase/server'
import CotisationsClient from '@/components/cotisations/CotisationsClient'

export default async function CotisationsPage() {
  const supabase = await createClient()

  const { data: currentYear } = await supabase
    .from('school_years')
    .select('id, label')
    .eq('is_current', true)
    .maybeSingle()

  const [
    { data: cotisationTypes },
    { count: classesWithout },
    { data: presenceTypes },
    { data: presenceTypeRates },
    { data: allYears },
    { data: allCotisationTypes },
    { data: allPresenceTypeRates },
  ] = await Promise.all([
    // Types de cotisation de l'année en cours
    currentYear
      ? supabase.from('cotisation_types').select('*').eq('school_year_id', currentYear.id).order('order_index').order('label')
      : Promise.resolve({ data: [] }),

    // Classes sans cotisation (année en cours)
    currentYear
      ? supabase.from('classes').select('id', { count: 'exact', head: true }).eq('academic_year', currentYear.label).is('cotisation_type_id', null)
      : Promise.resolve({ count: 0 }),

    // Types de présence actifs
    supabase.from('presence_types').select('id, label, code, color').eq('is_active', true).order('order_index').order('label'),

    // Taux horaires de l'année en cours
    currentYear
      ? supabase.from('presence_type_rates').select('presence_type_id, rate').eq('school_year_id', currentYear.id)
      : Promise.resolve({ data: [] }),

    // Toutes les années scolaires (historique)
    supabase.from('school_years').select('id, label, is_current').order('label', { ascending: false }),

    // Tous les types de cotisation (toutes années)
    supabase.from('cotisation_types').select('id, school_year_id, label, amount, registration_fee, sibling_discount, max_installments, is_adult').order('order_index').order('label'),

    // Tous les taux horaires (toutes années) avec label du type de présence
    supabase.from('presence_type_rates').select('school_year_id, rate, presence_types(label, color)'),
  ])

  return (
    <div className="h-full animate-fade-in">
      <CotisationsClient
        currentYear={currentYear ?? null}
        cotisationTypes={(cotisationTypes ?? []) as any[]}
        classesWithoutCount={classesWithout ?? 0}
        presenceTypes={(presenceTypes ?? []) as any[]}
        presenceTypeRates={(presenceTypeRates ?? []) as any[]}
        allYears={(allYears ?? []) as any[]}
        allCotisationTypes={(allCotisationTypes ?? []) as any[]}
        allPresenceTypeRates={(allPresenceTypeRates ?? []) as any[]}
      />
    </div>
  )
}
