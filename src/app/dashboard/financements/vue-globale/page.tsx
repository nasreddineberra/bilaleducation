import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import VueGlobaleClient from '@/components/financements/VueGlobaleClient'
import { computeFamilyFinancials, siblingDiscounts, lineTotal } from '@/lib/financements/compute'
import { isFinanceRole } from '@/lib/financements/roles'
import { AlertTriangle } from 'lucide-react'

export default async function VueGlobalePage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!isFinanceRole(me?.role)) redirect('/dashboard')

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
            cotisation_types ( id, label, is_adult, amount, registration_fee, sibling_discount, sibling_discount_same_type )
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
    .select(`parent_id, tutor_number, classes ( cotisation_types ( id, label, is_adult, amount, registration_fee ) )`)
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
      fee_installments ( amount_paid, payment_method, paid_date, created_at )
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
  }

  const feeByParent: Record<string, any> = {}
  for (const ff of (familyFees ?? []) as any[]) {
    if (!feeByParent[ff.parent_id]) feeByParent[ff.parent_id] = { fees: [] }
    feeByParent[ff.parent_id].fees.push(ff)
  }

  const rows: FamilyRow[] = []

  // Facture par type de cotisation (activite) : exact, ligne a ligne.
  // NB : l'ENCAISSE n'est pas ventilable par activite — un paiement est enregistre
  // au niveau du foyer, jamais rattache a une inscription precise.
  const cotisAgg: Record<string, { label: string; billed: number; count: number; isAdult: boolean }> = {}
  const addCotis = (ct: any, amount: number) => {
    const label = ct?.label ?? 'Sans cotisation'
    if (!cotisAgg[label]) cotisAgg[label] = { label, billed: 0, count: 0, isAdult: !!ct?.is_adult }
    cotisAgg[label].billed += amount
    cotisAgg[label].count++
  }

  for (const p of allParents as any[]) {
    // Sous-total des inscriptions : eleves (avec remise fratrie) + adultes.
    // La regle vit dans le helper partage avec Reglements — surtout ne pas la
    // reimplementer ici, c'est ce qui faisait diverger les deux sous-menus.
    const students = p.students ?? []
    const discounts = siblingDiscounts(
      students.map((s: any) => (s.enrollments ?? [])[0]?.classes?.cotisation_types)
    )

    let subtotal = 0
    students.forEach((s: any, i: number) => {
      const ct = (s.enrollments ?? [])[0]?.classes?.cotisation_types
      if (!ct) return
      const t = lineTotal(ct, discounts[i])
      subtotal += t
      addCotis(ct, t)
    })

    for (const ae of (adultByParent[p.id] ?? [])) {
      const ct = ae.classes?.cotisation_types
      if (!ct) continue
      const t = lineTotal(ct)
      subtotal += t
      addCotis(ct, t)
    }

    const parentFees = feeByParent[p.id]?.fees ?? []
    const { totalDue, totalPaid, netPercu, remaining, status } = computeFamilyFinancials(subtotal, parentFees)

    const label = [p.tutor1_last_name, p.tutor1_first_name].filter(Boolean).join(' ')
      + (p.tutor2_last_name ? ` / ${[p.tutor2_last_name, p.tutor2_first_name].filter(Boolean).join(' ')}` : '')

    if (totalDue > 0 || totalPaid > 0) {
      rows.push({
        parentId: p.id,
        parentLabel: label,
        totalDue,
        totalPaid: netPercu,
        remaining,
        status,
      })
    }
  }

  // ─── Agregats globaux pour les graphiques ─────────────────────────────────
  const allFees = (familyFees ?? []) as any[]

  // Encaissements : ventilation par moyen de paiement + par mois.
  // `paid_date` peut manquer sur d'anciennes lignes → repli sur `created_at`.
  const byMethod: Record<string, number> = {}
  const paidByMonth: Record<string, number> = {}
  for (const ff of allFees) {
    for (const inst of (ff.fee_installments ?? [])) {
      const amt = Number(inst.amount_paid ?? 0)
      if (amt <= 0) continue
      if (inst.payment_method) byMethod[inst.payment_method] = (byMethod[inst.payment_method] ?? 0) + amt
      const d = inst.paid_date ?? inst.created_at
      if (d) {
        const key = String(d).slice(0, 7)   // YYYY-MM
        paidByMonth[key] = (paidByMonth[key] ?? 0) + amt
      }
    }
  }

  // Mois couverts : bornes de l'annee scolaire ; repli sur l'etendue des paiements.
  const seenMonths = Object.keys(paidByMonth).sort()
  const fromKey = currentYear.start_date ? String(currentYear.start_date).slice(0, 7) : seenMonths[0]
  const toKey   = currentYear.end_date   ? String(currentYear.end_date).slice(0, 7)   : seenMonths[seenMonths.length - 1]

  const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']
  const monthly: { key: string; label: string; amount: number; cumul: number }[] = []
  if (fromKey && toKey) {
    let [y, m] = fromKey.split('-').map(Number)
    const [ey, em] = toKey.split('-').map(Number)
    let cumul = 0
    while (y < ey || (y === ey && m <= em)) {
      const key = `${y}-${String(m).padStart(2, '0')}`
      const amount = paidByMonth[key] ?? 0
      cumul += amount
      monthly.push({ key, label: `${MONTHS[m - 1]} ${String(y).slice(2)}`, amount, cumul })
      m++
      if (m > 12) { m = 1; y++ }
    }
  }

  const byCotisation = Object.values(cotisAgg).sort((a, b) => b.billed - a.billed)

  return (
    <div className="h-full animate-fade-in">
      <VueGlobaleClient
        rows={rows}
        yearLabel={currentYear.label}
        monthly={monthly}
        byMethod={byMethod}
        byCotisation={byCotisation}
      />
    </div>
  )
}
