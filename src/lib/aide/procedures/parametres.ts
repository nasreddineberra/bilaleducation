import type { Procedure } from '../types.ts'

// Ecrans de Parametres : components/annee-scolaire/, utilisateurs/, teachers/,
// classes/, cours/, types-presence/, ressources/, audit-logs/. A relire a chaque
// modification de ces fichiers.

export const anneesScolaires: Procedure = {
  slug: 'annees-scolaires',
  titre: 'Années scolaires',
  module: 'Paramètres',
  ecrans: ['/dashboard/annee-scolaire', '/dashboard/annee-scolaire/*'],
  roles: ['direction'],
  acces: 'Paramètres · Années scolaires',
  resume:
    "Le calendrier de chaque année : dates, découpage en trimestres ou semestres, types d'évaluation, vacances et jours fériés. "
    + "Une seule année est « en cours » : c'est sur elle que travaille toute l'application.",

  taches: [
    {
      titre: 'Créer l’année scolaire',
      etapes: [
        'Cliquez sur « Nouvelle année ».',
        'Renseignez l’« Année scolaire » au format AAAA-AAAA (par exemple 2026-2027), la « Date de rentrée » et la « Date de fin d’année ».',
        'Choisissez la « Répartition » : « Trimestriel » (T1, T2, T3) ou « Semestriel » (S1, S2).',
        'Choisissez les types d’évaluation utilisés : « Notée sur 10 », « Notée sur 20 », « Étoilée » (0 à 5 étoiles), ou « Diagnostique » (avec vos propres acronymes, par exemple AC pour Acquis).',
        'Cochez « Année en cours » si c’est l’année qui commence.',
        'Cliquez sur « Valider ».',
      ],
      aSavoir: [
        'Une seule année peut être en cours : décochez d’abord l’ancienne sur sa fiche.',
        'La répartition des périodes et les types d’évaluation se verrouillent dès que des notes ou des gabarits les utilisent.',
      ],
    },
    {
      titre: 'Déclarer les vacances et les jours fériés',
      etapes: [
        'Ouvrez la fiche de l’année, encadré « Vacances et jours fériés », puis cliquez sur « Gérer ».',
        'Dans le calendrier, cliquez sur les semaines à marquer en vacances, puis nommez la période (par exemple Vacances de Toussaint).',
        'Ajoutez les jours fériés avec leur date et leur libellé.',
        'Fermez la fenêtre, puis enregistrez la fiche.',
      ],
      aSavoir: [
        'Aucune séance de l’emploi du temps n’a lieu pendant les vacances et les jours fériés.',
      ],
    },
    {
      titre: 'Indiquer la période en cours',
      etapes: [
        'Ouvrez la fiche de l’année en cours, encadré « Période en cours ».',
        'Choisissez le trimestre ou le semestre en cours, puis validez.',
      ],
    },
    {
      titre: 'Modifier ou supprimer une année',
      etapes: [
        'Dans la liste, cliquez sur le crayon pour ouvrir la fiche, modifiez, puis cliquez sur « Modifier ».',
        'Une année sans données d’évaluation peut être supprimée avec la corbeille.',
      ],
      aSavoir: [
        'Une année close, archivée ou purgée s’ouvre en lecture seule. La purge se lance depuis sa fiche (voir Audits & Passage d’année).',
      ],
    },
  ],

  voirAussi: ['passage-annee', 'gabarits-evaluations'],
}

export const utilisateurs: Procedure = {
  slug: 'utilisateurs',
  titre: 'Utilisateurs',
  module: 'Paramètres',
  ecrans: ['/dashboard/utilisateurs', '/dashboard/utilisateurs/*'],
  roles: ['direction'],
  acces: 'Paramètres · Utilisateurs',
  resume:
    "Les comptes de l'équipe qui n'ont pas de fiche métier : direction, secrétariat, comptabilité, responsable pédagogique. "
    + 'Les enseignants se créent depuis leur fiche Enseignants.',

  taches: [
    {
      titre: 'Comptes parents (espace famille)',
      option: 'espace_famille',
      etapes: [
        'Onglet « Parents » : les accès des familles, leurs invitations et leur statut. Voir la procédure « Comptes parents (espace famille) ».',
      ],
    },
    {
      titre: 'Créer un compte',
      etapes: [
        'Cliquez sur « Ajouter ».',
        'Renseignez la « Civilité », le « Nom », le « Prénom », le « Rôle », le « Téléphone » et l’« Email ».',
        'Cliquez sur « Valider ». La personne reçoit un email pour définir son mot de passe (lien valable 1 heure).',
      ],
      aSavoir: [
        'Si l’email ne part pas, un mot de passe temporaire s’affiche : transmettez-le à la personne.',
        'À sa première connexion, la personne doit activer la double authentification (une application d’authentification sur son téléphone).',
      ],
    },
    {
      titre: 'Aider une personne qui ne peut plus se connecter',
      etapes: [
        'Ouvrez son compte.',
        'Mot de passe oublié : cliquez sur « Envoyer un lien par email pour réinitialiser ».',
        'Téléphone perdu ou changé : dans « Double authentification (2FA) », cliquez sur « Réinitialiser ». Elle en configurera une nouvelle à sa prochaine connexion.',
      ],
    },
    {
      titre: 'Désactiver ou supprimer un compte',
      etapes: [
        'Pour désactiver : ouvrez le compte, passez le statut en inactif, puis cliquez sur « Modifier ». La personne ne peut plus se connecter.',
        'Pour supprimer : cliquez sur la corbeille. Un compte sans données se supprime après avoir retapé son nom ; sinon, la fenêtre propose « Rendre inactif ».',
      ],
    },
  ],

  voirAussi: ['enseignants', 'mise-en-route', 'comptes-parents'],
}

