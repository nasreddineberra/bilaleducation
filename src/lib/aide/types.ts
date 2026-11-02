/**
 * AIDE INTEGREE (02/11) : modele d'une procedure utilisateur.
 *
 * Une procedure decrit UN ecran (ou un groupe d'ecrans) pour les ecoles : a quoi
 * il sert, qui peut faire quoi, les taches pas a pas, les regles, pourquoi un
 * bouton est grise, les questions frequentes. Le contenu vit dans le depot
 * (`lib/aide/procedures/`), relu et mis a jour dans le MEME commit que l'ecran.
 *
 * Ecriture : le nom exact d'un bouton, d'un champ ou d'un onglet s'ecrit entre
 * guillemets « ... » (mis en valeur a l'ecran). Ni tiret long, ni « (s) ».
 *
 * Droits : `admin` a partout les droits de `direction` ; il n'est donc jamais
 * nomme dans le contenu (voir `concerne`). Le parent et l'editeur n'ont pas
 * d'aide en V1.
 */
import type { UserRole } from '@/types/database'

export type RoleAide = Exclude<UserRole, 'admin' | 'super_admin' | 'parent'>

/** Restriction facultative d'un element : absente = tous les roles de la procedure. */
interface Pour { roles?: RoleAide[] }

export interface Tache extends Pour {
  titre: string
  etapes: string[]
  /** Remarques sous les etapes (cas particuliers, consequences). */
  aSavoir?: string[]
}

export interface Procedure {
  /** Identifiant d'adresse : `/dashboard/aide/<slug>`. */
  slug: string
  titre: string
  /** Section du menu ou se trouve l'ecran (regroupement du menu Aide). */
  module: string
  /** Adresses couvertes : exactes, ou prefixe termine par `/*` (fiches). */
  ecrans: string[]
  roles: RoleAide[]
  /** A quoi sert l'ecran, en deux phrases au plus. */
  resume: string
  /** Ou le trouver dans le menu (« Gestion · Financements · Règlements »). */
  acces: string
  droits?: (Pour & { texte: string })[]
  taches: Tache[]
  regles?: (Pour & { texte: string })[]
  grise?: (Pour & { element: string; raison: string; solution: string })[]
  faq?: (Pour & { question: string; reponse: string })[]
  /** Slugs d'autres procedures. */
  voirAussi?: string[]
}
