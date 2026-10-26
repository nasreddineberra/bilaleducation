// Refus des RPC de depart, de reglage et de decision
// (`add-depart-en-cours-annee.sql`) : la base leve un CODE en `message` (le SQL
// du projet reste en ASCII), l'ecran affiche la phrase francaise.
//
// Module ordinaire (PAS 'use server') : partage par plusieurs fichiers d'actions.

const PHRASES_REFUS: Record<string, string> = {
  DEPART_REFUSE:          'Votre rôle ne permet pas cette action.',
  DEPART_SANS_ANNEE:      'Aucune année scolaire en cours.',
  DEPART_ANNEE_CLOSE:     'L’année scolaire est close.',
  DEPART_DATE_HORS_ANNEE: 'La date de départ doit être comprise entre la rentrée et la fin de l’année scolaire.',
  DEPART_SANS_CLASSE:     'Aucune classe cette année.',
  DEPART_SANS_DONNEES:    'Aucune note ni absence : le retrait se fait depuis Affectations.',
  REGLE_REFUSEE:          'Votre rôle ne permet pas de modifier ce réglage.',
  DECISION_REFUSEE:       'Ce départ n’attend pas de décision, ou son année est close.',
}

export function phraseRefus(error: { message?: string }, defaut: string): string {
  return PHRASES_REFUS[error.message ?? ''] ?? defaut
}
