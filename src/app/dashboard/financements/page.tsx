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
      tutor2_last_name,
      tutor2_first_name,
      tutor1_adult_courses,
      tutor2_adult_courses,
      tutor1_relationship,
      tutor2_relationship,
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

  // Inscriptions adultes (cours parents/tuteurs)
  const { data: adultEnrollments } = await supabase
    .from('parent_class_enrollments')
    .select(`
      parent_id, tutor_number,
      classes (
        id, name, day_of_week, start_time, end_time,
        class_teachers (
          is_main_teacher,
          teachers ( civilite, first_name, last_name )
        ),
        cotisation_types (
          id, label, amount, registration_fee
        )
      )
    `)
    .eq('status', 'active')

  // Parents inscrits en cours adultes mais sans élève actif cette année
  const existingParentIds = new Set((parents ?? []).map((p: any) => p.id))
  const adultParentIds = [...new Set((adultEnrollments ?? []).map((ae: any) => ae.parent_id))]
    .filter(id => !existingParentIds.has(id))

  let additionalParents: any[] = []
  if (adultParentIds.length > 0) {
    const { data } = await supabase
      .from('parents')
      .select('id, tutor1_last_name, tutor1_first_name, tutor2_last_name, tutor2_first_name, tutor1_adult_courses, tutor2_adult_courses, tutor1_relationship, tutor2_relationship')
      .in('id', adultParentIds)
      .order('tutor1_last_name')
      .order('tutor1_first_name')
    additionalParents = (data ?? []).map(p => ({ ...p, students: [] }))
  }

  const allParents = [...(parents ?? []), ...additionalParents]
    .sort((a, b) => a.tutor1_last_name.localeCompare(b.tutor1_last_name) || a.tutor1_first_name.localeCompare(b.tutor1_first_name))

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
        parents={allParents as any[]}
        adultEnrollments={(adultEnrollments ?? []) as any[]}
        familyFees={(familyFees ?? []) as any[]}
      />
    </div>
  )
}
