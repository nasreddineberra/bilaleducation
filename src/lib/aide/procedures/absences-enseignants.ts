import type { Procedure, RoleAide } from '../types.ts'

// Ecrans : components/absences-enseignants/ (liste, AbsenceFormModal, fiche
// AbsenceDetailClient, CasePrevenir). A relire a chaque modification.

/** Declarent et decident ; l'enseignant et le comptable lisent seulement. */
const GESTION: RoleAide[] = ['direction', 'responsable_pedagogique', 'secretaire']

export const absencesEnseignants: Procedure = {
  slug: 'absences-enseignants',
  titre: 'Absences enseignants',
  module: 'Gestion',
  ecrans: ['/dashboard/absences-enseignants', '/dashboard/absences-enseignants/*'],
  roles: [...GESTION, 'enseignant', 'comptable'],
  acces: 'Gestion · Absences enseignants',
  resume:
    "Le seul écran où se déclarent les absences des enseignants. Pour chaque séance de cours touchée, on décide : "
    + 'remplacée par un membre de l’équipe, annulée, ou encore à décider.',

  taches: [
    {
      titre: 'Consulter les absences',
      etapes: [
        'Choisissez « en cours et à venir », « passées » ou « au total ».',
        'Cliquez sur une absence pour ouvrir sa fiche : enseignant, période, motif, et les séances touchées avec leur décision.',
      ],
      aSavoir: [
        'Le nombre de séances « à décider » s’affiche sur chaque ligne.',
      ],
    },
    {
      roles: GESTION,
      titre: 'Déclarer une absence',
      etapes: [
        'Cliquez sur « Déclarer une absence ».',
        'Choisissez l’« Enseignant ».',
        'Activez « Journée entière » pour des journées complètes ; sinon, précisez les heures (« À partir de », « Jusqu’à »).',
        'Renseignez les dates « Du » et « Au », et le « Motif » (congé, maladie, personnel, formation, autre).',
        'Cliquez sur « Valider ». La fiche de l’absence s’ouvre avec les séances touchées.',
      ],
      aSavoir: [
        'Une séance est touchée dès qu’elle chevauche l’absence, même d’une minute.',
      ],
    },
    {
      roles: GESTION,
      titre: 'Décider du sort de chaque séance',
      etapes: [
        'Dans la fiche de l’absence, chaque séance touchée a sa carte, avec un choix « Décision » : « À décider », « Annulée », ou « Remplacée par » un membre de l’équipe.',
        'Pour aller vite, utilisez « Même décision pour ce créneau » (toutes les séances d’un même cours) ou « Même décision pour toutes ».',
        'La couleur de la carte suit la décision choisie : à décider, annulée, remplacée, validée.',
        'Cliquez sur « Enregistrer ».',
        'Si des séances à venir sont annulées, rétablies ou remplacées, une fenêtre « Prévenir les familles » s’ouvre : cochez les annonces à envoyer, puis cliquez sur « Enregistrer ».',
      ],
      aSavoir: [
        'Un membre déjà pris sur le même horaire est grisé, avec la raison (« pris : ... »).',
        'Les familles d’une séance annulée sont prévenues par défaut ; celles d’un remplacement, seulement si vous cochez la case.',
        'Les heures de la séance sont comptées au remplaçant, quand il valide la séance.',
        'La date d’envoi s’affiche ensuite sur la carte : « Familles prévenues le ».',
      ],
    },
    {
      roles: GESTION,
      titre: 'Modifier ou supprimer une absence',
      etapes: [
        'Dans la fiche, cliquez sur « Modifier » pour changer les dates, les heures ou le motif, puis sur « Modifier ».',
        'Pour la supprimer, cliquez sur « Supprimer », puis confirmez. Ses séances redeviennent des séances ordinaires, assurées par le titulaire.',
      ],
      aSavoir: [
        'Si des séances annoncées annulées ont lieu finalement (période réduite ou absence supprimée), une case propose de prévenir les familles qu’elles ont bien lieu.',
      ],
    },
  ],

  regles: [
    { texte: 'Le motif d’une absence est visible de tout le personnel, jamais des familles.' },
    { texte: 'Une séance déjà validée ne change plus de décision : retirez d’abord la validation de présence dans l’emploi du temps.' },
    { roles: GESTION, texte: 'Une séance laissée « À décider » apparaît en tête de « À traiter » sur le tableau de bord.' },
  ],

  grise: [
    {
      roles: GESTION,
      element: 'Les cases « Prévenir les familles » sont grisées',
      raison: 'La messagerie de l’établissement n’est pas configurée.',
      solution: 'La direction la configure dans Paramètres · Établissement, encadré « Messagerie ».',
    },
    {
      roles: GESTION,
      element: 'La décision d’une séance ne se change pas',
      raison: 'La séance est « Validée ».',
      solution: 'Retirez d’abord la validation de présence dans l’emploi du temps.',
    },
  ],

  voirAussi: ['etablissement'],
}
