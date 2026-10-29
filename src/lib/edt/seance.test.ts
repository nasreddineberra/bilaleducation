import { test } from 'node:test'
import assert from 'node:assert/strict'
import { indexTitulaires, enseignantDeSeance, fusionnerDecisions, salleDeSeance } from './seance.ts'

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
  assert.deepEqual(enseignantDeSeance('c', '2026-10-01', { exception_type: 'cancelled', remplacant_teacher_id: null }, t),
    { annulee: true, teacherId: null, titulaireId: 'tit', remplacement: false, remplacantProfileId: null })
  assert.deepEqual(enseignantDeSeance('c', '2026-10-01', { exception_type: 'modified', remplacant_teacher_id: 'r' }, t),
    { annulee: false, teacherId: 'r', titulaireId: 'tit', remplacement: true, remplacantProfileId: null })
  assert.deepEqual(enseignantDeSeance('c', '2026-10-01', null, t),
    { annulee: false, teacherId: 'tit', titulaireId: 'tit', remplacement: false, remplacantProfileId: null })
  assert.deepEqual(enseignantDeSeance('autre', '2026-10-01', null, t),
    { annulee: false, teacherId: null, titulaireId: null, remplacement: false, remplacantProfileId: null })
})

test('remplacant d\'une absence : avec ou sans fiche enseignant', () => {
  const t = indexTitulaires([aff('tit', null, null)])
  // Enseignant remplacant : sa fiche assure la seance.
  assert.deepEqual(enseignantDeSeance('c', '2026-10-01',
    { exception_type: 'remplacement', remplacant_teacher_id: 'r', remplacant_profil_id: 'profil-r' }, t),
    { annulee: false, teacherId: 'r', titulaireId: 'tit', remplacement: true, remplacantProfileId: 'profil-r' })
  // Secretaire remplacante : ni le titulaire, ni « Prof non affecté ».
  assert.deepEqual(enseignantDeSeance('c', '2026-10-01',
    { exception_type: 'remplacement', remplacant_teacher_id: null, remplacant_profil_id: 'profil-sec' }, t),
    { annulee: false, teacherId: null, titulaireId: 'tit', remplacement: true, remplacantProfileId: 'profil-sec' })
})

test('decisions fondues dans les exceptions : annulee, remplacee, salle conservee', () => {
  const exceptions = [{ schedule_slot_id: 's1', exception_date: '2026-11-04', exception_type: 'modified', remplacant_teacher_id: null, override_room_id: 'salle' }]
  const decisions = [
    { absence_id: 'a', schedule_slot_id: 's1', seance_date: '2026-11-04', decision: 'remplacee', remplacant_profile_id: 'p-ens' },
    { absence_id: 'a', schedule_slot_id: 's2', seance_date: '2026-11-04', decision: 'annulee', remplacant_profile_id: null },
    { absence_id: 'a', schedule_slot_id: 's3', seance_date: '2026-11-04', decision: 'remplacee', remplacant_profile_id: 'p-sec' },
  ]
  const fusion = fusionnerDecisions(exceptions, decisions, p => (p === 'p-ens' ? 't-ens' : null))
  const de = (slot: string) => fusion.find(e => e.schedule_slot_id === slot)
  assert.equal(de('s1')?.exception_type, 'modified')
  assert.equal(de('s1')?.override_room_id, 'salle')
  assert.equal(de('s1')?.remplacant_teacher_id, 't-ens')
  assert.equal(de('s1')?.remplacant_profil_id, 'p-ens')
  assert.equal(de('s2')?.exception_type, 'cancelled')
  assert.equal(de('s2')?.par_absence, true)
  assert.equal(de('s3')?.exception_type, 'remplacement')
  assert.equal(de('s3')?.remplacant_teacher_id, null)
  assert.equal(fusionnerDecisions(exceptions, [], () => null), exceptions)
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
