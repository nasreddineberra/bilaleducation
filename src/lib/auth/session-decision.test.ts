/**
 * LE PARCOURS DE SESSION, ÉPROUVÉ. Premier test automatisé du projet.
 *
 * Lancer : `npm test`  (ou `node --test src/lib/auth/session-decision.test.ts`)
 *
 * AUCUNE DÉPENDANCE. `node:test` est natif et Node 24 lit le TypeScript sans
 * transpilation : rien à installer, rien à tenir à jour, rien qui puisse être
 * compromis en amont. Le projet a déjà retiré `next/font/google` pour supprimer
 * une dépendance réseau au moment du build ; la même règle valait ici.
 *
 * SEULE CONTRAINTE : les imports portent l'extension `.ts`, que le reste du
 * projet omet (Turbopack la résout, Node non). Elle ne vaut que pour les
 * fichiers de test.
 *
 * CE QUE CES TESTS NE COUVRENT PAS, et il faut le savoir : le comportement
 * réel d'un navigateur détenant deux cookies de même nom, le flux 2FA, et
 * Supabase. Ils couvrent la DÉCISION — là où vivaient quatre des six défauts.
 */

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import { evaluerSession, lireTraceur, traceurCouvreLaFenetre, type SeuilsSession }
  from './session-decision.ts'
import { INACTIVITY_SECONDS, MAX_SESSION_SECONDS, SESSION_COOKIE_MAX_AGE }
  from '../session-config.ts'

// Les seuils RÉELS de production : les tests portent sur ce qui tourne, pas sur
// des valeurs choisies pour arranger le test.
const SEUILS: SeuilsSession = {
  inactiviteSecondes: INACTIVITY_SECONDS,        // 1 200 s = 20 min
  dureeMaxSecondes: MAX_SESSION_SECONDS,         // 86 400 s = 24 h
  traceurMaxAgeSecondes: SESSION_COOKIE_MAX_AGE, //  4 800 s = 1 h 20
}

const MINUTE = 60
const HEURE = 3600
const JOUR = 86400

/** Un matin de rentrée : base de temps fixe, donc tests reproductibles. */
const T0 = Date.parse('2027-09-01T08:00:00.000Z')

/** Date de connexion située il y a `s` secondes, au format de Supabase. */
const connexionIlYA = (s: number) => new Date(T0 - s * 1000).toISOString()

/** Cookie traceur dont la dernière activité date de `s` secondes. */
const traceurIlYA = (s: number) =>
  JSON.stringify({ lastActivity: Math.floor((T0 - s * 1000) / 1000) })

/** Raccourci : le verdict seul, sur les seuils de production. */
const verdict = (lastSignInAt: string | null, traceur?: string) =>
  evaluerSession({ lastSignInAt, traceur, maintenantMs: T0 }, SEUILS).verdict

