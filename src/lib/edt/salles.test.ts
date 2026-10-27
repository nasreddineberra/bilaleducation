import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sallesLibres } from './salles.ts'
import type { SlotSource, ExceptionSource } from '../dashboard/seances.ts'

// 2026-10-31 est un samedi (day_of_week = 6).
const SAMEDI = '2026-10-31'
const salles = [
  { id: 'r1', name: '101', room_type: 'salle_cours' },
  { id: 'r2', name: '102', room_type: 'salle_cours' },
  { id: 'reu', name: 'Réunion', room_type: 'salle_reunion' },
]
const slot = (o: Partial<SlotSource>): SlotSource => ({
  id: 'a', class_id: 'c', teacher_id: null, day_of_week: 6, start_time: '09:00:00', end_time: '12:00:00',
  slot_type: 'cours', is_recurring: true, slot_date: null, effective_from: null, effective_until: null,
  is_active: true, room_id: 'r1', ...o,
})
const ex = (o: Partial<ExceptionSource>): ExceptionSource => ({
  schedule_slot_id: 'a', exception_date: SAMEDI, exception_type: 'modified',
  override_start_time: null, override_end_time: null, override_teacher_id: null, override_room_id: null, ...o,
})
const ids = (l: { id: string }[]) => l.map(r => r.id)

test('seules les salles de cours ; occupee sur un horaire qui chevauche', () => {
  assert.deepEqual(ids(sallesLibres(salles, [slot({})], [], SAMEDI, '10:00', '11:00')), ['r2'])
  assert.deepEqual(ids(sallesLibres(salles, [slot({})], [], SAMEDI, '12:00', '13:00')), ['r1', 'r2'])
})

test('seance annulee ou seance elle-meme : la salle est libre ; salle actuelle toujours proposee', () => {
  assert.deepEqual(ids(sallesLibres(salles, [slot({})], [ex({ exception_type: 'cancelled' })], SAMEDI, '10:00', '11:00')), ['r1', 'r2'])
  assert.deepEqual(ids(sallesLibres(salles, [slot({})], [], SAMEDI, '10:00', '11:00', { exclureSlotId: 'a' })), ['r1', 'r2'])
  assert.deepEqual(ids(sallesLibres(salles, [slot({})], [], SAMEDI, '10:00', '11:00', { salleActuelle: 'reu' })), ['r2', 'reu'])
})

test('salle changee pour CETTE seance : c\'est elle qui est occupee', () => {
  assert.deepEqual(ids(sallesLibres(salles, [slot({})], [ex({ override_room_id: 'r2' })], SAMEDI, '10:00', '11:00')), ['r1'])
})

test('salle de la classe : occupee par ses seances de serie', () => {
  const s = slot({ room_id: null })
  const salleDeClasse = (c: string) => (c === 'c' ? 'r2' : null)
  assert.deepEqual(ids(sallesLibres(salles, [s], [], SAMEDI, '10:00', '11:00', { salleDeClasse })), ['r1'])
})
