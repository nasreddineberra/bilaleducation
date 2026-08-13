/**
 * QUELS CRENEAUX UNE PERSONNE ASSURE UN JOUR DONNE.
 *
 * ┌─ POURQUOI CE FICHIER EXISTE ─────────────────────────────────────────────┐
 * │ La modale d'absence doit proposer un remplacant PAR CRENEAU — c'est la    │
 * │ maille reelle d'un remplacement, pas la demi-journee. Elle a donc besoin  │
 * │ de savoir ce que la personne absente devait assurer ce jour-la.          │
 * │                                                                           │
 * │ L'emploi du temps sait le calculer, mais sa resolution fait bien plus :   │
 * │ elle applique les exceptions d'horaire et de salle, resout les couleurs,  │
 * │ construit les libelles, gere la vue mois. La recopier serait le motif qui │
 * │ a produit le calcul comptable divergent dans trois sous-menus de          │
 * │ Financements — corrige dans un seul pendant un mois.                     │
 * │                                                                           │
 * │ Ce module ne garde donc que la question qui nous interesse, et RIEN de    │
 * │ l'affichage. C'est volontairement une resolution REDUITE, pas un doublon  │
 * │ de celle de l'EDT : elle repond « quels creneaux », jamais « comment les  │
 * │ dessiner ».                                                              │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * Les dates circulent en `AAAA-MM-JJ` : la comparaison lexicographique de ce
 * format est exacte et evite le piege des fuseaux.
 */

export interface CreneauSource {
  id: string
  class_id: string
  teacher_id: string
  day_of_week: number | null
  start_time: string
  end_time: string
  is_recurring: boolean
  slot_date: string | null
  effective_from: string | null
  effective_until: string | null
  is_active: boolean
}

export interface ExceptionSource {
  schedule_slot_id: string
  exception_date: string
  exception_type: string
  override_teacher_id: string | null
}

export interface CreneauDuJour {
  slotId: string
  classId: string
  /** Enseignant qui l'assure REELLEMENT ce jour-la : le remplacant s'il y en a un. */
  teacherId: string
  /** Titulaire du creneau, independamment d'un remplacement en cours. */
  titulaireId: string
  startTime: string
  endTime: string
  /** Un remplacant est deja designe pour ce jour (`override_teacher_id`). */
  remplacantId: string | null
}

/** Le jour de la semaine de `date`, au format de `day_of_week` (0 = dimanche). */
function jourSemaine(date: string): number {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d).getDay()
}

/**
 * Creneaux assures par `titulaireId` a la date donnee.
 *
 * `titulaireId` est un `teachers.id` — pas un `profile_id`. C'est ce que
 * portent `schedule_slots.teacher_id` et `schedule_exceptions.override_teacher_id`,
 * et confondre les deux est le piege paye le 10 juillet, ou le filtre « par
 * enseignant » de l'EDT comparait un id de profil a un id d'enseignant et ne
 * matchait jamais.
 */
export function creneauxDuJour(
  slots: CreneauSource[],
  exceptions: ExceptionSource[],
  titulaireId: string,
  date: string,
): CreneauDuJour[] {
  if (!titulaireId || !date) return []

  const jour = jourSemaine(date)

  return slots
    .filter(s => {
      if (!s.is_active) return false
      if (s.teacher_id !== titulaireId) return false

      if (s.is_recurring) {
        if (s.day_of_week !== jour) return false
        // Fenetre d'effet : un creneau clos ou pas encore commence n'a pas lieu.
        // Ignorer ces bornes, c'est prendre deux creneaux successifs pour un
        // doublon — erreur commise le 13 aout sur ces memes donnees.
        if (s.effective_from && date < s.effective_from) return false
        if (s.effective_until && date > s.effective_until) return false
        return true
      }

      return s.slot_date === date
    })
    .filter(s => {
      // Un creneau annule ce jour-la n'a pas a etre remplace.
      const ex = exceptions.find(e => e.schedule_slot_id === s.id && e.exception_date === date)
      return ex?.exception_type !== 'cancelled'
    })
    .map(s => {
      const ex = exceptions.find(e => e.schedule_slot_id === s.id && e.exception_date === date)
      return {
        slotId: s.id,
        classId: s.class_id,
        titulaireId: s.teacher_id,
        teacherId: ex?.override_teacher_id ?? s.teacher_id,
        startTime: s.start_time.slice(0, 5),
        endTime: s.end_time.slice(0, 5),
        remplacantId: ex?.override_teacher_id ?? null,
      }
    })
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
}