// Espace famille (option payante) : meme ecran, onglet « Parents ». La direction
// lit d'abord « Utilisateurs » (premiere procedure de l'ecran) ; la secretaire et
// le responsable pedagogique, qui n'ont que cet onglet, lisent celle-ci.
export const comptesParents: Procedure = {
  slug: 'comptes-parents',
  titre: 'Comptes parents (espace famille)',
  module: 'Paramètres',
  ecrans: ['/dashboard/utilisateurs'],
  roles: ['direction', 'secretaire', 'responsable_pedagogique'],
  option: 'espace_famille',
  acces: 'Paramètres · Utilisateurs · onglet « Parents »',
  resume:
    'Les accès des familles à l’espace famille : inviter les tuteurs, suivre qui a configuré son accès, renvoyer une invitation, couper un accès.',

  taches: [
    {
      titre: 'Inviter les familles',
      etapes: [
        'Onglet « Parents », cliquez sur « Inviter les familles ».',
        'Choisissez les tuteurs à inviter avec leur interrupteur, ou cliquez sur « Tout sélectionner ».',
        'Cliquez sur « Envoyer les invitations ». Chaque tuteur reçoit un email de l’établissement avec le bouton « Activer mon accès ».',
      ],
      aSavoir: [
        'Un tuteur qui a déjà configuré son accès est coché et verrouillé. Un tuteur sans email, ou dont l’accès est désactivé, est verrouillé.',
        'Le lien d’invitation est valable 7 jours et ne sert qu’une fois. Le tuteur choisit lui-même son mot de passe.',
        'À la fin de l’envoi, les invitations qui n’ont pas pu partir sont listées avec la raison.',
      ],
    },
    {
      titre: 'Renvoyer une invitation',
      etapes: [
        'Dans la liste, repérez le tuteur (statut « Invité le ... » ou « Invitation expirée »).',
        'Cliquez sur « Renvoyer l’invitation ». L’ancien lien ne fonctionne plus.',
      ],
    },
    {
      titre: 'Désactiver ou réactiver l’accès d’un parent',
      roles: ['direction'],
      etapes: [
        'Dans la liste, cliquez sur « Désactiver », puis confirmez. L’espace famille lui est fermé immédiatement.',
        'Pour le rouvrir, cliquez sur « Réactiver ».',
      ],
    },
  ],

  regles: [
    { texte: 'Statuts : « Invité le ... » (invitation en cours), « Invitation expirée », « Accès en ligne » (mot de passe choisi), « Désactivé ».' },
    { texte: 'Les familles sont prévenues par email et par une notification dans leur espace ; rien ne part automatiquement pour un bulletin : un message se rédige dans Communications.' },
  ],

  grise: [
    {
      roles: ['secretaire', 'responsable_pedagogique'],
      element: '« Désactiver » / « Réactiver »',
      raison: 'Couper ou rouvrir l’accès d’une famille est réservé à la direction.',
      solution: 'Demandez-le à la direction.',
    },
  ],

  voirAussi: ['parents', 'utilisateurs'],
}

