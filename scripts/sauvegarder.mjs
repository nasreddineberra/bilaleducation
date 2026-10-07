#!/usr/bin/env node
/**
 * SAUVEGARDE LOCALE COMPLETE — base, fichiers, configuration du tableau de bord.
 *
 *   node scripts/sauvegarder.mjs            sauvegarde + purge selon la retention
 *   node scripts/sauvegarder.mjs --sans-purge   ne supprime rien
 *
 * ── POURQUOI QUATRE PIECES ET NON UNE ──────────────────────────────────────
 *
 * Mesure du 7 octobre, sur la base reelle : 20 Mo, dont `public` 5 Mo,
 * `auth` 1,7 Mo et `storage` 408 Ko. Mais `storage` ne contient que les
 * METADONNEES — les 13 fichiers (4,7 Mo, dont SEPT BULLETINS) vivent dans S3.
 *
 * Un `pg_dump` seul restaurerait donc une base annoncant « bulletin archive »
 * avec un LIEN MORT. Or un bulletin archive est un document PUBLIE, remis aux
 * familles, et l'historique de cloture l'agrege depuis le 9 aout precisement
 * pour ne jamais le contredire. Une sauvegarde qui oublie ces fichiers n'est
 * pas une sauvegarde.
 *
 * Et la configuration du projet (Site URL, allow-list de redirection,
 * expiration des OTP, les treize gabarits d'email, le SMTP du projet) ne vit
 * ni dans la base ni dans le depot : elle vit dans le tableau de bord Supabase,
 * et ne se recupere que par l'API de gestion.
 *
 *   base.dump                           les trois schemas, donnees comprises
 *   fichiers/<compartiment>/<chemin>    les objets de Storage
 *   configuration-supabase-SECRETS.json l'etat du tableau de bord
 *   manifeste.json                      ce qui PROUVE que l'ensemble est complet
 *
 * ── LE MANIFESTE EST LA PIECE QUI COMPTE ───────────────────────────────────
 *
 * Sans compte de reference, une sauvegarde TRONQUEE se lit exactement comme une
 * sauvegarde reussie. C'est le defaut « un controle qui ne mesure rien annonce
 * zero », paye sept fois dans ce projet. Le manifeste porte donc le nombre de
 * lignes TABLE PAR TABLE, compte exactement (et non l'estimation de
 * `reltuples`, qui peut valoir -1 ou dater d'un ANALYZE ancien).
 *
 * C'est lui que `verifier-sauvegarde.mjs` confronte a la base restauree.
 *
 * ── CE FICHIER CONTIENT DES SECRETS, PAR DECISION ──────────────────────────
 *
 * `configuration-supabase-SECRETS.json` porte le mot de passe SMTP du projet et
 * les cles d'API. J'avais propose de les masquer ; l'utilisateur a prefere les
 * garder (7 octobre) — la restauration devient alors reellement en une etape.
 *
 * Consequence assumee, ecrite ici pour qu'elle ne surprenne personne : une
 * fuite du dossier de sauvegarde n'exposerait plus seulement les donnees de
 * 290 familles (dont des donnees de sante, art. 9) mais AUSSI le controle du
 * projet Supabase et du compte de messagerie. D'ou le nom du fichier, son
 * avertissement en tete, le drapeau du manifeste, et la garde « hors du depot »
 * ci-dessous.
 *
 * ── AUCUNE DEPENDANCE ──────────────────────────────────────────────────────
 *
 * `fetch` nu et deux binaires PostgreSQL deja installes. Le projet a subi le
 * ver npm du 4 aout : ce qui est fige ne depend plus de l'exterieur.
 */

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { choisirAGarder, MOTIF_DOSSIER } from './lib/retention.mjs'

// ─── Reglages ───────────────────────────────────────────────────────────────

