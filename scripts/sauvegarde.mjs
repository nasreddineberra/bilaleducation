/**
 * SAUVEGARDE COMPLETE DE LA PRODUCTION.
 *
 * ┌─ POURQUOI CE SCRIPT EXISTE ──────────────────────────────────────────────┐
 * │ Verifie dans le tableau de bord le 1er octobre 2026 :                    │
 * │ « Free Plan does not include project backups. »                          │
 * │                                                                           │
 * │ Il n'y a donc AUCUN filet : ni sauvegarde planifiee, ni restauration, ni  │
 * │ meme telechargement. Et le projet Supabase actuel EST la production — il  │
 * │ porte l'ecole reelle, ses familles, ses notes et ses paiements.           │
 * │                                                                           │
 * │ Ce script est, jusqu'au passage en Pro, LE SEUL filet.                    │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * ── CE QU'IL SAUVEGARDE, ET POURQUOI EN QUATRE MORCEAUX ────────────────────
 *
 * `pg_dump` seul ne suffit pas. Trois manques ont ete payes lors de l'export du
 * 6 aout, et ils sont repris ici plutot que redecouverts :
 *
 *   1. EXTENSIONS — `pg_dump` ne les exporte JAMAIS. Sans elles, la
 *      restauration s'arretait sur la contrainte GiST de l'emploi du temps.
 *   2. BASE — schema + donnees + PRIVILEGES. Surtout pas `--no-privileges`,
 *      qui parait anodin : il retirerait les GRANT/REVOKE, donc le regime
 *      « serveur uniquement » de `etablissement_smtp`, dont le mot de passe
 *      redeviendrait lisible par tout compte de l'ecole.
 *   3. SCHEMA `storage` — compartiments et policies de fichiers, que le dump
 *      du schema public ignore.
 *   4. FICHIERS du Storage — `pg_dump` ne les voit pas, ce sont des OBJETS.
 *      Bulletins archives, justificatifs d'absence, documents d'eleves et
 *      d'enseignants, logos, pieces jointes. **Un bulletin archive est un
 *      document REMIS AUX FAMILLES** : perdre le PDF, c'est perdre la piece,
 *      et l'historique de cloture qui l'agrege devient une affirmation sans
 *      preuve.
 *
 * ── FORMAT ─────────────────────────────────────────────────────────────────
 *
 * La base part en format `custom` (`.dump`) et non en SQL : c'est lui qui
 * permet une restauration SELECTIVE (`pg_restore --table=`), dont on aura
 * besoin le jour ou il faudra rendre une seule ecole sans ecraser les autres.
 * Le schema part EN PLUS en clair, pour etre lisible et comparable d'une
 * sauvegarde a l'autre.
 *
 * ── CE QU'IL NE FAIT PAS ───────────────────────────────────────────────────
 *
 * Il ne sauvegarde pas par ETABLISSEMENT : il n'y a qu'une base, `pg_dump` la
 * prend entiere. La restauration d'une seule ecole est une PROCEDURE, decrite
 * dans le README genere a cote des fichiers. Elle ne s'improvise pas un jour
 * de panne, et elle ne se fait JAMAIS en restaurant directement en production.
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, rmSync, statSync } from 'fs'
import { execFileSync } from 'child_process'
import { join } from 'path'

// ── Reglages ────────────────────────────────────────────────────────────────

/** HORS du depot, volontairement : un depot se clone, et ces fichiers portent
 *  les donnees personnelles d'eleves mineurs. */
const DESTINATION = 'D:\\# 2. Sauvegardes Supabase - BilalEducation'

/** `pg_dump` est installe mais absent du PATH : on l'appelle par son chemin.
 *  Version 17 — elle sait sauvegarder un serveur plus ancien, l'inverse non. */
const PG_DUMP = 'C:\\Program Files\\PostgreSQL\\17\\bin\\pg_dump.exe'
const PSQL    = 'C:\\Program Files\\PostgreSQL\\17\\bin\\psql.exe'

/** Retention : on garde les 7 dernieres, et la premiere de chacune des 4
 *  dernieres semaines. Une retention DECIDEE plutot que subie — ces fichiers
 *  sont des donnees personnelles, les garder indefiniment est un traitement
 *  qu'il faudrait justifier. */
const GARDER_QUOTIDIENNES = 7
const GARDER_HEBDOMADAIRES = 4

// ── Environnement (motif de `verifier-import.mts`) ──────────────────────────

const env = Object.fromEntries(readFileSync('.env.local', 'utf8').split(/\r?\n/)
  .filter(l => l.includes('=') && !l.trim().startsWith('#'))
  .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]))

