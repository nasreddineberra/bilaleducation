import type { Procedure, RoleAide } from '../types.ts'

// Ecrans : tableau de bord, notifications, communications, Mon compte, support,
// importation, classes archivees. A relire a chaque modification de ces ecrans
// (components/dashboard/, notifications/, communications/, mon-compte/, support/,
// import/, historique/).

const PERSONNEL: RoleAide[] = ['direction', 'responsable_pedagogique', 'secretaire', 'comptable', 'enseignant']

export const tableauDeBord: Procedure = {
  slug: 'tableau-de-bord',
  titre: 'Tableau de bord',
  module: 'Principal',
  ecrans: ['/dashboard'],
  roles: PERSONNEL,
  acces: 'Principal · Tableau de bord',
  resume:
    "La page d'accueil, propre à chaque rôle : les chiffres utiles du moment et, dans « À traiter », ce qui attend une action.",

  taches: [
    {
      titre: 'Lire son tableau de bord',
      etapes: [
        'En haut, la date et la période en cours.',
        '« À traiter » liste ce qui attend une action ; cliquez sur une ligne pour ouvrir l’écran concerné.',
        'Les autres encadrés résument l’activité (effectifs, absences, notes, règlements, selon votre rôle).',
      ],
      aSavoir: [
        'Une ligne surlignée en orange en tête de « À traiter » est urgente, par exemple des séances d’absence d’enseignant encore à décider.',
        'Sur ordinateur, l’icône plein écran de la barre du haut agrandit l’application.',
      ],
    },
  ],
}

export const notifications: Procedure = {
  slug: 'notifications',
  titre: 'Notifications',
  module: 'Principal',
  ecrans: ['/dashboard/notifications', '/dashboard/notifications/*'],
  roles: PERSONNEL,
  acces: 'Principal · Notifications (ou la cloche de la barre du haut)',
  resume: "Les messages reçus dans l'application, par exemple ceux envoyés à l'équipe avec le canal Notification.",

  taches: [
    {
      titre: 'Lire ses notifications',
      etapes: [
        'Le nombre de notifications non lues s’affiche sur la cloche de la barre du haut.',
        'Filtrez par statut (« Non lues ») ou par type, ou cherchez un mot.',
        'Cliquez sur une notification pour la lire en entier, pièces jointes comprises.',
      ],
      aSavoir: [
        'Supprimer une notification la retire de votre liste seulement : le message reste dans l’historique de son expéditeur.',
      ],
    },
  ],
}

export const messageParents: Procedure = {
  slug: 'message-parents',
  titre: 'Message aux parents',
  module: 'Gestion',
  ecrans: ['/dashboard/communications/new'],
  roles: ['direction', 'responsable_pedagogique', 'secretaire'],
  acces: 'Gestion · Communications · Message aux parents',
  resume: 'Écrire aux familles par email : toutes, une classe, ou une sélection. Un email par foyer.',

  taches: [
    {
      titre: 'Envoyer un message aux familles',
      etapes: [
        'Choisissez les « Destinataires » : « Parents (élèves inscrits) », « Parents d’une classe » (choisissez la « Classe »), « Parents choisis » (cochez les familles), ou « Tous les contacts » (anciennes familles comprises, à utiliser avec discernement).',
        'Renseignez l’« Objet » et rédigez le « Message ».',
        'Ajoutez si besoin des pièces jointes (« Ajouter un document », 1 Mo au total).',
        'Cliquez sur « Aperçu » pour relire le message et la liste des destinataires.',
        'Cliquez sur « Envoyer », puis confirmez.',
      ],
      aSavoir: [
        'Les familles répondent à l’email de contact de l’établissement ; la direction reçoit une copie cachée.',
        'Une famille sans adresse email est signalée : elle ne recevra rien.',
        'Le message est ensuite consultable dans Messages envoyés.',
      ],
    },
  ],

  grise: [
    {
      element: '« Envoyer » est grisé ou l’envoi est refusé',
      raison: 'Aucun destinataire n’est choisi, le message est vide, ou la messagerie de l’établissement (ou son email de contact) n’est pas configurée.',
      solution: 'Complétez le message ; pour la messagerie, la direction la configure dans Paramètres · Établissement.',
    },
  ],

  voirAussi: ['messages-envoyes', 'etablissement'],
}

