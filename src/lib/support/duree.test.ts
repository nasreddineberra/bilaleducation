import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { INTERVENTION_MAX_HEURES } from './duree.ts'

// La duree maximale d'une intervention vit a DEUX endroits : la constante de
// l'application (expiration au rendu d'une page) et la tache planifiee en base
// (`fn_expirer_interventions_support`), qui coupe l'acces meme si aucune page
// n'est ouverte. Une divergence ne leverait AUCUNE erreur : l'une expirerait,
// l'autre non. Ce test lit la migration pour les garder alignees.
test('la tache planifiee expire apres la meme duree que l application', () => {
  const sql = readFileSync('supabase/migrations/expire-support-interventions-cron.sql', 'utf8')
  const m = sql.match(/opened_at < now\(\) - interval '(\d+) hours?'/)
  assert.ok(m, 'intervalle introuvable dans la migration')
  assert.equal(Number(m![1]), INTERVENTION_MAX_HEURES)
})
