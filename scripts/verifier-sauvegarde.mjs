#!/usr/bin/env node
/**
 * EPROUVER UNE SAUVEGARDE — et dire honnetement jusqu'ou la preuve va.
 *
 *   node scripts/verifier-sauvegarde.mjs                la plus recente
 *   node scripts/verifier-sauvegarde.mjs 2026-10-07_10h59
 *
 * ── POURQUOI CE SCRIPT EXISTE ──────────────────────────────────────────────
 *
 * « Une sauvegarde dont on n'a jamais teste le retour arriere est une
 * intention, pas un filet. » La reserve etait posee au README des migrations
 * depuis le 4 octobre, sans suite.
 *
 * Et un controle qui se contenterait de constater que `pg_restore` n'a pas leve
 * ne prouverait RIEN : la RLS ne leve pas, elle filtre ; une archive tronquee se
 * restaure sans un mot. Ce qui prouve, c'est de retrouver les 221 apprenants et
 * les 134 foyers — donc de COMPARER au manifeste, table par table.
 *
 * ── DEUX NIVEAUX, ET LE SCRIPT DIT LEQUEL IL A ATTEINT ─────────────────────
 *
 * NIVEAU 1 — sans aucun identifiant, toujours execute :
 *   · l'archive se lit d'un bout a l'autre (integrite de la compression) ;
 *   · chacune des tables du manifeste a bien son entree TABLE DATA ;
 *   · les privileges sont dans l'archive — c'est ce qui detecte un `--no-acl`
 *     glisse dans le script de sauvegarde (mesure du 7 octobre : il retirait
 *     157 declarations, et le README de `supabase/restore/` l'interdit) ;
 *   · les fichiers de Storage sur disque correspondent au manifeste ;
 *   · les gabarits d'email du depot sont bien ceux qui sont EN PLACE.
 *
 * NIVEAU 2 — restauration reelle, si un PostgreSQL local est joignable :
 *   · base jetable, roles Supabase crees, `pg_restore`, puis RECOMPTAGE et
 *     comparaison au manifeste, table par table.
 *
 * Le niveau 1 ne remplace pas le 2 : il dit que l'archive est saine et
 * complete en STRUCTURE, pas que les lignes y sont. Le script l'ecrit noir sur
 * blanc plutot que d'annoncer « sauvegarde verifiee » dans les deux cas.
 *
 * ── CE QU'AUCUN DES DEUX NE PROUVERA ───────────────────────────────────────
 *
 * La greffe sur un VRAI projet Supabase. En local, les roles sont des coquilles
 * et le schema `auth` n'a pas son service derriere. Surtout : pour
 * `etablissement_smtp`, `pg_dump` n'emet que `GRANT ALL TO service_role` et
 * AUCUN `REVOKE` — or un projet Supabase neuf porte un `ALTER DEFAULT
 * PRIVILEGES` qui rendrait la table a `anon`/`authenticated` des sa creation.
 * La RLS sans policy (qui, elle, est dans l'archive) continue de bloquer la
 * lecture, donc le mot de passe SMTP reste inaccessible — mais la defense passe
 * de deux couches a une. A rejouer apres restauration :
 * `supabase/migrations/add-etablissement-smtp.sql`, dont le REVOKE est idempotent.
 */

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const RACINE_DEFAUT = 'D:\\Sauvegardes-BILALEDUCATION'
const BINAIRES_CANDIDATS = [
  'C:\\Program Files\\PostgreSQL\\17\\bin',
  'C:\\Program Files\\PostgreSQL\\16\\bin',
]
/** Mesure du 7 octobre sur l'archive reelle : les roles que ses GRANT citent. */
const ROLES_SUPABASE = [
  'anon', 'authenticated', 'service_role',
  'dashboard_user', 'supabase_auth_admin', 'supabase_storage_admin', 'supabase_admin',
]

const ROUGE = s => `\x1b[31m${s}\x1b[0m`
const VERT  = s => `\x1b[32m${s}\x1b[0m`
const AMBRE = s => `\x1b[33m${s}\x1b[0m`
const GRIS  = s => `\x1b[90m${s}\x1b[0m`

let echecs = 0
const ok   = (t, d = '') => console.log(`  ${VERT('ok')}      ${t}${d ? GRIS(' — ' + d) : ''}`)
const rate = (t, d = '') => { echecs++; console.log(`  ${ROUGE('ECHEC')}   ${t}${d ? GRIS(' — ' + d) : ''}`) }
const note = (t, d = '') => console.log(`  ${AMBRE('a voir')}  ${t}${d ? GRIS(' — ' + d) : ''}`)

function abandon(m) { console.error(`\n${ROUGE('ABANDON')} ${m}\n`); process.exit(1) }

