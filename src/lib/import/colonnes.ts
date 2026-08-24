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
import { libelleSituation } from '@/lib/parents/situation-familiale'

/** A quelle partie de la ligne la colonne appartient. */
export type Cible = 'tuteur1' | 'tuteur2' | 'foyer' | 'enfant'

export interface Valeur {
  /** Valeur prete a ecrire, ou `null` si la cellule est vide ou refusee. */
  valeur: string | null
  /** Rempli quand la cellule contient quelque chose d'illisible. */
  erreur?: string
  /**
   * Texte d'origine, conserve QUAND LA VALEUR EST REFUSEE.
   *
   * Sans lui l'ecran affichait un champ VIDE sous le message d'erreur, et il
   * fallait tout resaisir alors qu'une lettre manquait souvent. On rend donc a
   * l'utilisateur ce qu'il a ecrit, pour qu'il le corrige.
   */
  brut?: string
}

export interface Colonne {
  /** Nom de la colonne en base — c'est aussi la cle de la ligne normalisee. */
  cle: string
  /** Libelle exact dans le gabarit. */
  entete: string
  cible: Cible
  obligatoire: boolean
  normaliser: (brut: unknown) => Valeur
  /** Toutes les formes tolerees a la lecture (genre, lien, situation). */
  valeursAcceptees?: string[]
  /** Libelles canoniques — la liste deroulante du gabarit. */
  libelles?: string[]
  /**
   * Valeur STOCKEE vers valeur LISIBLE.
   *
   * La base garde « 2015-07-14 » et « male » ; l'utilisateur doit lire
   * « 14/07/2015 » et « Masculin ». Sans cette traduction, l'ecran d'import
   * affichait les valeurs techniques dans des champs francais.
   *
   * L'inverse est deja assure : `normaliser` accepte les deux ecritures, et
   * elle est idempotente — la saisie et le stockage se repondent donc.
   */
  afficher?: (valeur: string) => string
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
    return { valeur: null, erreur: `Adresse email illisible : « ${t.valeur} »`, brut: t.valeur }
  }
  return t
}

/**
 * Telephone : indicatif + chiffres, la forme qu'ecrit le formulaire.
 *
 * ┌─ ON NE DEVINE PAS L'INDICATIF ───────────────────────────────────────────┐
 * │ Un numero SANS « + » ni « 00 » est ambigu : « 33630752443 » peut se lire  │
 * │ « +33 6 30 75 24 43 » ou un numero local de onze chiffres. La premiere    │
 * │ version prefixait « +33 » a tout ce qui n'avait pas d'indicatif explicite │
 * │ — elle a produit « +3333630752443 », treize chiffres, sans rien signaler. │
 * │                                                                           │
 * │ Deviner sur une donnee ambigue, c'est fabriquer une erreur silencieuse.   │
 * │ On refuse donc, en disant les DEUX formes acceptees.                      │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * Sont acceptes :
 *   · l'international explicite — « +213 6 61 23 45 67 » ou « 00213661234567 » ;
 *   · le national francais — « 06 30 75 24 43 », dix chiffres commençant par 0.
 *
 * Le zero initial tombe apres l'indicatif : « +33 06 12… » n'a pas de sens.
 */
const telephone = (b: unknown): Valeur => {
  const t = texte(b)
  if (!t.valeur) return t

  const aide = "Écrivez « 06 12 34 56 78 » ou, pour l'étranger, « +213 6 61 23 45 67 »."

  let brut = t.valeur.replace(/[\s.\-()]/g, '')
  const international = brut.startsWith('+') || brut.startsWith('00')
  if (brut.startsWith('00')) brut = '+' + brut.slice(2)

  if (international) {
    // Le plus LONG indicatif d'abord : sans ce tri, « +2 » masquerait « +212 »
    // et « +213 » le jour ou un indicatif court entrerait dans la liste.
    const pays = [...COUNTRY_CODES]
      .sort((a, b2) => b2.code.length - a.code.length)
      .find(c => brut.startsWith(c.code))

    if (!pays) {
      return {
        valeur: null,
        brut: t.valeur,
        erreur: `Indicatif pays non reconnu : « ${t.valeur} ». Pays gérés : ${COUNTRY_CODES.map(c => c.code).join(' ')}.`,
      }
    }

    let chiffres = brut.slice(pays.code.length).replace(/\D/g, '')
    if (chiffres.startsWith('0')) chiffres = chiffres.slice(1)

    if (chiffres.length < 6 || chiffres.length > 12) {
      return { valeur: null, brut: t.valeur, erreur: `Numéro incomplet : « ${t.valeur} ».` }
    }
    return { valeur: pays.code + chiffres }
  }

  // ── Sans indicatif explicite : ce doit etre un numero national ────────────
  const chiffres = brut.replace(/\D/g, '')

  if (chiffres.length !== 10 || !chiffres.startsWith('0')) {
    return {
      valeur: null,
      brut: t.valeur,
      erreur: `Numéro de téléphone non reconnu : « ${t.valeur} ». ${aide}`,
    }
  }

  return { valeur: '+33' + chiffres.slice(1) }
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
    return valide(iso) ? { valeur: iso } : { valeur: null, erreur: `Date inexistante : « ${t} »`, brut: t }
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) {
    return valide(t) ? { valeur: t } : { valeur: null, erreur: `Date inexistante : « ${t} »`, brut: t }
  }

  return { valeur: null, erreur: `Date illisible : « ${t} » (attendu JJ/MM/AAAA)`, brut: t }
}

