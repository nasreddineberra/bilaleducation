# A tester a l'ecran

Essais sur le site deploye, ecole de demonstration (jamais ECOLE BILAL). Un point verifie se RETIRE de ce
fichier (le journal garde l'historique). Un nouveau chantier livre y ajoute sa recette.

## EDT, classes, titulaires

- **Fiche classe · Planning EDT avec des seances DEJA VALIDEES** : ajouter, modifier, supprimer un creneau (et
  changer le titulaire) quand des seances passees de ce creneau sont validees. Attendu : les validations, les heures
  de Temps de presence et l'historique restent justes ; rien de valide ne se perd ni ne se recalcule en silence.
- Lot 5 : EDT (creation d'une seance ponctuelle, glisser-deposer), fiche classe (titulaire, encadre Remplacements).
  NB : le glisser-deposer est desactive dans le code (`isDndActive = false`) : a trancher.
- Titulaire (30/10) : changer le titulaire d'une classe ; temps reel = le nouveau seul, historique = « initial puis
  remplacant ».
- Creneau : choix Cours / Activite (fiche classe, EDT). NOT NULL (30/10) : effectif propose a une nouvelle classe = 25.

## Absences enseignants

- Messagerie configuree : annulation annoncee puis retablissement, remplacement annonce.

## Eleves, parents, affectations

- Sortie des `any` lot 5 (30/10) : fiche eleve (5 onglets, fratrie, document, avertissement, depart), fiche parent
  avec cours adulte, affectation enfants et adultes (correction, depart).
- Carte fratrie (30/10) : classe de l'annee en cours, mentions Non affecte et Non actif accordees au genre.
- Fiches (30/10) : modifier puis enregistrer chacune des 6 fiches (classe, apprenant, parents, enseignant,
  utilisateur, annee) depuis une liste filtree = on RESTE sur la fiche (message, donnees a jour) ; « Retour a la
  liste » garde le filtre ; fiche classe : ajouter un creneau, enregistrer 2 fois = pas de doublon ; creer = liste.
- Apprenants en enseignant (02/11) : ni « Ajouter », ni « Mettre a jour les statuts », ni actions de ligne ; la
  ligne ouvre la fiche en lecture ; `/dashboard/students/new` renvoie a la liste.

## Cahier de texte et communications

- Sortie des `any` lot 6 (30/10) : cahier de texte en direction puis en enseignant (seance et devoir : creer,
  modifier, supprimer ; detail d'un devoir enfants et adulte ; filtre par classe ; jour en francais).
- Matiere (02/11) : seance et devoir dans une classe a une matiere (champ verrouille sur elle), a plusieurs (choix ;
  changer la date de la seance change la proposition), sans matiere (« Général ») ; modifier une ancienne seance
  « Général » ; pastille de matiere dans la liste et le detail ; email d'un devoir (ligne Matiere).
- Email d'un nouveau devoir (30/10) : classe enfants (« Eleve » / « Eleves » nommes) puis classe adulte.
- Sortie des `any` lot 7 (30/10) : message a une classe enfants, adulte, a l'equipe (piece jointe) ; detail
  (destinataires, enseignant, horaire) ; filtre par classe ; notifications. Pieces jointes : 1 Mo, jauge.

## Financements

- Sortie des `any` lot 4 : Reglements (famille, infobulle de classe avec niveau, historique, impayes anterieurs),
  Synthese, Vue globale, ouverture d'un paiement sans enregistrer, tableaux de bord comptable et direction.
- Bilans annuels (02/11) : provisoire de l'annee en cours (chiffres = Situation financiere, PDF, Excel 6 feuilles),
  en direction puis en comptable.

## Passage d'annee et historique

- Sortie des `any` lot 3 : 6 audits du passage d'annee, Historique des classes.
- Historisation (02/11, migration `historisation-avant-purge.sql`, controle 36) : Historique des classes, onglets
  Remplacements et Cahier de texte (visibles apres un archivage). Le parcours complet (archivage, carte de purge
  grisee avec la liste des manques, re-archivage) attend une vraie fin d'annee ou une ecole d'essai.

## Aide integree (02/11)

- Languette « ? » au bord droit (pulsations a la 1re visite de l'ecran dans la session seulement), panneau qui
  coulisse et se range (ecran derriere inchange, Echap, telephone plein ecran, theme sombre), « Ouvrir dans un
  onglet » ; menu « Aide » (recherche, « Guide PDF ») ; pas de languette sur un ecran sans procedure.
- Contenu des 33 procedures a relire par role (direction, resp. pedagogique, secretaire, comptable, enseignant).
- Guide PDF : presentation des fonctionnalites par role (tableau) puis « Mise en route » ; jamais controle
  visuellement.

## Passe generale (sortie des `any`, fin 30/10)

- Tableau de bord de chaque role (en-tete, notifications) ; appel enfants et adultes (saisie, justification) ;
  cotisations (historique) ; notes et bulletins (archivage, appreciation, PDF) ; ressources, types de presence,
  etablissement, enrolement 2FA ; affectation adultes (changement de classe avec modifications en cours).

## Espace famille (option payante, demonstration seule pendant le developpement)

- Lot 5a (03/11) : invitation d'un tuteur dans une ecole DONT LA MESSAGERIE EST CONFIGUREE (la demonstration n'en a
  pas) : email a la marque de l'ecole, « Activer mon acces », choix du mot de passe, connexion ; lien reutilise =
  « Ce lien n'est plus valable » ; nouvelle invitation = l'ancien lien refuse ; compte parent d'une ecole sans
  l'option = ecran de connexion « L'espace famille n'est pas disponible. »
- Creation d'une fiche parents : plus aucun mot de passe affiche, retour a la liste.
- Lot 5b (03/11), demonstration APRES « Reinitialiser » (console) : comptes `parent1@` et `parent2@demonstration.invalid`
  presents, relies a leurs foyers (badge sur la fiche, colonne de la liste) ; Utilisateurs > Parents : statut,
  derniere connexion apres une connexion parent, « Desactiver » puis « Reactiver » ; « Inviter les familles » : les
  deux tuteurs configures coches et verrouilles, sans email verrouilles ; une ecole SANS l'option : ni onglet
  Parents, ni colonne, ni badge.
- Email d'un tuteur modifie sur sa fiche : connexion avec la nouvelle adresse ; adresse deja prise = refus, fiche
  inchangee. Foyer supprime : son compte en ligne disparait d'Utilisateurs > Parents.
- Lot 6a (03/11), connecte en `parent1@demonstration.invalid` (demonstration reinitialisee) : menu reduit a ses
  ecrans, tableau de bord (enfants, devoirs de la semaine, absences), Mes enfants, Devoirs (fenetre du devoir :
  « Vu » pose a l'ouverture, « Effectue » avant / apres la date de rendu), Absences (commentaire visible),
  Notifications (marquer lu) ; une adresse du personnel tapee a la main (`/dashboard/students`) ramene a
  l'accueil ; sur telephone, menu complet et listes lisibles.
- Lot 6b (03/11), en `parent1@` puis `parent2@demonstration.invalid` : Emploi du temps (semaine, precedente / suivante,
  seance annulee ou remplacee apres une absence d'enseignant declaree, vacances), Bulletins (apres archivage d'une
  periode par l'ecole : « Ouvrir le bulletin »), Reglements (memes du, paye, reste que l'ecran Reglements de l'ecole
  pour ce foyer ; paiements un a un), `parent2` : son cours adulte fusionne (« Moi ») dans chaque ecran.
- Ecole (non-regression du calcul extrait) : Reglements, Statistiques, tableau de bord financier : memes montants
  qu'avant.
- Lot 7 (03/11) : console, fiche de la demonstration, encadre « Espace famille » (tarif enregistre, « Desactiver »
  grise tant que l'ecole est ouverte) ; une ecole REELLE : « Activer » grise (verrou de developpement) ; Parametres ·
  Etablissement (direction de la demonstration) : desactiver = `parent1@` renvoye a la connexion (« L'espace famille
  n'est pas disponible. »), « Envoyer les invitations » grise ; reactiver = acces rendu sans invitation ; Facturation :
  « dont espace famille » sur le releve d'une ecole a l'option (hors demonstration, jour J).

