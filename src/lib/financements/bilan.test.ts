import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { etablirBilan, type EntreesBilan } from './bilan.ts'

const entrees = (): EntreesBilan => ({
  annee: { label: '2025-2026', start_date: '2025-09-01', end_date: '2026-06-30' },
  fin: {
    rows: [{}, {}, {}] as EntreesBilan['fin']['rows'],
    monthly: [
      { key: '2025-09', label: 'sept. 25', amount: 300, cumul: 300 },
      { key: '2025-10', label: 'oct. 25', amount: 150.004, cumul: 450.004 },
    ],
    byMethod: { cash: 100, check: 350.004 },
    byCotisation: [{ label: 'Enfants', billed: 600, count: 3, isAdult: false }],
    kpi: { billed: 600, collected: 450.004, outstanding: 160, overpaid: 10, counts: { pending: 1, partial: 1, paid: 0, overpaid: 1 }, rate: 75 },
  },
  cout: {
    total: 120,
    byMonth: [{ month: '2025-09', cost: 120 }],
    byType: [{ label: 'Cours', cost: 120, hours: 8 }],
    byPerson: [{ nom: 'DUPONT Ali', role: 'Enseignant', type: 'Cours', hours: 8, cost: 120 }],
    unratedTypes: [{ code: 'REU', hours: 2 }],
  },
  depenses: [
    { amount: '40.50', category: 'Fournitures', expense_date: '2025-10-03' },
    { amount: 9.5, category: null, expense_date: '2025-09-20' },
    { amount: 50, category: 'Fournitures', expense_date: '2025-10-20' },
  ],
  revenus: [
    { amount: 30, source_type: 'Don', revenue_date: '2025-11-01' },
    { amount: 20, source_type: null, revenue_date: null },
  ],
  ajustements: [
    { adjustment_type: 'reduction', amount: -20 },
    { adjustment_type: 'reduction', amount: -10 },
    { adjustment_type: 'avoir', amount: -5 },
  ],
})

describe('etablirBilan', () => {
  test('resultat = encaisse + autres revenus - depenses - personnel (formule de la Situation)', () => {
    const b = etablirBilan(entrees())
    // 450.004 + 50 - 100 - 120
    assert.equal(b.resultat, 280)
    assert.equal(b.depenses.total, 100)
    assert.equal(b.autres_revenus.total, 50)
    assert.equal(b.personnel.total, 120)
  })

  test('cotisations reprises des agregats, arrondies au centime', () => {
    const b = etablirBilan(entrees())
    assert.equal(b.cotisations.encaisse, 450)
    assert.equal(b.cotisations.foyers, 3)
    assert.deepEqual(b.cotisations.statuts, { pending: 1, partial: 1, paid: 0, overpaid: 1 })
    assert.deepEqual(b.encaissements.par_moyen, [{ moyen: 'check', montant: 350 }, { moyen: 'cash', montant: 100 }])
  })

  test('depenses par categorie (sans categorie nommee) et par mois dans l ordre du calendrier', () => {
    const b = etablirBilan(entrees())
    assert.deepEqual(b.depenses.par_categorie, [
      { libelle: 'Fournitures', montant: 90.5 },
      { libelle: 'Sans catégorie', montant: 9.5 },
    ])
    assert.deepEqual(b.depenses.par_mois, [
      { mois: '2025-09', montant: 9.5 },
      { mois: '2025-10', montant: 90.5 },
    ])
  })

  test('un revenu sans date compte au total mais dans aucun mois', () => {
    const b = etablirBilan(entrees())
    assert.deepEqual(b.autres_revenus.par_mois, [{ mois: '2025-11', montant: 30 }])
    assert.deepEqual(b.autres_revenus.par_source, [{ libelle: 'Don', montant: 30 }, { libelle: 'Non précisé', montant: 20 }])
  })

  test('ajustements comptes et sommes par type', () => {
    const b = etablirBilan(entrees())
    assert.deepEqual(b.ajustements, [
      { type: 'avoir', nombre: 1, montant: -5 },
      { type: 'reduction', nombre: 2, montant: -30 },
    ])
  })

  test('personnel : heures totales, detail par personne, heures sans taux', () => {
    const b = etablirBilan(entrees())
    assert.equal(b.personnel.heures, 8)
    assert.equal(b.personnel.par_personne[0].nom, 'DUPONT Ali')
    assert.deepEqual(b.personnel.sans_taux, [{ code: 'REU', heures: 2 }])
  })
})