/**
 * `AAAA-MM-JJ` vers `JJ/MM/AAAA`, pour l'affichage.
 *
 * Decoupage de la CHAINE : construire un `Date` pour reformater une date deja
 * normalisee, c'est rouvrir la porte au decalage de fuseau pour rien.
 */
const afficherDate = (v: string): string => {
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : v
}

/** Le 31/02 se lit sans peine mais n'existe pas : `Date` le decalerait en mars. */
function valide(iso: string): boolean {
  const [a, m, j] = iso.split('-').map(Number)
  const d = new Date(a, m - 1, j)
  return d.getFullYear() === a && d.getMonth() === m - 1 && d.getDate() === j
}

const normaliserCle = (s: string): string =>
  s
    .trim()
    // « Tuteur 1 NOM (obligatoire) » designe la meme colonne que « Tuteur 1 NOM ».
    // Le marqueur est une DECORATION du gabarit : s'il entrait dans l'identite,
    // un fichier ou quelqu'un l'a efface ne serait plus reconnu.
    .replace(/\s*\([^)]*\)\s*$/, '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[\s_-]+/g, '')

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

    // ── LA VALEUR STOCKEE EST ELLE-MEME UNE FORME ACCEPTEE ─────────────────
    //
    // Sans cette ligne, normaliser une valeur DEJA normalisee la refuse :
    // « Masculin » donne « male », et « male » n'est pas un libelle connu.
    //
    // Ce n'est pas theorique : l'ecran d'import rejoue la normalisation de
    // toute la ligne des qu'une cellule est corrigee. La colonne Genre serait
    // alors declaree invalide a chaque correction, et le foyer basculerait en
    // « bloque » — l'ecran serait inutilisable pour ce qu'il sert a faire.
    //
    // Certaines valeurs passaient par chance (« mariés » et « Mariés » se
    // normalisent pareil), d'autres non (« veuf_veuve » contre « Veuf / Veuve »).
    // Compter sur cette coincidence serait pire que ne rien faire.
    table.set(normaliserCle(cible), cible)
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
        brut: t.valeur,
      }
    }
    return { valeur: trouve }
  }

  // Les formes acceptees remontent avec le normaliseur : le gabarit et l'ecran
  // les affichent sans les recopier. Recopier une liste fermee, c'est se donner
  // deux verites — et le jour ou l'une gagne une valeur, l'autre la refuse.
  return {
    normaliser,
    formes: Object.values(valeurs).flat(),
    // Le PREMIER de chaque cle est le libelle canonique : celui qu'on propose
    // dans la liste deroulante du gabarit. Les autres ne sont que tolerés.
    libelles: Object.values(valeurs).map(f => f[0]),

    // Chemin RETOUR : de la valeur stockee vers son libelle canonique.
    // La base garde « male », l'ecran doit montrer « Masculin ».
    afficher: (v: string) => valeurs[v]?.[0] ?? v,
  }
}

const genre = liste(
  {
    male: ['Masculin', 'M', 'Garçon', 'Garcon', 'H', 'Homme'],
    female: ['Féminin', 'Feminin', 'F', 'Fille', 'Femme'],
    non_specified: ['Non spécifié', 'Non specifie', 'NS'],
  },
  'Genre',
)

const lien = liste(
  {
    // Memes libelles que `RELATIONSHIP_OPTIONS` de la fiche parents : la liste
    // deroulante du gabarit doit offrir ce que l'ecran offre.
    'père': ['Père', 'Pere', 'Papa'],
    'mère': ['Mère', 'Mere', 'Maman'],
    'tuteur': ['Tuteur légal', 'Tuteur legal', 'Tuteur'],
    'autre': ['Autre'],
  },
  'Lien de parente',
)

// Les libelles viennent de la MEME source que la fiche parents : le gabarit
// propose exactement ce que l'ecran propose. Les formes suivantes ne sont que
// des tolerances de saisie pour un fichier qui ne viendrait pas du gabarit.
const situation = liste(
  {
    'mariés': [libelleSituation('mariés'), 'Marie', 'Maries'],
    'pacsés': [libelleSituation('pacsés'), 'Pacse', 'Pacses'],
    'union_libre': [libelleSituation('union_libre'), 'Concubinage'],
    'séparés': [libelleSituation('séparés'), 'Separe', 'Separes'],
    'divorcés': [libelleSituation('divorcés'), 'Divorce', 'Divorces'],
    'veuf_veuve': [libelleSituation('veuf_veuve'), 'Veuf', 'Veuve'],
    'monoparental': [libelleSituation('monoparental'), 'Monoparental'],
  },
  'Situation familiale',
)

