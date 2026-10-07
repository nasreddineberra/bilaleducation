import { test } from 'node:test'
import assert from 'node:assert/strict'
import { abonnementExpire, joursRestants, jourParis } from './abonnement.ts'

// La console enregistre une date seule : la base la range a minuit UTC.
const ETE   = '2027-07-31T00:00:00+00:00' // = 31/07 a 2 h, heure de Paris
const HIVER = '2027-01-31T00:00:00+00:00' // = 31/01 a 1 h, heure de Paris

test('ete : le jour d echeance est INCLUS jusqu a 23 h 59 a Paris', () => {
  assert.equal(abonnementExpire(ETE, new Date('2027-07-31T00:30:00Z')), false) // 2 h 30 Paris, l ancien code coupait ici
  assert.equal(abonnementExpire(ETE, new Date('2027-07-31T21:59:59Z')), false) // 23 h 59 Paris
  assert.equal(abonnementExpire(ETE, new Date('2027-07-31T22:00:00Z')), true)  // 01/08 0 h Paris
})

test('hiver : meme regle, avec un decalage d une heure', () => {
  assert.equal(abonnementExpire(HIVER, new Date('2027-01-31T22:59:59Z')), false) // 23 h 59 Paris
  assert.equal(abonnementExpire(HIVER, new Date('2027-01-31T23:00:00Z')), true)  // 01/02 0 h Paris
})

test('une echeance saisie a minuit de PARIS designe le meme jour', () => {
  assert.equal(jourParis(new Date('2027-07-30T22:00:00Z')), '2027-07-31')
  assert.equal(abonnementExpire('2027-07-30T22:00:00Z', new Date('2027-07-31T21:59:59Z')), false)
})

test('sans echeance, ou illisible : jamais expire', () => {
  assert.equal(abonnementExpire(null), false)
  assert.equal(abonnementExpire(''), false)
  assert.equal(abonnementExpire('pas une date'), false)
  assert.equal(joursRestants(null), null)
})

test('jours restants en jours calendaires de Paris', () => {
  assert.equal(joursRestants(ETE, new Date('2027-07-31T21:00:00Z')), 0)  // dernier jour
  assert.equal(joursRestants(ETE, new Date('2027-07-30T10:00:00Z')), 1)  // la veille
  assert.equal(joursRestants(ETE, new Date('2027-07-31T22:30:00Z')), -1) // expire
  // Traverse le passage a l heure d hiver (31/10/2027) sans perdre de jour.
  assert.equal(joursRestants('2027-11-15T00:00:00Z', new Date('2027-10-16T10:00:00Z')), 30)
})