function lireEnv() {
  const p = path.join(process.cwd(), '.env.local')
  if (!fs.existsSync(p)) return {}
  const out = {}
  for (const l of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const t = l.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i > 0) out[t.slice(0, i)] = t.slice(i + 1)
  }
  return out
}

function trouverBinaire(nom) {
  const exe = process.platform === 'win32' ? `${nom}.exe` : nom
  for (const d of BINAIRES_CANDIDATS) {
    const p = path.join(d, exe)
    if (fs.existsSync(p)) return p
  }
  try { execFileSync(nom, ['--version'], { stdio: 'ignore' }); return nom } catch { /* absent */ }
  abandon(`\`${nom}\` introuvable (outils clients PostgreSQL 17).`)
}

function tailleDossier(d) {
  let n = 0, octets = 0
  const parcourir = p => {
    for (const e of fs.readdirSync(p, { withFileTypes: true })) {
      const q = path.join(p, e.name)
      if (e.isDirectory()) parcourir(q)
      else { n++; octets += fs.statSync(q).size }
    }
  }
  if (fs.existsSync(d)) parcourir(d)
  return { n, octets }
}

const poids = o => o < 1024 ? `${o} o` : o < 1048576 ? `${(o / 1024).toFixed(0)} Ko` : `${(o / 1048576).toFixed(1)} Mo`

// ─── Niveau 1 ───────────────────────────────────────────────────────────────

function niveau1(dossier, manifeste, pgRestore) {
  console.log(`\n${GRIS('NIVEAU 1 — l archive, sans restauration')}`)

  const dump = path.join(dossier, 'base.dump')
  if (!fs.existsSync(dump)) { rate('`base.dump` present'); return null }

  // Integrite : forcer la lecture COMPLETE de l'archive compressee. Un
  // `pg_restore -l` ne lit que la table des matieres et ne detecterait pas une
  // troncature du corps.
  const nul = process.platform === 'win32' ? 'NUL' : '/dev/null'
  try {
    execFileSync(pgRestore, ['-f', nul, dump], { stdio: ['ignore', 'ignore', 'pipe'] })
    ok('archive lisible de bout en bout', poids(fs.statSync(dump).size))
  } catch (e) {
    rate('archive lisible de bout en bout', String(e.stderr || e.message).split('\n')[0])
    return null
  }

  // Table des matieres.
  const toc = execFileSync(pgRestore, ['-l', dump], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })

  // Chaque table du manifeste a-t-elle son entree de DONNEES ?
  // (une table vide n'en a pas : pg_dump n'ecrit pas d'entree TABLE DATA pour
  //  zero ligne — on ne compare donc que les tables non vides.)
  const attendues = Object.entries(manifeste.lignes || {}).filter(([, n]) => n > 0).map(([t]) => t)
  const presentes = new Set()
  for (const l of toc.split(/\r?\n/)) {
    const m = l.match(/TABLE DATA (\S+) (\S+)/)
    if (m) presentes.add(`${m[1]}.${m[2]}`)
  }
  const manquantes = attendues.filter(t => !presentes.has(t))
  if (manquantes.length === 0) ok(`donnees presentes pour les ${attendues.length} tables non vides`)
  else rate(`donnees manquantes pour ${manquantes.length} table(s)`, manquantes.slice(0, 6).join(', '))

  // Les privileges. C'est le garde-fou contre un `--no-acl` reintroduit.
  const acl = (toc.match(/ ACL /g) || []).length
  if (acl > 0) ok(`privileges conserves dans l archive`, `${acl} entrees ACL`)
  else rate('privileges conserves dans l archive',
            'AUCUNE entree ACL — un `--no-acl` a ete reintroduit dans la sauvegarde')

  // Les fichiers de Storage.
  const attenduF = manifeste.fichiers
  const reelF = tailleDossier(path.join(dossier, 'fichiers'))
  if (!attenduF) note('fichiers de Storage', 'le manifeste n en porte pas la trace')
  else if (reelF.n === attenduF.recuperes && reelF.octets === attenduF.octets) {
    ok('fichiers de Storage conformes au manifeste', `${reelF.n} fichiers, ${poids(reelF.octets)}`)
  } else {
    rate('fichiers de Storage conformes au manifeste',
         `disque ${reelF.n}/${poids(reelF.octets)} contre manifeste ${attenduF.recuperes}/${poids(attenduF.octets)}`)
  }

  // Derive des gabarits d'email : ce que porte le depot est-il EN PLACE ?
  // Aucune table de correspondance a tenir : on cherche le contenu du fichier
  // dans n'importe quel champ `mailer_templates_*`. Une table de correspondance
  // se perimerait, et c'est precisement ce qu'on cherche a eviter.
  const conf = path.join(dossier, 'configuration-supabase-SECRETS.json')
  if (!fs.existsSync(conf)) {
    note('gabarits d email identiques au depot', 'configuration non sauvegardee')
  } else {
    const c = JSON.parse(fs.readFileSync(conf, 'utf8'))
    const champs = Object.entries(c.auth || {}).filter(([k]) => /^mailer_templates_.*_content$/.test(k))
    const dossierG = path.join(process.cwd(), 'supabase', 'email-templates')
    const fichiers = fs.existsSync(dossierG) ? fs.readdirSync(dossierG).filter(f => f.endsWith('.html')) : []
    if (!champs.length) note('gabarits d email identiques au depot', 'aucun gabarit dans la configuration')
    else {
      const absents = []
      for (const f of fichiers) {
        const attendu = fs.readFileSync(path.join(dossierG, f), 'utf8').replace(/\r\n/g, '\n').trim()
        const trouve = champs.some(([, v]) => typeof v === 'string' && v.replace(/\r\n/g, '\n').trim() === attendu)
        if (!trouve) absents.push(f)
      }
      if (absents.length === 0) ok(`gabarits d email identiques au depot`, `${fichiers.length} fichiers retrouves`)
      else rate(`gabarits d email identiques au depot`,
                `non retrouves a l identique : ${absents.join(', ')} — le tableau de bord a derive du depot`)
    }
  }

  return dump
}