const codePostal = (b: unknown): Valeur => {
  const t = texte(b)
  if (!t.valeur) return t
  // Un tableur transforme volontiers « 01200 » en nombre 1200 : on recomplete.
  const chiffres = t.valeur.replace(/\D/g, '')
  if (chiffres.length === 0 || chiffres.length > 5) {
    return { valeur: null, erreur: `Code postal illisible : « ${t.valeur} »`, brut: t.valeur }
  }
  return { valeur: chiffres.padStart(5, '0') }
}

// ─── Le catalogue ────────────────────────────────────────────────────────────
//
// L'ordre est celui des colonnes du gabarit : les obligatoires d'abord, pour
// qu'on ne puisse pas remplir le fichier sans les voir.

export const COLONNES: Colonne[] = [
  // Le foyer d'abord, l'enfant ensuite : c'est l'ordre dans lequel une fiche
  // d'inscription est remplie, et celui que l'ecole lit de gauche a droite.
  { cle: 'tutor1_last_name',    entete: 'Tuteur 1 NOM',         cible: 'tuteur1', obligatoire: true,  normaliser: nom },
  { cle: 'tutor1_first_name',   entete: 'Tuteur 1 Prénom',      cible: 'tuteur1', obligatoire: true,  normaliser: prenom },
  { cle: 'tutor1_email',        entete: 'Tuteur 1 Email',       cible: 'tuteur1', obligatoire: true,  normaliser: email },
  { cle: 'tutor1_phone',        entete: 'Tuteur 1 Téléphone',   cible: 'tuteur1', obligatoire: false, normaliser: telephone },
  { cle: 'tutor1_relationship', entete: 'Tuteur 1 Lien',        cible: 'tuteur1', obligatoire: false, normaliser: lien.normaliser, valeursAcceptees: lien.formes, libelles: lien.libelles, afficher: lien.afficher },
  { cle: 'tutor1_address',      entete: 'Tuteur 1 Adresse',     cible: 'tuteur1', obligatoire: false, normaliser: texte },
  { cle: 'tutor1_city',         entete: 'Tuteur 1 Ville',       cible: 'tuteur1', obligatoire: false, normaliser: texte },
  { cle: 'tutor1_postal_code',  entete: 'Tuteur 1 Code postal', cible: 'tuteur1', obligatoire: false, normaliser: codePostal },
  { cle: 'tutor1_profession',   entete: 'Tuteur 1 Profession',  cible: 'tuteur1', obligatoire: false, normaliser: texte },

  { cle: 'tutor2_last_name',    entete: 'Tuteur 2 NOM',         cible: 'tuteur2', obligatoire: false, normaliser: nom },
  { cle: 'tutor2_first_name',   entete: 'Tuteur 2 Prénom',      cible: 'tuteur2', obligatoire: false, normaliser: prenom },
  { cle: 'tutor2_email',        entete: 'Tuteur 2 Email',       cible: 'tuteur2', obligatoire: false, normaliser: email },
  { cle: 'tutor2_phone',        entete: 'Tuteur 2 Téléphone',   cible: 'tuteur2', obligatoire: false, normaliser: telephone },
  { cle: 'tutor2_relationship', entete: 'Tuteur 2 Lien',        cible: 'tuteur2', obligatoire: false, normaliser: lien.normaliser, valeursAcceptees: lien.formes, libelles: lien.libelles, afficher: lien.afficher },
  { cle: 'tutor2_address',      entete: 'Tuteur 2 Adresse',     cible: 'tuteur2', obligatoire: false, normaliser: texte },
  { cle: 'tutor2_city',         entete: 'Tuteur 2 Ville',       cible: 'tuteur2', obligatoire: false, normaliser: texte },
  { cle: 'tutor2_postal_code',  entete: 'Tuteur 2 Code postal', cible: 'tuteur2', obligatoire: false, normaliser: codePostal },
  { cle: 'tutor2_profession',   entete: 'Tuteur 2 Profession',  cible: 'tuteur2', obligatoire: false, normaliser: texte },

  { cle: 'situation_familiale', entete: 'Situation familiale',  cible: 'foyer',   obligatoire: false, normaliser: situation.normaliser, valeursAcceptees: situation.formes, libelles: situation.libelles, afficher: situation.afficher },

  { cle: 'last_name',           entete: 'Enfant NOM',           cible: 'enfant',  obligatoire: true,  normaliser: nom },
  { cle: 'first_name',          entete: 'Enfant Prénom',        cible: 'enfant',  obligatoire: true,  normaliser: prenom },
  { cle: 'date_of_birth',       entete: 'Date de naissance',    cible: 'enfant',  obligatoire: true,  normaliser: date, afficher: afficherDate },
  { cle: 'gender',              entete: 'Genre',                cible: 'enfant',  obligatoire: true,  normaliser: genre.normaliser, valeursAcceptees: genre.formes, libelles: genre.libelles, afficher: genre.afficher },
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
