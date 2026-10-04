#!/usr/bin/env node
/**
 * ETAT DES MIGRATIONS : ce que le depot contient, face a ce que la base a joue.
 *
 * ┌─ POURQUOI UN SCRIPT LOCAL QUI GENERE DU SQL ─────────────────────────────┐
 * │ Le SQL ne sait pas lire un dossier, et ce projet n ouvre PAS de          │
 * │ connexion a la production depuis le poste : les migrations se collent    │
 * │ dans l editeur Supabase. Le script fait donc la seule moitie qu il peut  │
 * │ faire — lire le depot, calculer les empreintes — et PRODUIT un bloc SQL  │
 * │ a coller, qui compare cette liste au registre et affiche l ecart.        │
 * │                                                                          │
 * │ Rien n est applique automatiquement. Motif de `supabase/controles/` :    │
 * │ bloc `DO` termine par une exception volontaire, donc tout est annule et  │
 * │ le rapport s affiche a la place du message d erreur (bandeau rouge       │
 * │ attendu).                                                               │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * USAGE
 *   node scripts/migrations-etat.mjs              # bloc de COMPARAISON a coller
 *   node scripts/migrations-etat.mjs --remplir    # bloc de REMPLISSAGE INITIAL
 *   node scripts/migrations-etat.mjs --local      # inventaire local, sans SQL
 *   node scripts/migrations-etat.mjs --ligne <nom># la ligne a mettre en fin de migration
 *   node scripts/migrations-etat.mjs --depuis 2026-08-06   # ajoutees depuis cette date
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { execSync } from 'node:child_process'
import { join } from 'node:path'

const DIR = 'supabase/migrations'
const JOURNAL = 'CLAUDE.md'

// ── L EMPREINTE ───────────────────────────────────────────────────────────
/**
 * Deux normalisations, et chacune repare un faux ecart precis :
 *
 *  1. CRLF -> LF. Ce depot convertit les fins de ligne a la sortie de git
 *     (l avertissement « LF will be replaced by CRLF » apparait a chaque
 *     commit). Sans cela, la meme migration aurait deux empreintes selon la
 *     machine, et le registre signalerait un ecart a chaque changement de poste.
 *
 *  2. Les lignes qui APPELLENT `enregistrer_migration(` sont retirees — les
 *     appels seuls (`SELECT` / `PERFORM`), jamais la ligne qui DEFINIT la
 *     fonction, sinon l empreinte de la migration du registre deviendrait
 *     aveugle a sa propre signature. Une
 *     migration ne peut pas porter sa propre empreinte — l ecrire change le
 *     fichier, donc l empreinte. En excluant ces lignes du calcul, chaque
 *     migration peut porter son enregistrement en derniere ligne et un seul
 *     collage suffit.
 */
