import { test } from 'node:test'
import assert from 'node:assert/strict'
import { situationFoyer, type DonneesFinancesFoyer } from './finances.ts'

const CT = { id: 'ct', label: 'Enfant', amount: 300, registration_fee: 20, sibling_discount: 0, sibling_discount_same_type: false, max_installments: 3, is_adult: false }
const CT_ADULTE = { id: 'cta', label: 'Adulte', amount: 100, registration_fee: 0, sibling_discount: 0, sibling_discount_same_type: false, max_installments: 1, is_adult: true }

const enfant = (id: string, status: 'active' | 'withdrawn', depart: string | null = null, classe = 'c1') => ({
  id, first_name: id, last_name: 'FOYER', created_at: `2020-01-0${id.length}`, is_active: status === 'active',
  enrollment_id: `en-${id}-${status}`, status, class_id: classe, date_depart: depart, classe_nom: 'C1', cotisation: CT,
})

const base = (): DonneesFinancesFoyer => ({
  annee: { id: 'y', label: '2026-2027', start_date: '2026-09-01', end_date: '2027-06-30' },
  enfants: [
    enfant('S1', 'active'),
    // Parti le 15/11, regle « au prorata » figee au depart : septembre a novembre, 3 mois sur 10.
    enfant('S22', 'withdrawn', '2026-11-15'),
    // Parti PUIS revenu (inscription active ailleurs) : compte une seule fois, present.
    { ...enfant('S333', 'withdrawn', '2026-10-01'), is_active: true },
    enfant('S333', 'active', null, 'c2'),
  ],
  adultes: [{ tutor_number: 1, status: 'active', class_id: 'ca', date_depart: null, classe_nom: 'CA', cotisation: CT_ADULTE }],
  mouvements_depart: [
    { id: 'm1', student_id: 'S22', parent_id: 'f', tutor_number: null, class_id: 'c1', regle: 'prorata', decision: null },
  ],
  dossiers: [{
    id: 'ff', subtotal: 0, adjustments_total: -30, total_due: 0, num_installments: 2, status: 'partial',
    reductions: [{ adjustment_date: '2026-10-01', adjustment_type: 'reduction', label: 'Geste', amount: -30 }],
    echeances: [
      { installment_number: 1, due_date: '2026-10-01', amount_due: 250, amount_paid: 200, paid_date: '2026-10-02', payment_method: 'check', receipt_number: 'R1', status: 'partial' },
      { installment_number: 2, due_date: '2027-01-01', amount_due: 250, amount_paid: 0, paid_date: null, payment_method: null, receipt_number: null, status: 'pending' },
    ],
  }],
})

test('meme calcul que l ecole : present, parti au prorata, revenu, cours adulte', () => {
  const s = situationFoyer(base(), 'f')
  // S1 : 300 + 20 ; S333 revenu : 300 + 20 ; S22 parti : 300 x 3/10 + 20 = 110 ; adulte : 100.
  assert.equal(s.financier.subtotal, 320 + 320 + 110 + 100)
  assert.equal(s.financier.totalDue, 850 - 30)
  assert.equal(s.financier.totalPaid, 200)
  assert.equal(s.financier.remaining, 620)
  assert.equal(s.financier.status, 'partial')
  const parti = s.lignes.find(l => l.qui === 'FOYER S22')!
  assert.equal(parti.ligne.regle, 'prorata')
  assert.deepEqual(parti.ligne.mois, { retenus: 3, total: 10 })
  assert.equal(s.lignes.filter(l => l.qui === 'FOYER S333').length, 1)
})

test('paiements : seulement ceux encaisses, le plus recent d abord', () => {
  const s = situationFoyer(base(), 'f')
  assert.deepEqual(s.paiements, [{ date: '2026-10-02', montant: 200, moyen: 'check', recu: 'R1' }])
  assert.equal(s.echeances.length, 2)
  assert.equal(s.reductions.length, 1)
})

test('depart sans mouvement : regle par defaut (due en totalite)', () => {
  const d = base()
  d.mouvements_depart = []
  const parti = situationFoyer(d, 'f').lignes.find(l => l.qui === 'FOYER S22')!
  assert.equal(parti.ligne.regle, 'due')
  assert.equal(parti.ligne.total, 320)
})

test('sans aucune inscription : sous-total enregistre', () => {
  const d = base()
  d.enfants = []
  d.adultes = []
  d.dossiers[0].subtotal = 400
  assert.equal(situationFoyer(d, 'f').financier.subtotal, 400)
})
