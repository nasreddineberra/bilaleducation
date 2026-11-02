import type { Procedure } from '../types.ts'

// Ecrans : components/financements/SyntheseClient.tsx (Situation financiere),
// VueGlobaleClient.tsx (Statistiques), BilansClient.tsx + bilanPdf.ts + bilanExcel.ts
// (Bilans annuels). A relire a chaque modification de ces fichiers.

export const situationFinanciere: Procedure = {
  slug: 'situation-financiere',
  titre: 'Situation financière',
  module: 'Gestion',
  ecrans: ['/dashboard/financements'],
  roles: ['direction', 'comptable'],
  acces: 'Gestion · Financements · Situation financière',
  resume:
    "Le tableau de bord financier de l'année en cours : cotisations encaissées, coût de l'enseignement, dépenses et autres revenus. "
    + 'On y saisit les dépenses et les revenus qui ne viennent pas des familles.',

  taches: [
    {
      titre: 'Lire la situation de l’année',
      etapes: [
        'En haut, « Cotisations » résume le « Facturé », l’« Encaissé », le « Reste à encaisser » et le « Taux de recouvrement ».',
        '« Coût enseignement » donne le coût des heures du personnel, mois par mois, et sa répartition par type de présence.',
        '« Dépenses » et « Revenus autres » listent les saisies de l’année, avec leur répartition par catégorie ou par source.',
        'En bas, « Situation financière » donne le solde : cotisations encaissées, moins le coût enseignement et les dépenses, plus les autres revenus. Il est vert s’il est positif, rouge sinon.',
      ],
      aSavoir: [
        'Cliquez sur un mois de « Coût enseignement » pour ouvrir le Temps de présence de ce mois.',
      ],
    },
    {
      titre: 'Enregistrer une dépense',
      etapes: [
        'Dans l’encadré « Dépenses », cliquez sur « Ajouter ».',
        'Renseignez la « Date », le « Montant (€) » et le « Libellé ».',
        'Choisissez la « Catégorie » (loyer, charges, fournitures, assurance...).',
        'Ajoutez si besoin des « Notes » et le justificatif (« Choisir un fichier » : PDF, JPEG, PNG ou WEBP, 2 Mo au plus).',
        'Cliquez sur « Valider ».',
      ],
      aSavoir: [
        'Le justificatif se consulte ensuite depuis la ligne de la dépense ; il s’ouvre dans un nouvel onglet.',
      ],
    },
    {
      titre: 'Enregistrer un autre revenu (don, subvention, fête...)',
      etapes: [
        'Dans l’encadré « Revenus autres », cliquez sur « Ajouter ».',
        'Renseignez la « Date », le « Montant (€) », le « Libellé » et la « Source » (don, subvention, événement, partenariat...).',
        'Cliquez sur « Valider ».',
      ],
      aSavoir: [
        'Les cotisations des familles ne se saisissent pas ici : elles viennent des paiements enregistrés dans Règlements.',
      ],
    },
    {
      titre: 'Corriger ou supprimer une dépense ou un revenu',
      etapes: [
        'Sur la ligne, cliquez sur le crayon pour la modifier, puis sur « Modifier ».',
        'Pour la supprimer, cliquez sur la corbeille, puis confirmez. Le justificatif joint est supprimé avec elle.',
      ],
    },
  ],

  regles: [
    { texte: 'Le coût enseignement se calcule à partir des heures du Temps de présence et des taux horaires de l’année (Paramètres · Cotisations).' },
    { texte: 'Des heures sans taux comptent pour 0 € : un bandeau orange les signale, avec le lien « Paramétrer les taux ».' },
  ],

  faq: [
    {
      question: 'Le coût enseignement paraît trop bas.',
      reponse: 'Vérifiez le bandeau orange de l’encadré : des types de présence n’ont peut-être pas de taux horaire. Renseignez-les dans Paramètres · Cotisations, encadré « Taux horaires généralisés ».',
    },
  ],

  voirAussi: ['reglements', 'bilans-annuels', 'cotisations'],
}

