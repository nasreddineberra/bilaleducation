import { createClient } from '@/lib/supabase/server'
import VueGlobaleClient from '@/components/financements/VueGlobaleClient'

export default async function VueGlobalePage() {
  const supabase = await createClient()

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

  // Parents avec eleves actifs cette annee
  const { data: parents } = await supabase
    .from('parents')
    .select(`
      id,
      tutor1_last_name,
      tutor1_first_name,
      tutor2_last_name,
      tutor2_first_name,
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
    .order('tutor1_last_name')
    .order('tutor1_first_name')

  // Inscriptions adultes
  const { data: adultEnrollments } = await supabase
    .from('parent_class_enrollments')
    .select(`parent_id, tutor_number, classes ( cotisation_types ( id, amount, registration_fee ) )`)
    .eq('status', 'active')

  // Parents adultes sans eleve
  const existingParentIds = new Set((parents ?? []).map((p: any) => p.id))
  const adultParentIds = [...new Set((adultEnrollments ?? []).map((ae: any) => ae.parent_id))]
    .filter(id => !existingParentIds.has(id))

  let additionalParents: any[] = []
  if (adultParentIds.length > 0) {
    const { data } = await supabase
      .from('parents')
      .select('id, tutor1_last_name, tutor1_first_name, tutor2_last_name, tutor2_first_name')
      .in('id', adultParentIds)
      .order('tutor1_last_name')
      .order('tutor1_first_name')
    additionalParents = (data ?? []).map(p => ({ ...p, students: [] }))
  }

  const allParents = [...(parents ?? []), ...additionalParents]
    .sort((a, b) => a.tutor1_last_name.localeCompare(b.tutor1_last_name) || a.tutor1_first_name.localeCompare(b.tutor1_first_name))

  // Index adult enrollments par parent
  const adultByParent: Record<string, any[]> = {}
  for (const ae of (adultEnrollments ?? []) as any[]) {
    if (!adultByParent[ae.parent_id]) adultByParent[ae.parent_id] = []
    adultByParent[ae.parent_id].push(ae)
  }

  // Family fees avec installments
  const { data: familyFees } = await supabase
    .from('family_fees')
    .select(`
      id, parent_id, total_due, status,
      fee_adjustments ( adjustment_type, amount ),
      fee_installments ( amount_paid, payment_method )
    `)
    .eq('school_year_id', currentYear.id)

  // Calcul par famille
  type FamilyRow = {
    parentId: string
    parentLabel: string
    totalDue: number
    totalPaid: number
    remaining: number
    status: 'pending' | 'partial' | 'paid' | 'overpaid'
    byMethod: Record<string, number>
  }

  const feeByParent: Record<string, any> = {}
  for (const ff of (familyFees ?? []) as any[]) {
    if (!feeByParent[ff.parent_id]) feeByParent[ff.parent_id] = { fees: [] }
    feeByParent[ff.parent_id].fees.push(ff)
  }

  const rows: FamilyRow[] = []

  for (const p of allParents as any[]) {
    // Calcul du total du
    const students = p.students ?? []
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

    // Adultes
    for (const ae of (adultByParent[p.id] ?? [])) {
      const ct = ae.classes?.cotisation_types
      if (!ct) continue
      familyDue += Number(ct.amount ?? 0) + Number(ct.registration_fee ?? 0)
    }

    // Ajustements et paiements depuis family_fees
    const parentFees = feeByParent[p.id]?.fees ?? []
    let totalPaid = 0
    const byMethod: Record<string, number> = {}
    let adjustmentsTotal = 0

    for (const ff of parentFees) {
      for (const adj of (ff.fee_adjustments ?? [])) {
        adjustmentsTotal += Number(adj.amount ?? 0)
      }
      for (const inst of (ff.fee_installments ?? [])) {
        const amt = Number(inst.amount_paid ?? 0)
        totalPaid += amt
        if (inst.payment_method && amt > 0) {
          byMethod[inst.payment_method] = (byMethod[inst.payment_method] ?? 0) + amt
        }
      }
    }

    // totalDue = récapitulatif brut, netPercu = paiements - réductions
    const netPercu = totalPaid + adjustmentsTotal
    const remaining = familyDue - netPercu

    let status: FamilyRow['status'] = 'pending'
    if (netPercu > familyDue && familyDue > 0) status = 'overpaid'
    else if (familyDue <= 0 || netPercu >= familyDue) status = 'paid'
    else if (netPercu > 0) status = 'partial'

    const label = [p.tutor1_last_name, p.tutor1_first_name].filter(Boolean).join(' ')
      + (p.tutor2_last_name ? ` / ${[p.tutor2_last_name, p.tutor2_first_name].filter(Boolean).join(' ')}` : '')

    if (familyDue > 0 || totalPaid > 0) {
      rows.push({
        parentId: p.id,
        parentLabel: label,
        totalDue: familyDue,
        totalPaid: netPercu,
        remaining,
        status,
        byMethod,
      })
    }
  }

  return (
    <div className="h-full animate-fade-in">
      <VueGlobaleClient rows={rows} yearLabel={currentYear.label} />
    </div>
  )
}
