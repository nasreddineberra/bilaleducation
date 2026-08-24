/**
 * LECTURE D'UN FICHIER D'IMPORT.
 *
 * ┌─ DEUX MORCEAUX, ET C'EST DELIBERE ───────────────────────────────────────┐
 * │ `analyserLignes()` est PURE : elle prend un tableau de tableaux et rend   │
 * │ des lignes normalisees. Elle ne connait ni fichier, ni navigateur, et     │
 * │ s'eprouve donc dans un script, sans ecran.                                │
 * │                                                                           │
 * │ `lireFichierXlsx()` n'est qu'une coquille : elle decode le classeur puis  │
 * │ appelle la premiere. C'est le seul endroit qui depend de la bibliotheque  │
 * │ Excel, et il tient en trois lignes.                                       │
 * │                                                                           │
 * │ Sans cette separation, verifier le rapprochement demanderait de fabriquer │
 * │ un vrai `.xlsx` a chaque essai — et on ne testerait plus rien.            │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * Le decodage se fait DANS LE NAVIGATEUR : le fichier ne part nulle part tant
 * que l'utilisateur n'a pas coche ce qu'il veut enregistrer. Rien a televerser,
 * rien a stocker, et l'ecran repond immediatement.
 */

import { COLONNES, COLONNES_OBLIGATOIRES, colonnePourEntete, type Colonne } from './colonnes'

export interface LigneBrute {
  /** Numero de ligne DANS LE FICHIER, en-tete comprise : la 1re donnee est 2. */
  numero: number
  /** Valeurs normalisees, indexees par cle de colonne. */
  valeurs: Record<string, string | null>
  /** Ce qui etait present mais illisible. Une cellule vide n'en produit pas. */
  erreurs: string[]
}

export interface Lecture {
  lignes: LigneBrute[]
  /** En-tetes du fichier qu'on ne sait pas rattacher — ignorees, mais signalees. */
  entetesInconnues: string[]
  /** Colonnes obligatoires absentes du fichier : il est inexploitable. */
  colonnesManquantes: string[]
}

/** Une ligne entierement vide ne vaut pas une erreur : le tableur en fabrique. */
const ligneVide = (cellules: unknown[]): boolean =>
  cellules.every(c => c === null || c === undefined || String(c).trim() === '')

/**
 * Analyse un classeur deja decode.
 *
 * `rows[0]` porte les en-tetes. Elles sont rapprochees sans tenir compte de la
 * casse, des accents ni des espaces — une secretaire qui tape « Tuteur 1 Prénom »
 * la ou le gabarit dit « Tuteur 1 Prenom » ne doit pas se voir refuser son fichier.
 */
export function analyserLignes(rows: unknown[][]): Lecture {
  if (!rows.length) {
    return {
      lignes: [],
      entetesInconnues: [],
      colonnesManquantes: COLONNES_OBLIGATOIRES.map(c => c.entete),
    }
  }

  const entetes = rows[0].map(e => (e === null || e === undefined ? '' : String(e)))

  // Position de chaque colonne connue, et en-tetes qu'on ne sait pas rattacher.
  const parIndex: (Colonne | undefined)[] = entetes.map(e => (e ? colonnePourEntete(e) : undefined))
  const entetesInconnues = entetes.filter((e, i) => e.trim() !== '' && !parIndex[i])

  const presentes = new Set(parIndex.filter(Boolean).map(c => c!.cle))
  const colonnesManquantes = COLONNES_OBLIGATOIRES
    .filter(c => !presentes.has(c.cle))
    .map(c => c.entete)

  const lignes: LigneBrute[] = []

  for (let i = 1; i < rows.length; i++) {
    const cellules = rows[i] ?? []
    if (ligneVide(cellules)) continue

    const valeurs: Record<string, string | null> = {}
    const erreurs: string[] = []

    // Toutes les colonnes du CATALOGUE sont posees, meme absentes du fichier :
    // le tableau de l'ecran a des colonnes fixes, et une cle manquante y
    // produirait un trou plutot qu'une cellule vide editable.
    for (const col of COLONNES) valeurs[col.cle] = null

    // Colonnes dont la valeur etait presente mais illisible : elles ont deja
    // leur message, il ne faut pas leur ajouter « est obligatoire » par-dessus.
    const fautives = new Set<string>()

    parIndex.forEach((col, idx) => {
      if (!col) return
      const { valeur, erreur } = col.normaliser(cellules[idx])
      valeurs[col.cle] = valeur
      if (erreur) { erreurs.push(erreur); fautives.add(col.cle) }
    })

    // Obligatoire absente : signalee ICI et pas a la normalisation, qui ne sait
    // pas si la colonne est requise — elle ne connait que la valeur.
    //
    // Deux messages pour une seule cellule — « Date inexistante » PUIS « est
    // obligatoire » — feraient croire a deux problemes distincts sur un ecran
    // dont tout l'objet est de dire quoi corriger.
    for (const col of COLONNES_OBLIGATOIRES) {
      if (presentes.has(col.cle) && !valeurs[col.cle] && !fautives.has(col.cle)) {
        erreurs.push(`« ${col.entete} » est obligatoire`)
      }
    }

    lignes.push({ numero: i + 1, valeurs, erreurs })
  }

  return { lignes, entetesInconnues, colonnesManquantes }
}

/**
 * Decode un `.xlsx` depose dans le navigateur, puis l'analyse.
 *
 * L'import de la bibliotheque est DYNAMIQUE : elle ne pese sur aucune autre
 * page. Meme motif que Recharts, charge uniquement sur les statistiques.
 */
export async function lireFichierXlsx(fichier: File): Promise<Lecture> {
  // `read-excel-file/browser` et non `read-excel-file` : la version 9 n'expose
  // AUCUN point d'entree racine, seulement `/browser`, `/node`, `/universal` et
  // `/web-worker`. Verifie dans le `exports` du paquet, pas suppose.
  const { readSheet } = await import('read-excel-file/browser')

  // `readSheet` et non `readXlsxFile` : en version 9 ce dernier rend un tableau
  // de FEUILLES (`{ sheet, data }`), pas de lignes. C'est la rupture d'API la
  // plus facile a manquer, le nom n'ayant pas change.
  const rows = await readSheet(fichier)
  return analyserLignes(rows as unknown[][])
}
