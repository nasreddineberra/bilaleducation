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
  /** Remplacant designe par une absence d'enseignant (`profiles.id`), voir `fusionnerDecisions`. */
  override_profile_id?: string | null
}

export interface EnseignantSeance {
  annulee: boolean
  /** Qui assure la seance (`teachers.id`) : remplacant, sinon titulaire ; `null` = annulee,
   *  « Prof non affecté », ou remplacant SANS fiche enseignant (voir `remplacantProfileId`). */
  teacherId: string | null
  /** Titulaire en poste ce jour-la, remplacement ou non. */
  titulaireId: string | null
  /** Un autre que le titulaire assure la seance. */
  remplacement: boolean
  /** Remplacant designe par une absence (`profiles.id`), fiche enseignant ou non. */
  remplacantProfileId: string | null
}

export function enseignantDeSeance(
  classId: string,
  date: string,
  exception: ExceptionSeance | null | undefined,
  titulaireDe: TitulaireDe,
): EnseignantSeance {
  const titulaireId = titulaireDe(classId, date)
  if (exception?.exception_type === 'cancelled') {
    return { annulee: true, teacherId: null, titulaireId, remplacement: false, remplacantProfileId: null }
  }
  const remplacant = exception?.override_teacher_id ?? null
  const remplacantProfileId = exception?.override_profile_id ?? null
  // Un remplacant sans fiche enseignant (secretaire, direction) assure la seance :
  // ce n'est ni le titulaire ni « Prof non affecté ».
  const teacherId = remplacant ?? (remplacantProfileId ? null : titulaireId)
  return {
    annulee: false,
    teacherId,
    titulaireId,
    remplacement: !!remplacantProfileId || (!!remplacant && remplacant !== titulaireId),
    remplacantProfileId,
  }
}

/** Decision d'une absence d'enseignant pour une seance (`absences_enseignants_seances`). */
export interface DecisionSeance {
  absence_id: string
  schedule_slot_id: string
  seance_date: string
  decision: string
  remplacant_profile_id: string | null
}

/**
 * Les decisions d'absence, fondues dans les exceptions de l'EDT : une seance
 * ANNULEE pour absence se lit comme une annulation, une seance REMPLACEE porte
 * son remplacant (`override_profile_id`, et `override_teacher_id` s'il a une
 * fiche enseignant). L'exception propre a la seance (salle changee) est
 * conservee. `par_absence` et `absence_id` disent d'ou vient l'etat ; une seance
 * remplacee sans autre exception prend le type `remplacement`.
 */
export function fusionnerDecisions<E extends { schedule_slot_id: string; exception_date: string; exception_type: string; override_teacher_id: string | null }>(
  exceptions: E[],
  decisions: DecisionSeance[],
  enseignantDuProfil: (profileId: string) => string | null,
): (E & { override_profile_id?: string | null; par_absence?: boolean; absence_id?: string })[] {
  if (decisions.length === 0) return exceptions
  const cle = (slotId: string, date: string) => `${slotId}|${date}`
  const parCle = new Map<string, E & { override_profile_id?: string | null; par_absence?: boolean; absence_id?: string }>(
    exceptions.map(e => [cle(e.schedule_slot_id, e.exception_date), e]),
  )
  for (const d of decisions) {
    const date = String(d.seance_date).slice(0, 10)
    const existante = parCle.get(cle(d.schedule_slot_id, date))
    const remplacee = d.decision === 'remplacee' && !!d.remplacant_profile_id
    parCle.set(cle(d.schedule_slot_id, date), {
      ...(existante ?? {}),
      schedule_slot_id: d.schedule_slot_id,
      exception_date: date,
      exception_type: d.decision === 'annulee' ? 'cancelled' : (existante?.exception_type ?? 'remplacement'),
      override_teacher_id: remplacee ? enseignantDuProfil(d.remplacant_profile_id!) : (existante?.override_teacher_id ?? null),
      override_profile_id: remplacee ? d.remplacant_profile_id : null,
      par_absence: true,
      absence_id: d.absence_id,
    } as E & { override_profile_id?: string | null; par_absence?: boolean; absence_id?: string })
  }
  return [...parCle.values()]
}

/** Affectations a plat depuis des classes lues avec `class_teachers(...)` imbrique. */
export function affectationsDesClasses(
  classes: { id: string; class_teachers?: Omit<AffectationSource, 'class_id'>[] | null }[],
): AffectationSource[] {
  return classes.flatMap(c => (c.class_teachers ?? []).map(ct => ({ ...ct, class_id: c.id })))
}

/**
 * SALLE D'UNE SEANCE (decision du 27/10) — deduite, jamais recopiee :
 *   1. salle changee pour CETTE seance (`override_room_id`) ;
 *   2. seance PONCTUELLE : sa propre salle, choisie a sa creation ;
 *   3. salle de la CLASSE si elle en a une (« meme salle pour tous les creneaux ») ;
 *   4. sinon salle du CRENEAU (salle choisie creneau par creneau).
 * Une salle de classe renseignee prime donc sur une ancienne copie restee sur
 * un creneau de serie.
 */
export function salleDeSeance(
  slot: { is_recurring: boolean; room_id?: string | null },
  exception: { override_room_id?: string | null } | null | undefined,
  salleDeLaClasse: string | null | undefined,
): string | null {
  if (exception?.override_room_id) return exception.override_room_id
  if (!slot.is_recurring) return slot.room_id ?? salleDeLaClasse ?? null
  return salleDeLaClasse ?? slot.room_id ?? null
}
