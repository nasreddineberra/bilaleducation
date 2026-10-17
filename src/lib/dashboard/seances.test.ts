import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  seancesDuJour, statutSeance, seancesAValider, tauxAssiduite, ensembleValidations, jourSuivant, seancesSousAbsence,
  type SlotSource, type ExceptionSource,
} from './seances.ts'

// 2026-10-17 est un samedi (day_of_week = 6).
const SAMEDI = '2026-10-17'

const slot = (o: Partial<SlotSource>): SlotSource => ({
  id: 's1', class_id: 'c1', teacher_id: 't1', day_of_week: 6,
  start_time: '09:00:00', end_time: '10:30:00', slot_type: 'cours',
  is_recurring: true, slot_date: null, effective_from: null, effective_until: null, is_active: true,
  ...o,
})

const ex = (o: Partial<ExceptionSource>): ExceptionSource => ({
  schedule_slot_id: 's1', exception_date: SAMEDI, exception_type: 'modified',
  override_start_time: null, override_end_time: null, override_teacher_id: null, ...o,
})

test('jourSuivant traverse les fins de mois', () => {
  assert.equal(jourSuivant('2026-10-31'), '2026-11-01')
  assert.equal(jourSuivant('2026-12-31'), '2027-01-01')
})

test('seancesDuJour : jour, fenetre d effet, inactif, ponctuel', () => {
  const slots = [
    slot({ id: 'a' }),
    slot({ id: 'b', effective_until: '2026-10-10' }),
    slot({ id: 'c', effective_from: '2026-10-18' }),
    slot({ id: 'd', is_active: false }),
    slot({ id: 'e', day_of_week: 3 }),
    slot({ id: 'f', is_recurring: false, day_of_week: null, slot_date: SAMEDI, start_time: '08:00:00' }),
  ]
  assert.deepEqual(seancesDuJour(slots, [], SAMEDI).map(s => s.slotId), ['f', 'a'])
})

test('seancesDuJour : annulation, remplacement, horaire modifie', () => {
  const slots = [slot({ id: 's1' }), slot({ id: 's2', start_time: '11:00:00', end_time: '12:00:00' })]
  const exceptions = [
    ex({ schedule_slot_id: 's1', exception_type: 'cancelled' }),
    ex({ schedule_slot_id: 's2', override_teacher_id: 't9', override_start_time: '11:15:00' }),
  ]
  const [a, b] = seancesDuJour(slots, exceptions, SAMEDI)
  assert.equal(a.annulee, true)
  assert.equal(a.remplacement, false)
  assert.equal(b.remplacement, true)
  assert.equal(b.teacherId, 't9')
  assert.equal(b.titulaireId, 't1')
  assert.equal(b.debut, '11:15')
})

test('statutSeance selon l heure et la validation', () => {
  const [s] = seancesDuJour([slot({})], [], SAMEDI)
  const vides = new Set<string>()
  assert.equal(statutSeance(s, vides, SAMEDI, '08:00'), 'a_venir')
  assert.equal(statutSeance(s, vides, SAMEDI, '09:30'), 'en_cours')
  assert.equal(statutSeance(s, vides, SAMEDI, '10:30'), 'a_valider')
  assert.equal(statutSeance(s, vides, '2026-10-18', '00:00'), 'a_valider')
  const validees = ensembleValidations([{ schedule_slot_id: 's1', validation_date: SAMEDI }])
  assert.equal(statutSeance(s, validees, SAMEDI, '10:30'), 'validee')
})

test('seancesAValider exclut jours fermes, validees, annulees, absents', () => {
  const slots = [slot({ id: 's1' })]
  // Samedis du 3, 10 et 17 octobre.
  const validations = [{ schedule_slot_id: 's1', validation_date: '2026-10-03' }]
  const ferme = (d: string) => d === '2026-10-10'
  const tous = seancesAValider(slots, [], validations, '2026-10-01', SAMEDI, '12:00', ferme)
  assert.deepEqual(tous.map(s => s.date), ['2026-10-17'])

  const absent = (t: string | null, d: string) => t === 't1' && d === SAMEDI
  assert.equal(seancesAValider(slots, [], validations, '2026-10-01', SAMEDI, '12:00', ferme, absent).length, 0)

  const annule = [ex({ exception_type: 'cancelled' })]
  assert.equal(seancesAValider(slots, annule, validations, '2026-10-01', SAMEDI, '12:00', ferme).length, 0)
})

test('tauxAssiduite : un jour de classe par classe, absences dedoublonnees', () => {
  const slots = [slot({ id: 's1' }), slot({ id: 's2', start_time: '11:00:00', end_time: '12:00:00' })]
  // Deux samedis ouverts (10 et 17) x 10 eleves = 20 presences attendues.
  const absences = [
    { student_id: 'e1', class_id: 'c1', absence_date: '2026-10-10' },
    { student_id: 'e1', class_id: 'c1', absence_date: '2026-10-10' },
    { student_id: 'e2', class_id: 'c1', absence_date: '2026-10-17' },
    { student_id: 'e3', class_id: 'c1', absence_date: '2026-10-16' }, // pas un jour de classe
  ]
  const r = tauxAssiduite(slots, [], { c1: 10 }, absences, '2026-10-05', SAMEDI, '12:00', () => false)
  assert.deepEqual(r, { taux: 90, attendues: 20, absences: 2 })
})

test('tauxAssiduite : null sans cours, seance pas commencee ignoree', () => {
  assert.equal(tauxAssiduite([slot({})], [], { c1: 10 }, [], SAMEDI, SAMEDI, '08:00', () => false), null)
  assert.equal(tauxAssiduite([slot({})], [], {}, [], SAMEDI, SAMEDI, '12:00', () => false), null)
})

test('seancesSousAbsence : a remplacer, remplacee, annulee et jour ferme exclus', () => {
  const slots = [
    slot({ id: 'a', teacher_id: 't1' }),
    slot({ id: 'b', class_id: 'c2', teacher_id: 't2' }),
    slot({ id: 'c', class_id: 'c3', teacher_id: 't1' }),
  ]
  const ex: ExceptionSource[] = [
    { schedule_slot_id: 'b', exception_date: SAMEDI, exception_type: 'replacement', override_start_time: null, override_end_time: null, override_teacher_id: 't3' },
    { schedule_slot_id: 'c', exception_date: SAMEDI, exception_type: 'cancelled', override_start_time: null, override_end_time: null, override_teacher_id: null },
  ]
  const absents = new Set(['t1', 't2'])
  const r = seancesSousAbsence(slots, ex, SAMEDI, SAMEDI, () => false, t => absents.has(t ?? ''))
  assert.deepEqual(r.map(x => [x.seance.slotId, x.statut, x.absentId]), [['a', 'a_remplacer', 't1'], ['b', 'remplacee', 't2']])
  assert.equal(seancesSousAbsence(slots, ex, SAMEDI, SAMEDI, () => true, t => absents.has(t ?? '')).length, 0)
})