export const statistiquesReglements: Procedure = {
  slug: 'statistiques-reglements',
  titre: 'Statistiques sur règlements',
  module: 'Gestion',
  ecrans: ['/dashboard/financements/vue-globale'],
  roles: ['direction', 'comptable'],
  acces: 'Gestion · Financements · Statistiques',
  resume:
    "Une vue d'ensemble des règlements de l'année en cours, en lecture seule : où en est l'encaissement, par quels moyens, et quelles familles doivent le plus.",

  taches: [
    {
      titre: 'Suivre l’encaissement de l’année',
      etapes: [
        'En haut, lisez le nombre de « Dossiers », le « Facturé », l’« Encaissé », le « Reste à encaisser » et le « Taux de recouvrement ».',
        '« Répartitions » montre les dossiers par statut et les encaissements par moyen de paiement.',
        '« Facturé par activité » répartit le facturé par type de cotisation.',
        '« Rythme de collecte » compare, mois par mois, le cumul encaissé au facturé.',
      ],
      aSavoir: [
        'L’encaissé n’est pas ventilé par activité : une famille paie pour l’ensemble de son foyer.',
      ],
    },
    {
      titre: 'Ouvrir le dossier d’une famille qui doit encore',
      etapes: [
        'Dans « Top 10 familles débitrices », ou dans la liste des dossiers en bas de page (triée par reste dû décroissant), cliquez sur la famille.',
        'Son dossier s’ouvre dans Règlements, où vous pouvez enregistrer un paiement ou la relancer.',
      ],
    },
  ],

  voirAussi: ['reglements', 'situation-financiere'],
}

export const bilansAnnuels: Procedure = {
  slug: 'bilans-annuels',
  titre: 'Bilans annuels',
  module: 'Gestion',
  ecrans: ['/dashboard/financements/bilans'],
  roles: ['direction', 'comptable'],
  acces: 'Gestion · Financements · Bilans annuels',
  resume:
    "Le bilan financier de chaque année : cotisations, encaissements, dépenses, autres revenus et coût du personnel. "
    + "Celui de l'année en cours est provisoire ; celui d'une année archivée est figé.",

  taches: [
    {
      titre: 'Consulter un bilan',
      etapes: [
        'Choisissez l’« Année » dans la liste en haut à gauche.',
        'La mention à côté indique la nature du bilan : « Provisoire au » (année en cours, recalculé à chaque ouverture) ou « Établi le » (année archivée, chiffres figés).',
        'Les encadrés détaillent la synthèse, les cotisations, les encaissements, les dépenses, les autres revenus et le coût du personnel.',
      ],
    },
    {
      titre: 'Éditer le bilan pour la comptabilité',
      etapes: [
        'Choisissez l’année.',
        'Cliquez sur « Bilan PDF » : le document s’ouvre dans un nouvel onglet, prêt à imprimer ou à enregistrer.',
        'Pour le détail ligne à ligne, cliquez sur « Détail Excel » : le fichier se télécharge avec six feuilles (synthèse, paiements, ajustements, dépenses, autres revenus, personnel).',
      ],
    },
  ],

  regles: [
    { texte: 'Le bilan d’une année est figé au moment de son archivage (Audits & Passage d’année). Il ne bouge plus, même si des données sont supprimées ensuite.' },
    { texte: 'Le résultat se calcule comme la Situation financière : encaissé, moins le coût du personnel et les dépenses, plus les autres revenus.' },
    { texte: 'Des heures sans taux horaire sont comptées 0 € : le bilan le signale sous le coût du personnel.' },
  ],

  faq: [
    {
      question: 'Le bilan d’une année passée n’apparaît pas.',
      reponse: 'Seules les années archivées ont un bilan figé. La direction archive l’année depuis Audits & Passage d’année.',
    },
  ],

  voirAussi: ['situation-financiere', 'passage-annee'],
}
