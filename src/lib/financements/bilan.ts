// Bilan financier d'une annee — CALCUL PUR, SOURCE UNIQUE (02/11).
//
// Fige a l'archivage dans `bilans_financiers.chiffres` (la purge efface ensuite
// paiements soldes et Temps de presence : le bilan devient le seul chiffre de
// l'annee), et calcule a la volee pour le bilan PROVISOIRE de l'annee en cours.
// Les entrees viennent des sources de la Situation financiere
// (`getFamilyFinancials`, `chargerCoutHeures`) : memes chiffres, meme resultat
// (encaisse + autres revenus - depenses - cout du personnel).
//
// Aucun import de valeur par alias : `node --test` charge ce module tel quel.
// Lecture des donnees : `bilan-donnees.ts`.

import type { FamilyFinancials } from './family-financials'
import type { CoutHeures } from './cout-heures'
import type { FeeStatus } from '@/types/database'

export type MontantMois = { mois: string; montant: number }   // mois = AAAA-MM
export type MontantLibelle = { libelle: string; montant: number }

export type BilanChiffres = {
  annee: { label: string; debut: string | null; fin: string | null }
  cotisations: {
    facture: number
    encaisse: number
    reste_du: number
    trop_percu: number
    foyers: number
    taux: number
    statuts: Record<FeeStatus, number>
    par_cotisation: { libelle: string; adulte: boolean; facture: number; inscrits: number }[]
  }
  encaissements: { par_mois: MontantMois[]; par_moyen: { moyen: string; montant: number }[] }
  ajustements: { type: string; nombre: number; montant: number }[]
  autres_revenus: { total: number; par_source: MontantLibelle[]; par_mois: MontantMois[] }
  depenses: { total: number; par_categorie: MontantLibelle[]; par_mois: MontantMois[] }
  personnel: {
    total: number
    heures: number
    par_type: { type: string; heures: number; cout: number }[]
    par_personne: { nom: string; role: string; type: string; heures: number; cout: number }[]
    par_mois: MontantMois[]
    sans_taux: { code: string; heures: number }[]
  }
  resultat: number
}

export type EntreesBilan = {
  annee: { label: string; start_date?: string | null; end_date?: string | null }
  fin: Pick<FamilyFinancials, 'rows' | 'monthly' | 'byMethod' | 'byCotisation' | 'kpi'>
  cout: CoutHeures
  depenses: { amount: number | string | null; category: string | null; expense_date: string | null }[]
  revenus: { amount: number | string | null; source_type: string | null; revenue_date: string | null }[]
  ajustements: { adjustment_type: string; amount: number | string | null }[]
}

const cents = (n: number) => Math.round(n * 100) / 100

/** Somme par cle, triee par montant decroissant. */
function parLibelle<T>(lignes: T[], cle: (l: T) => string, montant: (l: T) => number): MontantLibelle[] {
  const m = new Map<string, number>()
  for (const l of lignes) m.set(cle(l), (m.get(cle(l)) ?? 0) + montant(l))
  return [...m].map(([libelle, v]) => ({ libelle, montant: cents(v) })).sort((a, b) => b.montant - a.montant)
}

/** Somme par mois (AAAA-MM), dans l'ordre du calendrier. */
function parMois<T>(lignes: T[], date: (l: T) => string | null, montant: (l: T) => number): MontantMois[] {
  const m = new Map<string, number>()
  for (const l of lignes) {
    const d = date(l)
    if (!d) continue
    const mois = d.slice(0, 7)
    m.set(mois, (m.get(mois) ?? 0) + montant(l))
  }
  return [...m].sort(([a], [b]) => a.localeCompare(b)).map(([mois, v]) => ({ mois, montant: cents(v) }))
}

export function etablirBilan(e: EntreesBilan): BilanChiffres {
  const { fin, cout } = e
  const montant = (v: number | string | null) => Number(v ?? 0)

  const totalDepenses = e.depenses.reduce((s, d) => s + montant(d.amount), 0)
  const totalRevenus = e.revenus.reduce((s, r) => s + montant(r.amount), 0)

  const ajustements = new Map<string, { nombre: number; montant: number }>()
  for (const a of e.ajustements) {
    const v = ajustements.get(a.adjustment_type) ?? { nombre: 0, montant: 0 }
    v.nombre++
    v.montant += montant(a.amount)
    ajustements.set(a.adjustment_type, v)
  }

  return {
    annee: { label: e.annee.label, debut: e.annee.start_date ?? null, fin: e.annee.end_date ?? null },
    cotisations: {
      facture: cents(fin.kpi.billed),
      encaisse: cents(fin.kpi.collected),
      reste_du: cents(fin.kpi.outstanding),
      trop_percu: cents(fin.kpi.overpaid),
      foyers: fin.rows.length,
      taux: fin.kpi.rate,
      statuts: { ...fin.kpi.counts },
      par_cotisation: fin.byCotisation.map(c => ({ libelle: c.label, adulte: c.isAdult, facture: cents(c.billed), inscrits: c.count })),
    },
    encaissements: {
      par_mois: fin.monthly.map(m => ({ mois: m.key, montant: cents(m.amount) })),
      par_moyen: Object.entries(fin.byMethod)
        .map(([moyen, v]) => ({ moyen, montant: cents(v) }))
        .sort((a, b) => b.montant - a.montant),
    },
    ajustements: [...ajustements]
      .map(([type, v]) => ({ type, nombre: v.nombre, montant: cents(v.montant) }))
      .sort((a, b) => a.type.localeCompare(b.type)),
    autres_revenus: {
      total: cents(totalRevenus),
      par_source: parLibelle(e.revenus, r => r.source_type || 'Non précisé', r => montant(r.amount)),
      par_mois: parMois(e.revenus, r => r.revenue_date, r => montant(r.amount)),
    },
    depenses: {
      total: cents(totalDepenses),
      par_categorie: parLibelle(e.depenses, d => d.category || 'Sans catégorie', d => montant(d.amount)),
      par_mois: parMois(e.depenses, d => d.expense_date, d => montant(d.amount)),
    },
    personnel: {
      total: cents(cout.total),
      heures: cents(cout.byType.reduce((s, t) => s + t.hours, 0)),
      par_type: cout.byType.map(t => ({ type: t.label, heures: t.hours, cout: cents(t.cost) })),
      par_personne: cout.byPerson.map(p => ({ nom: p.nom, role: p.role, type: p.type, heures: p.hours, cout: cents(p.cost) })),
      par_mois: cout.byMonth.map(m => ({ mois: m.month, montant: cents(m.cost) })),
      sans_taux: cout.unratedTypes.map(u => ({ code: u.code, heures: u.hours })),
    },
    // Meme formule que la Situation financiere (`SyntheseClient`).
    resultat: cents(fin.kpi.collected - cout.total - totalDepenses + totalRevenus),
  }
}