export const messageEquipe: Procedure = {
  slug: 'message-equipe',
  titre: 'Message à l’équipe',
  module: 'Gestion',
  ecrans: ['/dashboard/communications/staff'],
  roles: ['direction', 'responsable_pedagogique', 'secretaire', 'comptable'],
  acces: 'Gestion · Communications · Message à l’équipe',
  resume: "Écrire aux membres de l'équipe, par email, par notification dans l'application, ou les deux.",

  taches: [
    {
      titre: 'Envoyer un message à l’équipe',
      etapes: [
        'Choisissez le « Canal » : « Email », « Notification » ou « Les deux ».',
        'Cochez les destinataires (« Tous » coche toute l’équipe).',
        'Renseignez l’« Objet », le « Message » et si besoin les pièces jointes (envoyées seulement par email, 1 Mo au total).',
        'Cliquez sur « Aperçu », puis sur « Envoyer » et confirmez.',
      ],
      aSavoir: [
        'Sans messagerie configurée, seul le canal « Notification » est possible.',
      ],
    },
  ],

  voirAussi: ['messages-envoyes', 'notifications'],
}

export const messagesEnvoyes: Procedure = {
  slug: 'messages-envoyes',
  titre: 'Messages envoyés',
  module: 'Gestion',
  // `/*` couvre la fiche d'un message ; `new` et `staff` ont leur procedure,
  // placee AVANT celle-ci dans le registre (la premiere qui couvre l'emporte).
  ecrans: ['/dashboard/communications', '/dashboard/communications/*'],
  roles: PERSONNEL,
  acces: 'Gestion · Communications · Messages envoyés',
  resume: "L'historique des messages envoyés aux familles et à l'équipe, et des emails de devoirs.",

  taches: [
    {
      titre: 'Retrouver un message',
      etapes: [
        'Cherchez par objet, ou filtrez par ciblage et par classe.',
        'Cliquez sur un message pour voir son contenu, ses pièces jointes et ses destinataires.',
      ],
    },
  ],

  regles: [
    { roles: ['enseignant'], texte: 'Vous communiquez avec les familles par les devoirs du cahier de texte, envoyés par email.' },
  ],

  voirAussi: ['message-parents', 'message-equipe'],
}

export const monCompte: Procedure = {
  slug: 'mon-compte',
  titre: 'Mon compte',
  module: 'Principal',
  ecrans: ['/dashboard/mon-compte'],
  roles: PERSONNEL,
  acces: 'Votre nom, en haut à droite',
  resume: 'Vos informations personnelles, votre adresse de connexion, votre mot de passe et la double authentification.',

  taches: [
    {
      titre: 'Modifier ses informations ou son mot de passe',
      etapes: [
        'Dans « Mes informations », corrigez civilité, nom, prénom ou téléphone, puis cliquez sur « Enregistrer ».',
        'Pour changer d’adresse de connexion : « Changer l’email », puis confirmez. Une alerte part vers l’ancienne adresse.',
        'Pour changer de mot de passe : saisissez le « Nouveau mot de passe » deux fois, puis « Changer le mot de passe ».',
      ],
      aSavoir: [
        'Le rôle et l’établissement ne se modifient pas ici : demandez à la direction.',
      ],
    },
    {
      titre: 'Sécuriser ses connexions',
      etapes: [
        'Après un oubli de déconnexion sur un autre appareil : « Déconnecter mes autres appareils ».',
        'Nouveau téléphone : dans « Double authentification (2FA) », cliquez sur « Réinitialiser », puis configurez la nouvelle application immédiatement.',
      ],
      aSavoir: [
        'La session se ferme après 20 minutes d’inactivité, et au plus tard 24 heures après la connexion.',
      ],
    },
  ],
}

