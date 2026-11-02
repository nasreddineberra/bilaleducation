import type { Procedure, RoleAide } from '../types.ts'

// Ecrans : components/students/ (liste, fiche a 5 onglets), components/parents/
// (liste, fiche), components/affectation/ (enfants et adultes). A relire a chaque
// modification de ces fichiers.

/** Ecrivent les fiches et les affectations (matrice du 5 aout). */
const GESTION: RoleAide[] = ['direction', 'responsable_pedagogique', 'secretaire']

export const apprenants: Procedure = {
  slug: 'apprenants',
  titre: 'Apprenants',
  module: 'Vie scolaire',
  ecrans: ['/dashboard/students', '/dashboard/students/*'],
  roles: [...GESTION, 'enseignant'],
  acces: 'Vie scolaire · Apprenants',
  resume:
    "La liste des élèves et leur fiche : identité, rattachement à la famille, scolarité, discipline, documents et historique des années passées.",

  taches: [
    {
      titre: 'Trouver un élève',
      etapes: [
        'Choisissez un filtre : « au total », « actifs », « non affectés » (sans classe cette année), « alertes discipline », ou « sans rattachement » (sans fiche parents, affiché s’il en existe).',
        'Tapez au moins 2 caractères dans la recherche : nom, prénom ou n° élève.',
        'Cliquez sur la ligne pour ouvrir la fiche.',
      ],
      aSavoir: [
        'Des pictogrammes signalent un PAI, une autorisation de sortie ou une autorisation média.',
      ],
    },
    {
      titre: 'Consulter une fiche élève',
      etapes: [
        '« Identité » : état civil, photo, adresse, contact d’urgence et santé, famille, frères et sœurs, autorisations.',
        '« Scolarité » : la classe de l’année, les notes et les bulletins par période.',
        '« Discipline » : absences et retards, avertissements.',
        '« Documents » : pièces du dossier et leur complétude.',
        '« Historique » : le bilan figé de chaque année archivée (classe, moyenne, absences, situation financière, bulletins).',
      ],
    },
    {
      roles: GESTION,
      titre: 'Inscrire un nouvel élève',
      etapes: [
        'Cliquez sur « Ajouter ».',
        'Renseignez l’identité : nom, prénom, date de naissance, sexe. Le N° élève est proposé automatiquement.',
        'Dans « Rattachement parental », choisissez la « Fiche parents » de la famille. Vous pouvez reprendre l’adresse et le contact d’un des tuteurs.',
        'Complétez si besoin le contact d’urgence, les autorisations (sortie, média, PAI) et les notes médicales.',
        'Cliquez sur « Valider ». Vous revenez à la liste.',
      ],
      aSavoir: [
        'La fiche parents doit exister avant : créez-la d’abord dans Vie scolaire · Parents.',
        'Un élève de même nom, prénom et date de naissance est refusé : il existe déjà.',
        'L’élève n’a pas encore de classe : affectez-le ensuite dans Vie scolaire · Affectations.',
      ],
    },
    {
      roles: GESTION,
      titre: 'Modifier une fiche élève',
      etapes: [
        'Ouvrez la fiche, modifiez les champs de l’onglet « Identité ».',
        'Pour la photo : « Importer » une image ou « Webcam », puis recadrez.',
        'Cliquez sur « Modifier ». Vous restez sur la fiche, à jour.',
      ],
    },
    {
      roles: GESTION,
      titre: 'Déclarer le départ d’un élève en cours d’année',
      etapes: [
        'Ouvrez la fiche, onglet « Scolarité ».',
        'Cliquez sur « Déclarer un départ ».',
        'Renseignez la « Date de départ » (la règle de cotisation de l’établissement est rappelée), puis cliquez sur « Valider ».',
      ],
      aSavoir: [
        'L’élève devient inactif ; ses notes et absences sont conservées. Le montant dû suit la règle de départ (Paramètres · Cotisations).',
        'Un élève sans aucune note ni absence ne se déclare pas parti : retirez-le simplement de sa classe dans Affectations.',
        'Une nouvelle affectation dans l’année annule le départ.',
      ],
    },
    {
      roles: GESTION,
      titre: 'Gérer la discipline et les documents',
      etapes: [
        'Onglet « Discipline » : cliquez sur « Ajouter » dans « Avertissements », choisissez le type (l’aide au choix décrit chaque mesure), le motif et la période, joignez un fichier si besoin, puis « Enregistrer ».',
        'Onglet « Documents » : cliquez sur « Ajouter », choisissez le « Type de document » et le fichier (500 Ko au plus), puis « Enregistrer ».',
        'Un document s’ouvre dans un nouvel onglet ; la corbeille le supprime.',
      ],
      aSavoir: [
        'Les documents requis par l’établissement (Paramètres · Établissement) sont signalés « Requis » ; « Complétude du dossier » indique ce qui manque.',
      ],
    },
    {
      roles: GESTION,
      titre: 'Mettre à jour les statuts actif / inactif',
      etapes: [
        'Cliquez sur « Mettre à jour les statuts ».',
        'Basculez l’interrupteur de chaque élève, ou utilisez « Tout actif » / « Tout inactif ».',
        'Cliquez sur « Enregistrer » (le nombre de changements est indiqué entre parenthèses).',
      ],
      aSavoir: [
        'Un élève affecté à une classe reste actif : son interrupteur est verrouillé.',
      ],
    },
    {
      roles: GESTION,
      titre: 'Supprimer un élève',
      etapes: [
        'Sur la ligne de la liste, cliquez sur la corbeille.',
        'Si aucune donnée n’est rattachée, confirmez avec « Supprimer définitivement ».',
        'Sinon, la suppression est impossible : la fenêtre liste ce qui la bloque et propose « Rendre inactif ».',
      ],
    },
  ],

  regles: [
    { texte: 'Seule une fiche vierge (sans classe, note, absence ni document) peut être supprimée ; les autres se rendent inactives.' },
    { roles: ['enseignant'], texte: 'Vous consultez les fiches de vos élèves, sans pouvoir les modifier.' },
  ],

  grise: [
    {
      roles: GESTION,
      element: '« Limite atteinte » à la place de « Ajouter »',
      raison: 'L’établissement a atteint le nombre d’inscrits prévu par son abonnement (élèves actifs et adultes inscrits).',
      solution: 'Rendez inactifs les élèves partis, ou contactez l’éditeur pour augmenter la limite.',
    },
  ],

  voirAussi: ['parents', 'affectations'],
}

