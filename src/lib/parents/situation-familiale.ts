/**
 * LA SITUATION FAMILIALE D'UN FOYER — valeurs et libelles, une seule fois.
 *
 * ┌─ IL Y EN AVAIT QUATRE TABLES, ET ELLES DIVERGEAIENT ─────────────────────┐
 * │ · le SELECT de la fiche parents   : « Marié(e)s », « Pacsé(e)s »…        │
 * │ · l'affichage de la meme fiche    : « Mariés », « Veuf/Veuve »           │
 * │ · la liste des parents            : idem, mais « Monoparental »          │
 * │ · Financements                    : des CLES QUI N'EXISTENT PAS          │
 * │   (« concubinage », « célibataire », « veuf », « autre »), et pas         │
 * │   « union_libre » ni « veuf_veuve » ni « monoparental »                  │
 * │                                                                          │
 * │ Consequence mesurable : un foyer en union libre s'affichait « union_libre │
 * │ » dans Financements, tiret bas compris — la table n'ayant pas la cle, le  │
 * │ repli montrait la valeur brute de la base.                                │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Les VALEURS sont celles stockees en base et ne bougent pas. Seuls les
 * libelles s'affichent, et ils vivent desormais ici.
 */

export interface OptionSituation {
  /** Valeur stockee en base. */
  value: string
  label: string
}

/**
 * Les sept situations, dans l'ordre du formulaire.
 *
 * Le « (e) » a ete retire des libelles a la demande de l'utilisateur : une
 * situation familiale decrit le FOYER, pas une personne — « Mariés » se suffit.
 */
export const SITUATIONS_FAMILIALES: OptionSituation[] = [
  { value: 'mariés',       label: 'Mariés' },
  { value: 'pacsés',       label: 'Pacsés' },
  { value: 'union_libre',  label: 'Union libre' },
  { value: 'séparés',      label: 'Séparés' },
  { value: 'divorcés',     label: 'Divorcés' },
  { value: 'veuf_veuve',   label: 'Veuf / Veuve' },
  { value: 'monoparental', label: 'Famille monoparentale' },
]

const PAR_VALEUR = new Map(SITUATIONS_FAMILIALES.map(s => [s.value, s.label]))

/**
 * Libelle affichable d'une situation.
 *
 * Une valeur inconnue rend une chaine VIDE et non la valeur brute : afficher
 * « union_libre » a l'ecran, c'est montrer a l'utilisateur un identifiant de
 * base de donnees. Mieux vaut ne rien dire que dire ca.
 */
export function libelleSituation(valeur: string | null | undefined): string {
  if (!valeur) return ''
  return PAR_VALEUR.get(valeur) ?? ''
}