// ─── Niveau 2 ───────────────────────────────────────────────────────────────

function psqlSur(psql, url, sql, tolerant = false) {
  try {
    return execFileSync(psql, [url, '-At', '-F', '|', '-c', sql], {
      encoding: 'utf8',
      env: { ...process.env, PGCONNECT_TIMEOUT: '10' },
      maxBuffer: 32 * 1024 * 1024,
      stdio: ['ignore', 'pipe', tolerant ? 'ignore' : 'pipe'],
    })
  } catch (e) {
    if (tolerant) return ''
    throw e
  }
}

const SQL_COMPTES = schemas => `
select t.table_schema || '.' || t.table_name as tbl,
       (xpath('/row/c/text()', query_to_xml(
          format('select count(*) as c from %I.%I', t.table_schema, t.table_name),
          false, true, '')))[1]::text::bigint as n
  from information_schema.tables t
 where t.table_schema in (${schemas.map(s => `'${s}'`).join(',')})
   and t.table_type = 'BASE TABLE'
 order by 1
`

function niveau2(dump, manifeste, env, psql, pgRestore) {
  const url = env.VERIF_DB_URL
  console.log(`\n${GRIS('NIVEAU 2 — restauration reelle dans une base jetable')}`)

  if (!url) {
    note('restauration eprouvee', 'VERIF_DB_URL absente de `.env.local`')
    console.log(GRIS('\n          Pour atteindre le niveau 2, ajoutez a `.env.local` :'))
    console.log(GRIS('            VERIF_DB_URL=postgresql://postgres:MOT_DE_PASSE@localhost:5432/postgres'))
    console.log(GRIS('          (le mot de passe du PostgreSQL local, pose a son installation ;'))
    console.log(GRIS('           `.env.local` est deja ignore par git — verifie)'))
    return false
  }

  // Le serveur repond-il ?
  try {
    psqlSur(psql, url, 'select 1')
  } catch (e) {
    rate('PostgreSQL local joignable', String(e.stderr || e.message).split('\n')[0])
    return false
  }
  ok('PostgreSQL local joignable')

  // Les roles Supabase : sans eux, les centaines de GRANT echouent et le
  // rapport se noie dans ses propres erreurs.
  const sqlRoles = ROLES_SUPABASE
    .map(r => `do $v$ begin if not exists (select 1 from pg_roles where rolname='${r}') then create role ${r} nologin; end if; end $v$;`)
    .join('\n')
  try {
    psqlSur(psql, url, sqlRoles)
    ok('roles Supabase presents en local', ROLES_SUPABASE.length + ' roles')
  } catch (e) {
    rate('roles Supabase presents en local', String(e.stderr || e.message).split('\n')[0])
    return false
  }

  const base = `verif_sauvegarde_${Date.now()}`
  let creee = false
  try {
    psqlSur(psql, url, `create database ${base}`)
    creee = true
    const urlBase = url.replace(/\/[^/?]*(\?|$)/, `/${base}$1`)

    // `--no-owner` : les proprietaires Supabase n'existent pas ici, et pour une
    // archive au format custom cette option n'a d'effet qu'au RESTORE.
    // Des erreurs sont ATTENDUES (extensions de Supabase, declencheurs
    // d'evenement, schema `auth` sans son service) : on ne les traite pas comme
    // un echec, on les COMPTE et on juge sur le recomptage.
    let avertissements = 0
    try {
      execFileSync(pgRestore, ['--no-owner', '--dbname', urlBase, dump],
        { stdio: ['ignore', 'ignore', 'pipe'] })
    } catch (e) {
      avertissements = (String(e.stderr || '').match(/^pg_restore: error/gm) || []).length
    }
    if (avertissements) note('restauration terminee', `${avertissements} erreurs non bloquantes (objets geres par Supabase)`)
    else ok('restauration terminee', 'sans erreur')

    // LE CONTROLE QUI COMPTE : recompter et comparer au manifeste.
    const brut = psqlSur(psql, urlBase, SQL_COMPTES(manifeste.schemas || ['public', 'auth', 'storage']))
    const apres = {}
    for (const l of brut.split(/\r?\n/)) {
      const [t, n] = l.split('|')
      if (t && n !== undefined) apres[t] = Number(n)
    }

    const ecarts = []
    for (const [t, attendu] of Object.entries(manifeste.lignes || {})) {
      const reel = apres[t]
      if (reel === undefined) { if (attendu > 0) ecarts.push(`${t} : table absente (${attendu} attendues)`) }
      else if (reel !== attendu) ecarts.push(`${t} : ${reel} au lieu de ${attendu}`)
    }

    const total = Object.values(apres).reduce((a, b) => a + b, 0)
    if (ecarts.length === 0) {
      ok('comptes de lignes identiques au manifeste',
         `${Object.keys(manifeste.lignes || {}).length} tables, ${total} lignes`)
    } else {
      rate(`${ecarts.length} ecart(s) de comptage`, ecarts.slice(0, 8).join(' · '))
    }
    return true
  } catch (e) {
    rate('restauration dans une base jetable', String(e.stderr || e.message).split('\n')[0])
    return false
  } finally {
    // La base jetable part dans TOUS les cas, y compris apres un echec : sinon
    // les essais s accumuleraient sur le serveur local.
    if (creee) { try { psqlSur(psql, url, `drop database ${base} with (force)`, true) } catch { /* tant pis */ } }
  }
}

