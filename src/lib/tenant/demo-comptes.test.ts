import { test } from 'node:test'
import assert from 'node:assert/strict'
import { estAdresseFictive } from './demo-comptes.ts'

test('adresses de la demonstration : ecartees, casse et espaces compris', () => {
  assert.equal(estAdresseFictive('martin.pere@demonstration.invalid'), true)
  assert.equal(estAdresseFictive(' Direction@Demonstration.Invalid '), true)
})

test('une vraie adresse passe, meme si elle ressemble', () => {
  assert.equal(estAdresseFictive('nberra+tuteur@hotmail.com'), false)
  assert.equal(estAdresseFictive('contact@demonstration.invalid.fr'), false)
  assert.equal(estAdresseFictive('demonstration.invalid@gmail.com'), false)
})
