import { test } from 'node:test'
import assert from 'node:assert/strict'
import { moyenneSur20 } from './notes.ts'

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
