import type { Procedure } from '../types.ts'

// Ecrans : components/passage-annee/PassageAnneeClient.tsx (audits, cloture,
// archivage) et components/annee-scolaire/PurgeYearCard.tsx (purge, depuis la
// fiche de l'annee). Etapes : lib/closure/steps.ts. A relire a chaque modification.
export const passageAnnee: Procedure = {
  slug: 'passage-annee',
  titre: 'Audits & Passage d’année',
  module: 'Clôture',
  ecrans: ['/dashboard/passage-annee'],
  roles: ['direction'],
  acces: 'Clôture · Audits & Passage d’année',
  resume:
    "Terminer proprement une année scolaire : vérifier qu'il ne manque rien (six audits), la clôturer, l'archiver, "
    + 'puis, une fois la nouvelle année lancée, épurer si vous le souhaitez ses données de travail.',

  taches: [
    {
      titre: 'Passer les six audits',
      etapes: [
        'Pour chaque audit de la liste, cliquez sur « Auditer ». Le nombre d’anomalies s’affiche à droite : vert s’il n’y en a aucune, orange sinon.',
        'Cliquez sur « Voir le détail » pour lire les anomalies, puis sur « Corriger » pour ouvrir l’écran où les régler.',
        'Une fois corrigé, cliquez sur « Réinitialiser » puis de nouveau sur « Auditer » pour un résultat à jour.',
      ],
      aSavoir: [
        'Les audits sont, dans l’ordre : « Affectations & effectifs », « Absences », « Évaluations & notes », « Bulletins », « Temps de présence », « Financements ».',
        'Un audit « Bloquant » doit être à zéro pour clôturer ; un « Avertissement » n’empêche rien.',
        'Un audit dont un audit bloquant précédent remonte encore des anomalies est grisé « à revérifier » : son résultat serait incomplet.',
        'Pour « Financements », le bouton « Rafraîchir » recalcule les dossiers dont le montant n’est plus à jour, sans rien inventer.',
        'Les audits se relancent autant de fois que nécessaire : ils ne modifient aucune donnée.',
      ],
    },
    {
      titre: 'Clôturer l’année',
      etapes: [
        'Vérifiez dans l’encadré « Clôturer l’année » que les trois conditions sont cochées : année terminée, six audits passés, aucune anomalie bloquante.',
        'Cliquez sur « Clôturer l’année », puis sur « Clôturer ». Les six audits sont repassés à l’instant : leur constat est gardé avec la clôture.',
      ],
      aSavoir: [
        'La clôture n’est possible qu’à partir du lendemain de la date de fin de l’année.',
        'Une année close ne se modifie plus, mais les familles qui doivent encore peuvent toujours payer.',
      ],
    },
    {
      titre: 'Archiver l’année',
      etapes: [
        'Une fois l’année close, cliquez sur « Archiver l’année ».',
        'L’archivage fige l’historique de chaque élève, adulte, classe et foyer, le bilan financier, les remplacements et le cahier de texte de chaque classe.',
        'Indiquez ensuite votre intention pour la suite : « Épurer plus tard » ou « Tout conserver ». C’est un simple repère : rien n’est supprimé à ce stade.',
      ],
      aSavoir: [
        'L’archivage peut être relancé à volonté : il remplace l’archive précédente.',
        'L’historique archivé se consulte dans Pédagogie · Classes archivées, et le bilan figé dans Financements · Bilans annuels.',
      ],
    },
    {
      titre: 'Annuler une clôture',
      etapes: [
        'Cliquez sur « Annuler la clôture », puis confirmez.',
        'L’année redevient modifiable et son archive est supprimée. Il faudra clôturer et archiver de nouveau.',
      ],
      aSavoir: [
        'C’est possible tant que l’année n’a pas été purgée.',
      ],
    },
    {
      titre: 'Purger l’année (définitif)',
      etapes: [
        'Passez d’abord sur la nouvelle année : dans Paramètres · Années scolaires, créez-la et cochez « Année en cours ».',
        'Ouvrez la fiche de l’ancienne année (Paramètres · Années scolaires), encadré « Purge de l’année ».',
        'Cliquez sur « Purger l’année ».',
        'Tapez le libellé exact de l’année pour confirmer, puis cliquez sur « Purger définitivement ».',
      ],
      aSavoir: [
        'La purge supprime les données de travail de l’année : notes, absences, temps de présence, emploi du temps, cahier de texte, et finances des foyers soldés.',
        'Restent consultables : les bulletins (PDF), l’historique archivé, le bilan financier et les impayés.',
        'C’est la seule étape sans retour.',
      ],
    },
  ],

  regles: [
    { texte: 'Ordre à suivre : audits, clôture, archivage, bascule sur la nouvelle année, puis purge si vous le souhaitez.' },
    { texte: 'La purge est refusée si l’historique est incomplet, ou si des données ont été ajoutées, modifiées ou supprimées depuis l’archivage. La fiche de l’année liste alors ce qui manque : relancez l’archivage.' },
  ],

  grise: [
    {
      element: '« Clôturer l’année » est grisé',
      raison: 'Une des trois conditions de l’encadré n’est pas remplie (date de fin pas encore passée, audit non passé, ou anomalie bloquante).',
      solution: 'La condition non cochée dit quoi faire.',
    },
    {
      element: '« Purger l’année » est grisé',
      raison: 'L’historique de l’année est incomplet ou n’est plus à jour (« Historisation incomplète »).',
      solution: 'Relancez « Archiver l’année » depuis Audits & Passage d’année, puis revenez sur la fiche.',
    },
  ],

  faq: [
    {
      question: 'L’encadré « Closes non archivées » apparaît.',
      reponse: 'Une année précédente a été close sans être archivée : son historique n’a jamais été figé et elle ne pourra pas être purgée. Cliquez sur « Archiver » sur sa ligne.',
    },
  ],

  voirAussi: ['bilans-annuels', 'reglements'],
}
