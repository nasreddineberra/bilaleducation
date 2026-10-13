import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { appliquerOrdre, grouperParGabarit, moduleEffectif, type CoursPlace } from './ordre.ts'

// Referentiel : UE A (modules A1, A2) et UE B (module B1).
const ues = [{ id: 'A' }, { id: 'B' }]
const cours = new Map<string, CoursPlace>([
  ['ca1', { unite_enseignement_id: 'A', module_id: 'A1' }],
  ['ca2', { unite_enseignement_id: 'A', module_id: 'A2' }],
  ['ca0', { unite_enseignement_id: 'A', module_id: null }],
  ['cb1', { unite_enseignement_id: 'B', module_id: 'B1' }],
])
const ev = (id: string, cours_id: string, display_ue_id: string | null = null, display_module_id: string | null = null) =>
  ({ id, cours_id, display_ue_id, display_module_id })
const forme = (g: { ueId: string; modId: string | null; evals: { id: string }[] }[]) => g.map(x => `${x.ueId}/${x.modId ?? '-'}:${x.evals.map(e => e.id).join(',')}`)

test('sans ordre enregistre : ordre du Referentiel, sans module d abord', () => {
  const evals = [ev('1', 'ca2'), ev('2', 'cb1'), ev('3', 'ca1'), ev('4', 'ca0')]
  assert.deepEqual(forme(grouperParGabarit(evals, ues, cours, null)), ['A/-:4', 'A/A2:1', 'A/A1:3', 'B/B1:2'])
})

test('une UE n est jamais coupee en deux, meme si ses evaluations sont entrecoupees', () => {
  const evals = [ev('1', 'ca1'), ev('2', 'cb1'), ev('3', 'ca1')]
  assert.deepEqual(forme(grouperParGabarit(evals, ues, cours, null)), ['A/A1:1,3', 'B/B1:2'])
})

test('l ordre de l enseignant prime, sur les UE comme sur les modules', () => {
  const evals = [ev('1', 'ca1'), ev('2', 'ca2'), ev('3', 'cb1')]
  const config = { ue_order: ['B', 'A'], module_order: { A: ['A2', 'A1'] } }
  assert.deepEqual(forme(grouperParGabarit(evals, ues, cours, config)), ['B/B1:3', 'A/A2:2', 'A/A1:1'])
})

test('une UE ou un module absent de l ordre enregistre se place a la suite', () => {
  assert.deepEqual(appliquerOrdre(['x', 'y', 'z'], ['z']), ['z', 'x', 'y'])
  assert.deepEqual(appliquerOrdre(['x', 'y'], ['inconnu', 'y']), ['y', 'x'])
})

test('« afficher sous » une UE sans module : pas de module, pas celui du cours', () => {
  const e = ev('1', 'ca1', 'B', null)
  assert.equal(moduleEffectif(e, cours), null)
  assert.deepEqual(forme(grouperParGabarit([e], ues, cours, null)), ['B/-:1'])
})

test('evaluation sans cours connu : ecartee', () => {
  assert.deepEqual(grouperParGabarit([ev('1', 'inconnu')], ues, cours, null), [])
})

// Les Gabarits gardent leur propre rendu : on verifie qu'il applique la MEME
// regle (module effectif et ordre enregistre-puis-reste), pour qu'ils ne
// divergent pas en silence.
test('les Gabarits appliquent la meme regle', () => {
  const src = readFileSync(new URL('../../components/evaluations/EvaluationsClient.tsx', import.meta.url), 'utf8')
  assert.match(src, /e\.display_ue_id !== null\s*\?\s*e\.display_module_id/)
  assert.match(src, /savedOrder\.filter\(id => naturalModIds\.includes\(id\)\), \.\.\.naturalModIds\.filter\(id => !savedOrder\.includes\(id\)\)/)
  assert.match(src, /ueOrder\.filter\(id => rightUEIds\.has\(id\)\)/)
})
