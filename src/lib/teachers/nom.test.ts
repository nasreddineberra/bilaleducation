import { test } from 'node:test'
import assert from 'node:assert/strict'
import { nomCourtEnseignant, nomCompletEnseignant } from './nom.ts'

test('nom court : civilite + NOM, NOM seul sans civilite reconnue', () => {
  assert.equal(nomCourtEnseignant({ first_name: 'Yasmina', last_name: 'BENSAID', civilite: 'Mme' }), 'Mme BENSAID')
  assert.equal(nomCourtEnseignant({ first_name: 'Daniel', last_name: 'OKAFOR', civilite: 'M.' }), 'M. OKAFOR')
  assert.equal(nomCourtEnseignant({ first_name: 'Camille', last_name: 'LEFEBVRE' }), 'LEFEBVRE')
  assert.equal(nomCourtEnseignant(null), '')
})

test('nom complet : civilite NOM Prenom, sans « M. » invente', () => {
  assert.equal(nomCompletEnseignant({ first_name: 'Yasmina', last_name: 'BENSAID', civilite: 'Mme' }), 'Mme BENSAID Yasmina')
  assert.equal(nomCompletEnseignant({ first_name: 'Camille', last_name: 'LEFEBVRE' }), 'LEFEBVRE Camille')
})
