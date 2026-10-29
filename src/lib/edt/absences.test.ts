import { test } from 'node:test'
import assert from 'node:assert/strict'
import { chevaucheAbsence, joursDeLAbsence, seancesTouchees } from './absences.ts'
import { indexTitulaires } from './seance.ts'
import type { CreneauSource } from './creneaux-du-jour.ts'

const absence = { debut: '2026-11-04T10:00', fin: '2026-11-04T11:00' }

test('chevauchement d une minute : touchee', () => {
  assert.equal(chevaucheAbsence('2026-11-04', '09:30', '10:30', absence), true)   // a cheval sur le debut
  assert.equal(chevaucheAbsence('2026-11-04', '10:59', '12:00', absence), true)   // a cheval sur la fin
  assert.equal(chevaucheAbsence('2026-11-04', '10:15', '10:45', absence), true)   // dedans
  assert.equal(chevaucheAbsence('2026-11-04', '09:00', '12:00', absence), true)   // englobe l absence
})

test('bout a bout : pas touchee', () => {
  assert.equal(chevaucheAbsence('2026-11-04', '09:00', '10:00', absence), false)  // finit au debut
  assert.equal(chevaucheAbsence('2026-11-04', '11:00', '12:00', absence), false)  // commence a la fin
  assert.equal(chevaucheAbsence('2026-11-05', '10:00', '11:00', absence), false)  // autre jour
})

test('secondes et separateur espace (forme rendue par la base) toleres', () => {
  const base = { debut: '2026-11-04 10:00:00', fin: '2026-11-04 11:00:00' }
  assert.equal(chevaucheAbsence('2026-11-04', '10:30:00', '11:30:00', base), true)
  assert.equal(chevaucheAbsence('2026-11-04', '11:00:00', '12:00:00', base), false)
})

test('jours couverts, passage de mois compris', () => {
  assert.deepEqual(joursDeLAbsence({ debut: '2026-10-30T14:00', fin: '2026-11-02T12:00' }),
    ['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02'])
  assert.deepEqual(joursDeLAbsence(absence), ['2026-11-04'])
})

const T = 'prof-absent'
const affectations = [
  { class_id: 'CE1', teacher_id: T, is_main_teacher: true, effective_from: '2026-09-01', effective_until: null },
  // Classe reprise par un autre le 05/11 : ses seances suivantes ne sont plus a l absent.
  { class_id: 'CM1', teacher_id: T, is_main_teacher: true, effective_from: '2026-09-01', effective_until: '2026-11-04' },
  { class_id: 'CM1', teacher_id: 'autre', is_main_teacher: true, effective_from: '2026-11-05', effective_until: null },
]
const creneau = (id: string, classe: string, jour: number, debut: string, fin: string): CreneauSource => ({
  id, class_id: classe, day_of_week: jour, start_time: debut + ':00', end_time: fin + ':00', slot_type: 'cours',
  is_recurring: true, slot_date: null, effective_from: '2026-09-01', effective_until: null, is_active: true,
})
// 04/11/2026 = mercredi (3), 05/11 = jeudi (4).
const slots = [
  creneau('ce1-mer-matin', 'CE1', 3, '09:00', '10:00'),
  creneau('ce1-mer-aprem', 'CE1', 3, '14:00', '16:00'),
  creneau('cm1-jeu', 'CM1', 4, '09:00', '10:00'),
  creneau('cm1-mer', 'CM1', 3, '16:00', '17:00'),
]

test('absence sur deux jours : seances du titulaire EN POSTE a chaque date', () => {
  const touchees = seancesTouchees(
    { debut: '2026-11-04T13:00', fin: '2026-11-05T18:00', teacherId: T },
    slots, [], indexTitulaires(affectations),
  )
  assert.deepEqual(touchees.map(s => `${s.date} ${s.slotId}`), [
    '2026-11-04 ce1-mer-aprem',
    '2026-11-04 cm1-mer',
  ])   // cm1-jeu du 05/11 : la classe est a un autre ; ce1-mer-matin : avant l absence
})

test('seance annulee dans l EDT et jour ferme : ecartes', () => {
  const touchees = seancesTouchees(
    { debut: '2026-11-04T00:00', fin: '2026-11-04T23:59', teacherId: T },
    slots,
    [{ schedule_slot_id: 'ce1-mer-matin', exception_date: '2026-11-04', exception_type: 'cancelled' }],
    indexTitulaires(affectations),
  )
  assert.deepEqual(touchees.map(s => s.slotId), ['ce1-mer-aprem', 'cm1-mer'])
  assert.deepEqual(seancesTouchees(
    { debut: '2026-11-04T00:00', fin: '2026-11-04T23:59', teacherId: T },
    slots, [], indexTitulaires(affectations), d => d === '2026-11-04',
  ), [])
})
