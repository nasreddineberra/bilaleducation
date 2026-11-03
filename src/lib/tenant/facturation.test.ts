import { test } from 'node:test'
import assert from 'node:assert/strict'
import { montantMensuel, montantReleve } from './facturation.ts'

const releve = { eleves_actifs: 40, adultes_inscrits: 10, prix_inscrit: 2, forfait: 50 }

test('tarif de base seul : forfait + base x prix', () => {
  assert.equal(montantMensuel(50, 2, 50), 150)
  assert.deepEqual(montantReleve(releve), { base: 50, tarif: 150, option: null, total: 150 })
})

test('option active : son forfait + la MEME base x son prix', () => {
  const r = montantReleve({ ...releve, option_espace_famille: true, famille_forfait: 20, famille_prix_inscrit: 0.5 })
  assert.deepEqual(r, { base: 50, tarif: 150, option: 45, total: 195 })
})

test('option inactive ce mois-la : son tarif ne compte pas', () => {
  assert.equal(montantReleve({ ...releve, option_espace_famille: false, famille_forfait: 20, famille_prix_inscrit: 0.5 }).total, 150)
})

test('aucun tarif fixe : total inconnu ; option seule : son montant', () => {
  const sans = { eleves_actifs: 5, adultes_inscrits: 0, prix_inscrit: null, forfait: null }
  assert.equal(montantReleve(sans).total, null)
  assert.equal(montantReleve({ ...sans, option_espace_famille: true, famille_forfait: 10, famille_prix_inscrit: null }).total, 10)
})
