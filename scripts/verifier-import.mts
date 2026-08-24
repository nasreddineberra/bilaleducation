/**
 * Epreuve du lot 2 : lecture d'un classeur simule + rapprochement, contre les
 * VRAIES donnees de la base. Aucun ecran, aucune ecriture.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { analyserLignes } from '../src/lib/import/lire-fichier'
import { rapprocher, type FoyerExistant, type EnfantExistant } from '../src/lib/import/rapprocher'

const env = Object.fromEntries(readFileSync('.env.local', 'utf8').split(/\r?\n/)
  .filter(l => l.includes('=') && !l.trim().startsWith('#'))
  .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]))

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

// ── L'existant, tel quel ────────────────────────────────────────────────────
const { data: pRaw } = await sb.from('parents').select('*')
const { data: eRaw } = await sb.from('students').select('id,parent_id,last_name,first_name,date_of_birth')

const foyers: FoyerExistant[] = (pRaw ?? []).map(p => ({
  id: p.id,
  tutor1_last_name: p.tutor1_last_name,
  tutor1_first_name: p.tutor1_first_name,
  tutor2_last_name: p.tutor2_last_name,
  tutor2_first_name: p.tutor2_first_name,
  champs: p as Record<string, string | null>,
}))
const enfants: EnfantExistant[] = (eRaw ?? []) as EnfantExistant[]

const f0 = foyers[0]
const e0 = enfants.find(e => e.parent_id === f0.id)!
const f1 = foyers[1]

console.log('Existant : ' + foyers.length + ' foyers, ' + enfants.length + ' apprenants')
console.log('Temoin   : foyer « ' + f0.tutor1_last_name + ' ' + f0.tutor1_first_name + ' », enfant « ' + e0.last_name + ' ' + e0.first_name + ' » ne le ' + e0.date_of_birth + '\n')

// ── Un classeur simule, une ligne par enfant ────────────────────────────────
const ENTETES = [
  'Tuteur 1 NOM', 'Tuteur 1 Prénom', 'Tuteur 1 Email', 'Tuteur 1 Téléphone',
  'Tuteur 2 NOM', 'Tuteur 2 Prénom',
  'Enfant NOM', 'Enfant Prénom', 'Date de naissance', 'Genre',
]

const rows: unknown[][] = [
  ENTETES,
  // 1. Famille connue, enfant connu, rien ne change            -> rien
  [f0.tutor1_last_name, f0.tutor1_first_name, f0.champs.tutor1_email, f0.champs.tutor1_phone,
   f0.tutor2_last_name, f0.tutor2_first_name,
   e0.last_name, e0.first_name, e0.date_of_birth, 'M'],

  // 2. Famille connue (f1), telephone modifie                  -> mettre a jour
  [f1.tutor1_last_name, f1.tutor1_first_name, f1.champs.tutor1_email, '+33 6 99 88 77 66',
   f1.tutor2_last_name, f1.tutor2_first_name,
   'ESSAIMAJ', 'Lina', '12/03/2016', 'Feminin'],

  // 3. Famille inconnue, deux enfants -> deux lignes           -> creer
  ['essainouveau', 'karim', 'karim.essai@ecole.fr', '0612345678', '', '',
   'essainouveau', 'jean-baptiste', '05/09/2015', 'garcon'],
  ['ESSAINOUVEAU', 'Karim', 'karim.essai@ecole.fr', '06 12 34 56 78', '', '',
   'ESSAINOUVEAU', 'Amina', '17/11/2017', 'F'],

  // 4. Doublon INTERNE au fichier (meme enfant deux fois)      -> bloque
  ['ESSAIDOUBLE', 'Sami', 'sami@ecole.fr', '', '', '',
   'ESSAIDOUBLE', 'Yanis', '01/01/2015', 'M'],
  ['ESSAIDOUBLE', 'Sami', 'sami@ecole.fr', '', '', '',
   'ESSAIDOUBLE', 'Yanis', '01/01/2015', 'M'],

  // 5. Date illisible + genre inconnu                          -> bloque
  ['ESSAIDATE', 'Nora', 'nora@ecole.fr', '', '', '',
   'ESSAIDATE', 'Ali', '32/13/2015', 'inconnu'],

  // 6. Tuteur 2 appartenant deja a un AUTRE foyer              -> bloque
  ['ESSAICONFLIT', 'Omar', 'omar@ecole.fr', '', f0.tutor1_last_name, f0.tutor1_first_name,
   'ESSAICONFLIT', 'Sofia', '20/02/2016', 'F'],

  // 7. Email invalide                                          -> bloque
  ['ESSAIMAIL', 'Rachid', 'pas-un-email', '', '', '',
   'ESSAIMAIL', 'Nadia', '10/10/2014', 'F'],

  [], // ligne vide : le tableur en fabrique, elle doit etre ignoree
]

const lecture = analyserLignes(rows)
console.log('Lecture : ' + lecture.lignes.length + ' lignes retenues'
  + (lecture.entetesInconnues.length ? ' | en-tetes inconnues : ' + lecture.entetesInconnues.join(', ') : '')
  + (lecture.colonnesManquantes.length ? ' | MANQUANTES : ' + lecture.colonnesManquantes.join(', ') : ' | toutes les obligatoires presentes'))

const resultat = rapprocher(lecture.lignes, foyers, enfants)

console.log('\n' + '─'.repeat(78))
for (const f of resultat) {
  const nom = (f.valeurs.tutor1_last_name ?? '?') + ' ' + (f.valeurs.tutor1_first_name ?? '?')
  console.log('\n' + f.action.toUpperCase().padEnd(14) + nom + '   (lignes ' + f.lignes.join(', ') + ')'
    + (f.enregistrable ? '   [cochable]' : '   [grise]'))

  for (const c of f.changements) {
    console.log('     maj  ' + c.cle + ' : « ' + (c.avant ?? '(vide)') + ' » -> « ' + c.apres + ' »')
  }
  for (const a of f.anomalies) {
    console.log('     ' + a.gravite.padEnd(14) + a.message)
  }
  for (const e of f.enfants) {
    console.log('     enfant ligne ' + e.ligne + ' : ' + (e.valeurs.last_name ?? '?') + ' ' + (e.valeurs.first_name ?? '?')
      + ' (' + (e.valeurs.date_of_birth ?? '?') + ') -> ' + e.action)
    for (const a of e.anomalies) console.log('        ' + a.gravite.padEnd(14) + a.message)
  }
}
console.log('\n' + '─'.repeat(78))

const attendu: Record<string, string> = {
  ESSAINOUVEAU: 'creer', ESSAIDOUBLE: 'bloque',
  ESSAIDATE: 'bloque', ESSAICONFLIT: 'bloque', ESSAIMAIL: 'bloque',
}
let faux = 0
for (const [nom, att] of Object.entries(attendu)) {
  const f = resultat.find(r => (r.valeurs.tutor1_last_name ?? '').toUpperCase() === nom)
  if (!f) { faux++; console.log('MANQUANT : ' + nom); continue }
  if (f.action !== att) { faux++; console.log('ATTENDU ' + att + ' POUR ' + nom + ', OBTENU ' + f.action) }
}
// Le foyer connu, ligne identique a la base : rien a faire.
const temoin = resultat.find(r => r.existantId === f0.id && r.lignes.includes(2))
if (!temoin || temoin.action !== 'rien') { faux++; console.log('Le foyer temoin devait etre « rien », obtenu ' + (temoin?.action ?? 'absent')) }

// Le foyer connu qui gagne un enfant ET dont le telephone change : « completer »
// l'emporte sur « mettre a jour », mais les deux operations sont portees — le
// tableau des changements reste rempli, l'ecran montre donc les deux.
const majEtEnfant = resultat.find(r => r.existantId === f1.id)
if (!majEtEnfant || majEtEnfant.action !== 'completer') { faux++; console.log('Le foyer f1 devait etre « completer », obtenu ' + (majEtEnfant?.action ?? 'absent')) }
else if (majEtEnfant.changements.length === 0) { faux++; console.log('Le changement de telephone de f1 a ete perdu') }

console.log(faux === 0 ? 'Les 7 cas se comportent comme prevu.' : faux + ' CAS ABERRANT(S)')