export function empreinte(contenu) {
  const normalise = contenu
    .replace(/\r\n/g, '\n')
    .split('\n')
    // SEULS LES APPELS, pas la definition. Un filtre sur le simple nom
    // retirait aussi `CREATE OR REPLACE FUNCTION enregistrer_migration(` de la
    // migration du registre : changer la signature de la fonction n aurait
    // alors pas change l empreinte du fichier.
    .filter((l) => !/^\s*(SELECT|PERFORM)\s+enregistrer_migration\s*\(/i.test(l))
    .join('\n')
  return createHash('sha256').update(normalise, 'utf8').digest('hex')
}

// ── LE DEPOT ──────────────────────────────────────────────────────────────
function lireDepot() {
  const noms = readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort()

  // L ORDRE vient de git, jamais du nom : aucune migration de ce projet n est
  // prefixee par un horodatage, et il n y a PAS lieu d en renommer 131 —
  // `git log --diff-filter=A` porte deja la date d ajout de chacune.
  const dates = new Map()
  const brut = execSync(
    `git log --diff-filter=A --format="C %cI" --name-only --reverse -- ${DIR}/`,
    { encoding: 'utf-8', maxBuffer: 32 * 1024 * 1024 },
  )
  let courante = null
  for (const ligne of brut.split('\n')) {
    if (ligne.startsWith('C ')) { courante = ligne.slice(2).trim(); continue }
    const nom = ligne.trim().replace(`${DIR}/`, '')
    if (nom.endsWith('.sql') && !dates.has(nom)) dates.set(nom, courante)
  }

  // Les cases cochees du journal ATTESTENT d une application reelle ; tout le
  // reste n est que PRESUME. On ne confond pas les deux : un « presume » faux
  // se decouvre un jour, et il faut alors savoir qu on ne l avait pas verifie.
  const attestees = new Set()
  if (existsSync(JOURNAL)) {
    const j = readFileSync(JOURNAL, 'utf-8')
    for (const m of j.matchAll(/- \[x\][^\n]*?supabase\/migrations\/([A-Za-z0-9._-]+\.sql)/g)) {
      attestees.add(m[1])
    }
  }

  return noms.map((nom) => {
    const src = readFileSync(join(DIR, nom), 'utf-8')
    return {
      nom,
      empreinte: empreinte(src),
      ajoutee: dates.get(nom) ?? null,
      attestee: attestees.has(nom),
      // Un APPEL, pas la definition (meme raison que pour l empreinte).
      porteEnregistrement: /^\s*(SELECT|PERFORM)\s+enregistrer_migration\s*\(/im.test(src),
    }
  // Une migration PAS ENCORE COMMITEE n a pas de date d ajout : elle est, par
  // definition, la plus recente. La trier sur une chaine vide la placait en
  // TETE — donc en premier du remplissage, avec un ordre faux.
  }).sort((a, b) => (a.ajoutee ?? '9999').localeCompare(b.ajoutee ?? '9999')
                    || a.nom.localeCompare(b.nom))
}

// ── Les fichiers que git a connus puis qui ont DISPARU du disque ───────────
//
// Cas reel : `add-absence-replacement-designation.sql`, ajoutee le 14 aout puis
// supprimee le meme jour. VERIFIE EN BASE le 4 octobre : sa colonne n existe
// pas, et sa fonction est recreee par deux migrations PRESENTES — rien
// d orphelin. Le signalement brut (« fichier disparu ») avait donc fait croire
// a un ecart qui n existait pas.
//
// D ou le raffinement : on extrait les objets que le fichier creait et on ne
// crie que sur ceux dont AUCUN fichier present ne porte plus le nom. Un
// signalement qui ne distingue pas « a verifier » de « casse » fait perdre la
// confiance qu on lui accorde.
//
// RESULTAT DEJA OBTENU LE 4 OCTOBRE, pour ne pas le refaire : des 4 objets de
// ce fichier, la fonction et son trigger sont recrees par deux migrations
// presentes ; la colonne replacement_profile_id et son index n ont plus de
// source — et la base a repondu qu ils N EXISTENT PAS. Aucun orphelin, donc.
// L approche avait ete abandonnee AVANT d etre jouee : le code utilise
// replaced_profile_id, qui pointe en sens inverse.
function lireDisparues(presentes) {
  const brut = execSync(
    `git log --diff-filter=A --format="" --name-only -- ${DIR}/`,
    { encoding: 'utf-8', maxBuffer: 32 * 1024 * 1024 },
  )
  const connues = new Set(
    brut.split('\n').map((l) => l.trim().replace(`${DIR}/`, ''))
      .filter((n) => n.endsWith('.sql')),
  )
  const noms = [...connues].filter((n) => !presentes.has(n)).sort()
  if (!noms.length) return []

  // Tout le SQL encore present, pour y chercher les objets du disparu.
  const presentSql = [...presentes]
    .map((n) => readFileSync(join(DIR, n), 'utf-8')).join('\n')

  return noms.map((nom) => {
    // Derniere version connue du fichier, avant sa suppression.
    //
    // `~1` ET SURTOUT PAS `^` : `execSync` passe par `cmd.exe` sous Windows, ou
    // `^` est le caractere d ECHAPPEMENT. git recevait alors `<sha>:fichier` et
    // cherchait le fichier dans le commit qui l avait supprime — ou il n existe
    // plus, par definition. Les deux notations sont equivalentes pour git.
    let src = ''
    let echec = null
    try {
      const sha = execSync(`git log --diff-filter=D --format=%H -1 -- ${DIR}/${nom}`,
        { encoding: 'utf-8' }).trim()
      if (!sha) throw new Error('aucun commit de suppression trouve')
      src = execSync(`git show ${sha}~1:${DIR}/${nom}`,
        { encoding: 'utf-8', maxBuffer: 8 * 1024 * 1024 })
    } catch (e) {
      // JAMAIS un catch muet ici : son silence transformait l echec en
      // « 0 objet », donc en verdict rassurant « rien d orphelin ».
      echec = String(e.message).split('\n')[0]
    }

    // Les objets qu il creait. Un objet encore nomme par un fichier PRESENT a
    // ete repris ailleurs : ce n est pas un orphelin.
    const objets = [...new Set(
      [...src.matchAll(
        /(?:CREATE(?:\s+OR\s+REPLACE)?\s+(?:FUNCTION|TABLE|TRIGGER|POLICY|(?:UNIQUE\s+)?INDEX)(?:\s+IF\s+NOT\s+EXISTS)?|ADD\s+COLUMN(?:\s+IF\s+NOT\s+EXISTS)?)\s+"?([a-z_][a-z0-9_]*)"?/gi,
      )].map((m) => m[1]),
    )]
    const orphelins = objets.filter((o) => !presentSql.includes(o))

    // Un fichier SQL non vide d ou l on n extrait AUCUN objet est une anomalie
    // de ce script, pas un resultat : on le dit plutot que de conclure.
    if (!echec && src.trim() && !objets.length) {
      echec = 'contenu lu, mais aucun objet reconnu : extraction a revoir'
    }
    return { nom, objets, orphelins, echec }
  })
}

const q = (s) => `'${String(s).replace(/'/g, "''")}'`

// ══ MODES ═════════════════════════════════════════════════════════════════
const args = process.argv.slice(2)
const migrations = lireDepot()
const disparues = lireDisparues(new Set(migrations.map((m) => m.nom)))

if (args[0] === '--local') {
  console.log(`\n${migrations.length} migration(s) dans ${DIR}\n`)
  console.log('  ATTESTEES par CLAUDE.md : ' + migrations.filter((m) => m.attestee).length)
  console.log('  presumees               : ' + migrations.filter((m) => !m.attestee).length)
  console.log('  portant leur enregistrement : ' + migrations.filter((m) => m.porteEnregistrement).length)
  console.log('\n  5 plus anciennes :')
  const quand = (m) => (m.ajoutee ? m.ajoutee.slice(0, 10) : 'non commitee')
  migrations.slice(0, 5).forEach((m) => console.log(`    ${quand(m)}  ${m.nom}`))
  console.log('  5 plus recentes :')
  migrations.slice(-5).forEach((m) => console.log(`    ${quand(m)}  ${m.nom}`))
  if (disparues.length) {
    console.log(`\n  ${disparues.length} fichier(s) connu(s) de git, absent(s) du disque :`)
    for (const d of disparues) {
      const verdict = d.echec
        ? `?? NON CONCLUANT : ${d.echec}`
        : d.orphelins.length
          // « plus de source DANS LE DEPOT » n est PAS « orphelin en base » : le
          // script ne peut pas savoir si l objet existe. Il dit ce qu il sait.
          ? `${d.orphelins.length} objet(s) sans source au depot, A VERIFIER EN BASE : ${d.orphelins.join(', ')}`
          : `ses ${d.objets.length} objet(s) sont repris par des fichiers presents : rien d orphelin`
      console.log(`     ${d.nom}\n       ${verdict}`)
    }
  }
  process.exit(0)
}

// ── Ce qui a ete ajoute DEPUIS une date ───────────────────────────────────
//
// L usage reel : reconstruire une base. On part de l instantane de
// `supabase/restore/` (date dans son nom de fichier), puis on ne joue que les
// migrations POSTERIEURES — rejouer les 132 dans l ordre ne marche pas, elles
// sont incrementales et les tables centrales venaient de `schema.sql`, supprime
// le 5 aout.
if (args[0] === '--depuis') {
  const date = args[1]
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? '')) {
    console.error('usage : --depuis AAAA-MM-JJ   (ex. la date de supabase/restore/02-schema-*.sql)')
    process.exit(1)
  }
  // Comparaison lexicographique sur l horodatage ISO : exacte, et sans `Date`
  // donc sans fuseau (motif de `jours-fermes.ts`).
  const apres = migrations.filter((m) => (m.ajoutee ?? '9999') > date)
  console.log(`\n${apres.length} migration(s) ajoutee(s) APRES le ${date}, dans l ordre :\n`)
  apres.forEach((m, i) => {
    const marque = m.attestee ? ' ' : '?'
    const quand = m.ajoutee ? m.ajoutee.slice(0, 10) : 'non commitee'
    console.log(`  ${String(i + 1).padStart(3)}. ${marque} ${quand.padEnd(12)}  ${m.nom}`)
  })
  console.log(`\n  « ? » = non attestee par CLAUDE.md : son application n est que presumee.`)
  console.log(`  ${migrations.length - apres.length} migration(s) anterieure(s) : deja dans l instantane.`)
  process.exit(0)
}

