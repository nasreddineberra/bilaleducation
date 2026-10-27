/**
 * QUI ASSURE UNE SEANCE — la regle unique (conception du 27/10,
 * docs/CONCEPTION-PLANNING-ABSENCES.md, § 2).
 *
 * L'enseignant d'une seance n'est plus lu sur le creneau (copie qui se perime :
 * l'ancien titulaire restait propose apres son depart) : il est DEDUIT, pour la
 * date de la seance, dans cet ordre :
 *   1. seance ANNULEE : personne, elle n'a pas lieu ;
 *   2. REMPLACANT designe pour cette seance (`override_teacher_id`) ;
 *   3. TITULAIRE EN POSTE ce jour-la (affectation principale dont les dates
 *      couvrent la seance) ;
 *   4. sinon personne : « Prof non affecté » — la seance a lieu.
 * « Annulee » et « Prof non affecte » sont deux etats distincts.
 *
 * Module PUR, sans import : eprouve par `node --test`. Dates `AAAA-MM-JJ`.
 */

export interface AffectationSource {
  class_id: string
  teacher_id: string
  is_main_teacher: boolean | null
  effective_from?: string | null
  effective_until?: string | null
}

/** Titulaire d'une classe a une date (un `teachers.id`), ou `null`. */
export type TitulaireDe = (classId: string, date: string) => string | null

/**
 * Index des titulaires par classe. Deux affectations principales couvrant la
 * meme date (passation saisie le meme jour) : la plus RECENTE l'emporte.
 */
export function indexTitulaires(affectations: AffectationSource[]): TitulaireDe {
  const parClasse = new Map<string, AffectationSource[]>()
  for (const a of affectations) {
    if (!a.is_main_teacher || !a.teacher_id) continue
    const liste = parClasse.get(a.class_id) ?? []
    liste.push(a)
    parClasse.set(a.class_id, liste)
  }
  for (const liste of parClasse.values()) {
    liste.sort((x, y) => (y.effective_from ?? '').localeCompare(x.effective_from ?? ''))
  }
  return (classId, date) => {
    const enPoste = parClasse.get(classId)?.find(a =>
      (!a.effective_from || String(a.effective_from).slice(0, 10) <= date)
      && (!a.effective_until || String(a.effective_until).slice(0, 10) >= date))
    return enPoste?.teacher_id ?? null
  }
}

export interface ExceptionSeance {
  exception_type: string
  override_teacher_id: string | null
}

export interface EnseignantSeance {
  annulee: boolean
  /** Qui assure la seance : remplacant, sinon titulaire ; `null` = annulee ou « Prof non affecté ». */
  teacherId: string | null
  /** Titulaire en poste ce jour-la, remplacement ou non. */
  titulaireId: string | null
  /** Un autre que le titulaire assure la seance. */
  remplacement: boolean
}

export function enseignantDeSeance(
  classId: string,
  date: string,
  exception: ExceptionSeance | null | undefined,
  titulaireDe: TitulaireDe,
): EnseignantSeance {
  const titulaireId = titulaireDe(classId, date)
  if (exception?.exception_type === 'cancelled') {
    return { annulee: true, teacherId: null, titulaireId, remplacement: false }
  }
  const remplacant = exception?.override_teacher_id ?? null
  const teacherId = remplacant ?? titulaireId
  return { annulee: false, teacherId, titulaireId, remplacement: !!remplacant && remplacant !== titulaireId }
}

/** Affectations a plat depuis des classes lues avec `class_teachers(...)` imbrique. */
export function affectationsDesClasses(
  classes: { id: string; class_teachers?: Omit<AffectationSource, 'class_id'>[] | null }[],
): AffectationSource[] {
  return classes.flatMap(c => (c.class_teachers ?? []).map(ct => ({ ...ct, class_id: c.id })))
}