for (const cle of ['SUPABASE_DB_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']) {
  if (!env[cle]) {
    console.error(`ECHEC : ${cle} absente de .env.local. Rien n'a ete sauvegarde.`)
    process.exit(1)
  }
}
if (!existsSync(PG_DUMP)) {
  console.error(`ECHEC : pg_dump introuvable (${PG_DUMP}). Rien n'a ete sauvegarde.`)
  process.exit(1)
}

// ── Dossier horodate, en composantes LOCALES ────────────────────────────────
// Jamais `toISOString()` : il bascule en UTC et peut dater la veille (piege
// paye plusieurs fois dans ce projet).

const d = new Date()
const p2 = n => String(n).padStart(2, '0')
const horodatage = `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`
                 + `_${p2(d.getHours())}h${p2(d.getMinutes())}`
const dossier = join(DESTINATION, horodatage)
mkdirSync(dossier, { recursive: true })

console.log(`Sauvegarde dans ${dossier}\n`)

const pgdump = (args, sortie) => {
  execFileSync(PG_DUMP, [env.SUPABASE_DB_URL, ...args, '--file', join(dossier, sortie)],
    { stdio: ['ignore', 'inherit', 'inherit'] })
}

// ── 1. Extensions ───────────────────────────────────────────────────────────
// Ecrites a la main : `pg_dump` ne les emet pas, et leur absence fait echouer
// la restauration sur la premiere contrainte qui en depend (GiST / btree_gist
// pour l'anti-chevauchement de l'emploi du temps).

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

// LUES EN BASE, jamais figees ici : la liste n'est ecrite nulle part ailleurs,
// et une liste en dur se perimerait a la premiere extension ajoutee — sans que
// personne ne s'en apercoive avant une restauration.
// `plpgsql` est exclue : toujours presente, sa recreation echouerait.
const lignesExt = execFileSync(PSQL, [env.SUPABASE_DB_URL, '-At', '-c',
  "SELECT format('CREATE EXTENSION IF NOT EXISTS %I WITH SCHEMA %I;', extname, nspname)"
  + " FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace"
  + " WHERE extname <> 'plpgsql' ORDER BY extname"],
  { encoding: 'utf8' }).trim()

writeFileSync(join(dossier, '01-extensions.sql'),
  '-- Extensions, a jouer EN PREMIER.\n'
  + '-- pg_dump ne les exporte JAMAIS : sans elles la restauration s arrete sur\n'
  + '-- la contrainte GiST de l emploi du temps (btree_gist).\n'
  + lignesExt + '\n', 'utf8')
console.log(`  1/4  extensions (${lignesExt ? lignesExt.split('\n').length : 0})`)

// ── 2. La base : schema + donnees + PRIVILEGES, en format restaurable ───────

pgdump(['--format=custom', '--no-owner', '--schema=public'], '02-base.dump')
console.log('  2/4  base (schema + donnees + privileges)')

// En clair EN PLUS : lisible, comparable d une sauvegarde a l autre.
pgdump(['--format=plain', '--schema-only', '--no-owner', '--schema=public'], '02-schema-lisible.sql')

// ── 3. Le schema `storage` (compartiments et policies de fichiers) ──────────

pgdump(['--format=plain', '--no-owner', '--schema=storage'], '03-storage-schema.sql')
console.log('  3/4  schema storage')

// ── 4. LES FICHIERS. Invisibles pour pg_dump : ce sont des objets. ──────────

const racineFichiers = join(dossier, '04-fichiers')
mkdirSync(racineFichiers, { recursive: true })

const { data: buckets, error: errB } = await sb.storage.listBuckets()
if (errB) {
  console.error(`  4/4  ECHEC du listage des compartiments : ${errB.message}`)
  process.exit(1)
}

let nbFichiers = 0, octets = 0

/** Un compartiment est une arborescence : on la parcourt en entier. L API ne
 *  rend que 100 entrees par defaut et ne descend pas seule dans les dossiers. */
async function descendre(bucket, prefixe = '') {
  const { data: entrees, error } = await sb.storage.from(bucket).list(prefixe, { limit: 1000 })
  if (error) { console.error(`    ${bucket}/${prefixe} : ${error.message}`); return }

  for (const e of entrees ?? []) {
    const chemin = prefixe ? `${prefixe}/${e.name}` : e.name
    // Une entree sans metadonnees est un DOSSIER, pas un fichier.
    if (!e.id) { await descendre(bucket, chemin); continue }

    const { data: blob, error: errD } = await sb.storage.from(bucket).download(chemin)
    if (errD || !blob) { console.error(`    ${bucket}/${chemin} : ${errD?.message ?? 'vide'}`); continue }

    const cible = join(racineFichiers, bucket, ...chemin.split('/'))
    mkdirSync(join(cible, '..'), { recursive: true })
    const buf = Buffer.from(await blob.arrayBuffer())
    writeFileSync(cible, buf)
    nbFichiers++; octets += buf.length
  }
}

