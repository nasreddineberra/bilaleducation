import { test } from 'node:test'
import assert from 'node:assert/strict'
import { empreinteJeton, jetonBienForme, nouveauJeton } from './jeton.ts'

test('un jeton neuf est bien forme et son empreinte est stable', () => {
  const { jeton, empreinte } = nouveauJeton()
  assert.ok(jetonBienForme(jeton))
  assert.equal(empreinte, empreinteJeton(jeton))
  assert.match(empreinte, /^[0-9a-f]{64}$/)
})

test('deux jetons neufs different', () => {
  assert.notEqual(nouveauJeton().jeton, nouveauJeton().jeton)
})

test('forme refusee : vide, trop court, caracteres hors URL, autre type', () => {
  assert.equal(jetonBienForme(''), false)
  assert.equal(jetonBienForme('abc'), false)
  assert.equal(jetonBienForme('a'.repeat(42) + '/'), false)
  assert.equal(jetonBienForme(undefined), false)
  assert.equal(jetonBienForme(42), false)
})
