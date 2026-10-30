import { test } from 'node:test'
import assert from 'node:assert/strict'
import { libelleTitulaires, titulaireActuel } from './titulaire.ts'

test('historique : aucun titulaire', () => {
  assert.equal(libelleTitulaires([]), null)
})

test('historique : un seul titulaire, un seul nom', () => {
  assert.equal(libelleTitulaires([{ nom: 'M. DUPONT Ali', du: null }]), 'M. DUPONT Ali')
})

test('historique : initial puis remplacant, quel que soit l\'ordre recu', () => {
  const liste = [
    { nom: 'Mme MARTIN Sara', du: '2026-01-05' },
    { nom: 'M. DUPONT Ali',   du: '2025-09-01' },
  ]
  assert.equal(libelleTitulaires(liste), 'M. DUPONT Ali puis Mme MARTIN Sara')
  assert.equal(liste[0].nom, 'Mme MARTIN Sara', 'la liste recue n\'est pas modifiee')
})

test('historique : sans date d\'effet = depuis le debut', () => {
  assert.equal(
    libelleTitulaires([{ nom: 'Mme MARTIN Sara', du: '2026-01-05' }, { nom: 'M. DUPONT Ali', du: null }]),
    'M. DUPONT Ali puis Mme MARTIN Sara',
  )
})

test('historique : trois titulaires, celui du milieu n\'est pas nomme', () => {
  assert.equal(
    libelleTitulaires([
      { nom: 'A', du: '2025-09-01' },
      { nom: 'B', du: '2025-11-01' },
      { nom: 'C', du: '2026-02-01' },
    ]),
    'A puis C',
  )
})

test('historique : le meme au debut et a la fin, un seul nom', () => {
  assert.equal(libelleTitulaires([{ nom: 'A', du: '2025-09-01' }, { nom: 'B', du: '2025-11-01' }, { nom: 'A', du: '2026-02-01' }]), 'A')
})

test('temps reel : le titulaire sans date de fin, jamais l\'ancien', () => {
  const affectations = [
    { is_main_teacher: true, effective_until: '2025-12-31', nom: 'ancien' },
    { is_main_teacher: true, effective_until: null, nom: 'actuel' },
  ]
  assert.equal(titulaireActuel(affectations)?.nom, 'actuel')
  assert.equal(titulaireActuel([{ is_main_teacher: true, effective_until: '2025-12-31' }]), undefined)
})
