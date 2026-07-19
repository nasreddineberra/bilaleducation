// Agregation financiere par famille — SOURCE UNIQUE (couche requete + aggregation).
//
// Le calcul par ligne vit dans `compute.ts` ; ce module orchestre les REQUETES
// (parents + eleves + adultes + family_fees) et produit les series pretes a
// afficher : lignes par famille, cumul mensuel, ventilation par moyen de paiement,
// facture par activite, et les agregats de tresorerie.
//
// Partage par « Stats reglements » (vue globale) et le TABLEAU DE BORD
// (admin/direction + comptable). Avant, le dashboard reimplementait ce calcul
// inline et divergeait (reductions retranchees du percu au lieu du du).
// Toute evolution passe par ICI.

import { computeFamilyFinancials, siblingDiscounts, lineTotal } from './compute'
import type { FeeStatus } from '@/types/database'

// Client Supabase serveur (type volontairement souple : evite d'importer le type
// generique dans un module reutilise cote page).
type SB = { from: (table: string) => any }

export interface YearRef {
  id: string
  label: string
  start_date?: string | null
  end_date?: string | null
}

export interface FamilyRow {
  parentId: string
  parentLabel: string
  totalDue: number
  totalPaid: number
  remaining: number
  status: FeeStatus
}

export interface FamilyFinancials {
  rows: FamilyRow[]
  monthly: { key: string; label: string; amount: number; cumul: number }[]
  byMethod: Record<string, number>
  byCotisation: { label: string; billed: number; count: number; isAdult: boolean }[]
  kpi: {
    billed: number
    collected: number
    outstanding: number
    overpaid: number
    counts: Record<FeeStatus, number>
    rate: number
  }
}

const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']

/**
 * Financier de toutes les familles de l'annee en cours (eleves + adultes).
 * Renvoie les lignes par famille, le cumul mensuel des encaissements, la
 * ventilation par moyen de paiement, la facture par activite et les agregats.
 */
export async function getFamilyFinancials(supabase: SB, currentYear: YearRef): Promise<FamilyFinancials> {
  // Parents avec eleves actifs cette annee
  const { data: parents } = await supabase
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
    additionalParents = (data ?? []).map((p: any) => ({ ...p, students: [] }))
  }

  const allParents = [...(parents ?? []), ...additionalParents]
    .sort((a, b) => a.tutor1_last_name.localeCompare(b.tutor1_last_name) || a.tutor1_first_name.localeCompare(b.tutor1_first_name))

  const adultByParent: Record<string, any[]> = {}
  for (const ae of (adultEnrollments ?? []) as any[]) {
    if (!adultByParent[ae.parent_id]) adultByParent[ae.parent_id] = []
    adultByParent[ae.parent_id].push(ae)
  }

  // Family fees avec installments + ajustements
  const { data: familyFees } = await supabase
    .from('family_fees')
    .select(`
      id, parent_id, total_due, status,
      fee_adjustments ( adjustment_type, amount ),
      fee_installments ( amount_paid, payment_method, paid_date, created_at )
    `)
    .eq('school_year_id', currentYear.id)

  const feeByParent: Record<string, any> = {}
  for (const ff of (familyFees ?? []) as any[]) {
    if (!feeByParent[ff.parent_id]) feeByParent[ff.parent_id] = { fees: [] }
    feeByParent[ff.parent_id].fees.push(ff)
  }

  const rows: FamilyRow[] = []

  // Facture par activite (exact, ligne a ligne). L'ENCAISSE n'est pas ventilable
  // par activite (paiement au niveau du foyer).
  const cotisAgg: Record<string, { label: string; billed: number; count: number; isAdult: boolean }> = {}
  const addCotis = (ct: any, amount: number) => {
    const label = ct?.label ?? 'Sans cotisation'
    if (!cotisAgg[label]) cotisAgg[label] = { label, billed: 0, count: 0, isAdult: !!ct?.is_adult }
    cotisAgg[label].billed += amount
    cotisAgg[label].count++
  }

  for (const p of allParents as any[]) {
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
    const { totalDue, netPercu, remaining, status } = computeFamilyFinancials(subtotal, parentFees)

    const label = [p.tutor1_last_name, p.tutor1_first_name].filter(Boolean).join(' ')
      + (p.tutor2_last_name ? ` / ${[p.tutor2_last_name, p.tutor2_first_name].filter(Boolean).join(' ')}` : '')

    if (totalDue > 0 || netPercu > 0) {
      rows.push({ parentId: p.id, parentLabel: label, totalDue, totalPaid: netPercu, remaining, status })
    }
  }

  // Encaissements : ventilation par moyen de paiement + cumul mensuel.
  const allFees = (familyFees ?? []) as any[]
  const byMethod: Record<string, number> = {}
  const paidByMonth: Record<string, number> = {}
  for (const ff of allFees) {
    for (const inst of (ff.fee_installments ?? [])) {
      const amt = Number(inst.amount_paid ?? 0)
      if (amt <= 0) continue
      if (inst.payment_method) byMethod[inst.payment_method] = (byMethod[inst.payment_method] ?? 0) + amt
      const d = inst.paid_date ?? inst.created_at
      if (d) {
        const key = String(d).slice(0, 7) // YYYY-MM
        paidByMonth[key] = (paidByMonth[key] ?? 0) + amt
      }
    }
  }

  const seenMonths = Object.keys(paidByMonth).sort()
  const fromKey = currentYear.start_date ? String(currentYear.start_date).slice(0, 7) : seenMonths[0]
  const toKey = currentYear.end_date ? String(currentYear.end_date).slice(0, 7) : seenMonths[seenMonths.length - 1]

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

  // Agregats de tresorerie (memes intitules que le bandeau Reglements).
  let billed = 0, collected = 0, outstanding = 0, overpaid = 0
  const counts: Record<FeeStatus, number> = { pending: 0, partial: 0, paid: 0, overpaid: 0 }
  for (const r of rows) {
    billed += r.totalDue
    collected += Math.max(0, r.totalPaid)
    outstanding += Math.max(0, r.remaining)
    overpaid += Math.max(0, -r.remaining)
    counts[r.status]++
  }
  const rate = billed > 0 ? Math.min(100, Math.round((Math.min(collected, billed) / billed) * 100)) : 0

  return { rows, monthly, byMethod, byCotisation, kpi: { billed, collected, outstanding, overpaid, counts, rate } }
}