/** Hors du depot, et la garde plus bas le verifie. */
const RACINE_DEFAUT = 'D:\\# 2. Sauvegardes Supabase - BilalEducation'
const QUOTIDIENNES_GARDEES = 7
const HEBDOMADAIRES_GARDEES = 4

/** Les trois schemas qui portent nos donnees. `auth` contient les comptes. */
const SCHEMAS = ['public', 'auth', 'storage']

/**
 * Chemins ou chercher pg_dump quand il n'est pas dans le PATH. Mesure du
 * 7 octobre : PostgreSQL 17 est installe ici, et son pg_dump (17.10) est plus
 * recent que le serveur Supabase (17.6) — c'est le sens qui fonctionne,
 * l'inverse serait refuse.
 */
const BINAIRES_CANDIDATS = [
  'C:\\Program Files\\PostgreSQL\\17\\bin',
  'C:\\Program Files\\PostgreSQL\\16\\bin',
]

// ─── Utilitaires ────────────────────────────────────────────────────────────

const ROUGE = s => `\x1b[31m${s}\x1b[0m`
const VERT  = s => `\x1b[32m${s}\x1b[0m`
const GRIS  = s => `\x1b[90m${s}\x1b[0m`

function abandon(message) {
  console.error(`\n${ROUGE('ABANDON')} ${message}\n`)
  process.exit(1)
}

/**
 * Lecture de `.env.local`. On coupe sur le PREMIER `=` seulement : une chaine
 * de connexion ou une cle en contient.
 */
function lireEnv() {
  const p = path.join(process.cwd(), '.env.local')
  if (!fs.existsSync(p)) abandon('`.env.local` introuvable. Lancez le script depuis la racine du projet.')
  const out = {}
  for (const ligne of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const t = ligne.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i > 0) out[t.slice(0, i)] = t.slice(i + 1)
  }
  return out
}

/** Localise un binaire PostgreSQL, ou abandonne en disant quoi faire. */
function trouverBinaire(nom) {
  const exe = process.platform === 'win32' ? `${nom}.exe` : nom
  for (const d of BINAIRES_CANDIDATS) {
    const p = path.join(d, exe)
    if (fs.existsSync(p)) return p
  }
  try {
    execFileSync(nom, ['--version'], { stdio: 'ignore' })
    return nom
  } catch { /* pas dans le PATH non plus */ }
  abandon(
    `\`${nom}\` introuvable.\n\n` +
    `  Installez les outils clients PostgreSQL 17, ou ajoutez leur dossier\n` +
    `  a BINAIRES_CANDIDATS en tete de ce script.\n\n` +
    `  Le client doit etre de version EGALE OU SUPERIEURE au serveur (17.6) :\n` +
    `  un pg_dump plus ancien refuse de travailler.`,
  )
}

/** Horodatage de dossier, en composantes LOCALES (jamais toISOString). */
function horodatage(d = new Date()) {
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}h${p(d.getMinutes())}`
}

function poidsLisible(octets) {
  if (octets < 1024) return `${octets} o`
  if (octets < 1024 * 1024) return `${(octets / 1024).toFixed(0)} Ko`
  return `${(octets / 1024 / 1024).toFixed(1)} Mo`
}

// ─── Comptage exact, table par table ────────────────────────────────────────

/**
 * Compte EXACT de chaque table des trois schemas, en une requete.
 *
 * `query_to_xml` permet de compter dynamiquement sans bloc PL/pgSQL. On n'emploie
 * PAS `pg_class.reltuples` : c'est une ESTIMATION, qui vaut -1 sur une table
 * jamais analysee et qui date du dernier ANALYZE. Un manifeste cense PROUVER la
 * completude ne peut pas reposer sur une approximation.
 */
const SQL_COMPTES = `
select t.table_schema || '.' || t.table_name as tbl,
       (xpath('/row/c/text()', query_to_xml(
          format('select count(*) as c from %I.%I', t.table_schema, t.table_name),
          false, true, '')))[1]::text::bigint as n
  from information_schema.tables t
 where t.table_schema in (${SCHEMAS.map(s => `'${s}'`).join(',')})
   and t.table_type = 'BASE TABLE'
 order by 1
