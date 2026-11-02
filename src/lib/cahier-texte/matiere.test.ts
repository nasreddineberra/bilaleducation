import { test } from 'node:test'
import assert from 'node:assert/strict'
import { choixMatiere, libelleMatiere, type CreneauMatiere } from './matiere.ts'

const creneau = (o: Partial<CreneauMatiere>): CreneauMatiere => ({
  slot_type: 'cours', day_of_week: 3, is_recurring: true, slot_date: null,
  effective_from: '2026-09-01', effective_until: null, is_active: true,
  unites_enseignement: { nom_fr: 'Arabe' }, ...o,
})

// 2026-11-04 est un mercredi (3), 2026-11-07 un samedi (6).
test('aucun creneau de cours avec matiere : Général seul', () => {
  assert.deepEqual(choixMatiere([], '2026-11-04'), { options: [], proposee: '' })
  assert.deepEqual(choixMatiere([creneau({ slot_type: 'activite' }), creneau({ unites_enseignement: null })], '2026-11-04'),
    { options: [], proposee: '' })
})

test('une seule matiere : proposee meme un autre jour', () => {
  assert.deepEqual(choixMatiere([creneau({})], '2026-11-07'), { options: ['Arabe'], proposee: 'Arabe' })
})

test('plusieurs matieres : celle du jour est proposee', () => {
  const c = [creneau({}), creneau({ day_of_week: 6, unites_enseignement: { nom_fr: 'Coran' } })]
  assert.deepEqual(choixMatiere(c, '2026-11-07'), { options: ['Arabe', 'Coran'], proposee: 'Coran' })
  assert.deepEqual(choixMatiere(c, '2026-11-05'), { options: ['Arabe', 'Coran'], proposee: '' })
})

test('deux matieres le meme jour : aucune proposition', () => {
  const c = [creneau({}), creneau({ unites_enseignement: { nom_fr: 'Coran' } })]
  assert.equal(choixMatiere(c, '2026-11-04').proposee, '')
})

test('dates d effet, creneau inactif et creneau ponctuel', () => {
  const c = [
    creneau({ effective_until: '2026-10-31' }),
    creneau({ is_active: false, unites_enseignement: { nom_fr: 'Coran' } }),
    creneau({ is_recurring: false, slot_date: '2026-11-04', day_of_week: null, unites_enseignement: { nom_fr: 'Histoire' } }),
  ]
  assert.deepEqual(choixMatiere(c, '2026-11-04'), { options: ['Histoire'], proposee: 'Histoire' })
  assert.deepEqual(choixMatiere(c, '2026-10-28'), { options: ['Arabe'], proposee: 'Arabe' })
})

test('libelle : rien pour Général', () => {
  assert.equal(libelleMatiere('General'), null)
  assert.equal(libelleMatiere(null), null)
  assert.equal(libelleMatiere('Arabe'), 'Arabe')
})
