import { test } from 'node:test'
import assert from 'node:assert/strict'
import { frappeAcceptable, saisieConforme } from './saisie-confirmation.ts'

test('espace refusee en tete, doublee, ou autre que l espace simple', () => {
  assert.equal(frappeAcceptable(' ANNULATION'), false)
  assert.equal(frappeAcceptable('CE1  A'), false)
  assert.equal(frappeAcceptable('CE1\tA'), false)
  assert.equal(frappeAcceptable('CE1 A'), false)
  assert.equal(frappeAcceptable('CE1 A'), true)
  assert.equal(frappeAcceptable('CE1 '), true)
  assert.equal(frappeAcceptable(''), true)
})

test('confirmation exacte, casse ignoree, accents compris', () => {
  assert.equal(saisieConforme('annulation', 'ANNULATION'), true)
  assert.equal(saisieConforme('ben ali', 'BEN ALI'), true)
  assert.equal(saisieConforme('Hélène', 'HÉLÈNE'), true)
  assert.equal(saisieConforme('Helene', 'HÉLÈNE'), false)
  assert.equal(saisieConforme('BENALI', 'BEN ALI'), false)
})

test('espace finale ou initiale : jamais conforme', () => {
  assert.equal(saisieConforme('ANNULATION ', 'ANNULATION'), false)
  assert.equal(saisieConforme(' ANNULATION', 'ANNULATION'), false)
})

test('texte attendu mal espace en base : ramene a sa forme canonique', () => {
  assert.equal(saisieConforme('CE1 A', '  CE1   A '), true)
})

test('texte attendu vide : jamais conforme', () => {
  assert.equal(saisieConforme('', ''), false)
  assert.equal(saisieConforme('', '   '), false)
})
