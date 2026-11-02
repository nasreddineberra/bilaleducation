import type { Procedure, RoleAide } from '../types.ts'

// Ecrans : components/evaluations/EvaluationsClient.tsx (gabarits),
// components/grades/GradesClient.tsx (notes), components/bulletins/ (bulletins).
// A relire a chaque modification de ces fichiers.

const PEDAGOGIE: RoleAide[] = ['direction', 'responsable_pedagogique', 'secretaire', 'enseignant']

export const gabaritsEvaluations: Procedure = {
  slug: 'gabarits-evaluations',
  titre: 'Gabarits des évaluations',
  module: 'Pédagogie',
  ecrans: ['/dashboard/evaluations'],
  roles: PEDAGOGIE,
  acces: 'Pédagogie · Évaluations · Gabarits',
  resume:
    "Le programme des évaluations d'une classe pour une période : quels cours sont évalués, quand, avec quel type de note et quel coefficient.",

  taches: [
    {
      titre: 'Préparer le gabarit d’une classe',
      etapes: [
        'Choisissez la classe et la période.',
        'Dans « Référentiel des cours », cherchez le cours, puis cliquez sur « + » (« Ajouter une évaluation »).',
        'Choisissez le « Type » (notée sur 10, sur 20, étoilée, diagnostique), le « Coef. » et la « Date ».',
        'Recommencez pour chaque évaluation, réglez l’ordre avec les flèches, puis cliquez sur « Enregistrer le gabarit ».',
      ],
      aSavoir: [
        'La date est obligatoire : elle ordonne les évaluations et sert à reporter les absences de la feuille d’appel.',
        'Les types proposés sont ceux choisis dans l’année scolaire (Paramètres · Années scolaires).',
      ],
    },
  ],

  grise: [
    {
      element: 'Une évaluation ne se modifie pas ou ne se supprime pas',
      raison: 'Des notes ont déjà été saisies pour elle.',
      solution: 'Supprimez d’abord ses notes (Saisie des notes, « Supprimer toutes les notes »), si c’est vraiment voulu.',
    },
    {
      element: 'Le gabarit est verrouillé',
      raison: 'Les bulletins de la classe sont archivés pour cette période.',
      solution: 'Désarchivez-les d’abord dans Bulletins.',
    },
  ],

  voirAussi: ['saisie-notes', 'bulletins', 'referentiel-cours'],
}

export const saisieNotes: Procedure = {
  slug: 'saisie-notes',
  titre: 'Saisie des notes',
  module: 'Pédagogie',
  ecrans: ['/dashboard/grades'],
  roles: PEDAGOGIE,
  acces: 'Pédagogie · Évaluations · Saisie des notes',
  resume: "Saisir les notes de chaque évaluation du gabarit, élève par élève (ou participant pour un cours adulte).",

  taches: [
    {
      titre: 'Saisir les notes d’une évaluation',
      etapes: [
        'Choisissez la classe et la période, puis l’évaluation dans le « Gabarit ».',
        'Pour chaque élève, saisissez la note (ou les étoiles, ou l’acronyme d’une évaluation diagnostique) et si besoin une « Appréciation ».',
        'Cochez « Absent » pour un élève absent à l’évaluation.',
        'Cliquez sur « Valider » (ou « Modifier » si des notes existaient). « Évaluation précédente » et « Évaluation suivante » passent à la suivante.',
      ],
      aSavoir: [
        'Une absence relevée à la feuille d’appel le jour de l’évaluation est reportée automatiquement. Une note saisie malgré une absence à l’appel est signalée : corrigez l’appel ou cochez l’absence.',
        '« Saisie complète » s’affiche quand toutes les notes sont saisies.',
        'Quitter avec des notes non enregistrées demande confirmation.',
      ],
    },
    {
      titre: 'Repartir d’une grille vierge',
      etapes: [
        'Cliquez sur « Supprimer toutes les notes », puis confirmez. Le gabarit (type, coefficient, date) est conservé.',
      ],
    },
  ],

  grise: [
    {
      element: 'Les notes ne se modifient plus',
      raison: 'Les bulletins de la classe sont archivés pour cette période.',
      solution: 'Désarchivez-les d’abord dans Bulletins.',
    },
  ],

  voirAussi: ['gabarits-evaluations', 'bulletins', 'feuille-appel'],
}

export const bulletins: Procedure = {
  slug: 'bulletins',
  titre: 'Bulletins',
  module: 'Pédagogie',
  ecrans: ['/dashboard/bulletins'],
  roles: PEDAGOGIE,
  acces: 'Pédagogie · Évaluations · Bulletins',
  resume:
    "Les bulletins bilingues (français et arabe) de chaque élève pour une période : moyennes, absences, appréciation, puis archivage en PDF.",

  taches: [
    {
      titre: 'Préparer les bulletins d’une classe',
      etapes: [
        'Choisissez la classe et la période.',
        'Le tableau montre pour chaque élève la complétion des notes, la moyenne générale et les absences.',
        'Ajoutez l’appréciation de chaque élève (« Ajouter », puis « Enregistrer »).',
        'Ouvrez un bulletin pour le vérifier : il s’affiche dans un nouvel onglet.',
      ],
    },
    {
      titre: 'Archiver les bulletins',
      etapes: [
        'Quand toutes les notes sont saisies, cliquez sur « Archiver ».',
        'Les bulletins PDF sont figés avec leurs chiffres ; notes et appréciations sont alors verrouillées.',
        '« Voir tous les bulletins » ouvre l’ensemble pour l’impression.',
      ],
      aSavoir: [
        'Pour corriger après archivage, cliquez sur « Désarchiver » : les PDF archivés sont supprimés et les notes redeviennent modifiables. Il faudra archiver de nouveau.',
      ],
    },
  ],

  grise: [
    {
      element: '« Archiver » est grisé',
      raison: 'Toutes les notes ne sont pas saisies, ou les bulletins sont déjà archivés.',
      solution: 'Complétez les notes dans Saisie des notes.',
    },
  ],

  voirAussi: ['saisie-notes', 'passage-annee'],
}
