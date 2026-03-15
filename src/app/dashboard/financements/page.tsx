import { createClient } from '@/lib/supabase/server'
import VueGlobaleClient from '@/components/financements/VueGlobaleClient'

export default async function VueGlobalePage() {
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
        <p className="text-sm text-warm-500">Aucune annee scolaire en cours.</p>
      </div>
    )
  }

  // ── Eleves actifs inscrits cette annee avec cotisation ────────────────
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
    .order('tutor1_last_name')

  // ── Inscriptions adultes ─────────────────────────────────────────────
  const { data: adultEnrollments } = await supabase
    .from('parent_class_enrollments')
    .select(`
      parent_id, tutor_number,
      classes ( cotisation_types ( id, amount, registration_fee ) )
    `)
    .eq('status', 'active')

  // ── Paiements (fee_installments via family_fees) ─────────────────────
  const { data: familyFees } = await supabase
    .from('family_fees')
    .select('id, parent_id, status, total_due, fee_installments ( amount_paid )')
    .eq('school_year_id', currentYear.id)

  // Index paiements par parent
  const feeByParent: Record<string, { status: string; paid: number }> = {}
  for (const ff of (familyFees ?? []) as any[]) {
    const paid = (ff.fee_installments ?? []).reduce((s: number, i: any) => s + Number(i.amount_paid || 0), 0)
    feeByParent[ff.parent_id] = { status: ff.status, paid }
  }

  // Index adult enrollments par parent
  const adultByParent: Record<string, any[]> = {}
  for (const ae of (adultEnrollments ?? []) as any[]) {
    if (!adultByParent[ae.parent_id]) adultByParent[ae.parent_id] = []
    adultByParent[ae.parent_id].push(ae)
  }

  // ── Calcul par famille ───────────────────────────────────────────────
  // Collecter tous les parent_ids (eleves + adultes)
  const allParentIds = new Set<string>()
  for (const p of (parentsRaw ?? [])) allParentIds.add(p.id)
  for (const ae of (adultEnrollments ?? []) as any[]) allParentIds.add(ae.parent_id)

  // Recup info parents manquants (adultes sans eleve)
  const parentMap: Record<string, { id: string; tutor1_last_name: string; tutor1_first_name: string; tutor2_last_name: string | null; tutor2_first_name: string | null }> = {}
  for (const p of (parentsRaw ?? []) as any[]) {
    parentMap[p.id] = { id: p.id, tutor1_last_name: p.tutor1_last_name, tutor1_first_name: p.tutor1_first_name, tutor2_last_name: p.tutor2_last_name, tutor2_first_name: p.tutor2_first_name }
  }

  const missingIds = [...allParentIds].filter(id => !parentMap[id])
  if (missingIds.length > 0) {
    const { data: extra } = await supabase
      .from('parents')
      .select('id, tutor1_last_name, tutor1_first_name, tutor2_last_name, tutor2_first_name')
      .in('id', missingIds)
    for (const p of (extra ?? []) as any[]) {
      parentMap[p.id] = p
    }
  }

  type FamilyRow = {
    id: string; parentId: string; parentName: string; tutor2Name: string | null
    childrenCount: number; totalDue: number; paid: number; remaining: number; status: string
  }

  const families: FamilyRow[] = []
  let grandTotalDue = 0
  let grandTotalPaid = 0
  const feesByStatus = { pending: 0, partial: 0, paid: 0, overdue: 0, overpaid: 0 }

  for (const parentId of allParentIds) {
    const pInfo = parentMap[parentId]
    if (!pInfo) continue

    const pData = (parentsRaw ?? []).find((p: any) => p.id === parentId) as any
    const students = pData?.students ?? []

    // Calcul cotisations eleves (meme logique que FinancementsClient)
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
    const parentAdults = adultByParent[parentId] ?? []
    for (const ae of parentAdults) {
      const ct = ae.classes?.cotisation_types
      if (!ct) continue
      familyDue += Number(ct.amount ?? 0) + Number(ct.registration_fee ?? 0)
    }

    const childrenCount = students.length
    const feeData = feeByParent[parentId]
    const paid = feeData?.paid ?? 0
    const remaining = familyDue - paid

    // Determiner le statut a partir des montants calcules
    let status: string
    if (familyDue === 0) {
      status = 'paid'
    } else if (paid === 0) {
      status = 'pending'
    } else if (paid > familyDue) {
      status = 'overpaid'
    } else if (paid >= familyDue) {
      status = 'paid'
    } else {
      status = 'partial'
    }

    if (status in feesByStatus) (feesByStatus as any)[status]++

    grandTotalDue += familyDue
    grandTotalPaid += paid

    families.push({
      id: `${parentId}`,
      parentId,
      parentName: `${pInfo.tutor1_last_name} ${pInfo.tutor1_first_name}`,
      tutor2Name: pInfo.tutor2_last_name ? `${pInfo.tutor2_last_name} ${pInfo.tutor2_first_name}` : null,
      childrenCount,
      totalDue: familyDue,
      paid,
      remaining,
      status,
    })
  }

  // Trier par nom
  families.sort((a, b) => a.parentName.localeCompare(b.parentName))

  return (
    <div className="h-full animate-fade-in">
      <VueGlobaleClient
        yearLabel={currentYear.label}
        summary={{
          totalFamilies: families.length,
          totalDue: grandTotalDue,
          totalPaid: grandTotalPaid,
          remaining: grandTotalDue - grandTotalPaid,
          feesByStatus,
        }}
        families={families}
      />
    </div>
  )
}
