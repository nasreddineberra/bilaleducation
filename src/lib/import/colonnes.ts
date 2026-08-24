/**
 * LE GABARIT D'IMPORT : quelles colonnes, et comment chaque valeur se normalise.
 *
 * ┌─ UNE SEULE SOURCE ───────────────────────────────────────────────────────┐
 * │ Ce catalogue sert a TROIS choses : engendrer le fichier gabarit, lire un  │
 * │ fichier depose, et afficher le tableau de l'ecran d'import. Les trois     │
 * │ doivent parler des memes colonnes — les separer, c'est la derive qui a    │
 * │ produit trois calculs comptables divergents dans Financements.            │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * ── LES VALEURS SONT REFORMATEES COMME A LA SAISIE MANUELLE ────────────────
 *
 * NOM en majuscules, prenom en capitale initiale, telephone en indicatif +
 * chiffres : ce sont les regles des formulaires (`toUpperCase` / `toTitleCase`
 * / `digitsOnly`), recopiees ici a dessein. Un fichier dont les noms arrivent
 * en minuscules doit produire les memes fiches qu'une saisie a la main, sinon
 * la liste des apprenants melangerait deux presentations.
 */

import { COUNTRY_CODES } from '@/components/ui/FloatPhoneInput'

/** A quelle partie de la ligne la colonne appartient. */
export type Cible = 'tuteur1' | 'tuteur2' | 'foyer' | 'enfant'

export interface Valeur {
  /** Valeur prete a ecrire, ou `null` si la cellule est vide. */
  valeur: string | null
  /** Rempli quand la cellule contient quelque chose d'illisible. */
  erreur?: string
}

export interface Colonne {
  /** Nom de la colonne en base — c'est aussi la cle de la ligne normalisee. */
  cle: string
  /** Libelle exact dans le gabarit. */
  entete: string
  cible: Cible
  obligatoire: boolean
  normaliser: (brut: unknown) => Valeur
  /** Formes acceptees, pour les colonnes a liste fermee (genre, lien, situation). */
  valeursAcceptees?: string[]
}

// ─── Normaliseurs ────────────────────────────────────────────────────────────

/** Cellule vide, sous toutes ses formes (absente, nulle, espaces seuls). */
const vide = (b: unknown): boolean =>
  b === null || b === undefined || (typeof b === 'string' && b.trim() === '')

const texte = (b: unknown): Valeur =>
  vide(b) ? { valeur: null } : { valeur: String(b).trim().replace(/\s+/g, ' ') }

const nom = (b: unknown): Valeur => {
  const t = texte(b)
  return t.valeur ? { valeur: t.valeur.toUpperCase() } : t
}

/**
 * Capitale a chaque mot, comme `toTitleCase` des formulaires.
 *
 * Les traits d'union et apostrophes comptent comme separateurs : « jean-baptiste »
 * doit donner « Jean-Baptiste », ce que la version des formulaires — qui ne coupe
 * que sur l'espace — ne fait pas. Amelioration deliberee : un import brasse bien
 * plus de noms composes qu'une saisie a l'unite.
 */
