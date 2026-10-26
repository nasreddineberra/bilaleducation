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

import { computeFamilyFinancials, lignesCotisation, type FeeLike } from './compute'
import { chargerDeparts } from './departs'
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

/** Une ligne `family_fees` telle que cette fonction la lit. */
interface LigneFeeStockee extends FeeLike {
  id?: string | null
  total_due?: number | null
}

export interface FamilyRow {
  parentId: string
  parentLabel: string
  totalDue: number
  totalPaid: number
  remaining: number
  status: FeeStatus
  // ── CE QUI SUIT NE SERT QU A L AUDIT DE CLOTURE ────────────────────────────
  //
  // `totalDue` ci-dessus est le du VIVANT, recalcule depuis les inscriptions.
  // `storedDue` est ce que porte la colonne `family_fees.total_due`, qui n est
  // rafraichie qu a l occasion d une ecriture (paiement, ajustement) — jamais
  // quand les inscriptions changent.
  //
  // POURQUOI L ECART COMPTE : des la bascule d annee, c est le STOCKE qui fait
  // foi. `reglements/page.tsx` ne charge plus les inscriptions des annees
  // passees, et son code porte la mention « le vif prime » — la ligne
  // `family_fees` l emporte meme sur l archive. Un montant perime devient donc
  // ce qui s affiche ET ce qui est reclame, durablement.
  //
  /** Le du tel qu il est STOCKE, ou `null` si le foyer n a aucune ligne `family_fees`. */
  storedDue: number | null
  /** Le subtotal vivant, que la RPC de reparation attend en parametre. */
  subtotal: number
  /** Les lignes `family_fees` du foyer pour l annee (une seule en pratique). */
  feeIds: string[]
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
        id, is_active, created_at,
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

  // Inscriptions adultes — BORNÉES À L'ANNÉE (symétrique au côté élèves) : les
  // parent_class_enrollments sont conservées d'une année sur l'autre, il faut
  // donc filtrer sur l'année de la classe, sinon les cotisations adultes des
  // années passées gonflent le sous-total de l'année en cours.
  const { data: adultEnrollments } = await supabase
    .from('parent_class_enrollments')
    .select(`parent_id, tutor_number, classes!inner ( academic_year, cotisation_types ( id, label, is_adult, amount, registration_fee ) )`)
    .eq('status', 'active')
    .eq('classes.academic_year', currentYear.label)

  // Departs de l'annee (inscription `withdrawn`) : ils restent dans le calcul
  // de leur foyer, selon la regle de l'ecole.
  const departs = await chargerDeparts(supabase, currentYear)

  // Parents adultes (ou partis) sans eleve actif
  const existingParentIds = new Set((parents ?? []).map((p: any) => p.id))
  const adultParentIds = [...new Set([
    ...(adultEnrollments ?? []).map((ae: any) => ae.parent_id),
    ...departs.eleves.map(e => e.parent_id).filter((id): id is string => !!id),
    ...departs.adultes.map(a => a.parent_id),
  ])]
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

  // Family fees avec installments + ajustements
  const { data: familyFees } = await supabase
    .from('family_fees')
    .select(`
      id, parent_id, subtotal, total_due, status,
      fee_adjustments ( adjustment_type, amount ),
      fee_installments ( amount_paid, payment_method, paid_date, created_at )
    `)
    .eq('school_year_id', currentYear.id)

  const feeByParent: Record<string, any> = {}
  for (const ff of (familyFees ?? []) as any[]) {
    if (!feeByParent[ff.parent_id]) feeByParent[ff.parent_id] = { fees: [] }
    feeByParent[ff.parent_id].fees.push(ff)
  }

