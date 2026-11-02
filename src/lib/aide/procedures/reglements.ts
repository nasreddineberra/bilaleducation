import type { Procedure } from '../types.ts'

// Ecran : src/components/financements/FinancementsClient.tsx (+ PaymentModal,
// ImpayesAnterieurs). A relire a chaque modification de ces fichiers.
export const reglements: Procedure = {
  slug: 'reglements',
  titre: 'Règlements',
  module: 'Gestion',
  ecrans: ['/dashboard/financements/reglements'],
  roles: ['direction', 'comptable'],
  acces: 'Gestion · Financements · Règlements',
  resume:
    "Suivre le règlement des cotisations de chaque famille pour l'année en cours : ce qu'elle doit, ce qu'elle a payé, ce qui reste. "
    + "On y enregistre les paiements, les réductions, les relances et les attestations.",

  droits: [
    { texte: 'La direction et la comptabilité ont accès à tout l’écran, y compris la suppression des lignes du journal « Communication comptable ».' },
  ],

  taches: [
    {
      titre: 'Trouver une famille',
      etapes: [
        'Dans la colonne de gauche, choisissez un statut : « toutes », « en attente » (rien payé), « partiel », « soldé », ou « trop perçu » (affiché seulement s’il en existe). Le chiffre indique le nombre de familles.',
        'Pour chercher un nom, tapez au moins 2 lettres dans « Rechercher une famille ».',
        'Cliquez sur la famille : son dossier s’affiche à droite.',
      ],
      aSavoir: [
        'Chaque ligne montre le reste à payer (ou « Soldé ») et une barre de progression du règlement.',
        'La pastille « Sans inscr. » signale une famille qui n’a plus aucun enfant inscrit cette année : le montant du dernier enregistrement est conservé.',
      ],
    },
    {
      titre: 'Lire le dossier d’une famille',
      etapes: [
        '« Récapitulatif famille » : une ligne par enfant inscrit (classe, cotisation, frais d’inscription, réduction de fratrie, total), puis les « Cours adultes » des tuteurs.',
        'En bas du récapitulatif, « Échéances max » rappelle le nombre de paiements autorisés par les cotisations de la famille.',
        'En bas de page, trois cases résument le dossier : « Total dû », « Total perçu » et « Reste » (ou « Trop perçu », en rouge).',
        '« Informations sur mouvements pédagogiques » liste les arrivées, départs et corrections d’affectation de l’année.',
        '« Communication comptable » garde la trace des relances envoyées et des attestations éditées.',
      ],
    },
    {
      titre: 'Enregistrer un paiement',
      etapes: [
        'Ouvrez le dossier de la famille.',
        'Dans l’encadré « Paiements », cliquez sur « Ajouter ».',
        'Saisissez le « Montant (€) » et la « Date » du paiement.',
        'Choisissez le « Mode de paiement » : « Espèces », « Chèque », « CB » ou « Virement ».',
        'Complétez la référence demandée : pour un chèque, le « N° chèque » et la « Banque » ; pour une carte, le « N° transaction » ; pour un virement, la « Référence virement ».',
        'Si besoin, renseignez le « N° reçu » et une remarque dans « Notes ».',
        'Cliquez sur « Valider ». Le paiement apparaît dans la liste et les totaux se mettent à jour.',
      ],
      aSavoir: [
        'La fenêtre rappelle le total dû et le reste à payer avant la saisie.',
        'Le mode « En ligne » n’est pas encore disponible.',
        'Si la famille dépasse le nombre d’échéances autorisé, la pastille « échéances » et le numéro du paiement passent en orange. C’est un avertissement : le paiement est quand même enregistré.',
      ],
    },
    {
      titre: 'Corriger ou supprimer un paiement',
      etapes: [
        'Dans la liste des paiements, cliquez sur le crayon de la ligne pour la modifier, puis sur « Modifier ».',
        'Pour la supprimer, cliquez sur la corbeille, puis confirmez.',
      ],
    },
    {
      titre: 'Accorder une réduction, un avoir ou un remboursement',
      etapes: [
        'Dans l’encadré « Réductions & Avoirs », cliquez sur « Ajouter ».',
        'Vérifiez la « Date » (le jour même par défaut) et choisissez le « Type » : « Réduction », « Avoir » ou « Remboursement ».',
        'Indiquez le « Motif » (par exemple famille nombreuse) et le « Montant (€) ».',
        'Cliquez sur « Valider ». Le montant est déduit du « Total dû ».',
      ],
      aSavoir: [
        'La réduction est enregistrée pour toute la famille, pas pour un enfant en particulier.',
        'Pour l’annuler, cliquez sur la corbeille de sa ligne.',
      ],
    },
    {
      titre: 'Relancer une famille qui n’a pas tout payé',
      etapes: [
        'Ouvrez le dossier d’une famille « en attente » ou « partiel ».',
        'Cliquez sur « Relancer » en haut à droite.',
        'Relisez l’« Objet » et le « Message », préremplis avec le reste à payer et la signature de l’établissement. Modifiez-les si besoin.',
        'Cliquez sur « Envoyer ». L’email part aux deux tuteurs du foyer.',
      ],
      aSavoir: [
        'La relance est notée dans « Communication comptable », avec la mention « Échec » si l’envoi n’a pas abouti.',
      ],
    },
    {
      titre: 'Éditer une attestation de paiement',
      etapes: [
        'Ouvrez le dossier d’une famille « soldé ».',
        'Cliquez sur « Attestation » en haut à droite.',
        'Cochez les inscriptions à faire figurer. Si la famille a des enfants et des cours adultes, les raccourcis « Tout », « Élèves » et « Adultes » cochent d’un clic.',
        'Si la famille a une réduction, décidez si elle figure sur l’attestation (case cochée quand tout est retenu, décochable).',
        'Cliquez sur « Éditer l’attestation ». Le PDF s’ouvre dans un nouvel onglet, prêt à imprimer ou à enregistrer.',
      ],
      aSavoir: [
        'Une attestation qui ne couvre qu’une partie des inscriptions est dite « partielle » et nomme les bénéficiaires, par exemple pour un remboursement par un comité d’entreprise.',
        'Chaque attestation éditée est notée dans « Communication comptable ».',
      ],
    },
    {
      titre: 'Décider du montant dû après un départ (règle « Au cas par cas »)',
      etapes: [
        'Dans « Informations sur mouvements pédagogiques », repérez la ligne « Départ » qui porte le bouton « Décider ».',
        'Cliquez sur « Décider ».',
        'Choisissez la « Règle appliquée à ce départ » : « Due en totalité », « Au prorata » ou « Sans ajustement ».',
        'Cliquez sur « Enregistrer ». Le récapitulatif et les totaux se recalculent.',
      ],
      aSavoir: [
        'Le bouton n’apparaît que si l’établissement a choisi la règle « Au cas par cas » (Paramètres · Cotisations).',
        'Une décision se change ensuite par le bouton « Modifier » de la même ligne.',
      ],
    },
    {
      titre: 'Encaisser un impayé d’une année précédente',
      etapes: [
        'Cliquez sur l’onglet « Impayés années précédentes ». Le nombre entre parenthèses indique les foyers concernés.',
        'Sur la ligne du foyer, cliquez sur « Solder ».',
        'Saisissez le paiement comme pour l’année en cours, puis cliquez sur « Valider ».',
      ],
    },
  ],

  regles: [
    { texte: 'Le montant dû se calcule à partir des affectations des enfants et des cotisations de l’établissement. Pour le corriger, modifiez l’affectation ou la cotisation, jamais un paiement.' },
    { texte: 'Les frais d’inscription restent dus même en cas de départ, quelle que soit la règle de départ.' },
    { texte: 'Le « Total dû » est le total des cotisations moins les réductions, avoirs et remboursements.' },
    { texte: 'Un enfant parti en cours d’année reste affiché, barré, avec ce que la règle de départ retient pour lui.' },
  ],

  grise: [
    {
      element: '« Ajouter » (paiement) est grisé',
      raison: 'Le total dû de la famille est à zéro : aucun enfant n’est affecté à une classe avec une cotisation.',
      solution: 'Affectez les enfants à leur classe (Vie scolaire · Affectations), puis revenez sur le dossier.',
    },
    {
      element: 'Le bouton « Relancer » n’apparaît pas',
      raison: 'La famille est soldée, ou son total dû est à zéro.',
      solution: 'Aucune relance n’est nécessaire.',
    },
    {
      element: 'Le bouton « Attestation » n’apparaît pas',
      raison: 'L’attestation n’est proposée qu’une fois la famille soldée.',
      solution: 'Enregistrez les paiements manquants : le bouton apparaît dès que le reste est à zéro.',
    },
    {
      element: '« Éditer l’attestation » est grisé',
      raison: 'Aucune inscription n’est cochée.',
      solution: 'Cochez au moins une inscription.',
    },
  ],

  faq: [
    {
      question: 'La relance renvoie « Messagerie non configurée ».',
      reponse: 'L’établissement n’a pas encore renseigné son compte d’envoi d’emails. La direction le configure dans Paramètres · Établissement.',
    },
    {
      question: 'Une famille a trop payé : que faire ?',
      reponse: 'Elle apparaît dans le filtre « trop perçu ». Vérifiez d’abord les paiements (doublon, erreur de montant) et corrigez la ligne concernée. Si le trop-perçu est réel, enregistrez le geste convenu avec la famille.',
    },
    {
      question: 'Le montant d’une cotisation est faux.',
      reponse: 'Vérifiez la classe de l’enfant (Vie scolaire · Affectations) et le montant de la cotisation (Paramètres · Cotisations). Le dossier se met à jour seul.',
    },
  ],
}
