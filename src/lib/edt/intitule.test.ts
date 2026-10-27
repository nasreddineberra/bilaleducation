import { test } from 'node:test'
import assert from 'node:assert/strict'
import { intituleCreneau, intitulePropre, libelleSalle } from './intitule.ts'

test('cours : la matiere, sinon « Cours »', () => {
  assert.equal(intituleCreneau({ slot_type: 'cours', unites_enseignement: { nom_fr: 'Arabe' } }), 'Arabe')
  assert.equal(intituleCreneau({ slot_type: 'cours', unites_enseignement: null }), 'Cours')
  assert.equal(intitulePropre({ slot_type: 'cours' }), null)
})

test('activite : son nom, sinon « Activité » ; jamais une matiere', () => {
  assert.equal(intituleCreneau({ slot_type: 'activite', libelle: 'Sortie musée' }), 'Sortie musée')
  assert.equal(intituleCreneau({ slot_type: 'activite', libelle: '  ' }), 'Activité')
  assert.equal(intituleCreneau({ slot_type: 'activite', unites_enseignement: { nom_fr: 'Arabe' } }), 'Activité')
})

test('salle : prefixe « Salle », sans le doubler', () => {
  assert.equal(libelleSalle('101'), 'Salle 101')
  assert.equal(libelleSalle('Salle de réunion'), 'Salle de réunion')
  assert.equal(libelleSalle('salle B'), 'salle B')
  assert.equal(libelleSalle('Salles annexes'), 'Salle Salles annexes')
})
