import { test } from 'node:test'
import assert from 'node:assert/strict'
import { alertesSante, niveauSante, type EtatSante } from './sante.ts'

const MAINTENANT = new Date('2026-10-22T10:00:00Z').getTime()
const SAINE: EtatSante = {
  is_active: true, est_demo: false, donnees_effacees_le: null,
  smtp_configured: true, last_sign_in: '2026-10-21T08:00:00Z',
  base_facturable: 50, max_students: 100, subscription_expires_at: '2027-08-31T00:00:00+00:00',
}

test('aucun signal : bonne sante', () => {
  assert.deepEqual(alertesSante(SAINE, MAINTENANT), [])
  assert.equal(niveauSante(SAINE, MAINTENANT), 'bon')
})

test('un signal : a surveiller', () => {
  const e = { ...SAINE, smtp_configured: false }
  assert.deepEqual(alertesSante(e, MAINTENANT), ['Messagerie non configurée'])
  assert.equal(niveauSante(e, MAINTENANT), 'surveiller')
})

test('deux signaux ou plus : critique (decision du 22/10)', () => {
  const e = { ...SAINE, smtp_configured: false, base_facturable: 95 }
  assert.equal(alertesSante(e, MAINTENANT).length, 2)
  assert.equal(niveauSante(e, MAINTENANT), 'critique')
})

test('demo, inactif, donnees effacees : sans objet, aucun signal', () => {
  for (const e of [
    { ...SAINE, smtp_configured: false, est_demo: true },
    { ...SAINE, smtp_configured: false, is_active: false },
    { ...SAINE, smtp_configured: false, donnees_effacees_le: '2026-10-01T00:00:00Z' },
  ]) {
    assert.deepEqual(alertesSante(e, MAINTENANT), [])
    assert.equal(niveauSante(e, MAINTENANT), 'sans_objet')
  }
})

test('echeance : expiree, puis dans 30 jours inclus', () => {
  assert.deepEqual(
    alertesSante({ ...SAINE, subscription_expires_at: '2026-10-01T00:00:00+00:00' }, MAINTENANT),
    ['Abonnement expiré'],
  )
  assert.deepEqual(
    alertesSante({ ...SAINE, subscription_expires_at: '2026-11-21T00:00:00+00:00' }, MAINTENANT),
    ['Abonnement dans 30 j'],
  )
  assert.deepEqual(
    alertesSante({ ...SAINE, subscription_expires_at: '2026-11-22T00:00:00+00:00' }, MAINTENANT),
    [],
  )
})

test('jamais connecte ou sans connexion depuis 30 jours', () => {
  assert.deepEqual(alertesSante({ ...SAINE, last_sign_in: null }, MAINTENANT), ['Jamais connecté'])
  assert.equal(alertesSante({ ...SAINE, last_sign_in: '2026-09-01T10:00:00Z' }, MAINTENANT).length, 1)
})
