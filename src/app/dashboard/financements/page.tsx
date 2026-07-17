import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SyntheseClient from '@/components/financements/SyntheseClient'
import { isFinanceRole } from '@/lib/financements/roles'
import { computeFamilyFinancials, siblingDiscounts, lineTotal } from '@/lib/financements/compute'
import { AlertTriangle } from 'lucide-react'

export default async function SynthesePage() {
  const supabase = await createClient()

  // Situation financiere = CA, cout des salaires, depenses → trio finance
  // uniquement. La RLS fait foi ; cette garde evite d'afficher une page vide.
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!isFinanceRole(me?.role)) redirect('/dashboard')

  // Annee en cours
  const { data: currentYear } = await supabase
    .from('school_years')
    .select('id, label, start_date, end_date')
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

  // Lignes family_fees par parent (le calcul est fait par le helper partage).
  const feesByParent: Record<string, any[]> = {}
  for (const ff of (familyFees ?? []) as any[]) {
    if (!feesByParent[ff.parent_id]) feesByParent[ff.parent_id] = []
    feesByParent[ff.parent_id].push(ff)
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

    // Remise fratrie + modele comptable : helper partage avec Reglements et
    // Stats reglements. Ne PAS reimplementer ici (c'est ce qui faisait diverger
    // les trois sous-menus, les reductions etant retranchees du percu).
    const discounts = siblingDiscounts(
      students.map((s: any) => (s.enrollments ?? [])[0]?.classes?.cotisation_types)
    )

    let subtotal = 0
    students.forEach((s: any, i: number) => {
      const ct = (s.enrollments ?? [])[0]?.classes?.cotisation_types
      if (!ct) return
      subtotal += lineTotal(ct, discounts[i])
    })

    for (const ae of (adultByParent[parentId] ?? [])) {
      const ct = ae.classes?.cotisation_types
      if (!ct) continue
      subtotal += lineTotal(ct)
    }

    const { totalDue, netPercu } = computeFamilyFinancials(subtotal, feesByParent[parentId] ?? [])
    totalCotisationsDue  += totalDue
    totalCotisationsPaid += netPercu
  }

  // ── Cout enseignement : staff_time_entries + presence_type_rates ──────────
  const [
    { data: timeEntries },
    { data: presenceTypes },
    { data: presenceTypeRates },
  ] = await Promise.all([
    // Bornes REELLES de l'annee scolaire. On lisait `label.split('-')` + un
    // 01/08 en dur : ca supposait un libelle « AAAA-AAAA » et une annee courant
    // d'aout a aout — faux des qu'elle va de septembre a juin.
    supabase
      .from('staff_time_entries')
      .select('entry_type, duration_minutes, entry_date')
      .gte('entry_date', currentYear.start_date)
      .lte('entry_date', currentYear.end_date)
      .gt('duration_minutes', 0),

    // Pas de filtre `is_active` : un type desactive en cours d'annee a pu servir
    // a des heures deja saisies — les valoriser reste juste.
    supabase
      .from('presence_types')
      .select('id, code, label')
      .eq('school_year_id', currentYear.id),

    supabase
      .from('presence_type_rates')
      .select('presence_type_id, rate')
      .eq('school_year_id', currentYear.id),
  ])

  // Map code (uppercase) -> taux horaire + libelle lisible.
  // `staff_time_entries.entry_type` porte le CODE du type de presence (et non son
  // libelle) — confusion a l'origine du bug EDT du 15/07.
  const rateByCode: Record<string, number> = {}
  const labelByCode: Record<string, string> = {}
  for (const pt of (presenceTypes ?? []) as any[]) {
    const code = pt.code.toUpperCase()
    const rate = (presenceTypeRates ?? [] as any[]).find((r: any) => r.presence_type_id === pt.id)?.rate ?? 0
    rateByCode[code]  = Number(rate)
    labelByCode[code] = pt.label ?? code
  }

  const costByMonth: Record<string, number> = {}
  const costByType: Record<string, number> = {}
  let totalTeachingCost = 0

  // Heures dont le type n'a aucun taux : elles comptaient pour 0 € EN SILENCE,
  // sous-evaluant le cout sans le moindre signal. On les tient pour les
  // remonter a l'utilisateur (banniere).
  const unratedHoursByCode: Record<string, number> = {}

  for (const e of (timeEntries ?? []) as any[]) {
    const hours = e.duration_minutes / 60
    const code  = String(e.entry_type ?? '').toUpperCase()
    const rate  = rateByCode[code]

    if (rate === undefined || rate <= 0) {
      unratedHoursByCode[code] = (unratedHoursByCode[code] ?? 0) + hours
      continue
    }

    const cost = hours * rate
    totalTeachingCost += cost
    const monthKey = e.entry_date.slice(0, 7) // YYYY-MM
    costByMonth[monthKey] = (costByMonth[monthKey] ?? 0) + cost

    const typeLabel = labelByCode[code] ?? code
    costByType[typeLabel] = (costByType[typeLabel] ?? 0) + cost
  }

  const unratedTypes = Object.entries(unratedHoursByCode)
    .map(([code, hours]) => ({ code, hours: Math.round(hours * 10) / 10 }))
    .sort((a, b) => b.hours - a.hours)

  // Trier les mois
  const teachingCostsByMonth = Object.entries(costByMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, cost]) => ({ month, cost }))

  // ── Depenses ───────────────────────────────────────────────────────────
  const { data: expenses } = await supabase
    .from('expenses')
    .select('id, expense_date, label, amount, category, document_path, notes')
    .eq('school_year_id', currentYear.id)
    .order('expense_date', { ascending: false })

  const totalExpenses = (expenses ?? []).reduce((s: number, e: any) => s + Number(e.amount ?? 0), 0)

  // ── Revenus autres ─────────────────────────────────────────────────────
  const { data: revenues } = await supabase
    .from('other_revenues')
    .select('id, revenue_date, label, amount, source_type, notes')
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
          byType: Object.entries(costByType)
            .map(([label, cost]) => ({ label, cost }))
            .sort((a, b) => b.cost - a.cost),
          unratedTypes,
        }}
        initialExpenses={(expenses ?? []) as any[]}
        totalExpenses={totalExpenses}
        initialRevenues={(revenues ?? []) as any[]}
        totalRevenues={totalRevenues}
      />
    </div>
  )
}