export const parents: Procedure = {
  slug: 'parents',
  titre: 'Parents et foyers',
  module: 'Vie scolaire',
  ecrans: ['/dashboard/parents', '/dashboard/parents/*'],
  roles: GESTION,
  acces: 'Vie scolaire · Parents',
  resume:
    "Une fiche par foyer : un ou deux tuteurs, leurs coordonnées, la situation familiale, les enfants rattachés et, le cas échéant, les cours adultes suivis par les tuteurs.",

  taches: [
    {
      titre: 'Trouver un foyer',
      etapes: [
        'Choisissez un filtre : toutes les « fiches », « inscrits aux cours » adultes, ou « non affectés » (tuteurs inscrits sans classe).',
        'Tapez au moins 2 caractères du nom ou du prénom d’un tuteur.',
        'Cliquez sur « Voir les enfants » pour déplier les enfants du foyer, ou sur la ligne pour ouvrir la fiche.',
      ],
    },
    {
      titre: 'Créer une fiche parents',
      etapes: [
        'Cliquez sur « Ajouter ».',
        '« Tuteur 1 · Responsable principal » : nom, prénom, qualité (père, mère, tuteur légal...), téléphone, « Email » (obligatoire), adresse.',
        'Pour un second responsable, mettez « Tuteur 2 · Responsable secondaire » sur Oui et remplissez ses informations (« Adresse identique à celle du tuteur 1 » recopie l’adresse).',
        'Renseignez la « Situation » familiale et le « Type de garde ».',
        'Cliquez sur « Valider ».',
      ],
      aSavoir: [
        'Une même personne ne peut figurer qu’une fois dans l’établissement (nom et prénom, sans tenir compte des accents ni des majuscules).',
        'Les enfants se rattachent ensuite depuis leur fiche élève (« Rattachement parental »).',
      ],
    },
    {
      titre: 'Modifier une fiche parents',
      etapes: [
        'Ouvrez la fiche, modifiez les informations, puis cliquez sur « Modifier ». Vous restez sur la fiche.',
      ],
    },
    {
      titre: 'Inscrire un tuteur aux cours adultes',
      etapes: [
        'Dans la fiche, cochez « Inscrit aux cours adultes » pour le tuteur concerné, puis enregistrez.',
        'Affectez-le ensuite à une classe adulte : Vie scolaire · Affectations · Adultes.',
        'L’onglet « Scolarité adulte » de la fiche suit ensuite sa classe, ses notes, ses bulletins et sa situation financière.',
      ],
      aSavoir: [
        '« Cours adultes en lot » (liste des parents) inscrit ou désinscrit plusieurs tuteurs d’un coup.',
        'Un tuteur déjà affecté à une classe adulte ne peut pas être désinscrit : retirez-le d’abord de la classe.',
        'Pour un départ en cours d’année, utilisez « Déclarer un départ » dans l’onglet « Scolarité adulte ».',
      ],
    },
    {
      titre: 'Supprimer un foyer',
      etapes: [
        'Sur la ligne, cliquez sur la corbeille.',
        'Si aucune donnée n’est rattachée, confirmez avec « Supprimer définitivement ». Sinon, la fenêtre liste ce qui bloque (enfants, finances, cours adultes, communications).',
      ],
    },
  ],

  regles: [
    { texte: 'L’email du tuteur 1 est obligatoire : c’est par lui que partent devoirs, absences, relances et annonces.' },
  ],

  voirAussi: ['apprenants', 'affectations', 'reglements'],
}