const prenom = (b: unknown): Valeur => {
  const t = texte(b)
  if (!t.valeur) return t
  return {
    valeur: t.valeur
      .split(/([ \-’'])/)
      .map(m =>
        /^[ \-’']$/.test(m) ? m : m.charAt(0).toUpperCase() + m.slice(1).toLowerCase(),
      )
      .join(''),
  }
}

const email = (b: unknown): Valeur => {
  const t = texte(b)
  if (!t.valeur) return t
  // Meme controle que les formulaires. On ne met PAS en minuscules : la saisie
  // manuelle ne le fait pas, et diverger creerait deux presentations.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t.valeur)) {
    return { valeur: null, erreur: `Adresse email illisible : « ${t.valeur} »` }
  }
  return t
}

/**
 * Telephone : indicatif + chiffres, la forme qu'ecrit le formulaire.
 *
 * L'INDICATIF PAYS EST RECONNU s'il est present — « +213 » pour l'Algerie,
 * « +212 » pour le Maroc, etc., d'apres la liste `COUNTRY_CODES` qui alimente
 * deja le selecteur des formulaires. Une seule liste pour les deux : ajouter un
 * pays au selecteur le rend importable du meme coup.
 *
 * Le « 00 » international est accepte et traduit en « + ». A defaut d'indicatif,
 * on prend « +33 », valeur par defaut du formulaire.
 *
 * Le zero initial est retire quand un indicatif precede — « +33 06 12… » n'a
 * pas de sens. NB : les donnees de seed portent « 06 14 05 06 07 », sans
 * indicatif ; l'affichage (`parsePhone`) sait lire les deux, on s'aligne donc
 * sur ce qu'ecrit l'APPLICATION, pas sur le seed.
 */
const telephone = (b: unknown): Valeur => {
  const t = texte(b)
  if (!t.valeur) return t

  // Un tableur rend parfois un nombre : « 612345678 » sans le zero initial.
  let brut = t.valeur.replace(/[\s.\-() ]/g, '')
  if (brut.startsWith('00')) brut = '+' + brut.slice(2)

  // Le plus LONG indicatif d'abord : sans ce tri, « +33 » masquerait « +336 »
  // s'il en existait un, et surtout « +2 » masquerait « +212 » et « +213 ».
  const pays = [...COUNTRY_CODES]
    .sort((a, b2) => b2.code.length - a.code.length)
    .find(c => brut.startsWith(c.code))

  const indicatif = pays ? pays.code : '+33'
  let chiffres = (pays ? brut.slice(pays.code.length) : brut).replace(/\D/g, '')
  if (pays && chiffres.startsWith('0')) chiffres = chiffres.slice(1)
  if (!pays && chiffres.startsWith('0')) chiffres = chiffres.slice(1)

  if (chiffres.length < 6 || chiffres.length > 14) {
    return { valeur: null, erreur: `Numero de telephone illisible : « ${t.valeur} »` }
  }
  return { valeur: indicatif + chiffres }
}

/**
 * Date vers `AAAA-MM-JJ`.
 *
 * Trois formes acceptees : l'objet Date que rend le tableur, `JJ/MM/AAAA` que
 * tape un francais, et `AAAA-MM-JJ` deja normalise.
 *
 * Les composantes sont lues en LOCAL. `toISOString()` decalerait d'un jour vers
 * l'ouest de Greenwich — le piege paye deux fois sur ce projet, sur la feuille
 * d'appel puis sur les bornes du tableau de bord.
 */
const date = (b: unknown): Valeur => {
  if (vide(b)) return { valeur: null }

  if (b instanceof Date && !isNaN(b.getTime())) {
    const a = b.getFullYear()
    const m = String(b.getMonth() + 1).padStart(2, '0')
    const j = String(b.getDate()).padStart(2, '0')
    return { valeur: `${a}-${m}-${j}` }
  }

  const t = String(b).trim()

  const fr = t.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/)
  if (fr) {
    const [, j, m, a] = fr
    const iso = `${a}-${m.padStart(2, '0')}-${j.padStart(2, '0')}`
    return valide(iso) ? { valeur: iso } : { valeur: null, erreur: `Date inexistante : « ${t} »` }
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) {
    return valide(t) ? { valeur: t } : { valeur: null, erreur: `Date inexistante : « ${t} »` }
  }

  return { valeur: null, erreur: `Date illisible : « ${t} » (attendu JJ/MM/AAAA)` }
}

/** Le 31/02 se lit sans peine mais n'existe pas : `Date` le decalerait en mars. */
function valide(iso: string): boolean {
  const [a, m, j] = iso.split('-').map(Number)
  const d = new Date(a, m - 1, j)
  return d.getFullYear() === a && d.getMonth() === m - 1 && d.getDate() === j
}

const normaliserCle = (s: string): string =>
  s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[\s_-]+/g, '')

/**
 * Fabrique un normaliseur de liste fermee, tolerant a l'ecriture.
 *
 * Le fichier vient d'un humain : « M », « Masculin », « masculin », « garcon »
 * designent tous `male`. Refuser tout sauf la valeur exacte transformerait
 * l'ecran d'import en jeu de devinettes.
 */
function liste(valeurs: Record<string, string[]>, libelle: string) {
  const table = new Map<string, string>()
  for (const [cible, formes] of Object.entries(valeurs)) {
    for (const f of formes) table.set(normaliserCle(f), cible)
  }
  const normaliser = (b: unknown): Valeur => {
    const t = texte(b)
    if (!t.valeur) return t
    const trouve = table.get(normaliserCle(t.valeur))
    if (!trouve) {
      const attendu = Object.values(valeurs).map(f => f[0]).join(', ')
      return {
        valeur: null,
        erreur: `${libelle} non reconnu : « ${t.valeur} » (attendu : ${attendu})`,
      }
    }
    return { valeur: trouve }
  }

  // Les formes acceptees remontent avec le normaliseur : le gabarit et l'ecran
  // les affichent sans les recopier. Recopier une liste fermee, c'est se donner
  // deux verites — et le jour ou l'une gagne une valeur, l'autre la refuse.
  return { normaliser, formes: Object.values(valeurs).flat() }
}

const genre = liste(
  {
    male: ['Masculin', 'M', 'Garcon', 'H', 'Homme'],
    female: ['Feminin', 'F', 'Fille', 'Femme'],
    non_specified: ['Non specifie', 'NS'],
  },
  'Genre',
)

const lien = liste(
  {
    'père': ['Pere', 'Papa'],
    'mère': ['Mere', 'Maman'],
    'tuteur': ['Tuteur legal', 'Tuteur'],
    'autre': ['Autre'],
  },
  'Lien de parente',
)

const situation = liste(
  {
    'mariés': ['Maries', 'Marie'],
    'pacsés': ['Pacses', 'Pacse'],
    'union_libre': ['Union libre', 'Concubinage'],
    'séparés': ['Separes', 'Separe'],
    'divorcés': ['Divorces', 'Divorce'],
    'veuf_veuve': ['Veuf', 'Veuve', 'Veuf/Veuve'],
    'monoparental': ['Monoparental', 'Famille monoparentale'],
  },
  'Situation familiale',
)

const codePostal = (b: unknown): Valeur => {
  const t = texte(b)
  if (!t.valeur) return t
  // Un tableur transforme volontiers « 01200 » en nombre 1200 : on recomplete.
  const chiffres = t.valeur.replace(/\D/g, '')
  if (chiffres.length === 0 || chiffres.length > 5) {
    return { valeur: null, erreur: `Code postal illisible : « ${t.valeur} »` }
  }
  return { valeur: chiffres.padStart(5, '0') }
}

// ─── Le catalogue ────────────────────────────────────────────────────────────
//
// L'ordre est celui des colonnes du gabarit : les obligatoires d'abord, pour
// qu'on ne puisse pas remplir le fichier sans les voir.

export const COLONNES: Colonne[] = [
  { cle: 'tutor1_last_name',    entete: 'Tuteur 1 NOM',         cible: 'tuteur1', obligatoire: true,  normaliser: nom },
  { cle: 'tutor1_first_name',   entete: 'Tuteur 1 Prénom',      cible: 'tuteur1', obligatoire: true,  normaliser: prenom },
  { cle: 'tutor1_email',        entete: 'Tuteur 1 Email',       cible: 'tuteur1', obligatoire: true,  normaliser: email },
  { cle: 'last_name',           entete: 'Enfant NOM',           cible: 'enfant',  obligatoire: true,  normaliser: nom },
  { cle: 'first_name',          entete: 'Enfant Prénom',        cible: 'enfant',  obligatoire: true,  normaliser: prenom },
  { cle: 'date_of_birth',       entete: 'Date de naissance',    cible: 'enfant',  obligatoire: true,  normaliser: date },
  { cle: 'gender',              entete: 'Genre',                cible: 'enfant',  obligatoire: true,  normaliser: genre.normaliser, valeursAcceptees: genre.formes },

  { cle: 'tutor1_phone',        entete: 'Tuteur 1 Téléphone',   cible: 'tuteur1', obligatoire: false, normaliser: telephone },
  { cle: 'tutor1_relationship', entete: 'Tuteur 1 Lien',        cible: 'tuteur1', obligatoire: false, normaliser: lien.normaliser, valeursAcceptees: lien.formes },
  { cle: 'tutor1_address',      entete: 'Tuteur 1 Adresse',     cible: 'tuteur1', obligatoire: false, normaliser: texte },
  { cle: 'tutor1_city',         entete: 'Tuteur 1 Ville',       cible: 'tuteur1', obligatoire: false, normaliser: texte },
  { cle: 'tutor1_postal_code',  entete: 'Tuteur 1 Code postal', cible: 'tuteur1', obligatoire: false, normaliser: codePostal },
  { cle: 'tutor1_profession',   entete: 'Tuteur 1 Profession',  cible: 'tuteur1', obligatoire: false, normaliser: texte },

  { cle: 'tutor2_last_name',    entete: 'Tuteur 2 NOM',         cible: 'tuteur2', obligatoire: false, normaliser: nom },
  { cle: 'tutor2_first_name',   entete: 'Tuteur 2 Prénom',      cible: 'tuteur2', obligatoire: false, normaliser: prenom },
  { cle: 'tutor2_email',        entete: 'Tuteur 2 Email',       cible: 'tuteur2', obligatoire: false, normaliser: email },
  { cle: 'tutor2_phone',        entete: 'Tuteur 2 Téléphone',   cible: 'tuteur2', obligatoire: false, normaliser: telephone },
  { cle: 'tutor2_relationship', entete: 'Tuteur 2 Lien',        cible: 'tuteur2', obligatoire: false, normaliser: lien.normaliser, valeursAcceptees: lien.formes },
  { cle: 'tutor2_address',      entete: 'Tuteur 2 Adresse',     cible: 'tuteur2', obligatoire: false, normaliser: texte },
  { cle: 'tutor2_city',         entete: 'Tuteur 2 Ville',       cible: 'tuteur2', obligatoire: false, normaliser: texte },
  { cle: 'tutor2_postal_code',  entete: 'Tuteur 2 Code postal', cible: 'tuteur2', obligatoire: false, normaliser: codePostal },
  { cle: 'tutor2_profession',   entete: 'Tuteur 2 Profession',  cible: 'tuteur2', obligatoire: false, normaliser: texte },

  { cle: 'situation_familiale', entete: 'Situation familiale',  cible: 'foyer',   obligatoire: false, normaliser: situation.normaliser, valeursAcceptees: situation.formes },
]

export const COLONNES_OBLIGATOIRES = COLONNES.filter(c => c.obligatoire)

/**
 * Rapprochement d'un en-tete lu dans le fichier, insensible casse/accents/espaces.
 *
 * Les `entete` du catalogue sont ecrites en francais CORRECT — accents compris —
 * parce qu'elles sont ce que l'utilisateur lit dans le gabarit. La tolerance vit
 * ici : un fichier retape sans accents reste accepte.
 */
export function colonnePourEntete(entete: string): Colonne | undefined {
  const cle = normaliserCle(entete)
  return COLONNES.find(c => normaliserCle(c.entete) === cle)
}
