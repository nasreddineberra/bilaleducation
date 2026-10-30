import { createClient } from '@/lib/supabase/server'
import CotisationsClient from '@/components/cotisations/CotisationsClient'
import { REGLE_PAR_DEFAUT, type RegleAjustement } from '@/lib/financements/compute'
import { chargerApercuDeparts } from '@/lib/financements/departs'

export default async function CotisationsPage() {
  const supabase = await createClient()

  const { data: currentYear } = await supabase
    .from('school_years')
    .select('id, label, start_date, end_date')
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
    { data: etab },
  ] = await Promise.all([
    // Types de cotisation de l'année en cours
    currentYear
      ? supabase.from('cotisation_types').select('*').eq('school_year_id', currentYear.id).order('order_index').order('label')
      : Promise.resolve({ data: [] }),

    // Classes sans cotisation (année en cours)
    currentYear
      ? supabase.from('classes').select('id', { count: 'exact', head: true }).eq('academic_year', currentYear.label).is('cotisation_type_id', null)
      : Promise.resolve({ count: 0 }),

    // Types de présence actifs de l'année en cours (établissement via RLS)
    currentYear
      ? supabase.from('presence_types').select('id, label, code, color, is_absence').eq('is_active', true).eq('school_year_id', currentYear.id).order('order_index').order('label')
      : Promise.resolve({ data: [] }),

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

    // Regle d'ajustement en cours d'annee (depart), et qui l'a modifiee
    supabase.from('etablissements').select('regle_ajustement, regle_ajustement_le, regle_ajustement_par').maybeSingle(),
  ])

  const { data: auteurRegle } = etab?.regle_ajustement_par
    ? await supabase.from('profiles').select('last_name, first_name').eq('id', etab.regle_ajustement_par).maybeSingle()
    : { data: null }

  // Departs deja declares : apercu des montants si la regle leur est appliquee
  // (mouvements lus par les seuls roles financiers ; vide pour les autres).
  const apercuDeparts = currentYear ? await chargerApercuDeparts(supabase, currentYear) : []

  return (
    <div className="h-full animate-fade-in">
      <CotisationsClient
        currentYear={currentYear ?? null}
        cotisationTypes={cotisationTypes ?? []}
        classesWithoutCount={classesWithout ?? 0}
        presenceTypes={presenceTypes ?? []}
        presenceTypeRates={presenceTypeRates ?? []}
        allYears={allYears ?? []}
        allCotisationTypes={allCotisationTypes ?? []}
        allPresenceTypeRates={allPresenceTypeRates ?? []}
        reglage={{
          regle:      (etab?.regle_ajustement ?? REGLE_PAR_DEFAUT) as RegleAjustement,
          modifieLe:  etab?.regle_ajustement_le ?? null,
          modifiePar: auteurRegle ? `${auteurRegle.last_name.toUpperCase()} ${auteurRegle.first_name}` : null,
          annee:      { start_date: currentYear?.start_date ?? null, end_date: currentYear?.end_date ?? null },
          departs:    apercuDeparts,
        }}
      />
    </div>
  )
}
