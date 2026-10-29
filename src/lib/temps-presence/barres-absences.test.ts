import { test } from 'node:test'
import assert from 'node:assert/strict'
import { barresDeLaSemaine, joursCouverts } from './barres-absences.ts'

// Semaine du lundi 2 au dimanche 8 novembre 2026.
const semaine = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08']

test('jours couverts : minuit pile ne couvre pas le jour qui commence', () => {
  assert.deepEqual(joursCouverts('2026-11-04T08:00', '2026-11-06T18:00'), { premier: '2026-11-04', dernier: '2026-11-06' })
  assert.deepEqual(joursCouverts('2026-11-04T08:00', '2026-11-06T00:00'), { premier: '2026-11-04', dernier: '2026-11-05' })
  assert.deepEqual(joursCouverts('2026-11-04 14:00:00', '2026-11-04 16:00:00'), { premier: '2026-11-04', dernier: '2026-11-04' })
  // Changement de mois.
  assert.deepEqual(joursCouverts('2026-10-30T08:00', '2026-11-01T00:00'), { premier: '2026-10-30', dernier: '2026-10-31' })
})

test('une barre coupee aux deux bords de la semaine', () => {
  const [b] = barresDeLaSemaine([{ id: 'a', premier: '2026-10-28', dernier: '2026-11-12' }], semaine)
  assert.deepEqual(b, { id: 'a', colDebut: 0, colFin: 6, ligne: 0, coupeAvant: true, coupeApres: true })
})

test('rangement : pas de chevauchement, ligne reprise des qu elle est libre', () => {
  const barres = barresDeLaSemaine([
    { id: 'jeudi', premier: '2026-11-05', dernier: '2026-11-05' },
    { id: 'long', premier: '2026-11-03', dernier: '2026-11-05' },
    { id: 'vendredi', premier: '2026-11-06', dernier: '2026-11-06' },
    { id: 'avant', premier: '2026-10-01', dernier: '2026-10-31' },
  ], semaine)
  assert.deepEqual(barres.map(b => [b.id, b.colDebut, b.colFin, b.ligne]), [
    ['long', 1, 3, 0],
    ['jeudi', 3, 3, 1],
    ['vendredi', 4, 4, 0],
  ])
})

test('a egalite de debut, la plus longue en haut', () => {
  const barres = barresDeLaSemaine([
    { id: 'court', premier: '2026-11-04', dernier: '2026-11-04' },
    { id: 'long', premier: '2026-11-04', dernier: '2026-11-07' },
  ], semaine)
  assert.deepEqual(barres.map(b => [b.id, b.ligne]), [['long', 0], ['court', 1]])
})
