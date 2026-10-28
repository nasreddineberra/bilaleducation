// Absences enseignants : libelles et refus (lot 3, migration
// add-absences-enseignants.sql). La base leve un CODE en `message`, la seance
// en cause en `details` ; l'ecran affiche la phrase francaise.
//
// Module ordinaire (PAS 'use server') : partage par les actions et les ecrans.

export const MOTIFS = [
  { valeur: 'conge',     libelle: 'Congé' },
  { valeur: 'maladie',   libelle: 'Maladie' },
  { valeur: 'personnel', libelle: 'Personnel' },
  { valeur: 'formation', libelle: 'Formation' },
  { valeur: 'autre',     libelle: 'Autre' },
] as const

export type Motif = typeof MOTIFS[number]['valeur']

export function libelleMotif(motif: string): string {
  return MOTIFS.find(m => m.valeur === motif)?.libelle ?? motif
}

/** Decision d'une seance ; `a_decider` = aucune ligne en base. */
export type Decision = 'a_decider' | 'annulee' | 'remplacee'

const PHRASES_REFUS: Record<string, string> = {
  ABSENCE_REFUSEE:           'Votre rôle ne permet pas de gérer les absences des enseignants.',
  ABSENCE_PERIODE:           'La fin de l’absence doit suivre son début.',
  ABSENCE_MOTIF:             'Choisissez un motif.',
  ABSENCE_ENSEIGNANT:        'Enseignant introuvable dans cet établissement.',
  ABSENCE_ENSEIGNANT_FIGE:   'L’enseignant d’une absence ne change pas : supprimez-la et déclarez-en une autre.',
  ABSENCE_INTROUVABLE:       'Cette absence n’existe plus.',
  ABSENCE_CHEVAUCHEMENT:     'Cet enseignant a déjà une absence sur cette période : modifiez-la plutôt.',
  ABSENCE_SEANCE_VALIDEE:    'Une séance validée ne change pas : retirez d’abord la validation de présence.',
  ABSENCE_SEANCE_HORS:       'Cette séance n’est pas touchée par l’absence.',
  ABSENCE_SEANCE_ANNULEE:    'Cette séance est déjà annulée dans l’emploi du temps.',
  ABSENCE_DECISION:          'Décision invalide.',
  ABSENCE_REMPLACANT:        'Le remplaçant doit être un membre actif de l’équipe, autre que l’absent.',
  ABSENCE_REMPLACANT_OCCUPE: 'Ce remplaçant est déjà pris sur cet horaire.',
  // Validation d'une seance (`valider_seance`, `retirer_validation_seance`).
  VALIDATION_REFUSEE:         'Vous ne validez que les séances que vous assurez.',
  VALIDATION_SEANCE:          'Cette séance n’existe pas à cette date.',
  VALIDATION_FUTURE:          'Une séance à venir ne se valide pas.',
  VALIDATION_DEJA:            'Cette séance est déjà validée.',
  VALIDATION_ANNULEE:         'Une séance annulée ne se valide pas.',
  VALIDATION_A_DECIDER:       'L’enseignant est absent et rien n’est décidé pour cette séance : réglez d’abord l’absence.',
  VALIDATION_SANS_ENSEIGNANT: 'Personne n’assure cette séance, ou l’enseignant n’a pas de compte : sa présence ne peut pas être validée.',
  VALIDATION_TYPE:            'Aucun type de présence n’est associé à ce type de séance : configurez-le dans Paramètres, Types de présence.',
  VALIDATION_INTROUVABLE:     'Cette séance n’est pas validée.',
}

/** Phrase d'un refus, suivie de la seance en cause (« CE1 · 04/11/2026 · 14:00-16:00 »). */
export function phraseRefusAbsence(error: { message?: string; details?: string | null }, defaut: string): string {
  const phrase = PHRASES_REFUS[error.message ?? '']
  // Refus d'une autre garde de la base, deja redige en phrase (chevauchement de
  // saisies d'heures) : il dit mieux que le message par defaut.
  if (!phrase) return error.message && /\s/.test(error.message) ? error.message : defaut
  return error.details ? `${phrase} (${error.details})` : phrase
}
