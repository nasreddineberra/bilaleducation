import type { Procedure } from '../types.ts'

// Ecrans : components/etablissement/ (EtablissementForm, MessagerieConfig,
// AideMessagerie, DocumentTypesConfig). A relire a chaque modification.
export const etablissement: Procedure = {
  slug: 'etablissement',
  titre: 'Établissement et messagerie',
  module: 'Paramètres',
  ecrans: ['/dashboard/etablissement'],
  roles: ['direction'],
  acces: 'Paramètres · Établissement',
  resume:
    "La fiche de l'établissement : identité, logo, compte d'envoi des emails et documents demandés aux familles. "
    + 'Sans messagerie configurée, aucun email ne part (communications, devoirs, absences, relances).',

  taches: [
    {
      titre: 'Renseigner l’identité de l’établissement',
      etapes: [
        'Dans « Identité », renseignez le « Nom de l’établissement », l’« Adresse », le « Téléphone » et l’« Email de contact ».',
        'Choisissez le « Premier jour de la semaine » et les « Jours travaillés » (semaine de 5 ou de 7 jours).',
        'Cliquez sur « Valider ».',
      ],
      aSavoir: [
        'L’« Email de contact » est l’adresse à laquelle les familles répondent. Sans lui, aucune communication ne peut partir.',
        'Le nom, l’adresse et le logo figurent sur les bulletins, attestations et bilans.',
      ],
    },
    {
      titre: 'Ajouter ou changer le logo',
      etapes: [
        'Dans « Logo de l’établissement », cliquez sur « Importer » (ou « Changer » s’il y en a déjà un) et choisissez l’image.',
        'Recadrez-la avec le « Zoom », puis cliquez sur « Valider ».',
      ],
    },
    {
      titre: 'Configurer la messagerie',
      etapes: [
        'Réunissez quatre informations auprès du fournisseur de la boîte de l’établissement : le serveur d’envoi (SMTP) et son port, l’adresse complète de la boîte, un mot de passe d’application, et l’adresse d’expédition (celle de cette même boîte).',
        'Dans l’encadré « Messagerie », renseignez le « Serveur SMTP », le « Port » et le « Chiffrement » (« STARTTLS (587) » ou « SSL/TLS (465) »).',
        'Renseignez l’« Identifiant » (l’adresse complète de la boîte) et le « Mot de passe d’application ».',
        'Renseignez le « Nom affiché » (ce que la famille lit en haut du message) et l’« Adresse d’expédition » (celle de la boîte).',
        'Cliquez sur « Tester la connexion » : un vrai message part vers l’email de contact de l’établissement. Vérifiez qu’il arrive.',
        'Cliquez sur « Enregistrer ».',
      ],
      aSavoir: [
        'Réglages courants : Gmail smtp.gmail.com, Microsoft 365 smtp.office365.com, Infomaniak mail.infomaniak.com, OVH ssl0.ovh.net, tous en 587 STARTTLS. Le lien « Comment configurer ? » les rappelle.',
        'Le mot de passe d’application se demande dans les réglages de sécurité de la boîte (chez Google, après avoir activé la validation en deux étapes). Le mot de passe habituel est refusé.',
        'Le mot de passe enregistré n’est jamais réaffiché. Pour le remplacer, saisissez le nouveau ; laissé vide, l’ancien est conservé.',
        'Le test porte sur ce qui est saisi à l’écran : testez d’abord, enregistrez ensuite.',
      ],
    },
    {
      titre: 'Choisir les documents demandés aux familles',
      etapes: [
        'Dans « Documents requis par dossier », chaque catégorie (identité, médicaux, attestations, autres) liste ses types de document.',
        'Pour partir d’une liste prête, cliquez sur « Types par défaut » dans la catégorie.',
        'Pour ajouter un type, saisissez son nom puis cliquez sur « Ajouter ».',
        'Cliquez sur la pastille d’un type pour le faire passer de « Optionnel » à « Requis », ou l’inverse.',
        'Pour retirer un type, cliquez sur sa corbeille, puis confirmez.',
      ],
    },
  ],

  regles: [
    { texte: 'Les emails partent depuis la boîte de l’établissement, à son nom : les familles répondent à l’email de contact, jamais à l’adresse technique d’envoi.' },
    { texte: 'Supprimer la messagerie arrête tous les envois d’emails de l’établissement.' },
  ],

  faq: [
    {
      question: 'Le test de connexion échoue.',
      reponse: 'Neuf fois sur dix, c’est le mot de passe : il doit s’agir d’un mot de passe d’application, collé sans espace. Essayez aussi l’autre couple port / chiffrement (587 STARTTLS ou 465 SSL/TLS). Chez Microsoft 365, l’envoi SMTP est souvent désactivé : l’administrateur de l’abonnement doit l’autoriser pour cette boîte.',
    },
    {
      question: 'Les messages arrivent en indésirables.',
      reponse: 'Vérifiez que l’« Adresse d’expédition » est bien celle de la boîte configurée : une autre adresse, même à vous, fait classer les messages en indésirables.',
    },
    {
      question: 'Le problème persiste.',
      reponse: 'Recopiez le message d’erreur affiché sous les champs (il vient du fournisseur) dans une demande au Support technique.',
    },
  ],

  voirAussi: ['absences-enseignants', 'reglements'],
}