`

function compterLignes(psql, url) {
  const brut = execFileSync(psql, [url, '-At', '-F', '|', '-c', SQL_COMPTES], {
    encoding: 'utf8',
    env: { ...process.env, PGCONNECT_TIMEOUT: '30' },
    maxBuffer: 16 * 1024 * 1024,
  })
  const out = {}
  for (const l of brut.split(/\r?\n/)) {
    const [tbl, n] = l.split('|')
    if (tbl && n !== undefined) out[tbl] = Number(n)
  }
  return out
}

// ─── Les fichiers de Storage ────────────────────────────────────────────────

/**
 * Les objets vivent dans S3, pas dans Postgres : on lit leur LISTE en base,
 * puis on telecharge chacun par l'API Storage avec la cle service-role (les
 * compartiments sont prives — regle du 10 juillet, jamais `getPublicUrl`).
 *
 * Le chemin sur disque recopie `compartiment/chemin-d-origine` : c'est ce qui
 * permet de les remettre en place sans table de correspondance.
 */
async function sauverFichiers(psql, url, supabaseUrl, serviceKey, dossier) {
  const brut = execFileSync(psql, [
    url, '-At', '-F', '|', '-c',
    `select bucket_id, name, coalesce((metadata->>'size')::bigint, 0)
       from storage.objects where name is not null order by 1, 2`,
  ], { encoding: 'utf8', env: { ...process.env, PGCONNECT_TIMEOUT: '30' }, maxBuffer: 16 * 1024 * 1024 })

  const objets = brut.split(/\r?\n/).filter(Boolean).map(l => {
    const [bucket, ...reste] = l.split('|')
    const taille = reste.pop()
    return { bucket, nom: reste.join('|'), tailleAttendue: Number(taille) }
  })

  const resultat = { total: objets.length, recuperes: 0, octets: 0, echecs: [] }

  for (const o of objets) {
    const cible = path.join(dossier, o.bucket, ...o.nom.split('/'))
    fs.mkdirSync(path.dirname(cible), { recursive: true })
    const adresse = `${supabaseUrl}/storage/v1/object/${o.bucket}/${o.nom.split('/').map(encodeURIComponent).join('/')}`
    try {
      const r = await fetch(adresse, { headers: { Authorization: `Bearer ${serviceKey}` } })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const buf = Buffer.from(await r.arrayBuffer())
      fs.writeFileSync(cible, buf)
      resultat.recuperes++
      resultat.octets += buf.length
    } catch (e) {
      // Un fichier manquant ne doit pas faire echouer la sauvegarde ENTIERE :
      // on note l'echec, il apparaitra dans le manifeste et au rapport.
      resultat.echecs.push({ bucket: o.bucket, nom: o.nom, erreur: String(e.message || e) })
    }
  }
  return resultat
}

// ─── La configuration du tableau de bord ────────────────────────────────────

/**
 * API de gestion Supabase. Verifie sur la specification publique le 7 octobre :
 * `/config/auth` rend 238 champs, dont `site_url`, `uri_allow_list`,
 * `mailer_otp_exp`, les treize `mailer_templates_*_content` et le SMTP du projet.
 *
 * CHAQUE point est tolerant : un 403 ou un 404 sur l'un ne doit pas faire
 * echouer les autres. Une configuration partielle vaut mieux qu'aucune, et le
 * manifeste dira laquelle manque.
 */
const POINTS_CONFIG = [
  ['projet',          ''],
  ['auth',            '/config/auth'],
  ['api_keys',        '/api-keys'],
  ['storage',         '/config/storage'],
  ['pooler',          '/config/database/pooler'],
  ['postgres',        '/config/database/postgres'],
  // `/secrets` RETIRE : ce point ne rend que les secrets des Edge Functions, et
  // le projet n'en a AUCUNE (ni `supabase/functions/`, ni le moindre
  // `functions.invoke` dans `src` — verifie le 7 octobre). Le garder aurait
  // exige une permission HIGH RISK de plus pour rapporter un tableau vide, et
  // aurait fait annoncer « PARTIELLE » a chaque passage. A remettre le jour ou
  // une Edge Function apparait.
]

async function sauverConfiguration(ref, pat, fichier) {
  const sortie = {
    _avertissement:
      'CE FICHIER CONTIENT DES SECRETS EN CLAIR (mot de passe SMTP du projet, cles d API, '
      + 'secrets de fonctions). Ne le transmettez pas, ne le deposez pas dans le depot, '
      + 'ne le joignez pas a une demande de support. Choix assume du 7 octobre 2026.',
    _exporte_le: new Date().toISOString(),
    _projet_ref: ref,
  }
  const manque = []

  for (const [cle, chemin] of POINTS_CONFIG) {
    try {
      const r = await fetch(`https://api.supabase.com/v1/projects/${ref}${chemin}`, {
        headers: { Authorization: `Bearer ${pat}` },
      })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      sortie[cle] = await r.json()
    } catch (e) {
      sortie[cle] = { _erreur: String(e.message || e) }
      manque.push(cle)
    }
  }

  fs.writeFileSync(fichier, JSON.stringify(sortie, null, 2), 'utf8')
  return { points: POINTS_CONFIG.length, manque }
}