if (args[0] === '--ligne') {
  const nom = args[1]
  if (!nom) { console.error('usage : --ligne <nom-du-fichier.sql>'); process.exit(1) }
  const m = migrations.find((x) => x.nom === nom)
  if (!m) { console.error(`introuvable dans ${DIR} : ${nom}`); process.exit(1) }
  console.log(`\n-- A coller en DERNIERE ligne de ${nom} :`)
  console.log(`SELECT enregistrer_migration(${q(m.nom)}, ${q(m.empreinte)});`)
  console.log(`\n(l empreinte exclut cette ligne, le fichier peut donc la porter)`)
  process.exit(0)
}

// ── Bloc de REMPLISSAGE INITIAL ───────────────────────────────────────────
if (args[0] === '--remplir') {
  console.log(`-- ╔════════════════════════════════════════════════════════════════════════╗
-- ║  REMPLISSAGE INITIAL DU REGISTRE — genere le ${new Date().toISOString().slice(0, 10)}                      ║
-- ╚════════════════════════════════════════════════════════════════════════╝
--
-- A coller UNE SEULE FOIS, apres \`create-migrations-registre.sql\`.
--
-- CE QU IL DECLARE, ET CE QU IL NE PROUVE PAS. Les ${migrations.length} migrations du depot
-- sont declarees appliquees. Pour ${migrations.filter((m) => m.attestee).length} d entre elles, \`CLAUDE.md\` l atteste
-- (case cochee) : elles entrent en 'atteste'. Les ${migrations.filter((m) => !m.attestee).length} autres entrent en
-- 'presume' — personne ne peut aujourd hui affirmer qu elles ont ete jouees,
-- et le registre doit le dire plutot que de l effacer.
--
-- ORDRE : date d AJOUT dans git, seule source d ordre existante (aucun nom
-- n est prefixe par un horodatage, et il n y a pas lieu d en renommer ${migrations.length}).

INSERT INTO migrations_appliquees (nom, empreinte, appliquee_le, source, note) VALUES`)

  const lignes = migrations.map((m) => {
    const quand = m.ajoutee ? `${q(m.ajoutee)}::timestamptz` : 'now()'
    const note = m.attestee ? 'NULL' : q('declaree au remplissage initial, non verifiee')
    return `  (${q(m.nom)}, ${q(m.empreinte)}, ${quand}, ${q(m.attestee ? 'atteste' : 'presume')}, ${note})`
  })
  console.log(lignes.join(',\n'))
  console.log(`ON CONFLICT (nom) DO NOTHING;   -- rejouable : n ecrase aucun enregistrement reel

-- Verification immediate : le compte doit tomber juste, sinon le collage a ete
-- tronque — un copier-coller de ${lignes.length} lignes se coupe sans prevenir.
DO $v$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM migrations_appliquees;
  IF n < ${lignes.length} THEN
    RAISE EXCEPTION 'Registre incomplet : % ligne(s) sur ${lignes.length} attendue(s). Collage tronque ?', n;
  END IF;
  RAISE NOTICE 'OK : % migration(s) au registre (% attestee(s), % presumee(s)).',
    n,
    (SELECT count(*) FROM migrations_appliquees WHERE source = 'atteste'),
    (SELECT count(*) FROM migrations_appliquees WHERE source = 'presume');
END
$v$;`)
  const nonConcluants = disparues.filter((d) => d.echec)
  const avecOrphelins = disparues.filter((d) => !d.echec && d.orphelins.length)
  if (nonConcluants.length) {
    console.log(`
-- ── ${nonConcluants.length} fichier(s) disparu(s) que ce script N A PAS SU ANALYSER
${nonConcluants.map((d) => `--    ${d.nom} : ${d.echec}`).join('\n')}
-- A regarder a la main : leur contenu pourrait avoir laisse des objets en base.`)
  }
  if (avecOrphelins.length) {
    console.log(`
-- ── A VERIFIER EN BASE : ${avecOrphelins.length} fichier(s) disparu(s) dont des objets n ont PLUS DE SOURCE
${avecOrphelins.map((d) => `--    ${d.nom} -> ${d.orphelins.join(', ')}`).join('\n')}
-- Si ce fichier a ete joue avant sa suppression, ces objets vivent en base sans
-- qu aucune migration ne les decrive. Seule une requete sur le catalogue
-- (information_schema, pg_proc) peut le trancher.`)
  } else if (disparues.length) {
    console.log(`
-- ${disparues.length} fichier(s) disparu(s) du depot, mais leurs objets sont repris par des
-- migrations presentes : rien d orphelin a verifier.`)
  }
  process.exit(0)
}

