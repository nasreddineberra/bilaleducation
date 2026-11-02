import type { Procedure } from '../types.ts'

// Mise en route d'un etablissement : l'ORDRE du parametrage initial, impose par
// les dependances entre ecrans (une classe demande une salle, une cotisation et
// un titulaire ; un gabarit demande les types d'evaluation de l'annee et le
// referentiel...). Aucun ecran propre : elle ouvre le guide et le menu Aide.
// A relire si une de ces dependances change.
export const miseEnRoute: Procedure = {
  slug: 'mise-en-route',
  titre: 'Mise en route de l’établissement',
  module: 'Principal',
  ecrans: [],
  roles: ['direction'],
  acces: 'Paramètres, dans l’ordre ci-dessous',
  resume:
    "Le paramétrage à faire par la direction, dans cet ordre, avant que l'équipe utilise l'application au quotidien. "
    + "Chaque étape s'appuie sur les précédentes : par exemple, une classe demande une salle, une cotisation et un enseignant.",

  taches: [
    {
      titre: '1. L’établissement et sa messagerie',
      etapes: [
        'Paramètres · Établissement : nom, adresse, téléphone, « Email de contact », logo.',
        'Configurez la messagerie et testez-la : sans elle, aucun email ne part (devoirs, absences, relances, annonces).',
        'Choisissez les documents demandés aux familles.',
      ],
    },
    {
      titre: '2. L’année scolaire',
      etapes: [
        'Paramètres · Années scolaires : créez l’année, ses dates, sa répartition (trimestres ou semestres) et ses types d’évaluation ; cochez « Année en cours ».',
        'Déclarez les vacances et les jours fériés, puis la période en cours.',
      ],
    },
    {
      titre: '3. Les salles',
      etapes: [
        'Paramètres · Ressources : déclarez les salles de cours (et si besoin le matériel).',
      ],
    },
    {
      titre: '4. Les cotisations et les heures du personnel',
      etapes: [
        'Paramètres · Types de présence : reprenez ceux de l’an dernier ou créez les vôtres (réunion, permanence...).',
        'Paramètres · Cotisations : créez les types de cotisation (montant, frais de dossier, échéances, fratrie), choisissez la règle de départ en cours d’année, renseignez les taux horaires.',
      ],
    },
    {
      titre: '5. Ce qui s’enseigne',
      etapes: [
        'Paramètres · Pédagogie · Référentiel cours : unités d’enseignement (les matières), modules et cours. Le responsable pédagogique peut s’en charger.',
      ],
    },
    {
      titre: '6. L’équipe',
      etapes: [
        'Paramètres · Utilisateurs : créez les comptes du secrétariat, de la comptabilité et du responsable pédagogique.',
        'Paramètres · Enseignants : créez une fiche par enseignant ; son compte est créé avec.',
        'Chacun reçoit un email pour définir son mot de passe, puis active la double authentification à sa première connexion.',
      ],
    },
    {
      titre: '7. Les classes',
      etapes: [
        'Paramètres · Pédagogie · Param. classes : pour chaque classe, salle, capacité, type de cotisation, titulaire, puis ses créneaux de l’emploi du temps.',
      ],
    },
    {
      titre: '8. Les familles et les élèves',
      etapes: [
        'Vie scolaire · Importation : importez les familles et leurs enfants depuis le modèle Excel.',
        'Ou, famille par famille : Vie scolaire · Parents, puis Vie scolaire · Apprenants.',
      ],
    },
    {
      titre: '9. Les affectations',
      etapes: [
        'Vie scolaire · Affectations : placez chaque élève dans sa classe, et les adultes dans leur cours. C’est ce qui calcule la cotisation de chaque famille.',
      ],
    },
    {
      titre: '10. Ensuite, chacun dans son rôle',
      etapes: [
        'Responsable pédagogique : gabarits des évaluations par classe et par période, suivi de l’emploi du temps et des absences d’enseignants.',
        'Enseignants : feuille d’appel, cahier de texte et devoirs, notes, validation de leurs séances dans l’emploi du temps.',
        'Secrétariat : fiches des élèves et des familles, affectations, appel, absences d’enseignants, messages.',
        'Comptabilité : règlements, relances, attestations, dépenses et bilans.',
      ],
    },
  ],

  regles: [
    { texte: 'Chaque année, à la rentrée : nouvelle année scolaire (étape 2), cotisations et taux de l’année (étape 4), classes (étape 7), affectations (étape 9). La fin d’année se fait dans Audits & Passage d’année.' },
  ],

  voirAussi: ['etablissement', 'annees-scolaires', 'cotisations', 'classes', 'importation', 'passage-annee'],
}
