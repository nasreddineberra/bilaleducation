import { test } from 'node:test'
import assert from 'node:assert/strict'
import { moyenneSur20, avancementSaisie } from './notes.ts'

const bareme = new Map([['e10', 10], ['e20', 20], ['e0', 0]])

test('ramene chaque note sur 20 avant la moyenne', () => {
  // 5/10 = 10/20, 16/20 = 16/20 -> 13
  assert.equal(moyenneSur20([
    { evaluation_id: 'e10', score: 5, is_absent: false },
    { evaluation_id: 'e20', score: '16', is_absent: false },
  ], bareme), 13)
})

test('ignore absents, notes vides et evaluations sans bareme', () => {
  assert.equal(moyenneSur20([
    { evaluation_id: 'e20', score: 12, is_absent: false },
    { evaluation_id: 'e20', score: 0, is_absent: true },
    { evaluation_id: 'e20', score: null, is_absent: false },
    { evaluation_id: 'e0', score: 3, is_absent: false },
    { evaluation_id: 'inconnue', score: 3, is_absent: false },
  ], bareme), 12)
})

test('rend null sans aucune note exploitable', () => {
  assert.equal(moyenneSur20([], bareme), null)
  assert.equal(moyenneSur20([{ evaluation_id: 'e20', score: null, is_absent: false }], bareme), null)
})

test('avancementSaisie : attendues, saisies, incompletes, vides et a venir', () => {
  const inscrits = new Map([['c1', new Set(['a', 'b', 'c'])], ['c2', new Set(['d'])], ['vide', new Set<string>()]])
  const evals = [
    { id: 'e1', class_id: 'c1', evaluation_date: '2026-10-10' }, // 2 saisies sur 3 (dont un absent)
    { id: 'e2', class_id: 'c1', evaluation_date: '2026-10-12' }, // aucune note
    { id: 'e3', class_id: 'c2', evaluation_date: null },          // complete
    { id: 'e4', class_id: 'c1', evaluation_date: '2026-10-30' }, // a venir
    { id: 'e5', class_id: 'vide', evaluation_date: '2026-10-01' }, // classe sans inscrit
  ]
  const notes = [
    { evaluation_id: 'e1', apprenant: 'a', score: 12, is_absent: false },
    { evaluation_id: 'e1', apprenant: 'b', score: null, is_absent: true },
    { evaluation_id: 'e1', apprenant: 'parti', score: 15, is_absent: false },
    { evaluation_id: 'e1', apprenant: 'c', score: null, is_absent: false },
    { evaluation_id: 'e3', apprenant: 'd', score: 8, is_absent: false },
  ]
  assert.deepEqual(avancementSaisie(evals, notes, inscrits, '2026-10-17'), {
    evaluations: 5, attendues: 7, saisies: 3, taux: 43, incompletes: 1, passeesSansNote: 1, aVenir: 1,
  })
})

test('avancementSaisie : taux null sans note attendue', () => {
  const r = avancementSaisie([{ id: 'e', class_id: 'c', evaluation_date: '2026-12-01' }], [], new Map(), '2026-10-17')
  assert.equal(r.taux, null)
  assert.equal(r.aVenir, 1)
})
