import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { messageLimiteInscrits, REPERE_LIMITE } from './limite-inscrits.ts'

test('reconnait le refus a son repere et reformule en francais accentue', () => {
  const msg = messageLimiteInscrits({
    code: '23514', hint: 'limite_inscrits', details: 'max=50;eleves=48;adultes=3',
    message: 'Limite de l abonnement atteinte : 50 inscrits maximum (48 eleves actifs + 3 adultes inscrits).',
  })
  assert.equal(msg, "Limite de l'abonnement atteinte : 50 inscrits au maximum (48 élèves actifs + 3 adultes inscrits). Contactez l'éditeur pour l'augmenter.")
})

test('accorde au singulier', () => {
  const msg = messageLimiteInscrits({ hint: 'limite_inscrits', details: 'max=1;eleves=1;adultes=1' })
  assert.match(msg!, /1 inscrit au maximum \(1 élève actif \+ 1 adulte inscrit\)/)
})

test('rend null pour toute autre erreur (meme code)', () => {
  assert.equal(messageLimiteInscrits(null), null)
  assert.equal(messageLimiteInscrits({ code: '23514', message: 'new row violates check constraint' }), null)
})

test('details illisibles : message generique, jamais de chiffre invente', () => {
  assert.match(messageLimiteInscrits({ hint: 'limite_inscrits', details: '' })!, /Limite d'inscrits/)
})

test('le repere et le format des details sont ceux de la migration', () => {
  const sql = readFileSync(new URL('../../../supabase/migrations/guard-limite-inscrits.sql', import.meta.url), 'utf8')
  assert.ok(sql.includes(`HINT    = '${REPERE_LIMITE}'`), 'repere absent de la migration')
  assert.ok(sql.includes("format('max=%s;eleves=%s;adultes=%s'"), 'format des details modifie')
})
