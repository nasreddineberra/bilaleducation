/**
 * RAPPROCHEMENT : ce que chaque ligne du fichier va REELLEMENT faire.
 *
 * ┌─ L'IMPORT NE JUGE PAS UNE VALIDITE, IL DETERMINE UNE ACTION ─────────────┐
 * │ L'import se fait en aout, avant la rentree. Une bonne part du fichier     │
 * │ decrit des familles DEJA connues : reinscriptions, fratries qui           │
 * │ s'agrandissent. Traiter « existe deja » comme une erreur rouge — ce que   │
 * │ faisait le premier dessin — c'etait prendre la normalite pour une panne.  │
 * │                                                                           │
 * │ Chaque foyer tombe donc dans une ACTION, et la couleur de l'ecran porte   │
 * │ cette action, pas un verdict.                                             │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * ── LE REGROUPEMENT PAR FOYER EST FAIT AVANT TOUT CONTROLE ─────────────────
 *
 * Une famille de trois enfants occupe trois lignes, le foyer repete. Sans ce
 * regroupement, l'import creerait le foyer a la 1re ligne puis se verrait
 * REFUSER les deux suivantes comme doublons de tuteur — la garde en base ne
 * distinguant pas une fratrie d'une double saisie.
 */

import { normalizeNom } from '@/lib/normalize-name'
import { COLONNES } from './colonnes'
import type { LigneBrute } from './lire-fichier'

// ─── Ce qu'on sait de la base ────────────────────────────────────────────────

/** Foyer existant, reduit a ce que le rapprochement regarde. */
export interface FoyerExistant {
  id: string
  tutor1_last_name: string
  tutor1_first_name: string
  tutor2_last_name: string | null
  tutor2_first_name: string | null
  /** Champs modifiables, pour reperer ce qui a change. */
  champs: Record<string, string | null>
}

export interface EnfantExistant {
  id: string
  parent_id: string | null
  last_name: string
  first_name: string
  date_of_birth: string
}

// ─── Ce que le rapprochement rend ────────────────────────────────────────────

export type ActionFoyer =
  | 'creer'         // foyer inconnu
  | 'completer'     // foyer connu, au moins un enfant a rattacher
  | 'mettre_a_jour' // foyer connu, des coordonnees ont change
  | 'rien'          // tout est deja en base et identique
  | 'bloque'        // anomalie : rien ne sera ecrit

export type ActionEnfant = 'creer' | 'rien' | 'bloque'

export type Gravite = 'bloquant' | 'invalide' | 'avertissement'

export interface Anomalie {
  gravite: Gravite
  message: string
  /** Numero de ligne du fichier, quand l'anomalie en vise une seule. */
  ligne?: number
  /** Colonne visee, quand l'anomalie porte sur une cellule precise. */
  cle?: string
}

export interface Changement {
  cle: string
  avant: string | null
  apres: string | null
}

export interface EnfantRapproche {
  ligne: number
  valeurs: Record<string, string | null>
  /** Texte d'origine des cellules refusees, pour ne pas faire resaisir. */
  bruts: Record<string, string>
  action: ActionEnfant
  /** Identifiant de la fiche existante, quand l'enfant est deja connu. */
  existantId?: string
  anomalies: Anomalie[]
}

export interface FoyerRapproche {
  /** Cle de regroupement : le tuteur 1 normalise. */
  cle: string
  /** Lignes du fichier qui composent ce foyer. */
  lignes: number[]
  valeurs: Record<string, string | null>
  /** Texte d'origine des cellules refusees, cote foyer. */
  bruts: Record<string, string>
  /** Message par colonne du foyer, pour le poser SOUS le champ concerne. */
  erreursChamps: Record<string, string>
  action: ActionFoyer
  existantId?: string
  changements: Changement[]
  enfants: EnfantRapproche[]
  anomalies: Anomalie[]
  /** Vrai si la case a cocher est utilisable. */
  enregistrable: boolean
}

// ─── Cles ────────────────────────────────────────────────────────────────────

const clePersonne = (nom: string | null, prenom: string | null): string =>
  `${normalizeNom(nom)}|${normalizeNom(prenom)}`

