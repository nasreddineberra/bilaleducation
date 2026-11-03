import type { Procedure, RoleAide } from '../types.ts'

// Ecrans : components/absences/AbsencesClient.tsx (feuille d'appel enfants et
// adultes), components/cahier-texte/, components/emploi-du-temps/,
// components/temps-presence/. A relire a chaque modification de ces fichiers.

/** Encadrement pedagogique : gere l'EDT et cree pour le compte d'un enseignant. */
const ENCADREMENT: RoleAide[] = ['direction', 'responsable_pedagogique']

export const feuilleAppel: Procedure = {
  slug: 'feuille-appel',
  titre: 'Feuille d’appel',
  module: 'Vie scolaire',
  ecrans: ['/dashboard/absences', '/dashboard/absences/adultes'],
  roles: [...ENCADREMENT, 'secretaire', 'enseignant'],
  acces: 'Vie scolaire · Feuille d’appel · Apprenants ou Adultes',
  resume:
    "Faire l'appel d'une séance, suivre les absences et retards par classe et par élève, et justifier les absences.",

  taches: [
    {
      titre: 'Faire l’appel d’une séance',
      etapes: [
        'Choisissez la « Classe », puis la période (trimestre ou semestre).',
        'Cliquez sur « Ajouter » : la feuille d’appel s’ouvre à la date du jour (modifiable avec « Date »).',
        'Tous les élèves sont présents au départ. Cliquez sur la photo d’un élève pour le passer « Absent », puis « Retard », puis de nouveau présent.',
        'Ajoutez si besoin un commentaire à une absence ou un retard, dans la colonne de droite.',
        'Cliquez sur « Valider » (ou « Modifier » si l’appel de cette date existait déjà).',
      ],
      aSavoir: [
        'Pour une classe d’enfants, les familles sont prévenues par email de chaque nouvelle absence ou retard.',
        'Une feuille déjà enregistrée s’imprime avec « Imprimer la saisie ».',
        'La date ne peut pas être dans le futur.',
      ],
    },
    {
      titre: 'Imprimer une feuille vierge',
      etapes: [
        'Choisissez la classe, puis cliquez sur « Feuille vierge ». Le PDF s’ouvre dans un nouvel onglet, prêt à remplir à la main.',
      ],
    },
    {
      titre: 'Suivre les absences',
      etapes: [
        'Avec « Toutes les classes » (encadrement et secrétariat), le tableau compte les absences, absences non justifiées (NJ) et retards de chaque classe sur la période. « Ouvrir la classe » y mène.',
        'Dans une classe, le récapitulatif par élève liste ses absences et retards. Cliquez sur un élève pour voir le détail.',
      ],
      aSavoir: [
        'Un triangle orange signale un élève qui atteint 3 absences non justifiées sur la période.',
      ],
    },
    {
      titre: 'Justifier une absence',
      etapes: [
        'Dans le détail des absences de l’élève, cliquez sur « Justifier ».',
        'Renseignez la « Date de justification » et un « Commentaire » (certificat médical, mot des parents...).',
        'Joignez si besoin le justificatif (« Importer un justificatif » : PDF ou image, 5 Mo au plus).',
        'Cliquez sur « Valider ».',
      ],
      aSavoir: [
        '« Modifier » change la justification, « Retirer » l’annule, « Voir » ouvre le justificatif dans un nouvel onglet.',
        'La corbeille supprime l’absence ou le retard.',
      ],
    },
  ],

  regles: [
    { texte: 'Les absences reportées sur les bulletins viennent de la feuille d’appel.' },
    { texte: 'Les cours adultes ont leur propre feuille (Feuille d’appel · Adultes), sans email envoyé.' },
  ],

  voirAussi: ['apprenants', 'emploi-du-temps'],
}

