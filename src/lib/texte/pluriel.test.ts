import { test } from 'node:test'
import assert from 'node:assert/strict'
import { accord, pluriel } from './pluriel.ts'

test('0 et 1 au singulier, pluriel a partir de 2', () => {
  assert.equal(pluriel(0, 'foyer'), '0 foyer')
  assert.equal(pluriel(1, 'foyer'), '1 foyer')
  assert.equal(pluriel(2, 'foyer'), '2 foyers')
})

test('pluriel irregulier et participe', () => {
  assert.equal(pluriel(3, 'travail', 'travaux'), '3 travaux')
  assert.equal(accord(2, 'soldé'), 'soldés')
  assert.equal(accord(1, 'envoyée'), 'envoyée')
})

test('compteur absent : 0, jamais « undefined »', () => {
  assert.equal(pluriel(undefined, 'fichier'), '0 fichier')
  assert.equal(pluriel(null, 'compte'), '0 compte')
})
