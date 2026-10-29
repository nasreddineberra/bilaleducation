import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import type { FeeStatus } from '@/types/database'
import { getFamilyFinancials } from '@/lib/financements/family-financials'
import { chargerCoutHeures } from '@/lib/financements/cout-heures'
import type { AnneeRef } from './direction'

/**
 * DONNEES DU TABLEAU DE BORD COMPTABLE.
 *
 * Client de SESSION uniquement : la RLS verifie l'ecole ET le role.
 *
 * Il n'existe pas d'echeancier previsionnel : une « echeance » est un paiement
 * enregistre (`fee_installments`, `due_date` = date du paiement, du = paye).
 * Rien ici ne parle donc d'echeance a venir ou en retard.
 *
 * Le solde est CELUI de la Situation financiere (meme formule, memes sources) :
 * encaisse + autres revenus - depenses - cout des heures, sur l'annee.
 */

export interface DonneesComptable {
  aujourdhui: string
  finances: {
    billed: number
    collected: number
    outstanding: number
    overpaid: number
    rate: number
    counts: Record<FeeStatus, number>
    familles: number
    mensuel: { key: string; label: string; encaisse: number }[]
    moyens: { key: string; montant: number }[]
    cotisations: { label: string; billed: number; isAdult: boolean }[]
    debiteurs: { parentId: string; famille: string; reste: number; verse: number }[]
  } | null
  mois: { encaisse: number; precedent: number; paiements: number | null }
  paiements: { id: string; parentId: string | null; famille: string; date: string | null; mode: string | null; montant: number }[]
  situation: { solde: number; recettes: number; charges: number } | null
}

const cle = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export async function chargerDonneesComptable(
  supabase: SupabaseClient<Database>,
  annee: AnneeRef | null,
  aujourdhui: string,
): Promise<DonneesComptable> {
  const [ay, am] = aujourdhui.split('-').map(Number)
  const debutMois = `${aujourdhui.slice(0, 8)}01`
  const finMois = cle(new Date(ay, am, 1)) // 1er du mois suivant (exclu)
  const clePrecedent = cle(new Date(ay, am - 2, 1)).slice(0, 7)

  if (!annee) {
    return { aujourdhui, finances: null, mois: { encaisse: 0, precedent: 0, paiements: null }, paiements: [], situation: null }
  }

  const [financials, coutHeures, depensesRes, revenusRes, paiementsMoisRes, derniersRes] = await Promise.all([
    getFamilyFinancials(supabase, annee),
    annee.start_date && annee.end_date ? chargerCoutHeures(supabase, annee) : Promise.resolve(null),
    supabase.from('expenses').select('amount').eq('school_year_id', annee.id),
    supabase.from('other_revenues').select('amount').eq('school_year_id', annee.id),
    supabase.from('fee_installments')
      .select('id, family_fees!inner(school_year_id)', { count: 'exact', head: true })
      .eq('family_fees.school_year_id', annee.id)
      .gt('amount_paid', 0).gte('paid_date', debutMois).lt('paid_date', finMois),
    supabase.from('fee_installments')
      .select('id, amount_paid, paid_date, payment_method, family_fees!inner(school_year_id, parent_id, parents:parent_id(tutor1_last_name, tutor1_first_name))')
      .eq('family_fees.school_year_id', annee.id)
      .gt('amount_paid', 0)
      .order('paid_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(8),
  ])

  const k = financials.kpi
  const parMois = new Map(financials.monthly.map(m => [m.key, m.amount]))

  const somme = (rows: { amount: number | null }[] | null) => (rows ?? []).reduce((s, r) => s + Number(r.amount ?? 0), 0)
  // Une lecture en echec ne doit pas produire un faux solde : pas de situation.
  const situation = coutHeures && !depensesRes.error && !revenusRes.error
    ? (() => {
        const recettes = k.collected + somme(revenusRes.data)
        const charges = somme(depensesRes.data) + coutHeures.total
        return { solde: recettes - charges, recettes, charges }
      })()
    : null

  return {
    aujourdhui,
    finances: {
      billed: k.billed,
      collected: k.collected,
      outstanding: k.outstanding,
      overpaid: k.overpaid,
      rate: k.rate,
      counts: k.counts,
      familles: financials.rows.length,
      mensuel: financials.monthly.map(m => ({ key: m.key, label: m.label.split(' ')[0], encaisse: m.amount })),
      moyens: Object.entries(financials.byMethod)
        .map(([key, montant]) => ({ key, montant }))
        .sort((a, b) => b.montant - a.montant),
      cotisations: financials.byCotisation.map(c => ({ label: c.label, billed: c.billed, isAdult: c.isAdult })),
      debiteurs: financials.rows
        .filter(r => r.remaining > 0)
        .sort((a, b) => b.remaining - a.remaining)
        .slice(0, 8)
        .map(r => ({ parentId: r.parentId, famille: r.parentLabel, reste: r.remaining, verse: Math.max(0, r.totalPaid) })),
    },
    mois: {
      encaisse: parMois.get(aujourdhui.slice(0, 7)) ?? 0,
      precedent: parMois.get(clePrecedent) ?? 0,
      paiements: paiementsMoisRes.error ? null : (paiementsMoisRes.count ?? null),
    },
    paiements: (derniersRes.data ?? []).map(p => {
      const par = p.family_fees?.parents
      return {
        id: p.id,
        parentId: p.family_fees?.parent_id ?? null,
        famille: par ? `${par.tutor1_last_name ?? ''} ${par.tutor1_first_name ?? ''}`.trim() : '',
        date: p.paid_date,
        mode: p.payment_method,
        montant: Number(p.amount_paid ?? 0),
      }
    }),
    situation,
  }
}