  // Foyers qui ont un dossier cette annee mais PLUS AUCUNE inscription active
  // (enfant retire de sa classe, depart en cours d'annee). Sans eux, leurs
  // paiements disparaissaient des statistiques, du tableau de bord et de
  // l'archive de cloture. Meme regle que l'ecran Reglements.
  const dejaListes = new Set([...existingParentIds, ...adultParentIds])
  const sansInscriptionIds = Object.keys(feeByParent).filter(id => !dejaListes.has(id))
  let parentsSansInscription: any[] = []
  if (sansInscriptionIds.length > 0) {
    const { data } = await supabase
      .from('parents')
      .select('id, tutor1_last_name, tutor1_first_name, tutor2_last_name, tutor2_first_name')
      .in('id', sansInscriptionIds)
    parentsSansInscription = (data ?? []).map((p: any) => ({ ...p, students: [], sansInscription: true }))
  }

  const allParents = [...(parents ?? []), ...additionalParents, ...parentsSansInscription]
    .sort((a, b) => a.tutor1_last_name.localeCompare(b.tutor1_last_name) || a.tutor1_first_name.localeCompare(b.tutor1_first_name))

  const adultByParent: Record<string, any[]> = {}
  for (const ae of [...(adultEnrollments ?? []), ...departs.adultes] as any[]) {
    if (!adultByParent[ae.parent_id]) adultByParent[ae.parent_id] = []
    adultByParent[ae.parent_id].push(ae)
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
    // Enfants partis : rattaches a leur foyer, avec `depart`.
    const students = [...(p.students ?? []), ...departs.eleves.filter(e => e.parent_id === p.id)]
    const lignes = lignesCotisation(students.map((s: any) => ({
      ct:     (s.enrollments ?? [])[0]?.classes?.cotisation_types,
      ordre:  s.created_at,
      depart: s.depart,
    })), currentYear)

    let subtotal = 0
    students.forEach((s: any, i: number) => {
      const ct = (s.enrollments ?? [])[0]?.classes?.cotisation_types
      if (!ct) return
      subtotal += lignes[i].total
      addCotis(ct, lignes[i].total)
    })

    const adultes = adultByParent[p.id] ?? []
    const lignesAdultes = lignesCotisation(adultes.map((ae: any) => ({
      ct: ae.classes?.cotisation_types, depart: ae.depart,
    })), currentYear, { fratrie: false })
    adultes.forEach((ae: any, i: number) => {
      const ct = ae.classes?.cotisation_types
      if (!ct) return
      subtotal += lignesAdultes[i].total
      addCotis(ct, lignesAdultes[i].total)
    })

    // Sans inscription : plus de lignes d'ou recalculer, on reprend le sous-total
    // ENREGISTRE (le recalcul donnerait 0). Range a part dans « facture par
    // activite », pour que la somme des activites reste egale au facture.
    if (p.sansInscription) {
      subtotal = ((feeByParent[p.id]?.fees ?? []) as any[]).reduce((a, f) => a + Number(f.subtotal ?? 0), 0)
      if (subtotal > 0) addCotis({ label: 'Sans inscription' }, subtotal)
    }

    // Type local plutot que `any` : ces lignes servent au calcul (via `FeeLike`)
    // ET a l'audit de cloture, qui lit `id` et `total_due`.
    const parentFees: LigneFeeStockee[] = feeByParent[p.id]?.fees ?? []
    const { totalDue, netPercu, remaining, status } = computeFamilyFinancials(subtotal, parentFees)

    const label = [p.tutor1_last_name, p.tutor1_first_name].filter(Boolean).join(' ')
      + (p.tutor2_last_name ? ` / ${[p.tutor2_last_name, p.tutor2_first_name].filter(Boolean).join(' ')}` : '')

    if (totalDue > 0 || netPercu > 0) {
      // `null` et non `0` quand il n'y a aucune ligne : « absent » et « vaut
      // zero » sont deux etats differents, et l'audit les traite differemment.
      const storedDue = parentFees.length === 0
        ? null
        : parentFees.reduce((s, f) => s + Number(f.total_due ?? 0), 0)

      rows.push({
        parentId: p.id, parentLabel: label, totalDue, totalPaid: netPercu, remaining, status,
        storedDue, subtotal, feeIds: parentFees.map(f => f.id).filter((id): id is string => !!id),
      })
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