// ── Bloc de COMPARAISON (mode par defaut) ─────────────────────────────────
console.log(`-- ╔════════════════════════════════════════════════════════════════════════╗
-- ║  ETAT DES MIGRATIONS : depot face au registre — genere le ${new Date().toISOString().slice(0, 10)}         ║
-- ║  Lecture seule. Tout est ANNULE : exception volontaire en sortie unique. ║
-- ╚════════════════════════════════════════════════════════════════════════╝
--
-- Trois ecarts possibles, et ils ne se corrigent pas de la meme facon :
--   MANQUANTE  : au depot, absente du registre      -> a jouer, puis enregistrer
--   MODIFIEE   : enregistree, mais le fichier a change -> relire le diff AVANT
--                de rejouer (certaines ne se rejouent pas sans lever)
--   INCONNUE   : au registre, absente du depot      -> fichier supprime : la
--                base porte peut-etre des objets sans source

DO $etat$
DECLARE
  r        text := E'\\n';
  ligne    record;
  n_man    int := 0;
  n_mod    int := 0;
  n_inc    int := 0;
  n_ok     int := 0;
BEGIN
  CREATE TEMP TABLE depot (nom text PRIMARY KEY, empreinte text) ON COMMIT DROP;
  INSERT INTO depot (nom, empreinte) VALUES`)

