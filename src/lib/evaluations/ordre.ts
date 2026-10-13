/**
 * Ordre d'affichage des evaluations d'une classe pour une periode.
 *
 * L'ENSEIGNANT le definit dans les Gabarits (`evaluation_order_config`, cle
 * classe + periode) : ordre des UE, et des modules dans chaque UE. Il est repris
 * par la Saisie des notes et par le CONTENU du bulletin PDF.
 *
 * La regle, unique :
 *   · les UE de l'ordre enregistre d'abord, les autres ensuite dans l'ordre du
 *     Referentiel (celui de la liste `ues` recue) ;
 *   · dans chaque UE : les evaluations SANS module, puis les modules de l'ordre
 *     enregistre, puis les autres dans leur ordre d'apparition ;
 *   · les evaluations gardent l'ordre recu (celui du gabarit, `sort_order`).
 *
 * Elle vivait recopiee dans les Gabarits et la Saisie des notes, et le bulletin
 * en suivait une autre (ordre d'apparition des evaluations) : une UE pouvait y
 * etre coupee en deux blocs, et l'ordre de l'enseignant y etait ignore.
 * Les Gabarits gardent leur propre rendu (il gere en plus le cours en cours
 * d'ajout) ; `ordre.test.ts` verifie que leur regle et celle-ci concordent.
 *
 * Module pur : eprouve par `node --test`.
 */

export interface EvalPlacee {
  cours_id:          string | null
  display_ue_id:     string | null
  display_module_id: string | null
}

export interface CoursPlace {
  unite_enseignement_id: string
  module_id:             string | null
}

export interface ConfigOrdre {
  ue_order?:     string[] | null
  module_order?: Record<string, string[]> | null
}

/** UE ou s'affiche l'evaluation : celle du reglage « afficher sous », sinon celle de son cours. */
export function ueEffective(e: EvalPlacee, coursById: Map<string, CoursPlace>): string {
  return e.display_ue_id ?? coursById.get(e.cours_id ?? '')?.unite_enseignement_id ?? ''
}

/**
 * Module ou s'affiche l'evaluation. Avec un reglage « afficher sous », c'est le
 * module de ce reglage — NUL compris (directement sous l'UE) : reprendre alors
 * le module d'origine du cours rangerait l'evaluation ailleurs que l'enseignant.
 */
export function moduleEffectif(e: EvalPlacee, coursById: Map<string, CoursPlace>): string | null {
  return e.display_ue_id !== null
    ? e.display_module_id
    : coursById.get(e.cours_id ?? '')?.module_id ?? null
}

/** Ordre enregistre d'abord (s'il est present), puis le reste dans son ordre. */
export function appliquerOrdre(naturel: string[], enregistre: string[] | null | undefined): string[] {
  if (!enregistre || enregistre.length === 0) return naturel
  return [...enregistre.filter(id => naturel.includes(id)), ...naturel.filter(id => !enregistre.includes(id))]
}

/** UE presentes, ordonnees. `ues` arrive dans l'ordre du Referentiel. */
export function ordonnerUes<U extends { id: string }>(ues: U[], presentes: Set<string>, config: ConfigOrdre | null | undefined): U[] {
  const naturel = ues.filter(u => presentes.has(u.id)).map(u => u.id)
  return appliquerOrdre(naturel, config?.ue_order)
    .map(id => ues.find(u => u.id === id))
    .filter((u): u is U => Boolean(u))
}

export interface Groupe<E> {
  ueId:  string
  modId: string | null
  evals: E[]
}

/**
 * Evaluations regroupees par UE puis module, dans l'ordre de l'enseignant.
 * Une evaluation sans UE identifiable (cours supprime) est ecartee, comme elle
 * l'est de l'arbre de la Saisie des notes.
 */
export function grouperParGabarit<E extends EvalPlacee, U extends { id: string }>(
  evals:     E[],
  ues:       U[],
  coursById: Map<string, CoursPlace>,
  config:    ConfigOrdre | null | undefined,
): Groupe<E>[] {
  const presentes = new Set(evals.map(e => ueEffective(e, coursById)).filter(Boolean))
  const groupes: Groupe<E>[] = []
  for (const ue of ordonnerUes(ues, presentes, config)) {
    const ueEvals = evals.filter(e => ueEffective(e, coursById) === ue.id)
    const directs = ueEvals.filter(e => moduleEffectif(e, coursById) === null)
    if (directs.length) groupes.push({ ueId: ue.id, modId: null, evals: directs })
    const naturels = [...new Set(ueEvals.map(e => moduleEffectif(e, coursById)).filter((id): id is string => id !== null))]
    for (const modId of appliquerOrdre(naturels, config?.module_order?.[ue.id])) {
      groupes.push({ ueId: ue.id, modId, evals: ueEvals.filter(e => moduleEffectif(e, coursById) === modId) })
    }
  }
  return groupes
}