for (const b of buckets ?? []) await descendre(b.name)
console.log(`  4/4  fichiers : ${nbFichiers} dans ${buckets?.length ?? 0} compartiment(s)`)

// ── Le mode d emploi, ecrit MAINTENANT et non le jour de la panne ───────────

writeFileSync(join(dossier, 'RESTAURATION.md'), `# Restaurer cette sauvegarde

Prise le ${horodatage.replace('_', ' a ').replace('h', ' h ')}.
Contenu : ${nbFichiers} fichier(s) de stockage, ${(octets / 1024 / 1024).toFixed(1)} Mo.

## 1. Tout restaurer (la base a disparu)

Dans cet ordre, **les extensions D ABORD** — sans elles la restauration
s arrete sur la contrainte GiST de l emploi du temps :

    psql "<URL_DE_LA_NOUVELLE_BASE>" -f 01-extensions.sql
    pg_restore -d "<URL_DE_LA_NOUVELLE_BASE>" --no-owner 02-base.dump
    psql "<URL_DE_LA_NOUVELLE_BASE>" -f 03-storage-schema.sql

Puis reteleverser \`04-fichiers/\` compartiment par compartiment (chaque
sous-dossier porte le nom de son compartiment).

**Ne pas ajouter \`--no-privileges\`** : il retirerait les GRANT/REVOKE, donc le
regime « serveur uniquement » de \`etablissement_smtp\` — le mot de passe SMTP
redeviendrait lisible par tout compte de l ecole.

## 2. Restaurer UNE SEULE ecole

**Ne jamais restaurer ce dump directement en production pour cela.** Il
ecraserait le travail de toutes les autres ecoles depuis cette sauvegarde : le
remede serait pire que le mal.

1. Restaurer le dump dans une base **jetable** (projet Supabase temporaire ou
   base locale), comme au point 1.
2. En extraire les lignes de l ecole, **en suivant les chaines de
   rattachement** — car toutes les tables ne portent pas \`etablissement_id\` :
   - \`class_teachers\` -> par \`classes\`
   - \`announcement_recipients\`, \`announcement_staff_recipients\`,
     \`announcement_attachments\` -> par \`announcements\`
   - \`periods\`, \`eval_type_configs\` -> par \`school_years\`
   Ces chemins sont ceux des policies RLS : chaque migration du chantier
   (aout-octobre 2026) dit par quelle jointure une table se rattache a son
   etablissement. C est la carte a suivre.
3. Reinjecter en production **dans l ordre des cles etrangeres**.

## 3. Ce que cette sauvegarde ne contient pas

Les comptes \`auth.users\` ne sont **pas** dans le schema \`public\`. Une
restauration sur un projet neuf recreera les donnees mais pas les identifiants
de connexion : il faudra recreer les comptes et relier \`profiles.id\`.
`, 'utf8')

// ── Retention : decidee, pas subie ──────────────────────────────────────────

const toutes = readdirSync(DESTINATION)
  .filter(n => /^\d{4}-\d{2}-\d{2}_\d{2}h\d{2}$/.test(n))
  .filter(n => statSync(join(DESTINATION, n)).isDirectory())
  .sort().reverse()

const garder = new Set(toutes.slice(0, GARDER_QUOTIDIENNES))
const semainesVues = new Set()
for (const n of toutes) {
  const [a, m, j] = n.slice(0, 10).split('-').map(Number)
  const sem = Math.floor(Date.UTC(a, m - 1, j) / (7 * 86400000))
  if (!semainesVues.has(sem) && semainesVues.size < GARDER_HEBDOMADAIRES) {
    semainesVues.add(sem); garder.add(n)
  }
}
let supprimees = 0
for (const n of toutes) {
  if (garder.has(n)) continue
  rmSync(join(DESTINATION, n), { recursive: true, force: true })
  supprimees++
}

console.log(`\nTermine. ${toutes.length - supprimees} sauvegarde(s) conservee(s)`
          + (supprimees ? `, ${supprimees} ancienne(s) effacee(s).` : '.'))
console.log(`Mode d emploi : ${join(dossier, 'RESTAURATION.md')}`)
