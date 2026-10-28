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
}

/** Phrase d'un refus, suivie de la seance en cause (« CE1 · 04/11/2026 · 14:00-16:00 »). */
export function phraseRefusAbsence(error: { message?: string; details?: string | null }, defaut: string): string {
  const phrase = PHRASES_REFUS[error.message ?? '']
  if (!phrase) return defaut
  return error.details ? `${phrase} (${error.details})` : phrase
}