export const affectations: Procedure = {
  slug: 'affectations',
  titre: 'Affectations',
  module: 'Vie scolaire',
  ecrans: ['/dashboard/affectation', '/dashboard/affectation/adultes'],
  roles: GESTION,
  acces: 'Vie scolaire · Affectations · Apprenants ou Adultes',
  resume:
    "Placer les élèves dans leur classe de l'année, et les tuteurs inscrits aux cours adultes dans leur classe adulte. "
    + "C'est l'affectation qui déclenche la cotisation due par la famille.",

  taches: [
    {
      titre: 'Affecter des élèves à une classe',
      etapes: [
        'Choisissez la « Classe » en haut de l’écran. Ses informations (niveau, enseignant, effectif) s’affichent.',
        'À gauche, « Élèves disponibles » : filtrez sur « non affectés » ou cherchez un nom.',
        'Cliquez sur un élève pour l’ajouter à la classe (à droite).',
        'Cliquez sur « Valider » (ou « Modifier » si la classe avait déjà des élèves).',
      ],
      aSavoir: [
        'La pastille « Complet » s’affiche quand l’effectif maximal de la classe est atteint.',
        'Un élève n’a qu’une classe active par année.',
        'Changer de classe sans enregistrer : une confirmation prévient que les modifications seront perdues.',
      ],
    },
    {
      titre: 'Retirer un élève d’une classe (correction)',
      etapes: [
        'Dans la liste de droite, cliquez sur la croix « Retirer de la classe » de l’élève.',
        'Cliquez sur « Modifier » pour enregistrer.',
      ],
      aSavoir: [
        'Le retrait n’est possible que pour un élève sans note, absence, retard ni bulletin archivé : c’est une correction d’erreur. Sinon, un message nomme ce qui bloque.',
        'Pour un élève qui quitte l’établissement avec des données, utilisez « Déclarer un départ » dans sa fiche (onglet « Scolarité »).',
        'Si une appréciation de bulletin avait été saisie, une confirmation propose « Retirer et supprimer ».',
      ],
    },
    {
      titre: 'Affecter un adulte à un cours adulte',
      etapes: [
        'Ouvrez Affectations · Adultes et choisissez la « Classe adulte ».',
        'À gauche, « Participants disponibles » : les tuteurs inscrits aux cours adultes. Cliquez sur un participant pour l’affecter.',
        'Cliquez sur « Valider » ou « Modifier ».',
      ],
      aSavoir: [
        'Seuls les tuteurs cochés « Inscrit aux cours adultes » dans leur fiche parents apparaissent.',
        'Le retrait suit la même règle que pour les élèves (« Retirer du cours »).',
      ],
    },
  ],

  regles: [
    { texte: 'Le bouton de rechargement (flèche circulaire) relit la classe depuis la base, en abandonnant les modifications non enregistrées.' },
  ],

  grise: [
    {
      element: '« Valider » ou « Modifier » est grisé',
      raison: 'Aucune modification n’a été faite sur la classe.',
      solution: 'Ajoutez ou retirez un participant, puis enregistrez.',
    },
  ],

  voirAussi: ['apprenants', 'parents', 'reglements'],
}
