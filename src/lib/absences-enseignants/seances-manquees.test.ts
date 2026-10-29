import { test } from 'node:test'
import assert from 'node:assert/strict'
import { seancesManquees, type DecisionEnBase } from './seances-manquees.ts'
import type { SeanceTouchee } from '../edt/absences.ts'

const seances: SeanceTouchee[] = [
  { slotId: 's1', classId: 'c1', date: '2026-11-04', startTime: '09:00:00', endTime: '10:30:00' },
  { slotId: 's2', classId: 'c2', date: '2026-11-04', startTime: '14:00', endTime: '16:00' },
  { slotId: 's1', classId: 'c1', date: '2026-11-11', startTime: '09:00:00', endTime: '10:30:00' },
]

const decisions: DecisionEnBase[] = [
  { absence_id: 'a1', schedule_slot_id: 's1', seance_date: '2026-11-04', decision: 'remplacee', remplacant_profile_id: 'p9' },
  { absence_id: 'a1', schedule_slot_id: 's2', seance_date: '2026-11-04', decision: 'annulee', remplacant_profile_id: null },
  // Une autre absence, et une decision sans seance touchee : ignorees.
  { absence_id: 'a2', schedule_slot_id: 's1', seance_date: '2026-11-11', decision: 'annulee', remplacant_profile_id: null },
  { absence_id: 'a1', schedule_slot_id: 's3', seance_date: '2026-11-18', decision: 'annulee', remplacant_profile_id: null },
]

test('chaque seance touchee porte sa duree et sa decision', () => {
  const r = seancesManquees('a1', seances, decisions)
  assert.deepEqual(r.map(s => [s.slotId, s.date, s.minutes, s.decision, s.remplacantProfileId]), [
    ['s1', '2026-11-04', 90, 'remplacee', 'p9'],
    ['s2', '2026-11-04', 120, 'annulee', null],
    ['s1', '2026-11-11', 90, 'a_decider', null],
  ])
  assert.ok(r.every(s => s.absenceId === 'a1'))
})

test('sans seance touchee, rien ne compte', () => {
  assert.deepEqual(seancesManquees('a1', [], decisions), [])
})