export const cahierTexte: Procedure = {
  slug: 'cahier-texte',
  titre: 'Cahier de texte',
  module: 'Pédagogie',
  ecrans: ['/dashboard/cahier-texte'],
  roles: [...ENCADREMENT, 'enseignant'],
  acces: 'Pédagogie · Cahier de texte',
  resume:
    "Le journal des séances de chaque classe (ce qui a été fait) et les devoirs donnés, envoyés par email aux familles.",

  taches: [
    {
      titre: 'Consulter le cahier d’une classe',
      etapes: [
        'Choisissez la classe en haut de l’écran (l’encadrement peut afficher « Toutes les classes »).',
        'Onglet « Journal de séance » : les séances, de la plus récente à la plus ancienne. Onglet « Devoirs » : les devoirs et leur date de rendu.',
        'Utilisez la recherche pour retrouver une séance ou un devoir.',
        'Cliquez sur une séance ou un devoir pour l’ouvrir.',
      ],
    },
    {
      titre: 'Ajouter une séance',
      etapes: [
        'Choisissez une classe précise, onglet « Journal de séance », puis cliquez sur « Ajouter une séance ».',
        'La classe et l’enseignant sont remplis. La « Matière » se déduit de l’emploi du temps : à choisir seulement si la classe en a plusieurs.',
        'Renseignez la « Date de séance », le « Titre de la séance » et le « Contenu de la séance ».',
        'Cliquez sur « Valider ».',
      ],
    },
    {
      titre: 'Donner un devoir',
      etapes: [
        'Choisissez une classe précise, onglet « Devoirs », puis cliquez sur « Ajouter un devoir ».',
        'Choisissez le type (« Exercice », « Leçon à apprendre », « Exposé », « Autre »), le « Titre du devoir » et la « Date de rendu ».',
        'Rédigez les « Consignes ».',
        'Cliquez sur « Valider ». Les familles de la classe reçoivent le devoir par email (un message par foyer).',
      ],
      aSavoir: [
        'Dans le détail d’un devoir, « Suivi » indique pour chaque élève (ou participant adulte) si sa famille a vu le devoir et l’a marqué « Effectué », avec la date. Ce suivi se remplit depuis l’espace famille, quand il est ouvert.',
        'Après la date de rendu, « Effectué » ne peut plus être modifié.',
      ],
    },
    {
      titre: 'Modifier ou supprimer une séance ou un devoir',
      etapes: [
        'Ouvrez la séance ou le devoir, puis cliquez sur « Modifier » ou « Supprimer ».',
      ],
      aSavoir: [
        'Une séance se modifie ou se supprime pendant 7 jours après sa date.',
        'Un devoir se modifie ou se supprime jusqu’à sa date de rendu. Les familles sont prévenues par email d’une modification et d’une annulation.',
      ],
    },
  ],

  regles: [
    { roles: ['enseignant'], texte: 'Vous voyez les classes dont vous êtes titulaire, et celles où vous remplacez une séance (de 7 jours avant à 7 jours après).' },
  ],

  grise: [
    {
      element: '« Ajouter une séance » ou « Ajouter un devoir » est grisé',
      raison: 'L’affichage porte sur toutes les classes.',
      solution: 'Choisissez une classe précise.',
    },
    {
      element: '« Modifier » ou « Supprimer » est grisé',
      raison: 'La séance date de plus de 7 jours, ou la date de rendu du devoir est passée : elle appartient à l’historique.',
      solution: 'Aucune : l’historique ne se modifie plus.',
    },
  ],

  voirAussi: ['emploi-du-temps', 'feuille-appel'],
}

export const emploiDuTemps: Procedure = {
  slug: 'emploi-du-temps',
  titre: 'Emploi du temps',
  module: 'Pédagogie',
  ecrans: ['/dashboard/emploi-du-temps'],
  roles: [...ENCADREMENT, 'enseignant'],
  acces: 'Pédagogie · Emploi du temps',
  resume:
    "Le planning des séances de la semaine, du jour ou du mois. On y valide les séances assurées, et l'encadrement y gère les séances ponctuelles, les annulations et les salles.",

  taches: [
    {
      titre: 'Lire le planning',
      etapes: [
        'Choisissez l’affichage : jour, semaine ou mois. Les flèches passent à la période précédente ou suivante ; le bouton du milieu revient à aujourd’hui.',
        'L’encadrement choisit « Par classe » ou « Par enseignant », puis la classe ou l’enseignant à afficher.',
        'Chaque séance montre la matière ou l’activité, l’enseignant et la salle. « Prof non affecté » (en rouge) signale une séance sans enseignant.',
      ],
      aSavoir: [
        'Une séance remplacée affiche « Remplacé par » ; une séance annulée, « ANNULÉ ».',
        'Les vacances et jours fériés sont grisés.',
      ],
    },
    {
      titre: 'Valider une séance assurée',
      etapes: [
        'Sur une séance du jour ou passée, cliquez sur la coche « Valider ma présence » (enseignant) ou « Valider la séance » (encadrement).',
        'La séance passe « Présence validée » : ses heures sont comptées dans le Temps de présence.',
        'Pour revenir en arrière, cliquez sur « Annuler ma validation » (ou « Annuler la validation »).',
      ],
      aSavoir: [
        'Une séance dont l’enseignant est absent sans décision ne peut pas être validée : la décision se prend dans Absences enseignants.',
        'Un remplaçant valide les séances qu’il assure : les heures sont à son nom.',
      ],
    },
    {
      roles: ENCADREMENT,
      titre: 'Agir sur une séance (annuler, changer la salle, réactiver)',
      etapes: [
        'Cliquez sur les trois points « Actions du créneau » de la séance.',
        'Choisissez « Annuler cette séance », « Changer la salle », « Réactiver la séance » (si elle était annulée) ou « Supprimer la séance » (séance ponctuelle seulement).',
        'Pour annuler ou supprimer, tapez le mot demandé (ANNULATION ou SUPPRESSION) pour confirmer.',
      ],
      aSavoir: [
        'Une séance touchée par une absence d’enseignant se règle depuis l’absence : le menu propose alors « Régler l’absence ».',
        '« Changer la salle » ne propose que les salles de cours libres sur ce créneau.',
        'Une séance validée ne s’annule pas : retirez d’abord la validation.',
        '« Ouvrir la fiche classe » mène aux créneaux réguliers de la classe.',
      ],
    },
    {
      roles: ENCADREMENT,
      titre: 'Ajouter une séance ponctuelle',
      etapes: [
        'Cliquez sur « Ajouter ».',
        'Choisissez le « Type de créneau » (« Cours » ou « Activité »), puis la « Matière » ou le « Nom de l’activité », la « Classe », la « Salle », la « Date », le « Début » et la « Fin ».',
        'Cliquez sur « Valider ».',
      ],
      aSavoir: [
        'Une date de vacances est signalée ; un conflit de classe ou de salle sur le même horaire aussi.',
        'Les créneaux qui reviennent chaque semaine ne se créent pas ici mais dans la fiche classe (Paramètres · Pédagogie · Param. classes).',
      ],
    },
  ],

  regles: [
    { roles: ['enseignant'], texte: 'Vous voyez votre planning et les séances que vous remplacez.' },
    { texte: 'Qui assure une séance se déduit à la date : le titulaire de la classe, sauf remplacement ou annulation décidés dans Absences enseignants.' },
  ],

  voirAussi: ['absences-enseignants', 'temps-presence', 'cahier-texte'],
}