// ─── Retention ──────────────────────────────────────────────────────────────

/**
 * 7 quotidiennes + la plus recente de chacune des 4 dernieres semaines.
 *
 * TROIS GARDES, parce qu'une suppression ne se defait pas :
 *  1. on ne regarde que les dossiers dont le NOM a la forme attendue ;
 *  2. on exige un `manifeste.json` a l'interieur — preuve que le dossier est
 *     bien l'un des notres et non un dossier homonyme ;
 *  3. on ne purge JAMAIS si la sauvegarde du jour a echoue : sinon une panne
 *     emporterait les sauvegardes saines.
 */
/**
 * La REGLE vit dans `lib/retention.mjs`, pure et eprouvee par son test : c'est
 * la seule partie du dispositif qui supprime, et une regle fausse n'y leve pas,
 * elle efface. Ici on ne fait que le disque.
 *
 * TROIS GARDES, parce qu'une suppression ne se defait pas :
 *  1. on ne soumet a la regle que les dossiers dont le NOM est le notre ;
 *  2. on exige un `manifeste.json` a l'interieur — preuve que le dossier vient
 *     bien de ce script et n'est pas un homonyme ;
 *  3. on n'efface QUE ce que la regle a mis dans `supprimer`. Un dossier
 *     etranger ne figure dans aucune de ses deux listes, par construction.
 */
function purger(racine) {
  const candidats = fs.readdirSync(racine, { withFileTypes: true })
    .filter(e => e.isDirectory() && MOTIF_DOSSIER.test(e.name))
    .filter(e => fs.existsSync(path.join(racine, e.name, 'manifeste.json')))
    .map(e => e.name)

  const { garder, supprimer } = choisirAGarder(candidats, {
    quotidiennes: QUOTIDIENNES_GARDEES,
    hebdomadaires: HEBDOMADAIRES_GARDEES,
  })

  for (const nom of supprimer) fs.rmSync(path.join(racine, nom), { recursive: true, force: true })
  return { gardes: garder, supprimes: supprimer }
}

// ─── Programme ──────────────────────────────────────────────────────────────

