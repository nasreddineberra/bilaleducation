import { createClient } from '@/lib/supabase/server'
import FinancementsClient from '@/components/financements/FinancementsClient'

export default async function FinancementsPage() {
  const supabase = await createClient()

  // Année en cours
  const { data: currentYear } = await supabase
    .from('school_years')
    .select('id, label')
    .eq('is_current', true)
    .single()

  if (!currentYear) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center animate-fade-in">
        <p className="text-sm text-warm-500">Aucune annee scolaire en cours.</p>
      </div>
    )
  }

  // Parents ayant au moins un élève actif inscrit cette année
  // On récupère : parent info + ses élèves actifs + classe + cotisation_type
  const { data: parents } = await supabase
    .from('parents')
    .select(`
      id,
      tutor1_last_name,
      tutor1_first_name,
      students!inner (
        id,
        first_name,
        last_name,
        is_active,
        enrollments!inner (
          id,
          status,
          class_id,
          classes!inner (
            id,
            name,
            academic_year,
            cotisation_type_id,
            day_of_week,
            start_time,
            end_time,
            class_teachers (
              is_main_teacher,
              teachers ( civilite, first_name, last_name )
            ),
            cotisation_types (
              id, label, amount, registration_fee, sibling_discount, sibling_discount_same_type, max_installments
            )
          )
        )
      )
    `)
    .eq('students.is_active', true)
    .eq('students.enrollments.status', 'active')
    .eq('students.enrollments.classes.academic_year', currentYear.label)
    .order('tutor1_last_name')
    .order('tutor1_first_name')

  // Family fees existants pour cette année
  const { data: familyFees } = await supabase
    .from('family_fees')
    .select(`
      *,
      fee_adjustments (*),
      fee_installments (*)
    `)
    .eq('school_year_id', currentYear.id)
    .order('created_at')

  return (
    <div className="h-full animate-fade-in">
      <FinancementsClient
        currentYear={currentYear}
        parents={(parents ?? []) as any[]}
        familyFees={(familyFees ?? []) as any[]}
      />
    </div>
  )
}