export const tempsPresence: Procedure = {
  slug: 'temps-presence',
  titre: 'Temps de présence',
  module: 'Principal',
  ecrans: ['/dashboard/temps-presence'],
  roles: [...ENCADREMENT, 'secretaire', 'comptable', 'enseignant'],
  acces: 'Principal · Temps de présence',
  resume:
    "Les heures du personnel, jour par jour : heures de cours et d'activité (venues de l'emploi du temps), absences, et autres présences saisies à la main (réunion, permanence...).",

  taches: [
    {
      titre: 'Consulter les heures',
      etapes: [
        'Choisissez « Mois » ou « Semaine » et naviguez avec les flèches.',
        'Choisissez un « Membre » ou « Tous » (selon vos droits).',
        'Cliquez sur un jour pour voir ses saisies dans le panneau de droite, avec le total du jour.',
        '« Récap. mensuel » et « Récap. annuel » totalisent les heures par membre et par type ; « Exporter PDF » les imprime.',
      ],
      aSavoir: [
        'Les absences d’enseignants s’affichent en barres sur les jours concernés.',
      ],
    },
    {
      roles: ['direction', 'responsable_pedagogique', 'secretaire'],
      titre: 'Ajouter une saisie',
      etapes: [
        'Cliquez sur un jour, puis sur « Ajouter ».',
        'Choisissez le « Membre équipe » et le « Type » de présence.',
        'Renseignez le « Début » et la « Fin », et si besoin des « Notes ».',
        'Cliquez sur « Valider ».',
      ],
      aSavoir: [
        'Deux saisies d’une même personne ne peuvent pas se chevaucher le même jour.',
        'Le responsable pédagogique saisit pour les enseignants et pour lui-même.',
      ],
    },
    {
      roles: ['direction', 'responsable_pedagogique', 'secretaire'],
      titre: 'Corriger ou supprimer une saisie',
      etapes: [
        'Dans le panneau du jour, cliquez sur le crayon de la saisie pour la modifier, ou sur la corbeille pour la supprimer.',
      ],
    },
  ],

  regles: [
    { texte: 'Les heures de cours et d’activité ne se saisissent pas ici : elles naissent de la validation de la séance dans l’emploi du temps, et ne se modifient pas dans cet écran.' },
    { texte: 'Les absences d’enseignants se déclarent dans Absences enseignants.' },
    { roles: ['direction', 'comptable'], texte: 'Le coût se calcule avec les taux horaires de l’année (Paramètres · Cotisations).' },
    { roles: ['enseignant'], texte: 'Vous voyez vos propres heures et leur coût. Vos heures de cours viennent de la validation de vos séances dans l’emploi du temps.' },
    { roles: ['comptable'], texte: 'Vous consultez les heures et les coûts, sans saisir.' },
  ],

  grise: [
    {
      roles: ['direction', 'responsable_pedagogique', 'secretaire'],
      element: '« Ajouter » est grisé',
      raison: 'Aucun type de présence ne se saisit à la main : cours et activités viennent de l’emploi du temps.',
      solution: 'Créez un type de présence libre (réunion, permanence...) dans Paramètres · Types de présence.',
    },
  ],

  voirAussi: ['emploi-du-temps', 'absences-enseignants', 'cotisations'],
}
