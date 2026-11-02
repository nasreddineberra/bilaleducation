import type { Procedure } from '../types.ts'

// Ecran : components/cotisations/CotisationsClient.tsx. A relire a chaque
// modification de ce fichier ou de `lib/financements/compute.ts` (regles de depart).
export const cotisations: Procedure = {
  slug: 'cotisations',
  titre: 'Cotisations et taux',
  module: 'Paramètres',
  ecrans: ['/dashboard/cotisations'],
  roles: ['direction', 'comptable'],
  acces: 'Paramètres · Cotisations',
  resume:
    "Les tarifs de l'année en cours : types de cotisation (montant, frais de dossier, échéances, réduction de fratrie), "
    + 'règle appliquée quand un élève part en cours d’année, et taux horaires du personnel.',

  taches: [
    {
      titre: 'Créer un type de cotisation',
      etapes: [
        'Dans « Types de cotisations », cliquez sur « Ajouter ».',
        'Renseignez le « Type de scolarité » (son nom, par exemple Primaire ou Coran).',
        'Cochez « Cours adultes » si les classes de ce type sont réservées aux adultes.',
        'Renseignez la « Côtis. annuelle », les « Frais de dossier », le nombre « Max échéances » (paiements autorisés) et la « Réduc. fratrie » (réduction par enfant supplémentaire).',
        'Mettez « Même type » sur Oui si la réduction de fratrie ne doit jouer qu’entre enfants inscrits dans ce même type.',
        'Cliquez sur « Créer ».',
      ],
      aSavoir: [
        'Un type de cotisation se rattache ensuite à chaque classe, dans la fiche classe. Un bandeau orange signale les classes qui n’en ont pas, avec le lien « Voir les classes ».',
      ],
    },
    {
      titre: 'Modifier ou supprimer un type de cotisation',
      etapes: [
        'Sur la ligne du type, cliquez sur le crayon, changez les montants, puis cliquez sur « Modifier ».',
        'Pour le supprimer, cliquez sur la corbeille, puis confirmez avec « Supprimer définitivement ».',
      ],
      aSavoir: [
        'Les dossiers des familles se recalculent avec les nouveaux montants.',
        'La suppression est refusée tant que des inscriptions de l’année utilisent ce type : changez d’abord la cotisation de leurs classes.',
      ],
    },
    {
      titre: 'Choisir la règle appliquée à un départ en cours d’année',
      etapes: [
        'Dans « Règle de cotisation pour départ en cours d’année », choisissez la règle (l’infobulle de chaque choix la détaille) :',
        '« Due en totalité » : la cotisation de l’année reste due en entier (règle par défaut).',
        '« Au prorata » : la cotisation est due de la rentrée jusqu’au mois du départ inclus.',
        '« Au cas par cas » : vous décidez pour chaque départ, dans Règlements, avec le bouton « Décider ».',
        '« Sans ajustement » : la cotisation n’est plus due après le départ.',
        'Cliquez sur « Enregistrer ».',
        'Si des départs ont déjà été déclarés cette année, une fenêtre montre pour chacun le montant avant et après. Choisissez « Prochains départs seulement » ou « Appliquer aussi » aux départs déjà déclarés.',
      ],
      aSavoir: [
        'Les frais d’inscription restent toujours dus, quelle que soit la règle.',
        'Une arrivée en cours d’année doit l’année entière.',
        'La date et l’auteur du dernier changement s’affichent à côté de la règle.',
      ],
    },
    {
      titre: 'Renseigner les taux horaires du personnel',
      etapes: [
        'Dans « Taux horaires généralisés », saisissez le taux par heure de chaque type de présence.',
        'Cliquez sur « Enregistrer ». Le bandeau indique « Tous les taux sont enregistrés. »',
      ],
      aSavoir: [
        'Un type sans taux est signalé en orange : ses heures comptent pour 0 € dans la Situation financière et les bilans.',
        'Une absence n’est jamais facturée : son taux reste à 0.',
        'Les types de présence eux-mêmes se créent dans Paramètres · Types de présence.',
      ],
    },
  ],

  regles: [
    { texte: 'Tout se règle pour l’année scolaire EN COURS. Le tableau « Historique » rappelle les tarifs des années précédentes.' },
  ],

  grise: [
    {
      element: '« Enregistrer » de la règle de départ est grisé',
      raison: 'La règle choisie est celle déjà enregistrée.',
      solution: 'Choisissez une autre règle pour pouvoir l’enregistrer.',
    },
    {
      element: '« Enregistrer » des taux horaires est grisé',
      raison: 'Aucun taux n’a été modifié et tous sont déjà enregistrés.',
      solution: 'Modifiez un taux pour pouvoir enregistrer.',
    },
  ],

  voirAussi: ['reglements', 'situation-financiere'],
}
