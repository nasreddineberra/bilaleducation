// Lectures du bilan financier annuel (calcul : `bilan.ts`).
//
// `chargerEntreesBilan` : les sources de la Situation financiere, pour figer le
// bilan a l'archivage ou le calculer a la volee (bilan PROVISOIRE de l'annee en
// cours).
// `chargerDetailBilan` : les lignes de l'Excel. Une annee ARCHIVEE se lit dans
// l'historique (`family_year_finance`) : la purge efface les paiements des foyers
// soldes, l'Excel reste donc reproductible apres elle. Depenses et autres revenus
// ne sont jamais purges.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import { getFamilyFinancials, type YearRef } from './family-financials'
import { chargerCoutHeures } from './cout-heures'
import type { EntreesBilan } from './bilan'

type Client = SupabaseClient<Database>

export async function chargerEntreesBilan(supabase: Client, annee: YearRef): Promise<EntreesBilan> {
  const [fin, cout, { data: depenses }, { data: revenus }, { data: ajustements }] = await Promise.all([
    getFamilyFinancials(supabase, annee),
    chargerCoutHeures(supabase, annee),
    supabase.from('expenses').select('amount, category, expense_date').eq('school_year_id', annee.id),
    supabase.from('other_revenues').select('amount, source_type, revenue_date').eq('school_year_id', annee.id),
    supabase.from('fee_adjustments')
      .select('adjustment_type, amount, family_fees!inner(school_year_id)')
      .eq('family_fees.school_year_id', annee.id),
  ])
  return { annee, fin, cout, depenses: depenses ?? [], revenus: revenus ?? [], ajustements: ajustements ?? [] }
}

export type DetailBilan = {
  paiements:   { date: string | null; foyer: string; montant: number; moyen: string | null; reference: string | null }[]
  ajustements: { date: string | null; foyer: string; type: string; libelle: string | null; montant: number }[]
  depenses:    { date: string | null; libelle: string; categorie: string | null; montant: number; notes: string | null }[]
  revenus:     { date: string | null; libelle: string; source: string | null; montant: number; notes: string | null }[]
}

const nomFoyer = (nom: string | null | undefined, prenom: string | null | undefined) =>
  [nom, prenom].filter(Boolean).join(' ') || '?'

const parDate = <T extends { date: string | null }>(a: T, b: T) => String(a.date ?? '').localeCompare(String(b.date ?? ''))

export async function chargerDetailBilan(supabase: Client, anneeId: string, archivee: boolean): Promise<DetailBilan> {
  const [{ data: depenses }, { data: revenus }] = await Promise.all([
    supabase.from('expenses').select('expense_date, label, category, amount, notes').eq('school_year_id', anneeId),
    supabase.from('other_revenues').select('revenue_date, label, source_type, amount, notes').eq('school_year_id', anneeId),
  ])

  const paiements: DetailBilan['paiements'] = []
  const ajustements: DetailBilan['ajustements'] = []

  if (archivee) {
    const { data: foyers } = await supabase
      .from('family_year_finance')
      .select('tutor1_last_name, tutor1_first_name, installments_json, adjustments_json')
      .eq('school_year_id', anneeId)
    for (const f of foyers ?? []) {
      const foyer = nomFoyer(f.tutor1_last_name, f.tutor1_first_name)
      for (const p of f.installments_json) paiements.push({ date: p.date, foyer, montant: p.montant, moyen: p.moyen, reference: p.reference })
      for (const a of f.adjustments_json) ajustements.push({ date: a.date, foyer, type: a.type, libelle: a.label, montant: a.montant })
    }
  } else {
    const { data: dossiers } = await supabase
      .from('family_fees')
      .select('parents(tutor1_last_name, tutor1_first_name), fee_installments(amount_paid, paid_date, payment_method, receipt_number), fee_adjustments(adjustment_date, adjustment_type, label, amount)')
      .eq('school_year_id', anneeId)
    for (const d of dossiers ?? []) {
      const foyer = nomFoyer(d.parents?.tutor1_last_name, d.parents?.tutor1_first_name)
      for (const p of d.fee_installments) {
        if (Number(p.amount_paid) <= 0) continue
        paiements.push({ date: p.paid_date, foyer, montant: Number(p.amount_paid), moyen: p.payment_method, reference: p.receipt_number })
      }
      for (const a of d.fee_adjustments) {
        ajustements.push({ date: a.adjustment_date, foyer, type: a.adjustment_type, libelle: a.label, montant: Number(a.amount) })
      }
    }
  }

  return {
    paiements: paiements.sort(parDate),
    ajustements: ajustements.sort(parDate),
    depenses: (depenses ?? [])
      .map(d => ({ date: d.expense_date, libelle: d.label, categorie: d.category, montant: Number(d.amount ?? 0), notes: d.notes }))
      .sort(parDate),
    revenus: (revenus ?? [])
      .map(r => ({ date: r.revenue_date, libelle: r.label, source: r.source_type, montant: Number(r.amount ?? 0), notes: r.notes }))
      .sort(parDate),
  }
}
