import { test } from 'node:test'
import assert from 'node:assert/strict'
import { indexTitulaires, enseignantDeSeance, salleDeSeance } from './seance.ts'

const aff = (teacher_id: string, from: string | null, until: string | null, is_main_teacher = true) =>
  ({ class_id: 'c', teacher_id, is_main_teacher, effective_from: from, effective_until: until })

test('titulaire en poste a la date, fin INCLUSE ; plus personne apres son depart', () => {
  const t = indexTitulaires([aff('ancien', '2026-09-01', '2026-10-27')])
  assert.equal(t('c', '2026-10-27'), 'ancien')
  assert.equal(t('c', '2026-10-28'), null)
  assert.equal(t('c', '2026-08-31'), null)
})

test('passation : chacun sur sa periode ; le plus recent si deux se recouvrent', () => {
  const t = indexTitulaires([aff('ancien', '2026-09-01', '2026-10-27'), aff('nouveau', '2026-10-27', null)])
  assert.equal(t('c', '2026-10-01'), 'ancien')
  assert.equal(t('c', '2026-10-27'), 'nouveau')
  assert.equal(t('c', '2027-01-10'), 'nouveau')
})

test('un remplacant de classe (non principal) n\'est pas titulaire', () => {
  const t = indexTitulaires([aff('remplacant', null, null, false)])
  assert.equal(t('c', '2026-10-01'), null)
})

test('seance : annulee, remplacee, titulaire, prof non affecte', () => {
  const t = indexTitulaires([aff('tit', null, null)])
  assert.deepEqual(enseignantDeSeance('c', '2026-10-01', { exception_type: 'cancelled', override_teacher_id: null }, t),
    { annulee: true, teacherId: null, titulaireId: 'tit', remplacement: false })
  assert.deepEqual(enseignantDeSeance('c', '2026-10-01', { exception_type: 'modified', override_teacher_id: 'r' }, t),
    { annulee: false, teacherId: 'r', titulaireId: 'tit', remplacement: true })
  assert.deepEqual(enseignantDeSeance('c', '2026-10-01', null, t),
    { annulee: false, teacherId: 'tit', titulaireId: 'tit', remplacement: false })
  assert.deepEqual(enseignantDeSeance('autre', '2026-10-01', null, t),
    { annulee: false, teacherId: null, titulaireId: null, remplacement: false })
})

test('salle d\'une seance : seance, ponctuelle, classe, creneau', () => {
  const serie = { is_recurring: true, room_id: 'copie' }
  assert.equal(salleDeSeance(serie, { override_room_id: 'jour' }, 'classe'), 'jour')
  assert.equal(salleDeSeance(serie, null, 'classe'), 'classe')
  assert.equal(salleDeSeance(serie, null, null), 'copie')
  assert.equal(salleDeSeance({ is_recurring: false, room_id: 'sienne' }, null, 'classe'), 'sienne')
  assert.equal(salleDeSeance({ is_recurring: false, room_id: null }, null, 'classe'), 'classe')
  assert.equal(salleDeSeance({ is_recurring: true, room_id: null }, null, null), null)
})
