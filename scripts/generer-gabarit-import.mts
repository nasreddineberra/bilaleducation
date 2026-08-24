/**
 * ENGENDRE LE GABARIT D'IMPORT (`public/gabarit-import-apprenants.xlsx`).
 *
 * ┌─ POURQUOI AUCUNE BIBLIOTHEQUE D'ECRITURE ────────────────────────────────┐
 * │ Un `.xlsx` n'est qu'une archive zip contenant du XML. L'ecrire a la main  │
 * │ coute une centaine de lignes ICI, dans un script qui tourne UNE FOIS et   │
 * │ dont le resultat est versionne — contre une dependance de plus dans       │
 * │ l'application, permanente celle-la. Les deux bibliotheques Excel les plus │
 * │ connues sont a l'abandon (xlsx depuis mars 2022, exceljs depuis octobre   │
 * │ 2023) : en ajouter une pour ecrire un fichier figé serait mal echange.    │
 * │                                                                           │
 * │ `fflate` sert a compresser — il est deja present, tire par la lecture.    │
 * │ Si un jour il disparait, le gabarit versionne, lui, reste valide.         │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * Le fichier est engendre depuis `COLONNES` : ajouter une colonne au catalogue
 * et relancer ce script suffit. Rien n'est ecrit en double.
 *
 *   npx tsx scripts/generer-gabarit-import.mts
 */

import { writeFileSync } from 'fs'
import { zipSync, strToU8 } from 'fflate'
import { COLONNES } from '../src/lib/import/colonnes'

const SORTIE = 'public/gabarit-import-apprenants.xlsx'

// ─── Petits outils XML ───────────────────────────────────────────────────────

const echapper = (t: string): string =>
  t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** 0 → A, 25 → Z, 26 → AA. Au-dela de 26 colonnes, la 2e lettre compte. */