async function principal() {
  const sansPurge = process.argv.includes('--sans-purge')
  const env = lireEnv()

  const dbUrl = env.SUPABASE_DB_URL
  const supabaseUrl = (env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '')
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY
  const pat = env.SUPABASE_ACCESS_TOKEN

  if (!dbUrl) abandon('`SUPABASE_DB_URL` absente de `.env.local`.')
  if (!supabaseUrl || !serviceKey) abandon('`NEXT_PUBLIC_SUPABASE_URL` ou `SUPABASE_SERVICE_ROLE_KEY` absente.')

  const ref = (supabaseUrl.match(/^https:\/\/([a-z0-9]+)\.supabase\./) || [])[1]
  if (!ref) abandon(`Impossible de deduire la reference du projet depuis « ${supabaseUrl} ».`)

  // GARDE : le dossier ne doit JAMAIS vivre dans le depot. Il porte les donnees
  // de 290 familles et, par decision du 7 octobre, des secrets en clair ;
  // l'historique git ne s'efface pas.
  const racine = path.resolve(process.env.SAUVEGARDE_DIR || env.SAUVEGARDE_DIR || RACINE_DEFAUT)
  const depot = path.resolve(process.cwd())
  if (racine === depot || racine.startsWith(depot + path.sep)) {
    abandon(
      `Le dossier de sauvegarde (${racine}) est DANS le depot.\n\n` +
      `  Il contient des donnees personnelles et des secrets : il doit vivre\n` +
      `  ailleurs. Reglez \`SAUVEGARDE_DIR\` dans \`.env.local\`.`,
    )
  }

  const pgDump = trouverBinaire('pg_dump')
  const psql = trouverBinaire('psql')

  const nom = horodatage()
  const dossier = path.join(racine, nom)
  fs.mkdirSync(path.join(dossier, 'fichiers'), { recursive: true })

  // Un avertissement a la RACINE du dossier, pose une fois. Qui tombera sur ce
  // dossier dans deux ans — sur un disque, dans une copie, apres un changement
  // de poste — doit savoir ce qu'il tient sans avoir a ouvrir un fichier.
  const lisezMoi = path.join(racine, 'LISEZ-MOI.txt')
  if (!fs.existsSync(lisezMoi)) {
    fs.writeFileSync(lisezMoi, [
      'SAUVEGARDES DE BILAL EDUCATION',
      '',
      'CE DOSSIER EST CONFIDENTIEL. Il contient :',
      '  - les donnees personnelles de ~290 familles, dont des donnees de SANTE',
      '    (notes medicales des apprenants : RGPD article 9) ;',
      '  - les comptes de connexion et leurs facteurs de double authentification ;',
      '  - les documents publies : bulletins, justificatifs, pieces des enseignants ;',
      '  - DES SECRETS EN CLAIR : mot de passe SMTP du projet et cles d API',
      '    (fichier configuration-supabase-SECRETS.json).',
      '',
      'Ne le transmettez pas, ne le deposez pas dans un depot de code, ne le joignez',
      'pas a une demande de support. Une fuite donnerait acces aux donnees des',
      'familles ET au controle du projet Supabase et de la messagerie.',
      '',
      'Un dossier par sauvegarde, nomme AAAA-MM-JJ_HHhMM :',
      '  base.dump                            les 3 schemas, donnees comprises',
      '  fichiers/<compartiment>/<chemin>     les objets de Storage',
      '  configuration-supabase-SECRETS.json  l etat du tableau de bord Supabase',
      '  manifeste.json                       nombre de lignes TABLE PAR TABLE',
      '',
      'journal.txt : la sortie de chaque execution planifiee.',
      '',
      'Pour EPROUVER une sauvegarde (et non seulement la constater presente),',
      'depuis la racine du projet :',
      '  node scripts/verifier-sauvegarde.mjs',
      '',
      'Pour en RESTAURER une : supabase/restore/README.md.',
      '',
    ].join('\r\n'), 'utf8')
  }

  console.log(`\nSauvegarde ${VERT(nom)}`)
  console.log(GRIS(`  vers ${dossier}\n`))

  /**
   * DEUX NOTIONS DISTINCTES, et les confondre produit une fausse assurance.
   *
   * `incident`  : quelque chose a ECHOUE. Bloque la purge — une panne ne doit
   *               pas emporter les sauvegardes saines.
   * `couverture`: ce que cette sauvegarde porte REELLEMENT. Le jeton de gestion
   *               peut n'avoir jamais ete pose : ce n'est pas une panne, mais la
   *               configuration du tableau de bord n'est alors PAS sauvegardee,
   *               et un drapeau « complete » le masquerait.
   *
   * Premier jet corrige : il annoncait `complete: true` sans la configuration.
   */
  const manifeste = {
    sauvegarde_le: new Date().toISOString(),
    projet_ref: ref,
    contient_des_secrets: true,
    schemas: SCHEMAS,
  }
  const couverture = { base: false, fichiers: false, configuration: false }
  let incident = false

  // 1 ── Les comptes de lignes, AVANT le dump : ils en sont la preuve.
  process.stdout.write('  comptage des lignes      ')
  try {
    manifeste.lignes = compterLignes(psql, dbUrl)
    manifeste.lignes_total = Object.values(manifeste.lignes).reduce((a, b) => a + b, 0)
    console.log(VERT(`ok`) + GRIS(` — ${Object.keys(manifeste.lignes).length} tables, ${manifeste.lignes_total} lignes`))
  } catch (e) {
    incident = true
    manifeste.lignes_erreur = String(e.message || e)
    console.log(ROUGE('ECHEC') + GRIS(` — ${manifeste.lignes_erreur.split('\n')[0]}`))
  }

  // 2 ── Le dump. SANS `--no-acl` : mesure du 7 octobre, cette option retire
  //      157 declarations de privileges (780 Ko au lieu de 844). C'est ce que
  //      le README de `supabase/restore/` interdit explicitement.
  //      `--no-owner` n'est PAS passe ici : pour un format custom il n'a d'effet
  //      qu'au moment du `pg_restore`, et l'archive doit rester complete.
  process.stdout.write('  dump de la base          ')
  const dump = path.join(dossier, 'base.dump')
  try {
    execFileSync(pgDump, [dbUrl, '-Fc', ...SCHEMAS.flatMap(s => ['--schema', s]), '-f', dump], {
      stdio: ['ignore', 'ignore', 'pipe'],
      env: { ...process.env, PGCONNECT_TIMEOUT: '30' },
    })
    manifeste.base_dump_octets = fs.statSync(dump).size
    couverture.base = true
    console.log(VERT('ok') + GRIS(` — ${poidsLisible(manifeste.base_dump_octets)}`))
  } catch (e) {
    incident = true
    manifeste.base_dump_erreur = String(e.stderr || e.message || e).trim()
    console.log(ROUGE('ECHEC') + GRIS(` — ${manifeste.base_dump_erreur.split('\n')[0]}`))
  }

  // 3 ── Les fichiers de Storage, qui ne sont PAS dans le dump.
  process.stdout.write('  fichiers de Storage      ')
  try {
    const f = await sauverFichiers(psql, dbUrl, supabaseUrl, serviceKey, path.join(dossier, 'fichiers'))
    manifeste.fichiers = f
    couverture.fichiers = f.echecs.length === 0
    if (f.echecs.length) incident = true
    console.log(
      (f.echecs.length ? ROUGE('partiel') : VERT('ok'))
      + GRIS(` — ${f.recuperes}/${f.total} fichiers, ${poidsLisible(f.octets)}`)
      + (f.echecs.length ? ROUGE(` (${f.echecs.length} en echec)`) : ''),
    )
  } catch (e) {
    incident = true
    manifeste.fichiers_erreur = String(e.message || e)
    console.log(ROUGE('ECHEC') + GRIS(` — ${manifeste.fichiers_erreur.split('\n')[0]}`))
  }

  // 4 ── La configuration du tableau de bord, qui ne vit ni en base ni au depot.
  process.stdout.write('  configuration Supabase   ')
  if (!pat) {
    manifeste.configuration = { _absente: 'SUPABASE_ACCESS_TOKEN non renseigne dans .env.local' }
    console.log(ROUGE('ignoree') + GRIS(' — pas de SUPABASE_ACCESS_TOKEN'))
  } else {
    try {
      const c = await sauverConfiguration(ref, pat, path.join(dossier, 'configuration-supabase-SECRETS.json'))
      manifeste.configuration = c
      couverture.configuration = c.manque.length === 0
      // PAS un incident, et c'est delibere. Un point refuse signifie le plus
      // souvent qu'on a VOULU ne pas accorder la permission (le jeton est
      // limite au strict necessaire) — en faire un echec bloquerait la purge
      // POUR TOUJOURS, et les sauvegardes s'accumuleraient sans fin. La partie
      // irremplacable, elle, a reussi : seule la COUVERTURE est entamee, et le
      // message de fin la nomme.
      console.log(
        (c.manque.length ? ROUGE('partiel') : VERT('ok'))
        + GRIS(` — ${c.points - c.manque.length}/${c.points} points`)
        + (c.manque.length ? ROUGE(` (manque : ${c.manque.join(', ')})`) : ''),
      )
    } catch (e) {
      incident = true
      manifeste.configuration = { _erreur: String(e.message || e) }
      console.log(ROUGE('ECHEC') + GRIS(` — ${String(e.message || e).split('\n')[0]}`))
    }
  }

  manifeste.couverture = couverture
  manifeste.sans_incident = !incident
  // « complete » n a droit a `true` que si les TROIS pieces sont la ET que
  // rien n a echoue. Sinon le resume contredirait le detail.
  manifeste.complete = !incident && Object.values(couverture).every(Boolean)
  fs.writeFileSync(path.join(dossier, 'manifeste.json'), JSON.stringify(manifeste, null, 2), 'utf8')

  // 5 ── Retention. Jamais apres un incident (voir la 3e garde de `purger`).
  if (sansPurge) {
    console.log(GRIS('\n  purge ignoree (--sans-purge)'))
  } else if (incident) {
    console.log(ROUGE('\n  purge IGNOREE : la sauvegarde du jour est incomplete.'))
    console.log(GRIS('  Une panne ne doit pas emporter les sauvegardes saines.'))
  } else {
    const { gardes, supprimes } = purger(racine)
    console.log(GRIS(`\n  retention : ${gardes.length} gardees`)
      + (supprimes.length ? GRIS(`, ${supprimes.length} supprimees (${supprimes.join(', ')})`) : ''))
  }

  if (incident) {
    console.log(`\n${ROUGE('SAUVEGARDE EN ECHEC')} — voir \`manifeste.json\`, cle par cle.\n`)
    process.exit(2)
  }

  const absents = Object.entries(couverture).filter(([, v]) => !v).map(([k]) => k)
  if (absents.length) {
    // Rien n'a echoue, mais une piece n'est pas couverte : on le DIT plutot que
    // d'annoncer une sauvegarde complete. Sortie 0 — ce n'est pas une panne.
    console.log(`\n${ROUGE('Sauvegarde PARTIELLE')} — non couvert : ${absents.join(', ')}.`)
    if (!couverture.configuration && !pat) {
      console.log(GRIS('  Posez `SUPABASE_ACCESS_TOKEN` dans `.env.local` pour inclure la'))
      console.log(GRIS('  configuration du tableau de bord (Site URL, allow-list, OTP, gabarits).'))
    }
    console.log(GRIS(`\n  Eprouvez-la : node scripts/verifier-sauvegarde.mjs\n`))
    return
  }
  console.log(`\n${VERT('Sauvegarde complete.')} Eprouvez-la : ${GRIS('node scripts/verifier-sauvegarde.mjs')}\n`)
}

principal().catch(e => abandon(String(e.stack || e)))
