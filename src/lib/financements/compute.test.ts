import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { feeStatus, computeFamilyFinancials } from './compute.ts'

/**
 * `feeStatus` EST LA SEULE REGLE DE CE MODULE DUPLIQUEE EN SQL.
 *
 * Depuis le 6 octobre, les quatre ecritures d'argent passent par des RPC
 * atomiques (`add-financement-rpc-atomiques.sql`) qui doivent conclure sur le
 * statut DANS leur propre transaction. La regle vit donc aussi en base, dans
 * `fin_statut_dossier()`.
 *
 * Le reste — remise fratrie, subtotal — est RESTE en TypeScript a dessein : le
 * dupliquer reproduirait le defaut du 17 juillet, ou le calcul comptable
 * recopie dans trois sous-menus etait faux dans deux d'entre eux pendant des
 * semaines.
 *
 * Ces tests existent pour que la duplication assumee ne devienne pas une
 * divergence silencieuse. Un ecart ne leverait aucune erreur : il afficherait
 * simplement un statut a l'ecran et en enregistrerait un autre en base.
 */

// ── Translitteration de la fonction SQL, recopiee de la migration ───────────
//
// L'ORDRE DES BRANCHES EST SIGNIFIANT : intervertir « due <= 0 » et
// « paid >= due » changerait le cas d'un dossier a zero euro non paye.
function statutSql(paid: number, due: number): string {
  if (paid > due && due > 0) return 'overpaid'
  if (due <= 0)              return 'paid'
  if (paid >= due)           return 'paid'
  if (paid > 0)              return 'partial'
  return 'pending'
}

describe('feeStatus et son miroir SQL fin_statut_dossier', () => {
  test('les cinq verdicts nommes', () => {
    assert.equal(feeStatus(150, 100), 'overpaid')
    assert.equal(feeStatus(100, 100), 'paid')
    assert.equal(feeStatus(40, 100),  'partial')
    assert.equal(feeStatus(0, 100),   'pending')
    // Du NUL : solde, meme sans aucun versement. C'est la branche `due <= 0`,
    // placee AVANT `paid >= due` — un dossier a zero euro n'est pas « en
    // attente » de quelque chose.
    assert.equal(feeStatus(0, 0),     'paid')
  })

  test('du NEGATIF (remboursement superieur aux cotisations) : paid, jamais overpaid', () => {
    // `paid > due` est vrai (0 > -20) mais `due > 0` est faux : la premiere
    // branche ne mord pas, et c'est voulu. Sans la condition `due > 0`, un
    // foyer rembourse serait annonce « trop percu ».
    assert.equal(feeStatus(0, -20), 'paid')
    assert.equal(feeStatus(50, -20), 'paid')
  })

  test('TS et SQL rendent le MEME verdict sur une grille de 2 601 couples', () => {
    const valeurs: number[] = []
    for (let v = -50; v <= 200; v += 5) valeurs.push(v)
    // Les bornes exactes comptent plus que les valeurs rondes.
    valeurs.push(-0.01, 0.01, 99.99, 100.01, 0, 100)

    const ecarts: string[] = []
    for (const paid of valeurs) {
      for (const due of valeurs) {
        if (feeStatus(paid, due) !== statutSql(paid, due)) {
          ecarts.push(`paid=${paid} due=${due} : TS=${feeStatus(paid, due)} SQL=${statutSql(paid, due)}`)
        }
      }
    }
    assert.deepEqual(ecarts, [], `Divergence TS / SQL :\n${ecarts.slice(0, 10).join('\n')}`)
  })

  // ── LE CONTROLE QUI COMPTE VRAIMENT ──────────────────────────────────────
  //
  // Les tests ci-dessus comparent le TS a MA translitteration. Si la migration
  // changeait sans que je la mette a jour ici, ils resteraient verts et ne
  // prouveraient rien — le defaut « un controle qui ne mesure rien annonce 0 ».
  // Celui-ci lit le FICHIER DE MIGRATION et verifie que ses cinq branches y
  // sont, dans l'ordre.
  test('la migration porte bien ces cinq branches, dans cet ordre', () => {
    const sql = readFileSync('supabase/migrations/add-financement-rpc-atomiques.sql', 'utf8')

    const bloc = sql.slice(sql.indexOf('FUNCTION public.fin_statut_dossier'))
    const fin = bloc.indexOf('$fn$;')
    assert.ok(fin > 0, 'corps de fin_statut_dossier introuvable')
    const corps = bloc.slice(0, fin)

    // Garde-fou : si l'extraction echoue, le test doit ECHOUER, pas passer sur
    // une chaine vide.
    assert.ok(corps.length > 100, 'extraction du corps SQL anormalement courte')

    const branches = [...corps.matchAll(/THEN\s+'(\w+)'/g)].map(m => m[1])
    assert.deepEqual(
      branches,
      ['overpaid', 'paid', 'paid', 'partial'],
      'Les branches de fin_statut_dossier ont change : mettre a jour statutSql() ci-dessus ET verifier feeStatus().',
    )
    assert.match(corps, /ELSE\s+'pending'/, "la branche par defaut n'est plus 'pending'")
  })
})

describe('computeFamilyFinancials — la regle comptable', () => {
  test('les ajustements reduisent le DU, jamais le percu', () => {
    // Regle du 16 juillet : payer toute sa cotisation + un remboursement de 20
    // doit SOLDER le dossier. Avant, le remboursement etait retranche du percu
    // et la famille apparaissait devoir encore 20.
    const r = computeFamilyFinancials(100, {
      fee_adjustments:  [{ amount: -20 }],
      fee_installments: [{ amount_paid: 100 }],
    })
    assert.equal(r.totalDue, 80)
    assert.equal(r.netPercu, 100)
    assert.equal(r.remaining, -20)
    assert.equal(r.status, 'overpaid')
  })

  test('un dossier sans ligne : du = subtotal, rien de percu', () => {
    const r = computeFamilyFinancials(250, null)
    assert.equal(r.totalDue, 250)
    assert.equal(r.totalPaid, 0)
    assert.equal(r.status, 'pending')
  })
})
