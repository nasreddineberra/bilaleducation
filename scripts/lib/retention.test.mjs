import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { choisirAGarder, numeroDeSemaine, MOTIF_DOSSIER } from './retention.mjs'

/**
 * LA RETENTION EST LA SEULE PARTIE DU DISPOSITIF QUI SUPPRIME.
 *
 * Elle ne leve pas quand elle se trompe : elle efface, et l'on ne s'en apercoit
 * que le jour ou l'on cherche une sauvegarde qui n'est plus la. Deux defauts y
 * ont ete trouves par l'epreuve, aucun ne se voyait a la lecture — les deux ont
 * leur test nomme ci-dessous.
 */

const JEU = [
  // trois le MEME jour
  '2026-10-07_08h00', '2026-10-07_12h00', '2026-10-07_20h00',
  // neuf jours consecutifs ensuite
  '2026-10-06_20h00', '2026-10-05_20h00', '2026-10-04_20h00', '2026-10-03_20h00',
  '2026-10-02_20h00', '2026-10-01_20h00', '2026-09-30_20h00', '2026-09-29_20h00',
  // cinq semaines en arriere
  '2026-09-24_20h00', '2026-09-17_20h00', '2026-09-10_20h00', '2026-09-03_20h00',
  '2026-08-27_20h00',
]

describe('choisirAGarder — la regle du jour', () => {

  test('UN SEUL dossier garde par jour, et c est le plus recent', () => {
    const { garder, supprimer } = choisirAGarder(JEU)
    const jours = garder.map(g => g.slice(0, 10))
    assert.equal(new Set(jours).size, jours.length, 'deux dossiers du meme jour sont gardes')
    assert.ok(garder.includes('2026-10-07_20h00'), 'le plus recent du jour doit etre garde')
    assert.ok(supprimer.includes('2026-10-07_08h00'))
    assert.ok(supprimer.includes('2026-10-07_12h00'))
  })

  test('« 7 plus recentes » n est PAS « 7 derniers jours » — defaut n°1', () => {
    // Dix sauvegardes le meme jour : garder les 7 plus recentes ne garderait
    // AUCUN autre jour. La regle par jour en garde une seule, et laisse les six
    // autres places aux jours precedents.
    const memeJour = Array.from({ length: 10 }, (_, i) => `2026-10-07_${String(8 + i).padStart(2, '0')}h00`)
    const avant = ['2026-10-06_20h00', '2026-10-05_20h00', '2026-10-04_20h00']
    const { garder } = choisirAGarder([...memeJour, ...avant])
    assert.equal(garder.filter(g => g.startsWith('2026-10-07')).length, 1)
    for (const a of avant) assert.ok(garder.includes(a), `${a} doit survivre`)
  })

  test('sept JOURS distincts au titre du quotidien', () => {
    const { garder } = choisirAGarder(JEU)
    const septPremiers = garder.slice(0, 7).map(g => g.slice(0, 10))
    assert.equal(new Set(septPremiers).size, 7)
  })
})

describe('choisirAGarder — la regle de la semaine', () => {

  test('les quatre hebdomadaires S AJOUTENT aux sept quotidiennes — defaut n°2', () => {
    // Les semaines deja couvertes par la passe quotidienne ne doivent pas
    // consommer le budget hebdomadaire : on en gardait 2 au lieu de 4.
    const { garder } = choisirAGarder(JEU)
    assert.equal(garder.length, 11, 'attendu 7 quotidiennes + 4 hebdomadaires')
  })

  test('aucune sauvegarde de la semaine en cours n est REPECHEE par la passe hebdomadaire', () => {
    // Six du meme jour et rien d'autre : la passe quotidienne en garde une, et
    // la passe hebdomadaire ne doit pas en reprendre une seconde dans la meme
    // semaine. C'est le defaut constate sur le dossier reel (2 gardees au lieu
    // d'une).
    const memeSemaine = ['2026-10-07_11h07', '2026-10-07_11h06', '2026-10-07_11h05',
                         '2026-10-07_11h04', '2026-10-07_10h59', '2026-10-07_10h58']
    const { garder, supprimer } = choisirAGarder(memeSemaine)
    assert.equal(garder.length, 1, `gardees : ${garder.join(', ')}`)
    assert.equal(supprimer.length, 5)
  })

  test('une seule sauvegarde par semaine au-dela du quotidien', () => {
    const { garder } = choisirAGarder(JEU)
    const auDela = garder.slice(7)
    const semaines = auDela.map(n => {
      const [a, m, j] = n.slice(0, 10).split('-').map(Number)
      return numeroDeSemaine(new Date(a, m - 1, j))
    })
    assert.equal(new Set(semaines).size, semaines.length)
  })
})

describe('choisirAGarder — ce qui ne doit JAMAIS etre supprime', () => {

  test('un nom qui n est pas le notre n est ni garde ni supprime', () => {
    // La garde structurelle : l appelant n efface que ce qui sort de
    // `supprimer`. Un dossier etranger ne doit apparaitre dans AUCUNE des deux
    // listes — sinon une purge emporterait les fichiers de quelqu un d autre.
    const etrangers = ['archives-a-moi', 'photos', '2026-10', 'base.dump', 'LISEZ-MOI.txt']
    const { garder, supprimer } = choisirAGarder([...JEU, ...etrangers])
    for (const e of etrangers) {
      assert.ok(!garder.includes(e), `${e} ne doit pas etre garde`)
      assert.ok(!supprimer.includes(e), `${e} ne doit pas etre supprime`)
    }
  })

  test('une liste vide ne supprime rien', () => {
    const { garder, supprimer } = choisirAGarder([])
    assert.deepEqual(garder, [])
    assert.deepEqual(supprimer, [])
  })

  test('moins de sauvegardes que le quota : on ne supprime rien', () => {
    const trois = ['2026-10-07_20h00', '2026-10-06_20h00', '2026-10-05_20h00']
    const { garder, supprimer } = choisirAGarder(trois)
    assert.equal(garder.length, 3)
    assert.deepEqual(supprimer, [])
  })

  test('le motif de nom refuse ce qui y ressemble sans en etre', () => {
    assert.ok(MOTIF_DOSSIER.test('2026-10-07_20h00'))
    assert.ok(!MOTIF_DOSSIER.test('2026-10-07_20h00-copie'))
    assert.ok(!MOTIF_DOSSIER.test('2026-10-07'))
    assert.ok(!MOTIF_DOSSIER.test('a2026-10-07_20h00'))
  })
})

describe('numeroDeSemaine — la cle de regroupement', () => {

  test('deux jours de la meme semaine ISO donnent la meme cle', () => {
    // Lundi 5 et dimanche 11 octobre 2026 : meme semaine.
    assert.equal(numeroDeSemaine(new Date(2026, 9, 5)), numeroDeSemaine(new Date(2026, 9, 11)))
  })

  test('le dimanche et le lundi suivant NE sont PAS dans la meme semaine', () => {
    // Piege classique : la semaine ISO commence le LUNDI. Un regroupement qui
    // la ferait commencer le dimanche decalerait toute la retention d un jour.
    assert.notEqual(numeroDeSemaine(new Date(2026, 9, 11)), numeroDeSemaine(new Date(2026, 9, 12)))
  })

  test('un changement d annee ne casse pas la cle', () => {
    // 31 decembre 2026 (jeudi) appartient a la semaine 53 de 2026 ; le
    // 1er janvier 2027 (vendredi) a la MEME semaine ISO.
    assert.equal(numeroDeSemaine(new Date(2026, 11, 31)), numeroDeSemaine(new Date(2027, 0, 1)))
  })
})
