/**
 * Types TypeScript de la base, GENERES depuis la structure reelle du projet
 * Supabase (API de gestion, schema `public`) -> `src/types/supabase.ts`.
 *
 * Les clients Supabase sont types avec ce fichier (`createClient<Database>`) :
 * chaque requete sait ce qu'elle renvoie, et une colonne renommee ou supprimee
 * fait echouer `npm run type-check` au lieu de casser un ecran. Les types
 * n'existent qu'a la compilation : aucun effet a l'execution.
 *
 * A RELANCER APRES TOUTE MIGRATION qui touche la structure de `public` :
 *   npm run types-db
 *
 * Lecture seule (structure, aucune donnee). Jeton : SUPABASE_TYPES_TOKEN de
 * `.env.local` (permission `database_read`), a defaut SUPABASE_ACCESS_TOKEN ;
 * plus `psql` et SUPABASE_DB_URL pour les tables a ecole posee par declencheur.
 * Ne pas editer le fichier produit.
 */
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const SORTIE = path.join('src', 'types', 'supabase.ts')

function abandon(message) {
  console.error(`\n[types-db] ${message}\n`)
  process.exit(1)
}

/** `.env.local`, coupe sur le PREMIER `=` (une cle peut en contenir). */
function lireEnv() {
  const p = path.join(process.cwd(), '.env.local')
  if (!fs.existsSync(p)) abandon('`.env.local` introuvable. Lancez le script depuis la racine du projet.')
  const out = {}
  for (const ligne of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const t = ligne.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i > 0) out[t.slice(0, i)] = t.slice(i + 1).replace(/^["']|["']$/g, '')
  }
  return out
}

const env = lireEnv()
const jeton = env.SUPABASE_TYPES_TOKEN || env.SUPABASE_ACCESS_TOKEN
const url = env.NEXT_PUBLIC_SUPABASE_URL
if (!jeton) abandon('SUPABASE_TYPES_TOKEN (ou SUPABASE_ACCESS_TOKEN) absent de `.env.local`.')
if (!url) abandon('NEXT_PUBLIC_SUPABASE_URL absent de `.env.local`.')
const ref = new URL(url).hostname.split('.')[0]

const reponse = await fetch(
  `https://api.supabase.com/v1/projects/${ref}/types/typescript?included_schemas=public`,
  { headers: { Authorization: `Bearer ${jeton}` } },
)
if (reponse.status === 403) {
  abandon(
    'le jeton n\'a pas la permission `database_read`.\n\n' +
    '  Creer un jeton (Supabase > Account > Access Tokens) avec cette permission, puis\n' +
    '  l\'ajouter a `.env.local` :  SUPABASE_TYPES_TOKEN=sbp_...',
  )
}
if (reponse.status === 401) {
  abandon(
    'jeton refuse (expire ou revoque).\n\n' +
    '  En recreer un (Supabase > Account > Access Tokens, Database = Read) et remplacer\n' +
    '  SUPABASE_TYPES_TOKEN dans `.env.local`.',
  )
}
if (!reponse.ok) abandon(`API Supabase : ${reponse.status} ${await reponse.text()}`)
const { types } = await reponse.json()

// Garde-fou : un fichier vide ou tronque passerait le type-check en typant tout
// de travers. On exige le schema et quelques tables connues.
for (const attendu of ['public:', 'students:', 'etablissements:', 'Functions:']) {
  if (!types?.includes(attendu)) abandon(`reponse inattendue (« ${attendu} » introuvable) : rien n'est ecrit.`)
}

/**
 * Parametres des fonctions SQL : PostgreSQL ne sait pas declarer un parametre
 * NOT NULL, tout appel peut passer NULL (et nos fonctions le gerent : civilite,
 * telephone...). Le generateur les type pourtant non nuls : on ajoute `| null`
 * a chaque parametre de `Functions.*.Args`. Les garde-fous restent en SQL.
 */
function parametresNullables(source) {
  const lignes = source.split('\n')
  let dansFonctions = false
  let dansArgs = false
  return lignes.map(ligne => {
    if (/^ {4}Functions: \{$/.test(ligne)) dansFonctions = true
    else if (/^ {4}[A-Za-z]+: \{/.test(ligne)) dansFonctions = false
    if (!dansFonctions) return ligne
    // `Args: { p_a: string; p_b?: number }` sur une ligne (suivi ou non de `; Returns: ...`)
    if (/Args: \{ [^{}]+ \}/.test(ligne)) {
      return ligne.replace(/Args: \{ ([^{}]+) \}/, (_, liste) =>
        `Args: { ${liste.split('; ').map(p => `${p} | null`).join('; ')} }`)
    }
    if (/^\s*Args: \{$/.test(ligne)) { dansArgs = true; return ligne }
    if (dansArgs && /^\s*\}$/.test(ligne)) { dansArgs = false; return ligne }
    if (dansArgs && /^\s*[a-z_0-9]+\??: .+[^{|]$/.test(ligne)) return `${ligne} | null`
    return ligne
  }).join('\n')
}

/** Lignes rendues par une requete en LECTURE (psql, SUPABASE_DB_URL), colonnes separees par `|`. */
function lireBase(sql) {
  if (!env.SUPABASE_DB_URL) abandon('SUPABASE_DB_URL absent de `.env.local`.')
  const exe = process.platform === 'win32' ? 'psql.exe' : 'psql'
  const candidat = path.join('C:/Program Files/PostgreSQL/17/bin', exe)
  const psql = fs.existsSync(candidat) ? candidat : 'psql'
  let sortie
  try {
    sortie = execFileSync(psql, [env.SUPABASE_DB_URL, '-At', '-c', sql], { encoding: 'utf8' })
  } catch (e) {
    abandon(`lecture de la base impossible (psql) : ${e.message}`)
  }
  const lignes = sortie.split(/\r?\n/).filter(Boolean).map(l => l.split('|'))
  if (!lignes.length) abandon(`requete sans resultat, rien n'est ecrit :\n${sql}`)
  return lignes
}

/**
 * Parcourt `Tables` ligne a ligne et donne a `remplacer(table, bloc, ligne)` les
 * colonnes des blocs Row / Insert / Update. Rend le texte et le nombre de lignes changees.
 */
function parcourirColonnes(source, remplacer) {
  let dansTables = false
  let table = null
  let bloc = null
  let changees = 0
  const sortie = source.split('\n').map(ligne => {
    if (/^ {4}Tables: \{$/.test(ligne)) { dansTables = true; return ligne }
    if (/^ {4}[A-Za-z]+: \{$/.test(ligne)) dansTables = false
    if (!dansTables) return ligne
    const t = ligne.match(/^ {6}([a-z_0-9]+): \{$/)
    if (t) { table = t[1]; bloc = null; return ligne }
    const b = ligne.match(/^ {8}(Row|Insert|Update|Relationships): /)
    if (b) { bloc = b[1]; return ligne }
    if (!bloc || bloc === 'Relationships' || !/^ {10}\S/.test(ligne)) return ligne
    const nouvelle = remplacer(table, bloc, ligne)
    if (nouvelle !== ligne) changees++
    return nouvelle
  }).join('\n')
  return { sortie, changees }
}

/**
 * Tables dont `etablissement_id` est pose par le declencheur `set_etablissement_id`
 * (BEFORE INSERT, ecole de la session) : la colonne y est NOT NULL sans defaut,
 * le generateur l'exige donc a l'insertion alors que le code ne l'envoie pas.
 * On la rend facultative dans `Insert`.
 */
function ecoleFacultativeALInsertion(source) {
  const noms = new Set(lireBase(`SELECT DISTINCT c.relname FROM pg_trigger t
    JOIN pg_proc p ON p.oid = t.tgfoid JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND p.proname = 'set_etablissement_id' AND NOT t.tgisinternal`).map(l => l[0]))
  const { sortie, changees } = parcourirColonnes(source, (table, bloc, ligne) =>
    bloc === 'Insert' && noms.has(table) && ligne === '          etablissement_id: string'
      ? '          etablissement_id?: string'
      : ligne)
  if (changees !== noms.size) abandon(`${noms.size} tables a declencheur, ${changees} colonnes rendues facultatives : rien n'est ecrit.`)
  return sortie
}

/**
 * Colonnes bornees par un CHECK d'une seule colonne `col = ANY (ARRAY[...])`
 * (eventuellement `col IS NULL OR ...`) : le generateur les type `string` /
 * `number`, on y met l'union des valeurs permises, lue dans la contrainte.
 */
function valeursPermises(source) {
  const lignes = lireBase(`SELECT c.relname, a.attname, pg_get_constraintdef(k.oid)
    FROM pg_constraint k JOIN pg_class c ON c.oid = k.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = k.conkey[1]
    WHERE k.contype = 'c' AND n.nspname = 'public' AND array_length(k.conkey, 1) = 1`)
  const unions = new Map()
  for (const [table, col, def] of lignes) {
    const m = def.match(/^CHECK \(\(+(?:\w+ IS NULL\) OR \(+)?(\w+) = ANY \(ARRAY\[(.*)\]\)\)+$/)
    if (!m || m[1] !== col) continue
    const texte = [...m[2].matchAll(/'((?:[^']|'')*)'::text/g)].map(v => JSON.stringify(v[1].replace(/''/g, "'")))
    const nombres = m[2].split(', ').filter(v => /^-?\d+$/.test(v))
    const valeurs = texte.length ? texte : nombres
    if (valeurs.length) unions.set(`${table}.${col}`, { base: texte.length ? 'string' : 'number', union: valeurs.join(' | ') })
  }
  const { sortie, changees } = parcourirColonnes(source, (table, _bloc, ligne) => {
    const m = ligne.match(/^( {10}(\w+)\??: )(string|number)( \| null)?$/)
    const u = m && unions.get(`${table}.${m[2]}`)
    return u && u.base === m[3] ? `${m[1]}${u.union}${m[4] ?? ''}` : ligne
  })
  // Chaque colonne paraît dans Row, Insert et Update.
  if (changees !== unions.size * 3) abandon(`${unions.size} colonnes bornees, ${changees} lignes typees (attendu ${unions.size * 3}) : rien n'est ecrit.`)
  return sortie
}

/**
 * Colonnes jsonb a structure connue : leur forme est declaree dans
 * `src/types/json.ts` (`ColonnesJson`, cles `table.colonne`) et remplace `Json`.
 */
function colonnesJson(source) {
  const declarees = fs.readFileSync(path.join('src', 'types', 'json.ts'), 'utf8')
  const bloc = declarees.slice(declarees.indexOf('export type ColonnesJson'))
  const cles = new Set([...bloc.matchAll(/'(\w+\.\w+)':/g)].map(m => m[1]))
  if (!cles.size) abandon('aucune colonne lue dans `ColonnesJson` (src/types/json.ts) : rien n\'est ecrit.')
  const { sortie, changees } = parcourirColonnes(source, (table, _bloc, ligne) => {
    const m = ligne.match(/^( {10}(\w+)\??: )Json( \| null)?$/)
    return m && cles.has(`${table}.${m[2]}`) ? `${m[1]}ColonnesJson['${table}.${m[2]}']${m[3] ?? ''}` : ligne
  })
  if (changees !== cles.size * 3) abandon(`${cles.size} colonnes jsonb declarees, ${changees} lignes typees (attendu ${cles.size * 3}) : rien n'est ecrit.`)
  return sortie
}

const entete =
  '// FICHIER GENERE par `npm run types-db` (scripts/generer-types-db.mjs) : ne pas editer.\n' +
  `// Structure du schema public du projet Supabase, le ${new Date().toISOString().slice(0, 10)}.\n\n` +
  "import type { ColonnesJson } from './json'\n\n"
fs.writeFileSync(SORTIE, entete + colonnesJson(valeursPermises(ecoleFacultativeALInsertion(parametresNullables(types)))))
const tables = (types.match(/^ {6}[a-z_]+: \{$/gm) ?? []).length
console.log(`[types-db] ${SORTIE} ecrit (${tables} entrees de premier niveau, ${types.length} caracteres).`)