console.log(migrations.map((m) => `    (${q(m.nom)}, ${q(m.empreinte)})`).join(',\n') + ';')

console.log(`
  SELECT count(*) INTO n_ok FROM depot d JOIN migrations_appliquees m USING (nom)
   WHERE d.empreinte = m.empreinte;

  r := r || format('  depot : %s   registre : %s   concordantes : %s%s',
                   (SELECT count(*) FROM depot),
                   (SELECT count(*) FROM migrations_appliquees),
                   n_ok, E'\\n');

  r := r || E'\\n=== MANQUANTES (au depot, pas au registre) ======================\\n';
  FOR ligne IN
    SELECT d.nom FROM depot d
     WHERE NOT EXISTS (SELECT 1 FROM migrations_appliquees m WHERE m.nom = d.nom)
     ORDER BY d.nom
  LOOP
    n_man := n_man + 1;
    r := r || format('  %s%s', ligne.nom, E'\\n');
  END LOOP;
  IF n_man = 0 THEN r := r || E'  aucune.\\n'; END IF;

  r := r || E'\\n=== MODIFIEES DEPUIS LEUR APPLICATION ==========================\\n';
  FOR ligne IN
    SELECT d.nom, m.appliquee_le::date AS le, m.source FROM depot d
      JOIN migrations_appliquees m USING (nom)
     WHERE d.empreinte <> m.empreinte
     ORDER BY d.nom
  LOOP
    n_mod := n_mod + 1;
    r := r || format('  %-52s appliquee le %s (%s)%s',
                     ligne.nom, ligne.le, ligne.source, E'\\n');
  END LOOP;
  IF n_mod = 0 THEN r := r || E'  aucune.\\n'; END IF;

  r := r || E'\\n=== INCONNUES (au registre, plus au depot) =====================\\n';
  FOR ligne IN
    SELECT m.nom FROM migrations_appliquees m
     WHERE NOT EXISTS (SELECT 1 FROM depot d WHERE d.nom = m.nom)
     ORDER BY m.nom
  LOOP
    n_inc := n_inc + 1;
    r := r || format('  %s%s', ligne.nom, E'\\n');
  END LOOP;
  IF n_inc = 0 THEN r := r || E'  aucune.\\n'; END IF;

  -- Un registre VIDE n est pas « tout concordant » : c est un registre vide.
  -- Sans ce garde-fou, le rapport dirait « aucun ecart » sur une base ou rien
  -- n a jamais ete enregistre — un controle qui ne mesure rien annonce 0.
  IF (SELECT count(*) FROM migrations_appliquees) = 0 THEN
    r := r || E'\\n  >>> LE REGISTRE EST VIDE. Jouer d abord --remplir.\\n';
  ELSIF n_man = 0 AND n_mod = 0 AND n_inc = 0 THEN
    r := r || E'\\n  Depot et registre concordent.\\n';
  END IF;

  r := r || E'\\n  Rien n a ete conserve.\\n';
  RAISE EXCEPTION '%', r;
END
$etat$;`)