// ═══════════════════════════════════════════════════════════════════════════
describe('Chemins nominaux', () => {
  test('session jeune et traceur frais : on entre', () => {
    assert.equal(verdict(connexionIlYA(5 * MINUTE), traceurIlYA(MINUTE)), 'ok')
  })

  test('traceur de 19 min : sous la fenêtre, on entre', () => {
    assert.equal(verdict(connexionIlYA(HEURE), traceurIlYA(19 * MINUTE)), 'ok')
  })

  test('traceur de 20 min PILE : on entre (le seuil est strict)', () => {
    // `>` et non `>=` : la borne exacte appartient à l'utilisateur. Un test sur
    // la valeur ronde est le seul moyen de s'en apercevoir si elle change.
    assert.equal(verdict(connexionIlYA(HEURE), traceurIlYA(INACTIVITY_SECONDS)), 'ok')
  })

  test('traceur de 20 min et 1 s : inactivité', () => {
    assert.equal(verdict(connexionIlYA(HEURE), traceurIlYA(INACTIVITY_SECONDS + 1)), 'inactivity')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('FAIL-OPEN quand le traceur manque (le verrouillage du 9 août)', () => {
  test('session de 5 min SANS traceur : on entre', () => {
    // C'est le cas qui a verrouillé la production : une session toute neuve n'a
    // pas encore de traceur, et la règle FAIL-CLOSED la déconnectait aussitôt.
    // Chaque tentative repartait du même état, sans recours.
    assert.equal(verdict(connexionIlYA(5 * MINUTE), undefined), 'ok')
  })

  test('session de 1 h sans traceur : encore dans la durée de vie du cookie, on entre', () => {
    assert.equal(verdict(connexionIlYA(HEURE), undefined), 'ok')
  })

  test('session de 1 h 21 sans traceur : le cookie a expiré sans être rafraîchi', () => {
    // La déduction : si le traceur avait été rafraîchi, il serait là. Son
    // absence au-delà de sa durée de vie PROUVE l'absence d'activité.
    assert.equal(verdict(connexionIlYA(SESSION_COOKIE_MAX_AGE + 60), undefined), 'inactivity')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('Un traceur qui ne dit rien de fiable vaut ABSENT, jamais ZÉRO', () => {
  // Point le plus subtil du module. Si `lireTraceur` renvoyait `0` au lieu de
  // `null`, alors `now - 0` dépasserait n'importe quelle fenêtre et TOUT
  // cookie abîmé déconnecterait. La distinction null/0 est la garantie.
  const jeune = connexionIlYA(5 * MINUTE)

  test('JSON cassé', () => {
    assert.equal(lireTraceur('{ pas du json'), null)
    assert.equal(verdict(jeune, '{ pas du json'), 'ok')
  })

  test('JSON valide mais sans lastActivity', () => {
    assert.equal(lireTraceur('{"autre":1}'), null)
    assert.equal(verdict(jeune, '{"autre":1}'), 'ok')
  })

  test('lastActivity en chaîne de caractères', () => {
    assert.equal(lireTraceur('{"lastActivity":"1800000000"}'), null)
    assert.equal(verdict(jeune, '{"lastActivity":"1800000000"}'), 'ok')
  })

  test('lastActivity à null', () => {
    assert.equal(lireTraceur('{"lastActivity":null}'), null)
    assert.equal(verdict(jeune, '{"lastActivity":null}'), 'ok')
  })

  test('cookie vide', () => {
    assert.equal(lireTraceur(''), null)
  })

  test('lastActivity à 0 est un NOMBRE, donc il fait foi, donc il déconnecte', () => {
    // Un cookie portant réellement 0 n'est pas « abîmé » : il dit « dernière
    // activité en 1970 ». On le croit. C'est la contrepartie assumée.
    assert.equal(lireTraceur('{"lastActivity":0}'), 0)
    assert.equal(verdict(jeune, '{"lastActivity":0}'), 'inactivity')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('Quand Supabase ne dit pas l âge de la session', () => {
  test('date absente, traceur frais : on entre', () => {
    assert.equal(verdict(null, traceurIlYA(MINUTE)), 'ok')
  })

  test('date illisible, aucun traceur : on entre (âge réputé nul)', () => {
    assert.equal(verdict('pas-une-date', undefined), 'ok')
  })

  test('ni date ni traceur : on entre — on ne déconnecte pas sur du vide', () => {
    const d = evaluerSession({ lastSignInAt: null, traceur: undefined, maintenantMs: T0 }, SEUILS)
    assert.equal(d.verdict, 'ok')
    assert.equal(d.ageSessionSecondes, 0)
    assert.equal(d.lastActivity, null)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('Durée maximale, ancrée sur last_sign_in_at', () => {
  test('23 h 59 avec traceur frais : on entre', () => {
    assert.equal(verdict(connexionIlYA(24 * HEURE - 60), traceurIlYA(MINUTE)), 'ok')
  })

  test('25 h avec traceur frais : expiration, et le motif est « session »', () => {
    // Quelqu un d actif en permanence est déconnecté quand même : c est le
    // propre de la durée maximale, et le traceur frais le prouve ici.
    const d = evaluerSession(
      { lastSignInAt: connexionIlYA(25 * HEURE), traceur: traceurIlYA(MINUTE), maintenantMs: T0 },
      SEUILS,
    )
    assert.equal(d.expired, true)
    assert.equal(d.inactive, false)
    assert.equal(d.verdict, 'session')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('RETOUR DE VACANCES : deux mois sans connexion', () => {
  // Scénario réel de l établissement : les équipes pédagogiques ne se
  // connectent pas pendant les vacances d été, puis reviennent TOUTES le même
  // matin. Un défaut de ce bloc dormirait deux mois avant de tomber sur dix
  // personnes à la fois — raison d être de ce fichier.

  test('60 jours sans traceur : les DEUX fenêtres sont franchies', () => {
    const d = evaluerSession(
      { lastSignInAt: connexionIlYA(60 * JOUR), traceur: undefined, maintenantMs: T0 },
      SEUILS,
    )
    assert.equal(d.inactive, true, 'inactif : le traceur a disparu depuis longtemps')
    assert.equal(d.expired, true, 'expiré : bien au-delà des 24 h')
    // L INACTIVITÉ PRIME : comportement d origine, figé ici tel quel. L écran
    // annoncera donc « expirée pour inactivité » après deux mois, alors que la
    // cause structurelle est la durée maximale. Le changer est une DÉCISION,
    // pas une correction — et ce test se mettra au rouge pour le signaler.
    assert.equal(d.verdict, 'inactivity')
  })

  test('60 jours avec un traceur frais : la durée maximale tranche seule', () => {
    // Combinaison impossible en pratique (le traceur ne vit que 1 h 20), mais
    // elle isole la priorité du motif : sans inactivité, c est « session ».
    assert.equal(verdict(connexionIlYA(60 * JOUR), traceurIlYA(MINUTE)), 'session')
  })

  test('on ne reste JAMAIS connecté après deux mois, quel que soit le cookie', () => {
    for (const t of [undefined, '', '{ casse', '{"lastActivity":null}', traceurIlYA(MINUTE)]) {
      assert.notEqual(verdict(connexionIlYA(60 * JOUR), t), 'ok',
        'un cookie ne doit jamais prolonger une session de deux mois')
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('Horloge décalée', () => {
  test('dernière activité dans le futur : on entre', () => {
    // Un poste en avance de dix minutes rend `now - lastActivity` négatif. On
    // entre, conformément au FAIL-OPEN : une horloge mal réglée ne doit pas
    // enfermer dehors.
    assert.equal(verdict(connexionIlYA(HEURE), traceurIlYA(-10 * MINUTE)), 'ok')
  })

  test('connexion dans le futur : âge négatif, on entre', () => {
    assert.equal(verdict(connexionIlYA(-HEURE), undefined), 'ok')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('L INVARIANT des seuils, et ce qui arrive quand il tombe', () => {
  test('les constantes de PRODUCTION le respectent', () => {
    assert.ok(traceurCouvreLaFenetre(SEUILS),
      `traceur=${SESSION_COOKIE_MAX_AGE}s doit tenir entre inactivité=${INACTIVITY_SECONDS}s et max=${MAX_SESSION_SECONDS}s`)
  })

  test('traceur à 30 JOURS : la protection d inactivité s auto-désactive', () => {
    // LE DÉFAUT DU 13 JUILLET, reproduit. Avec un traceur qui survit à la
    // fenêtre qu il surveille, son absence n est plus jamais concluante : une
    // session de trois heures sans traceur est déclarée valide.
    const trenteJours: SeuilsSession = { ...SEUILS, traceurMaxAgeSecondes: 30 * JOUR }
    assert.equal(traceurCouvreLaFenetre(trenteJours), false)

    const entrees = { lastSignInAt: connexionIlYA(3 * HEURE), traceur: undefined, maintenantMs: T0 }
    assert.equal(evaluerSession(entrees, SEUILS).verdict, 'inactivity', 'seuils sains')
    assert.equal(evaluerSession(entrees, trenteJours).verdict, 'ok', 'seuils cassés : on entre à tort')
  })

  test('traceur plus COURT que la fenêtre : déconnexion d une session valide', () => {
    // L autre sens du même invariant : le cookie disparaît avant la fin de la
    // fenêtre, et la branche « absent » tranche sur un âge sans rapport.
    const tropCourt: SeuilsSession = { ...SEUILS, traceurMaxAgeSecondes: 10 * MINUTE }
    assert.equal(traceurCouvreLaFenetre(tropCourt), false)
    assert.equal(verdict(connexionIlYA(15 * MINUTE), undefined), 'ok', 'seuils sains')
    assert.equal(
      evaluerSession({ lastSignInAt: connexionIlYA(15 * MINUTE), traceur: undefined, maintenantMs: T0 }, tropCourt).verdict,
      'inactivity', 'seuils cassés : déconnexion à 15 min')
  })
})