export const support: Procedure = {
  slug: 'support',
  titre: 'Support technique',
  module: 'Principal',
  ecrans: ['/dashboard/support'],
  roles: ['direction'],
  acces: 'Bas de la barre latérale · Support technique',
  resume: "Écrire à l'éditeur de l'application quand la procédure de l'aide ne suffit pas, et suivre ses demandes.",

  taches: [
    {
      titre: 'Envoyer une demande',
      etapes: [
        'Vérifiez d’abord dans la liste que le problème n’a pas déjà été signalé.',
        'Cliquez sur « Contacter le support ».',
        'Choisissez la « Nature de la demande » (assistance, incident, information, suggestion, abonnement, autre) et, pour un incident, l’« Impact » (bloquant, gênant, mineur).',
        'Renseignez l’« Objet » et « Votre message » : ce que vous faisiez, ce que vous attendiez, ce qui s’est produit.',
        'Joignez si possible une capture d’écran (image ou PDF), puis cliquez sur « Envoyer ».',
      ],
      aSavoir: [
        'La page, la version et le navigateur sont joints automatiquement.',
        'La demande est enregistrée même si l’email ne part pas (« Non transmise »).',
      ],
    },
  ],
}

export const importation: Procedure = {
  slug: 'importation',
  titre: 'Importation de familles',
  module: 'Vie scolaire',
  ecrans: ['/dashboard/import'],
  roles: ['direction'],
  acces: 'Vie scolaire · Importation',
  resume: "Créer d'un coup les familles et leurs enfants à partir d'un classeur Excel, au démarrage ou à la rentrée.",

  taches: [
    {
      titre: 'Importer les familles',
      etapes: [
        'Cliquez sur « Télécharger le modèle » et remplissez-le : une ligne par enfant, avec les coordonnées des tuteurs.',
        'Cliquez sur « Importer le fichier » et choisissez le classeur .xlsx.',
        'Le tableau « Familles du fichier » indique pour chaque foyer l’action prévue : « Créer la famille », « Ajouter au foyer existant », « Mettre à jour le foyer » ou « Déjà enregistré ».',
        'Ouvrez « Voir et corriger les coordonnées » pour corriger une ligne avant l’enregistrement.',
        'Cochez les foyers à enregistrer (ou « Cocher tout ce qui est enregistrable »), puis cliquez sur « Enregistrer la sélection » et confirmez.',
      ],
      aSavoir: [
        'Chaque foyer s’enregistre en entier ou pas du tout. Les foyers enregistrés disparaissent du tableau ; ceux en échec restent, avec la raison.',
        'Une colonne obligatoire absente du fichier est signalée avant toute écriture.',
        'Les enfants importés n’ont pas encore de classe : affectez-les ensuite.',
      ],
    },
  ],

  voirAussi: ['parents', 'apprenants', 'affectations'],
}

export const classesArchivees: Procedure = {
  slug: 'classes-archivees',
  titre: 'Classes archivées',
  module: 'Pédagogie',
  ecrans: ['/dashboard/historique-classes'],
  roles: PERSONNEL,
  acces: 'Pédagogie · Classes archivées',
  resume:
    "L'historique figé des classes des années archivées : titulaires, créneaux, élèves, remplacements et cahier de texte.",

  taches: [
    {
      titre: 'Consulter une classe d’une année passée',
      etapes: [
        'Choisissez l’année et cherchez la classe.',
        'Cliquez sur la classe : onglets « Élèves » (ou « Participants »), « Remplacements » et « Cahier de texte ».',
      ],
      aSavoir: [
        'Une année n’apparaît qu’une fois archivée (Audits & Passage d’année).',
      ],
    },
  ],

  voirAussi: ['passage-annee'],
}