// ─── Programme ──────────────────────────────────────────────────────────────

function principal() {
  const env = lireEnv()
  const racine = path.resolve(process.env.SAUVEGARDE_DIR || env.SAUVEGARDE_DIR || RACINE_DEFAUT)
  if (!fs.existsSync(racine)) abandon(`Aucun dossier de sauvegarde en ${racine}.`)

  const demande = process.argv[2]
  const dispo = fs.readdirSync(racine, { withFileTypes: true })
    .filter(e => e.isDirectory() && fs.existsSync(path.join(racine, e.name, 'manifeste.json')))
    .map(e => e.name).sort().reverse()
  if (!dispo.length) abandon(`Aucune sauvegarde valide en ${racine} (pas de manifeste.json).`)

  const nom = demande || dispo[0]
  if (!dispo.includes(nom)) abandon(`Sauvegarde « ${nom} » introuvable.\n  Disponibles : ${dispo.join(', ')}`)

  const dossier = path.join(racine, nom)
  const manifeste = JSON.parse(fs.readFileSync(path.join(dossier, 'manifeste.json'), 'utf8'))

  console.log(`\nVerification de ${VERT(nom)}`)
  console.log(GRIS(`  ${dossier}`))
  console.log(GRIS(`  prise le ${manifeste.sauvegarde_le}`))
  if (manifeste.contient_des_secrets) {
    console.log(AMBRE('  ce dossier contient des secrets en clair — ne pas le transmettre'))
  }

  const pgRestore = trouverBinaire('pg_restore')
  const psql = trouverBinaire('psql')

  const dump = niveau1(dossier, manifeste, pgRestore)
  const niveau2Atteint = dump ? niveau2(dump, manifeste, env, psql, pgRestore) : false

  // Le VERDICT nomme le niveau atteint. « Verifiee » sans restauration et
  // « verifiee » avec ne sont pas la meme affirmation, et les confondre
  // donnerait exactement la fausse assurance que ce script combat.
  console.log('')
  if (echecs) {
    console.log(`${ROUGE('ECHEC')} — ${echecs} controle(s) en echec. Cette sauvegarde n est pas fiable.\n`)
    process.exit(2)
  }
  if (niveau2Atteint) {
    console.log(`${VERT('SAUVEGARDE EPROUVEE')} — restauree et recomptee ligne par ligne.`)
    console.log(GRIS('  Reste hors de portee d un test local : la greffe sur un vrai projet'))
    console.log(GRIS('  Supabase, et le REVOKE de `etablissement_smtp` a rejouer apres restauration.\n'))
  } else {
    console.log(`${AMBRE('ARCHIVE SAINE — restauration NON eprouvee.')}`)
    console.log(GRIS('  L archive est lisible, complete en structure et ses privileges y sont.'))
    console.log(GRIS('  Mais personne n a encore verifie que les lignes en ressortent.\n'))
  }
}

principal()