export const enseignants: Procedure = {
  slug: 'enseignants',
  titre: 'Enseignants',
  module: 'Paramètres',
  ecrans: ['/dashboard/teachers', '/dashboard/teachers/*'],
  roles: ['direction', 'secretaire'],
  acces: 'Paramètres · Enseignants',
  resume:
    "La fiche de chaque enseignant : identité, contact, documents, et son assiduité (heures assurées, absences, remplacements). "
    + 'Créer la fiche crée aussi son compte de connexion.',

  taches: [
    {
      titre: 'Créer un enseignant',
      etapes: [
        'Cliquez sur « Ajouter ».',
        'Renseignez la « Civilité », le « Nom », le « Prénom », la « Date d’embauche », l’« Email », le « Téléphone » et la « Spécialisation ». Le « N° employé » est proposé automatiquement.',
        'Cliquez sur « Valider ». Son compte de connexion (rôle enseignant) est créé et un email lui est envoyé pour définir son mot de passe.',
      ],
      aSavoir: [
        'Si l’email ne part pas, le mot de passe temporaire s’affiche une seule fois : copiez-le et transmettez-le.',
        'Un enseignant de même nom et prénom existe déjà : la création est refusée.',
        'L’enseignant devient titulaire d’une classe depuis la fiche classe.',
      ],
    },
    {
      titre: 'Consulter et compléter une fiche',
      etapes: [
        'Cliquez sur la ligne de l’enseignant.',
        '« Identité » : modifiez, puis cliquez sur « Modifier ». Vous restez sur la fiche.',
        '« Documents » : « Ajouter un document » (catégorie, libellé, date d’expiration facultative, fichier de 1 Mo au plus).',
        '« Assiduité » : heures assurées par mois, absences de l’année et remplacements assurés.',
      ],
    },
    {
      roles: ['direction'],
      titre: 'Supprimer un enseignant',
      etapes: [
        'Cliquez sur la corbeille de sa ligne.',
        'Une fiche sans données se supprime avec son compte ; sinon, la fenêtre liste ce qui bloque et propose « Rendre inactif » (son compte est alors désactivé).',
      ],
    },
  ],

  voirAussi: ['classes', 'absences-enseignants'],
}

export const classes: Procedure = {
  slug: 'classes',
  titre: 'Classes',
  module: 'Paramètres',
  ecrans: ['/dashboard/classes', '/dashboard/classes/*'],
  roles: ['direction', 'responsable_pedagogique', 'secretaire'],
  acces: 'Paramètres · Pédagogie · Param. classes',
  resume:
    "Les classes de l'année : salle, effectif, cotisation, titulaire et créneaux réguliers de l'emploi du temps.",

  taches: [
    {
      titre: 'Créer une classe',
      etapes: [
        'Cliquez sur « Ajouter ».',
        'Renseignez le « Nom de la classe », le « Niveau », l’« Année scolaire », la « Salle de la classe », la « Capacité max » et le « Type de cotisation ».',
        'Cliquez sur « Valider ». Vous revenez à la liste.',
      ],
      aSavoir: [
        'Le type de cotisation décide du montant dû par les familles ; un type « Cours adultes » fait de la classe un cours adulte.',
        'La salle et le type de cotisation doivent exister avant (Ressources, Cotisations).',
      ],
    },
    {
      titre: 'Nommer ou changer le titulaire',
      etapes: [
        'Ouvrez la fiche classe, encadré « Enseignant ».',
        'Cliquez sur « Affecter un titulaire », choisissez l’enseignant et la date « À compter du », puis « Valider ».',
        'Pour un changement en cours d’année, indiquez le dernier jour de l’ancien titulaire : l’historique garde « initial puis remplaçant ».',
      ],
      aSavoir: [
        'L’absence ponctuelle d’un enseignant ne se règle pas ici, mais dans Absences enseignants. L’encadré « Remplacements » en garde la trace.',
      ],
    },
    {
      titre: 'Définir les créneaux de l’emploi du temps',
      etapes: [
        'Dans « Planning EDT », cliquez sur « Ajouter ».',
        'Choisissez le « Type de créneau » (« Cours », avec sa « Matière », ou « Activité », avec son nom), le « Jour », le « Début », la « Fin » et la « Salle ».',
        'Indiquez « À partir du » (par défaut la rentrée) et, si besoin, « Jusqu’au » (par défaut la fin d’année).',
        'Validez, puis enregistrez la fiche avec « Modifier ».',
      ],
      aSavoir: [
        'Un créneau revient chaque semaine dans l’emploi du temps, hors vacances et jours fériés.',
        'Modifier ou supprimer un créneau en cours d’année demande une « Date d’effet » : les séances passées et validées ne changent pas.',
        '« Même salle pour tous les créneaux » aligne les créneaux sur la salle de la classe.',
      ],
    },
    {
      titre: 'Supprimer une classe',
      etapes: [
        'Retirez d’abord les élèves affectés (Affectations).',
        'Cliquez sur la corbeille, lisez ce qui sera supprimé, puis retapez le nom de la classe pour confirmer.',
      ],
    },
  ],

  voirAussi: ['affectations', 'emploi-du-temps', 'cotisations'],
}