const cleEnfant = (nom: string | null, prenom: string | null, naissance: string | null): string =>
  `${normalizeNom(nom)}|${normalizeNom(prenom)}|${naissance ?? ''}`

/** Colonnes du foyer que l'import a le droit de modifier. */
const CHAMPS_MODIFIABLES = [
  'tutor1_email', 'tutor1_phone', 'tutor1_relationship',
  'tutor1_address', 'tutor1_city', 'tutor1_postal_code', 'tutor1_profession',
  'tutor2_email', 'tutor2_phone', 'tutor2_relationship',
  'tutor2_address', 'tutor2_city', 'tutor2_postal_code', 'tutor2_profession',
  'situation_familiale',
]

// ─── Le rapprochement ────────────────────────────────────────────────────────

export function rapprocher(
  lignes: LigneBrute[],
  foyers: FoyerExistant[],
  enfants: EnfantExistant[],
): FoyerRapproche[] {

  // Index de l'existant. Une personne peut etre tuteur 1 OU tuteur 2 : les deux
  // rangs entrent dans le meme index, sans quoi on refabriquerait le trou du
  // controle d'origine, qui ne comparait chaque rang qu'a lui-meme.
  const foyerParPersonne = new Map<string, FoyerExistant>()
  for (const f of foyers) {
    foyerParPersonne.set(clePersonne(f.tutor1_last_name, f.tutor1_first_name), f)
    if (f.tutor2_last_name || f.tutor2_first_name) {
      foyerParPersonne.set(clePersonne(f.tutor2_last_name, f.tutor2_first_name), f)
    }
  }

  const enfantParCle = new Map<string, EnfantExistant>()
  for (const e of enfants) {
    enfantParCle.set(cleEnfant(e.last_name, e.first_name, e.date_of_birth), e)
  }

  // ── Index des QUASI-IDENTIQUES ──────────────────────────────────────────
  //
  // Meme foyer, meme NOM, meme date de naissance, prenom different. C'est
  // presque toujours la MEME personne dont l'orthographe a ete corrigee dans le
  // fichier — et l'import, qui cree sans jamais renommer, en fabriquerait un
  // second exemplaire. C'est arrive le 24 aout : « Enfant » puis « Enfant 1 »,
  // nes le meme jour dans le meme foyer.
  //
  // On AVERTIT sans bloquer : des jumeaux nes le meme jour dans le meme foyer
  // portent legitimement deux prenoms. La machine ne peut pas trancher, elle
  // n'a donc pas a decider.
  const parNomEtDate = new Map<string, EnfantExistant[]>()
  for (const e of enfants) {
    if (!e.parent_id) continue
    const cle = `${e.parent_id}|${normalizeNom(e.last_name)}|${e.date_of_birth}`
    const l = parNomEtDate.get(cle)
    if (l) l.push(e)
    else parNomEtDate.set(cle, [e])
  }

  // ── 1. Regrouper les lignes par foyer ──────────────────────────────────────
  const groupes = new Map<string, LigneBrute[]>()
  for (const l of lignes) {
    const cle = clePersonne(l.valeurs.tutor1_last_name, l.valeurs.tutor1_first_name)
    const g = groupes.get(cle)
    if (g) g.push(l)
    else groupes.set(cle, [l])
  }

  // ── 2. Doublons INTERNES au fichier ────────────────────────────────────────
  //
  // Deux lignes decrivant le meme enfant ne sont refusees par aucune regle de
  // base : il n'existe pas encore. Les DEUX sont bloquees — rien ne dit
  // laquelle est la bonne.
  const occurrences = new Map<string, number[]>()
  for (const l of lignes) {
    const cle = cleEnfant(l.valeurs.last_name, l.valeurs.first_name, l.valeurs.date_of_birth)
    if (cle === '||') continue // enfant non renseigne : deja signale ailleurs
    const o = occurrences.get(cle)
    if (o) o.push(l.numero)
    else occurrences.set(cle, [l.numero])
  }
  const lignesEnDouble = new Map<number, number[]>()
  for (const [, nums] of occurrences) {
    if (nums.length > 1) for (const n of nums) lignesEnDouble.set(n, nums)
  }

  // ── 3. Un foyer par groupe ─────────────────────────────────────────────────
  const resultat: FoyerRapproche[] = []

  for (const [cle, groupe] of groupes) {
    const premiere = groupe[0]
    const anomalies: Anomalie[] = []

    // Le foyer prend les valeurs de sa PREMIERE ligne. Les suivantes doivent
    // dire la meme chose : sinon on ecrirait silencieusement l'une des deux.
    const valeursFoyer: Record<string, string | null> = {}
    for (const [k, v] of Object.entries(premiere.valeurs)) {
      if (!k.startsWith('last_name') && !k.startsWith('first_name') &&
          k !== 'date_of_birth' && k !== 'gender') {
        valeursFoyer[k] = v
      }
    }

    for (const l of groupe.slice(1)) {
      for (const k of Object.keys(valeursFoyer)) {
        const a = valeursFoyer[k]
        const b = l.valeurs[k]
        // Une cellule vide ne contredit pas : elle ne dit rien.
        if (a !== null && b !== null && a !== b) {
          anomalies.push({
            gravite: 'avertissement',
            ligne: l.numero,
            message: `Le foyer est decrit differemment ligne ${premiere.numero} et ligne ${l.numero} (${k}) : « ${a} » puis « ${b} ». La 1re ligne fait foi.`,
          })
        }
      }
    }

    // Le tuteur 2 ne peut pas etre le tuteur 1 : meme regle qu'en base.
    if (valeursFoyer.tutor2_last_name || valeursFoyer.tutor2_first_name) {
      const c2 = clePersonne(valeursFoyer.tutor2_last_name, valeursFoyer.tutor2_first_name)
      if (c2 === cle) {
        anomalies.push({
          gravite: 'bloquant',
          message: 'Le tuteur 2 est la meme personne que le tuteur 1.',
        })
      }
    }

    const existant = foyerParPersonne.get(cle)

    // Le tuteur 2 du fichier appartient-il DEJA a un autre foyer ?
    if (valeursFoyer.tutor2_last_name || valeursFoyer.tutor2_first_name) {
      const c2 = clePersonne(valeursFoyer.tutor2_last_name, valeursFoyer.tutor2_first_name)
      const autre = foyerParPersonne.get(c2)
      if (autre && (!existant || autre.id !== existant.id)) {
        anomalies.push({
          gravite: 'bloquant',
          message: `Le tuteur 2 appartient deja au foyer « ${autre.tutor1_last_name} ${autre.tutor1_first_name} ».`,
        })
      }
    }

    // ── Les changements de coordonnees ───────────────────────────────────────
    const changements: Changement[] = []
    if (existant) {
      for (const champ of CHAMPS_MODIFIABLES) {
        const apres = valeursFoyer[champ]
        // Une cellule vide n'efface JAMAIS : elle veut dire « pas d'information ».
        if (apres === null) continue

        const avant = existant.champs[champ] ?? null

        // ── LA COMPARAISON SE FAIT SUR LA MEME NORMALISATION ───────────────
        //
        // Sans cela, un fichier contenant EXACTEMENT la valeur de la base
        // ressortirait comme modifie : le seed stocke « 06 14 05 06 07 », notre
        // normaliseur produit « +33614050607 ». Reimporter un fichier inchange
        // aurait propose de mettre a jour les 200 foyers, et l'utilisateur
        // aurait coche sans y croire — ou pire, aurait cru a un vrai changement.
        //
        // On compare donc la valeur EXISTANTE passee au meme normaliseur.
        const normaliseur = COLONNES.find(c => c.cle === champ)?.normaliser
        const avantNormalise = normaliseur ? normaliseur(avant).valeur : avant

        if (avantNormalise !== apres) changements.push({ cle: champ, avant, apres })
      }
    }

    // ── Les enfants du foyer ─────────────────────────────────────────────────
    const enfantsRapproches: EnfantRapproche[] = groupe.map(l => {
      const aEnfants: Anomalie[] = l.erreurs.map(e => ({
        gravite: 'invalide' as Gravite, message: e.message, ligne: l.numero, cle: e.cle,
      }))

      const doublons = lignesEnDouble.get(l.numero)
      if (doublons) {
        aEnfants.push({
          gravite: 'bloquant',
          ligne: l.numero,
          message: `Cet enfant apparait aussi ligne ${doublons.filter(n => n !== l.numero).join(', ')} du fichier.`,
        })
      }

      const cleE = cleEnfant(l.valeurs.last_name, l.valeurs.first_name, l.valeurs.date_of_birth)
      const dejaLa = cleE === '||' ? undefined : enfantParCle.get(cleE)

      // Un enfant deja en base mais rattache a un AUTRE foyer : la machine ne
      // peut pas trancher entre l'homonyme et l'erreur de saisie.
      if (dejaLa && existant && dejaLa.parent_id && dejaLa.parent_id !== existant.id) {
        aEnfants.push({
          gravite: 'bloquant',
          ligne: l.numero,
          message: 'Cet enfant est deja enregistre dans un autre foyer.',
        })
      }
      if (dejaLa && !existant) {
        aEnfants.push({
          gravite: 'bloquant',
          ligne: l.numero,
          message: 'Un enfant identique existe deja, rattache a un autre foyer.',
        })
      }

      // Quasi-identique dans le MEME foyer : on le nomme, pour que l'utilisateur
      // tranche en connaissance de cause.
      if (!dejaLa && existant && l.valeurs.last_name && l.valeurs.date_of_birth) {
        const proches = parNomEtDate.get(
          `${existant.id}|${normalizeNom(l.valeurs.last_name)}|${l.valeurs.date_of_birth}`,
        )
        if (proches?.length) {
          aEnfants.push({
            gravite: 'avertissement',
            ligne: l.numero,
            message:
              `Un apprenant très proche existe déjà dans ce foyer : `
              + proches.map(p => `${p.last_name} ${p.first_name}`).join(', ')
              + ` (même nom, même date de naissance). S'il s'agit de la même personne, `
              + `corrigez son prénom sur sa fiche : l'import créerait un second dossier.`,
          })
        }
      }

      const bloque = aEnfants.some(a => a.gravite === 'bloquant' || a.gravite === 'invalide')

      return {
        ligne: l.numero,
        valeurs: l.valeurs,
        bruts: l.bruts,
        action: bloque ? 'bloque' : dejaLa ? 'rien' : 'creer',
        existantId: dejaLa?.id,
        anomalies: aEnfants,
      }
    })

    // ── L'action du foyer ────────────────────────────────────────────────────
    //
    // UN SEUL enfant bloque bloque TOUT le foyer : un foyer a moitie importe
    // est un piege — on croit la famille saisie alors qu'il manque un enfant,
    // et le rejeu buterait sur le doublon de tuteur.
    const foyerBloque =
      anomalies.some(a => a.gravite === 'bloquant') ||
      enfantsRapproches.some(e => e.action === 'bloque')

    let action: ActionFoyer
    if (foyerBloque) action = 'bloque'
    else if (!existant) action = 'creer'
    else if (enfantsRapproches.some(e => e.action === 'creer')) action = 'completer'
    else if (changements.length > 0) action = 'mettre_a_jour'
    else action = 'rien'

    // Les erreurs des colonnes de FOYER viennent de la premiere ligne, qui fait
    // foi pour le foyer. Elles sont indexees par colonne pour que l'ecran les
    // pose sous le champ concerne au lieu de les empiler en bout de ligne.
    const erreursChamps: Record<string, string> = {}
    for (const e of premiere.erreurs) {
      if (!(e.cle in valeursFoyer)) continue
      erreursChamps[e.cle] = e.message
    }

    resultat.push({
      cle,
      lignes: groupe.map(l => l.numero),
      valeurs: valeursFoyer,
      bruts: premiere.bruts,
      erreursChamps,
      action,
      existantId: existant?.id,
      changements,
      enfants: enfantsRapproches,
      anomalies,
      enregistrable: action === 'creer' || action === 'completer' || action === 'mettre_a_jour',
    })
  }

  // Ordre du fichier : l'utilisateur relit son tableau, pas le notre.
  return resultat.sort((a, b) => a.lignes[0] - b.lignes[0])
}