function lettre(index: number): string {
  let n = index
  let s = ''
  do {
    s = String.fromCharCode(65 + (n % 26)) + s
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return s
}

/** Une ligne de cellules texte. `inlineStr` evite la table de chaines partagees. */
function ligne(numero: number, valeurs: string[]): string {
  const cellules = valeurs
    .map((v, i) =>
      v === ''
        ? ''
        : `<c r="${lettre(i)}${numero}" t="inlineStr"><is><t xml:space="preserve">${echapper(v)}</t></is></c>`,
    )
    .join('')
  return `<row r="${numero}">${cellules}</row>`
}

/**
 * Listes deroulantes (« validation de donnees » au sens OOXML).
 *
 * C'est ce qui empeche la mauvaise saisie A LA SOURCE : plutot que de refuser
 * « celibataire » a l'import et de faire recommencer l'ecole, le tableur ne
 * laisse choisir que des valeurs connues.
 *
 * La liste est ecrite EN CLAIR dans la formule (`"Père,Mère,…"`). Excel borne
 * cette forme a 255 caracteres — nos trois listes tiennent tres largement, la
 * plus longue faisant moins de 90 signes.
 *
 * `allowBlank` : une colonne facultative doit pouvoir rester vide.
 * `showErrorMessage` : Excel refuse une saisie hors liste au lieu de l'avaler.
 */
interface Deroulante { colonne: number; valeurs: string[]; obligatoire: boolean }

function validations(listes: Deroulante[], derniereLigne: number): string {
  if (!listes.length) return ''
  const items = listes
    .map(d => {
      const ref = `${lettre(d.colonne)}2:${lettre(d.colonne)}${derniereLigne}`
      const valeurs = echapper(d.valeurs.join(','))
      return `<dataValidation type="list" allowBlank="1" showInputMessage="1" showErrorMessage="1"`
        + ` errorTitle="Valeur non acceptée" error="Choisissez une valeur dans la liste."`
        + ` sqref="${ref}"><formula1>&quot;${valeurs}&quot;</formula1></dataValidation>`
    })
    .join('')
  return `<dataValidations count="${listes.length}">${items}</dataValidations>`
}

/**
 * Colonnes que le tableur doit traiter comme du TEXTE et non comme un nombre.
 *
 * ┌─ SANS CELA, EXCEL ABIME LA SAISIE ───────────────────────────────────────┐
 * │ · Un « + » en tete de cellule ouvre une FORMULE : taper                   │
 * │   « +33630752443 » ne donne pas ce texte, mais une tentative de calcul.   │
 * │ · Les zeros de tete disparaissent : « 00213661234567 » devient            │
 * │   « 213661234567 », et le code postal « 01200 » devient « 1200 ».         │
 * │                                                                           │
 * │ Les deux formes internationales que notre lecteur accepte sont donc       │
 * │ precisement celles qu'Excel detruit. Signale par l'utilisateur, qui n'a   │
 * │ pas pu valider un numero commençant par « + ».                            │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * Le format « @ » (numFmtId 49) est le format texte integre d'OOXML.
 */
const EN_TEXTE = (cle: string) => cle.endsWith('_phone') || cle.endsWith('_postal_code')

function feuille(lignes: string[], largeurs: number[], figerEntete: boolean, listes: Deroulante[] = [], texte: boolean[] = []): string {
  const cols = largeurs
    .map((l, i) =>
      `<col min="${i + 1}" max="${i + 1}" width="${l}" customWidth="1"`
      + (texte[i] ? ' style="1"' : '')
      + '/>')
    .join('')

  // L'en-tete reste visible au defilement : sur 23 colonnes et 200 lignes, sans
  // cela on ne sait plus quelle colonne on remplit au bout de trois ecrans.
  const vue = figerEntete
    ? '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
    : ''

  // `dataValidations` se place APRES `sheetData` : l'ordre des elements est
  // impose par le schema OOXML, et Excel refuse d'ouvrir un fichier qui l'inverse.
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${vue}<cols>${cols}</cols><sheetData>${lignes.join('')}</sheetData>${validations(listes, 1000)}</worksheet>`
}

// ─── Feuille 1 : les colonnes a remplir ──────────────────────────────────────
//
// UNE SEULE ligne d'en-tete, et AUCUNE ligne d'exemple. Un exemple oublie dans
// le fichier serait importe comme une vraie famille — le genre de piege qu'on
// ne decouvre qu'apres avoir cree « DUPONT Jean » dans la base d'une ecole.

// Le marqueur est ecrit DANS l'en-tete : c'est la seule facon qu'il soit vu par
// qui remplit le fichier hors ligne. Le rapprochement l'ignore (`normaliserCle`
// retire la parenthese finale), donc un fichier ou quelqu'un l'a efface — ou
// retape sans lui — reste parfaitement lisible.
const libelle = (c: (typeof COLONNES)[number]) =>
  c.obligatoire ? c.entete + ' (obligatoire)' : c.entete

const entetes = COLONNES.map(libelle)
const largeurs = COLONNES.map(c => Math.max(14, Math.min(32, libelle(c).length + 3)))
// Une liste deroulante partout ou la colonne a une liste fermee : genre, lien
// de parente (les deux tuteurs) et situation familiale.
const deroulantes: Deroulante[] = COLONNES
  .map((c, i) => ({ colonne: i, valeurs: c.libelles ?? [], obligatoire: c.obligatoire }))
  .filter(d => d.valeurs.length > 0)

const feuilleImport = feuille([ligne(1, entetes)], largeurs, true, deroulantes, COLONNES.map(c => EN_TEXTE(c.cle)))

// ─── Feuille 2 : ce que les colonnes acceptent ───────────────────────────────
//
// Placee en SECONDE position : la lecture ne regarde que la premiere feuille,
// cette aide ne peut donc pas etre prise pour des donnees.

const aide: string[] = []
let n = 1
aide.push(ligne(n++, ['Colonne', 'Obligatoire', 'Valeurs acceptées / format']))

for (const c of COLONNES) {
  let format = 'Texte libre'
  if (c.valeursAcceptees) format = c.valeursAcceptees.join(', ')
  else if (c.cle === 'date_of_birth') format = 'JJ/MM/AAAA (ou une vraie date du tableur)'
  else if (c.cle.endsWith('_email')) format = 'adresse@exemple.fr'
  else if (c.cle.endsWith('_phone')) format = '06 12 34 56 78 · +213 6 61 23 45 67 · indicatif reconnu'
  else if (c.cle.endsWith('_postal_code')) format = '5 chiffres'
  else if (c.cle.endsWith('last_name')) format = 'Texte — mis en MAJUSCULES à l’import'
  else if (c.cle.endsWith('first_name')) format = 'Texte — première lettre mise en capitale'

  aide.push(ligne(n++, [libelle(c), c.obligatoire ? 'Oui' : 'Non', format]))
}

aide.push(ligne(n++, ['', '', '']))
aide.push(ligne(n++, ['Une ligne par ENFANT.', '', '']))
aide.push(ligne(n++, ['Une famille de trois enfants occupe donc trois lignes, avec les mêmes colonnes de tuteurs répétées.', '', '']))
aide.push(ligne(n++, ['Une cellule laissée vide ne supprime jamais une information déjà enregistrée.', '', '']))

const feuilleAide = feuille(aide, [34, 14, 70], true)

// ─── L'assemblage OOXML ──────────────────────────────────────────────────────

const NS_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'

const fichiers: Record<string, Uint8Array> = {
  '[Content_Types].xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`),

  '_rels/.rels': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="${NS_REL}/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`),

  'xl/workbook.xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="${NS_REL}">
<sheets>
<sheet name="Import" sheetId="1" r:id="rId1"/>
<sheet name="Valeurs acceptées" sheetId="2" r:id="rId2"/>
</sheets>
</workbook>`),

  'xl/_rels/workbook.xml.rels': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="${NS_REL}/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="${NS_REL}/worksheet" Target="worksheets/sheet2.xml"/>
<Relationship Id="rId3" Type="${NS_REL}/styles" Target="styles.xml"/>
</Relationships>`),

  // Deux formats seulement : le general (index 0, par defaut) et le TEXTE
  // (index 1), pose sur les colonnes de telephone et de code postal.
  'xl/styles.xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>
<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="2">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
</cellXfs>
<!-- Facultatif au schema, mais Excel le reclame en pratique : sans lui il
     signale un classeur « a reparer », ce qui serait pire que le probleme
     qu'on corrige. -->
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`),

  'xl/worksheets/sheet1.xml': strToU8(feuilleImport),
  'xl/worksheets/sheet2.xml': strToU8(feuilleAide),
}

writeFileSync(SORTIE, zipSync(fichiers, { level: 6 }))

console.log('Gabarit ecrit : ' + SORTIE)
console.log('  ' + COLONNES.length + ' colonnes, dont ' + COLONNES.filter(c => c.obligatoire).length + ' obligatoires')
console.log('  feuille 1 « Import » (en-tetes seules, ligne figee)')
console.log('  feuille 2 « Valeurs acceptées » (' + (n - 1) + ' lignes)')