export const referentielCours: Procedure = {
  slug: 'referentiel-cours',
  titre: 'Référentiel des cours',
  module: 'Paramètres',
  ecrans: ['/dashboard/cours'],
  roles: ['direction', 'responsable_pedagogique'],
  acces: 'Paramètres · Pédagogie · Référentiel cours',
  resume:
    "Ce qui s'enseigne, en trois niveaux : unités d'enseignement (les matières), modules, et cours. "
    + 'Les unités servent de matière aux créneaux de l’emploi du temps ; les cours servent aux évaluations.',

  taches: [
    {
      titre: 'Construire le référentiel',
      etapes: [
        'Cliquez sur « Ajouter une unité » et renseignez son « Nom (FR) » (et si besoin son « Nom (AR) »).',
        'Sélectionnez l’unité, puis ajoutez ses modules et ses cours (un cours peut aussi se rattacher directement à l’unité).',
        'Faites glisser une ligne par sa poignée pour régler l’ordre d’affichage.',
      ],
      aSavoir: [
        'L’ordre du référentiel est celui des bulletins.',
      ],
    },
    {
      titre: 'Modifier ou supprimer',
      etapes: [
        'Utilisez le crayon ou la corbeille de la ligne.',
      ],
      aSavoir: [
        'Une unité qui contient des modules ou des cours, ou qui sert de matière à un créneau, ne se supprime pas : videz-la ou changez le créneau d’abord.',
        'La suppression d’un cours encore utilisé dans des évaluations est signalée avant confirmation.',
      ],
    },
  ],

  voirAussi: ['classes', 'gabarits-evaluations'],
}

export const typesPresence: Procedure = {
  slug: 'types-presence',
  titre: 'Types de présence',
  module: 'Paramètres',
  ecrans: ['/dashboard/types-presence'],
  roles: ['direction'],
  acces: 'Paramètres · Types de présence',
  resume:
    'Les catégories d’heures du personnel (réunion, permanence, surveillance...) utilisées dans Temps de présence, chacune avec un code et une couleur.',

  taches: [
    {
      titre: 'Préparer les types de l’année',
      etapes: [
        'Pour reprendre ceux de l’an dernier, cliquez sur « Copier depuis » l’année précédente.',
        'Sinon, cliquez sur « Ajouter », renseignez le libellé, le « Code (3 car.) » et la « Couleur », puis validez.',
      ],
      aSavoir: [
        'ABSENCE, COURS et ACTIVITÉ sont des types réservés, reconduits chaque année : seule leur couleur se modifie.',
        'Le taux horaire de chaque type se règle dans Paramètres · Cotisations.',
      ],
    },
    {
      titre: 'Modifier ou supprimer un type',
      etapes: [
        'Utilisez le crayon ou la corbeille de la ligne.',
      ],
    },
  ],

  voirAussi: ['temps-presence', 'cotisations'],
}

export const ressources: Procedure = {
  slug: 'ressources',
  titre: 'Ressources',
  module: 'Paramètres',
  ecrans: ['/dashboard/ressources'],
  roles: ['direction'],
  acces: 'Paramètres · Ressources',
  resume: "Les salles de l'établissement et le matériel.",

  taches: [
    {
      titre: 'Déclarer les salles',
      etapes: [
        'Dans « Salles », cliquez sur « Ajouter ».',
        'Renseignez le nom, le type (salle de cours, informatique, réunion, sport), la capacité et l’étage, puis validez.',
      ],
      aSavoir: [
        'Les salles servent aux classes et aux séances de l’emploi du temps : déclarez-les avant de créer les classes.',
      ],
    },
    {
      titre: 'Inventorier le matériel',
      etapes: [
        'Dans « Matériels », cliquez sur « Ajouter ».',
        'Renseignez le nom, la catégorie, la quantité, l’état, la salle, et si besoin la date d’achat et le n° de série, puis validez.',
      ],
    },
  ],

  voirAussi: ['classes'],
}

export const journalActivite: Procedure = {
  slug: 'journal-activite',
  titre: 'Journal d’activité',
  module: 'Paramètres',
  ecrans: ['/dashboard/logs'],
  roles: ['direction'],
  acces: 'Paramètres · Journal d’activité',
  resume:
    "La trace des créations, modifications, suppressions et connexions de l'équipe : qui a fait quoi, et quand.",

  taches: [
    {
      titre: 'Rechercher une action',
      etapes: [
        'Filtrez par utilisateur, type d’action (« Création », « Modification », « Suppression », « Connexion », « Déconnexion ») et donnée concernée.',
        'Lisez le détail sur chaque ligne ; « Réinitialiser » efface les filtres.',
      ],
    },
    {
      titre: 'Purger le journal',
      etapes: [
        'Cliquez sur « Purger le journal ».',
        'Choisissez la « Durée de conservation » (ce qui est plus ancien sera supprimé), ou « Tout supprimer ».',
        'Confirmez. La suppression est définitive.',
      ],
    },
  ],
}
