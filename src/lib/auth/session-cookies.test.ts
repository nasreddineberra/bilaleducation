/**
 * LA PURGE DES TRACEURS, et le contrôle « UN SEUL ÉCRIVAIN ».
 *
 * Lancer : `npm test`
 *
 * Deux défauts du câblage sont visés, et ils sont de nature différente :
 *
 *  · 11 août — DEUX ÉCRIVAINS pour `app-session` : la page de connexion et le
 *    middleware. Le navigateur en gardait deux, dont un périmé, et la
 *    production s'est verrouillée. Aucun test de comportement ne l'attrape : il
 *    faut regarder la FORME DU CODE. D'où le second bloc, qui lit les sources.
 *
 *  · 11 août — une purge portant un domaine n'efface QUE le cookie qui en a
 *    un. L'autre survit, et la boucle recommence. D'où le premier bloc, qui
 *    exige les deux variantes.
 */

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

import {
  entetesDePurge, doitPurger,
  COOKIE_SESSION, COOKIE_MARQUEUR_RETIRE, COOKIES_A_PURGER, CHEMINS_DE_PURGE,
} from './session-cookies.ts'

// ═══════════════════════════════════════════════════════════════════════════
describe('Les en-têtes de purge', () => {
  const DOMAINE = '.bilaleducation.fr'

  test('sans domaine : un en-tête par cookie', () => {
    const e = entetesDePurge()
    assert.equal(e.length, 2, 'deux cookies, une variante chacun')
    // Chaînes EXACTES, recopiées du code qui tournait avant l'extraction : ce
    // test est la preuve que rien n'a bougé au passage.
    assert.deepEqual(e, [
      'app-session=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax',
      'app-open=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax',
    ])
  })

  test('avec domaine : DEUX en-têtes par cookie, avec et sans', () => {
    const e = entetesDePurge(DOMAINE)
    assert.equal(e.length, 4, 'deux cookies x deux variantes')
    assert.deepEqual(e, [
      'app-session=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax',
      'app-session=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax; Domain=.bilaleducation.fr',
      'app-open=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax',
      'app-open=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax; Domain=.bilaleducation.fr',
    ])
  })

  test('la variante SANS domaine ne doit JAMAIS disparaître', () => {
    // LE DÉFAUT DU 11 AOÛT, en une assertion. Avant `NEXT_PUBLIC_SITE_URL`, les
    // cookies étaient attachés à l'hôte seul ; un navigateur ayant traversé ce
    // changement en détient un sans domaine. Ne purger qu'avec domaine le
    // laisse vivre, et sa seule présence rouvre la boucle sur /login.
    const e = entetesDePurge(DOMAINE)
    for (const nom of COOKIES_A_PURGER) {
      assert.ok(e.includes(`${nom}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`),
        `${nom} doit être purgé AUSSI sans domaine`)
    }
  })

  test('Path=/ et Max-Age=0 sur chaque en-tête : ce sont eux qui effacent', () => {
    // Un navigateur n'apparie un Set-Cookie à un cookie existant que sur
    // (nom, domaine, chemin). Un `Path` différent ne supprimerait rien : il
    // poserait un second cookie vide en laissant l'ancien en place.
    for (const entete of [...entetesDePurge(), ...entetesDePurge(DOMAINE)]) {
      assert.match(entete, /(^|; )Path=\/(;|$)/, `Path=/ absent : ${entete}`)
      assert.match(entete, /(^|; )Max-Age=0(;|$)/, `Max-Age=0 absent : ${entete}`)
    }
  })

  test('une chaîne vide n est pas un domaine', () => {
    // `sessionCookieDomain()` rend `undefined` en local. Si un appelant passait
    // `''`, émettre `Domain=` serait un en-tête invalide, silencieusement
    // ignoré — donc une purge qui paraît faite et ne l'est pas.
    assert.deepEqual(entetesDePurge(''), entetesDePurge())
  })

  test('les deux noms sont couverts, le marqueur retiré compris', () => {
    const tout = entetesDePurge(DOMAINE).join(' ')
    assert.ok(tout.includes(COOKIE_SESSION))
    // `app-open` n'est plus écrit par personne depuis le 11 août : il n'est
    // purgé que pour vider les navigateurs qui en portent encore un. Le jour où
    // on le retirera, ce test dira ce qu'on perd.
    assert.ok(tout.includes(COOKIE_MARQUEUR_RETIRE))
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('UN SEUL ÉCRIVAIN : contrôle structurel des sources', () => {
  // Test d'ARCHITECTURE, et non de comportement : il lit le code. C'est le seul
  // moyen d'attraper le défaut du 11 août — deux écrivains pour un cookie se
  // comportent parfaitement, chacun de son côté.

  const RACINE = join(import.meta.dirname, '..', '..')   // → src/

  /** Tous les fichiers TypeScript de `src`, hors fichiers de test. */
  const sources = readdirSync(RACINE, { recursive: true, encoding: 'utf-8' })
    .filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f))
    .map((f) => join(RACINE, f))

  /**
   * Retire les commentaires avant toute recherche.
   *
   * Sans ça, le contrôle sonnerait sur les commentaires qui RACONTENT le défaut
   * — et ils sont nombreux, à dessein. Motif déjà employé le 18 juillet pour le
   * balayage des tirets longs : un classifieur non-commentaire.
   */
  const sansCommentaires = (src: string) =>
    src.replace(/\/\*[\s\S]*?\*\//g, '')          // blocs
      .split('\n')
      .filter((l) => !/^\s*(\/\/|\*)/.test(l))     // lignes de commentaire
      .join('\n')

  const chercher = (aiguille: string) =>
    sources
      .filter((f) => sansCommentaires(readFileSync(f, 'utf-8')).includes(aiguille))
      .map((f) => relative(RACINE, f).split(sep).join('/'))

  test('le nom du cookie de session est déclaré À UN SEUL ENDROIT', () => {
    const fichiers = chercher(COOKIE_SESSION)
    assert.deepEqual(fichiers, ['lib/auth/session-cookies.ts'],
      'un second fichier nomme le cookie de session : est-il en train de l écrire ?')
  })

  test('le marqueur retiré aussi', () => {
    assert.deepEqual(chercher(COOKIE_MARQUEUR_RETIRE), ['lib/auth/session-cookies.ts'])
  })

  test('AUCUNE écriture de cookie depuis le navigateur', () => {
    // `document.cookie` est la forme exacte qu'avait pris le défaut du 11 août,
    // et elle reste possible sous n'importe quel nom. Le contrôle porte donc sur
    // l'ÉCRITURE elle-même, pas sur le nom du cookie.
    assert.deepEqual(chercher('document.cookie'), [],
      'un cookie écrit côté navigateur échappe au middleware et ne peut pas être purgé par lui')
  })

  test('le balayage a bien lu quelque chose', () => {
    // UN CONTRÔLE QUI NE MESURE RIEN ANNONCE « 0 ». Trois fois payé sur ce
    // projet (16 août, 2 octobre, 3 octobre) : sans ce garde-fou, une erreur de
    // chemin rendrait les trois tests ci-dessus verts et vides de sens.
    assert.ok(sources.length > 200, `seulement ${sources.length} sources lues`)
    assert.ok(sources.some((f) => f.endsWith('proxy.ts')), 'proxy.ts doit être dans le balayage')
    assert.ok(chercher('NextResponse').length > 0, 'le balayage doit trouver du code connu')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('QUELS CHEMINS PURGENT (point C du 3 octobre)', () => {
  // Un traceur est `httpOnly` : le navigateur ne peut pas l effacer. Le clic sur
  // « Deconnexion » appelle `signOut()` et s en va, mais le cookie reste —
  // SEUL LE SERVEUR peut le supprimer, et seulement aux chemins listes.

  test('les deux ecrans de connexion purgent', () => {
    assert.equal(doitPurger('/login'), true, 'ecole')
    assert.equal(doitPurger('/superadmin/login'), true, 'console')
  })

  test('/superadmin/login etait OUBLIE, et le cookie est PARTAGE', () => {
    // La condition etait `pathname === '/login'`, une egalite stricte. Or le
    // cookie porte `.bilaleducation.fr` : il vaut pour la console ET pour les
    // ecoles. Un editeur quittant la console gardait donc un horodatage perime,
    // et son entree suivante dans une ecole le deconnectait aussitot — le
    // montage exact du « double login » du 12 juillet, sur l autre domaine.
    assert.ok(CHEMINS_DE_PURGE.includes('/superadmin/login'))
  })

  test('EGALITE STRICTE : aucun chemin voisin ne purge', () => {
    // `startsWith` aurait accepte ces quatre-la, et n importe quelle route
    // future commencant par les memes lettres aurait efface la session.
    for (const chemin of ['/loginbidon', '/login-autre', '/superadmin/login2', '/logins']) {
      assert.equal(doitPurger(chemin), false, chemin)
    }
  })

  test('les routes ordinaires ne purgent jamais', () => {
    for (const chemin of ['/dashboard', '/superadmin', '/', '/auth/totp-challenge', '/vitrine']) {
      assert.equal(doitPurger(chemin), false, chemin)
    }
  })

  test('CABLAGE REEL : la branche console de proxy.ts purge bien', () => {
    // `doitPurger` dit la REGLE ; ce test verifie qu elle est APPLIQUEE la ou
    // il faut. La branche `/superadmin/login` rend la main AVANT la purge de fin
    // de fonction : la liste seule ne suffirait donc pas, et un test qui ne
    // regarderait que `doitPurger` passerait au vert sur un cablage absent.
    const proxy = readFileSync(join(import.meta.dirname, '..', '..', 'proxy.ts'), 'utf-8')
    const lignes = proxy.split('\n')
    const i = lignes.findIndex((l) => l.includes("pathname === '/superadmin/login'"))
    assert.ok(i > 0, 'la branche /superadmin/login doit exister dans proxy.ts')
    const fenetre = lignes.slice(i, i + 30).join('\n')
    assert.match(fenetre, /purgerTraceurs\(response\)/,
      'la branche console doit purger avant de rendre la main')
  })
})
