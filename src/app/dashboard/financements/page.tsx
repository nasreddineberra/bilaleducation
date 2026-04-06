import { createClient } from '@/lib/supabase/server'
import SyntheseClient from '@/components/financements/SyntheseClient'
import { AlertTriangle } from 'lucide-react'

export default async function SynthesePage() {
  const supabase = await createClient()

  // Annee en cours
  const { data: currentYear } = await supabase
    .from('school_years')
    .select('id, label')
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

  // ── Cotisations : eleves actifs inscrits cette annee ────────────────────
  const { data: parentsRaw } = await supabase
    .from('parents')
    .select(`
      id,
      tutor1_last_name, tutor1_first_name,
      tutor2_last_name, tutor2_first_name,
      students!inner (
        id, is_active,
        enrollments!inner (
          status,
          classes!inner (
            academic_year,
            cotisation_types ( id, amount, registration_fee, sibling_discount, sibling_discount_same_type )
          )
        )
      )
    `)
    .eq('students.is_active', true)
    .eq('students.enrollments.status', 'active')
    .eq('students.enrollments.classes.academic_year', currentYear.label)

  // Inscriptions adultes
  const { data: adultEnrollments } = await supabase
    .from('parent_class_enrollments')
    .select(`parent_id, tutor_number, classes ( cotisation_types ( id, amount, registration_fee ) )`)
    .eq('status', 'active')

  // Paiements (fee_installments via family_fees)
  const { data: familyFees } = await supabase
    .from('family_fees')
    .select('id, parent_id, total_due, fee_installments ( amount_paid ), fee_adjustments ( amount )')
    .eq('school_year_id', currentYear.id)

  // Index paiements par parent (netPercu = paiements + ajustements)
  const feeByParent: Record<string, number> = {}
  for (const ff of (familyFees ?? []) as any[]) {
    const paid = (ff.fee_installments ?? []).reduce((s: number, i: any) => s + Number(i.amount_paid || 0), 0)
    const adj = (ff.fee_adjustments ?? []).reduce((s: number, a: any) => s + Number(a.amount || 0), 0)
    feeByParent[ff.parent_id] = (feeByParent[ff.parent_id] ?? 0) + paid + adj
  }

  // Index adult enrollments par parent
  const adultByParent: Record<string, any[]> = {}
  for (const ae of (adultEnrollments ?? []) as any[]) {
    if (!adultByParent[ae.parent_id]) adultByParent[ae.parent_id] = []
    adultByParent[ae.parent_id].push(ae)
  }

  // Tous les parent_ids (eleves + adultes)
  const allParentIds = new Set<string>()
  for (const p of (parentsRaw ?? [])) allParentIds.add(p.id)
  for (const ae of (adultEnrollments ?? []) as any[]) allParentIds.add(ae.parent_id)

  // Calcul cotisations
  let totalCotisationsDue = 0
  let totalCotisationsPaid = 0

  for (const parentId of allParentIds) {
    const pData = (parentsRaw ?? []).find((p: any) => p.id === parentId) as any
    const students = pData?.students ?? []

    const countByType: Record<string, number> = {}
    for (const s of students) {
      const ct = (s.enrollments ?? [])[0]?.classes?.cotisation_types
      if (ct?.id) countByType[ct.id] = (countByType[ct.id] ?? 0) + 1
    }

    const indexByType: Record<string, number> = {}
    let globalIndex = 0
    let familyDue = 0

    for (const s of students) {
      const ct = (s.enrollments ?? [])[0]?.classes?.cotisation_types
      if (!ct) continue
      const ctId = ct.id ?? ''
      const sameTypeOnly = ct.sibling_discount_same_type ?? false
      let discount = 0

      if (ct.sibling_discount > 0) {
        if (sameTypeOnly) {
          const typeIdx = indexByType[ctId] ?? 0
          if (typeIdx > 0) discount = Number(ct.sibling_discount)
          indexByType[ctId] = typeIdx + 1
        } else {
          if (globalIndex > 0) discount = Number(ct.sibling_discount)
        }
      } else {
        if (sameTypeOnly) indexByType[ctId] = (indexByType[ctId] ?? 0) + 1
      }
      globalIndex++
      familyDue += Number(ct.amount ?? 0) + Number(ct.registration_fee ?? 0) - discount
    }

    // Cotisations adultes
    for (const ae of (adultByParent[parentId] ?? [])) {
      const ct = ae.classes?.cotisation_types
      if (!ct) continue
      familyDue += Number(ct.amount ?? 0) + Number(ct.registration_fee ?? 0)
    }

    totalCotisationsDue += familyDue
    totalCotisationsPaid += feeByParent[parentId] ?? 0
  }

  // ── Cout enseignement : staff_time_entries + presence_type_rates ──────────
  const [
    { data: timeEntries },
    { data: presenceTypes },
    { data: presenceTypeRates },
  ] = await Promise.all([
    supabase
      .from('staff_time_entries')
      .select('entry_type, duration_minutes, entry_date')
      .gte('entry_date', `${currentYear.label.split('-')[0]}-08-01`)
      .lt('entry_date', `${currentYear.label.split('-')[1]}-08-01`)
      .gt('duration_minutes', 0),

    supabase
      .from('presence_types')
      .select('id, code')
      .eq('is_active', true),

    supabase
      .from('presence_type_rates')
      .select('presence_type_id, rate')
      .eq('school_year_id', currentYear.id),
  ])

  // Map code (uppercase) -> taux horaire
  const rateByCode: Record<string, number> = {}
  for (const pt of (presenceTypes ?? []) as any[]) {
    const rate = (presenceTypeRates ?? [] as any[]).find((r: any) => r.presence_type_id === pt.id)?.rate ?? 0
    rateByCode[pt.code.toUpperCase()] = Number(rate)
  }

  const costByMonth: Record<string, number> = {}
  let totalTeachingCost = 0

  for (const e of (timeEntries ?? []) as any[]) {
    const hours = e.duration_minutes / 60
    const rate = rateByCode[e.entry_type.toUpperCase()] ?? 0
    const cost = hours * rate
    totalTeachingCost += cost
    const monthKey = e.entry_date.slice(0, 7) // YYYY-MM
    costByMonth[monthKey] = (costByMonth[monthKey] ?? 0) + cost
  }

  // Trier les mois
  const teachingCostsByMonth = Object.entries(costByMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, cost]) => ({ month, cost }))

  // ── Depenses ───────────────────────────────────────────────────────────
  const { data: expenses } = await supabase
    .from('expenses')
    .select('*')
    .eq('school_year_id', currentYear.id)
    .order('expense_date', { ascending: false })

  const totalExpenses = (expenses ?? []).reduce((s: number, e: any) => s + Number(e.amount ?? 0), 0)

  // ── Revenus autres ─────────────────────────────────────────────────────
  const { data: revenues } = await supabase
    .from('other_revenues')
    .select('*')
    .eq('school_year_id', currentYear.id)
    .order('revenue_date', { ascending: false })

  const totalRevenues = (revenues ?? []).reduce((s: number, r: any) => s + Number(r.amount ?? 0), 0)

  return (
    <div className="h-full animate-fade-in">
      <SyntheseClient
        yearLabel={currentYear.label}
        schoolYearId={currentYear.id}
        cotisations={{
          totalDue: totalCotisationsDue,
          totalPaid: totalCotisationsPaid,
          remaining: totalCotisationsDue - totalCotisationsPaid,
          familyCount: allParentIds.size,
          collectRate: totalCotisationsDue > 0 ? Math.round((totalCotisationsPaid / totalCotisationsDue) * 100) : 0,
        }}
        teachingCosts={{
          total: totalTeachingCost,
          byMonth: teachingCostsByMonth,
        }}
        initialExpenses={(expenses ?? []) as any[]}
        totalExpenses={totalExpenses}
        initialRevenues={(revenues ?? []) as any[]}
        totalRevenues={totalRevenues}
      />
    </div>
  )
}
