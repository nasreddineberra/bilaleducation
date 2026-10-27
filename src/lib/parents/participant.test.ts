import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cleAdulte, lireCleAdulte } from './participant.ts'

const UUID = '3f2a9c1e-7b4d-4e8a-9c2f-1a2b3c4d5e6f'

test('aller-retour : le uuid garde ses tirets', () => {
  assert.equal(cleAdulte(UUID, 2), `${UUID}-2`)
  assert.deepEqual(lireCleAdulte(cleAdulte(UUID, 1)), { parent_id: UUID, tutor_number: 1 })
  assert.deepEqual(lireCleAdulte(`${UUID}-2`), { parent_id: UUID, tutor_number: 2 })
})

test('numero de tuteur hors 1 / 2 ou cle sans tiret : refus', () => {
  assert.throws(() => lireCleAdulte(`${UUID}-3`))
  assert.throws(() => lireCleAdulte(`${UUID}-x`))
  assert.throws(() => lireCleAdulte(UUID.replace(/-/g, '')))
})
