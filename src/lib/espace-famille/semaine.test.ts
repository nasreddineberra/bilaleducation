import { test } from 'node:test'
import assert from 'node:assert/strict'
import { joursDeLaSemaine, semaineFamille, type CreneauFamille, type EntreeSemaine } from './semaine.ts'

// Semaine du lundi 2 au dimanche 8 novembre 2026 (le 4 est un mercredi).
const creneau = (o: Partial<CreneauFamille>): CreneauFamille => ({
  id: 's1', class_id: 'c1', day_of_week: 3, start_time: '10:00:00', end_time: '12:00:00', slot_type: 'cours',
  is_recurring: true, slot_date: null, effective_from: null, effective_until: null, is_active: true, room_id: null,
  libelle: null, unites_enseignement: { nom_fr: 'Langue' }, ...o,
})

const entree = (o: Partial<EntreeSemaine> = {}): EntreeSemaine => ({
  jours: joursDeLaSemaine('2026-11-04', 1, 7),
  creneaux: [creneau({})],
  exceptions: [],
  decisions: [],
  titulaireDe: () => 't1',
  nomEnseignant: id => (id === 't1' ? 'Mme MARTIN Lea' : null),
  salleDeLaClasse: () => 'r1',
  nomSalle: id => (id === 'r1' ? '101' : id === 'r2' ? 'Bibliothèque' : null),
  vacances: [],
  feries: [],
  participants: [{ classId: 'c1', libelle: 'Lina' }],
  ...o,
})

const mercredi = (e: EntreeSemaine) => semaineFamille(e).find(j => j.date === '2026-11-04')!

test('jours de la semaine : debut de l ecole, jours ouvres', () => {
  assert.deepEqual(joursDeLaSemaine('2026-11-04', 1, 5), ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06'])
  assert.equal(joursDeLaSemaine('2026-11-08', 1, 7)[0], '2026-11-02')
  assert.equal(joursDeLaSemaine('2026-11-04', 6, 2)[0], '2026-10-31')
})

test('seance recurrente : intitule, salle de la classe, titulaire', () => {
  const s = mercredi(entree()).seances
  assert.equal(s.length, 1)
  assert.deepEqual({ ...s[0] }, {
    slotId: 's1', debut: '10:00', fin: '12:00', intitule: 'Langue', salle: 'Salle 101',
    enseignant: 'Mme MARTIN Lea', statut: 'prevue', qui: ['Lina'],
  })
  // Un seul jour : le mercredi.
  assert.equal(semaineFamille(entree()).reduce((n, j) => n + j.seances.length, 0), 1)
})

test('dates d effet et seance ponctuelle', () => {
  assert.equal(mercredi(entree({ creneaux: [creneau({ effective_from: '2026-11-05' })] })).seances.length, 0)
  assert.equal(mercredi(entree({ creneaux: [creneau({ effective_until: '2026-11-03' })] })).seances.length, 0)
  const ponctuelle = creneau({ id: 'p', is_recurring: false, day_of_week: null, slot_date: '2026-11-04', room_id: 'r2' })
  assert.equal(mercredi(entree({ creneaux: [ponctuelle], salleDeLaClasse: () => null })).seances[0].salle, 'Salle Bibliothèque')
})

test('annulee, remplacee, salle changee', () => {
  const annulee = mercredi(entree({ decisions: [{ schedule_slot_id: 's1', seance_date: '2026-11-04', decision: 'annulee', remplacant_profile_id: null, remplacant_teacher_id: null, remplacant_civilite: null, remplacant_nom: null, remplacant_prenom: null }] })).seances[0]
  assert.equal(annulee.statut, 'annulee')
  assert.equal(annulee.enseignant, null)

  const remplacee = mercredi(entree({ decisions: [{ schedule_slot_id: 's1', seance_date: '2026-11-04', decision: 'remplacee', remplacant_profile_id: 'pr', remplacant_teacher_id: null, remplacant_civilite: 'M.', remplacant_nom: 'DURAND', remplacant_prenom: 'Paul' }] })).seances[0]
  assert.equal(remplacee.statut, 'remplacee')
  assert.equal(remplacee.enseignant, 'M. DURAND Paul')

  const salle = mercredi(entree({ exceptions: [{ schedule_slot_id: 's1', exception_date: '2026-11-04', exception_type: 'modified', override_room_id: 'r2' }] })).seances[0]
  assert.equal(salle.salle, 'Salle Bibliothèque')
  assert.equal(salle.statut, 'prevue')

  const exception = mercredi(entree({ exceptions: [{ schedule_slot_id: 's1', exception_date: '2026-11-04', exception_type: 'cancelled', override_room_id: null }] })).seances[0]
  assert.equal(exception.statut, 'annulee')
})

test('jour ferme : pas de seance, le motif', () => {
  const j = mercredi(entree({ feries: [{ date: '2026-11-04', label: 'Test' }] }))
  assert.equal(j.seances.length, 0)
  assert.equal(j.ferme?.nature, 'ferie')
  const v = mercredi(entree({ vacances: [{ start_date: '2026-11-01', end_date: '2026-11-05', label: 'Toussaint' }] }))
  assert.equal(v.ferme?.nature, 'vacances')
})

test('classes de plusieurs participants, fusion du cours adulte', () => {
  const e = entree({
    creneaux: [creneau({}), creneau({ id: 's2', class_id: 'ca', start_time: '08:00:00', end_time: '09:00:00', slot_type: 'activite', libelle: 'Atelier', unites_enseignement: null })],
    participants: [{ classId: 'c1', libelle: 'Lina' }, { classId: 'ca', libelle: 'Moi' }],
  })
  const s = mercredi(e).seances
  assert.deepEqual(s.map(x => [x.debut, x.intitule, x.qui.join()]), [['08:00', 'Atelier', 'Moi'], ['10:00', 'Langue', 'Lina']])
  // Classe sans participant : rien.
  assert.equal(mercredi(entree({ participants: [{ classId: 'autre', libelle: 'X' }] })).seances.length, 0)
})
