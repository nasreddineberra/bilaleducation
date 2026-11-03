# Plan de tests · modifications du 30/10 au 03/11/2026

Campagne de validation, sur le site DÉPLOYÉ, dans l'**école de démonstration** uniquement (jamais ÉCOLE BILAL).
Ordre pensé pour ne se connecter qu'une fois par compte. Chaque ligne : ce que vous faites → ce que vous devez
voir. Cochez `[x]` au fur et à mesure ; notez tout écart dans « Anomalies » en bas, avec l'étape (ex. « S7.4 »).

Ce que couvre la campagne :

| Date | Chantier | Sessions |
|---|---|---|
| 30/10 | Fiches : on reste sur la fiche après modification | S2 |
| 30/10 | Titulaire en temps réel, carte fratrie, effectif par défaut 25 | S2 |
| 30/10 | Sortie des `any` (lots 3 à 7) : non-régression générale | S2, S5, S6 |
| 02/11 | Historisation avant purge, bilans financiers annuels | S2, S6 |
| 02/11 | PDF : montants de 1 000 € et plus | S2, S6 |
| 02/11 | Cahier de texte : matière déduite des créneaux | S2, S5 |
| 02/11 | Aide intégrée (languette, menu Aide, guide PDF, 33 procédures) | S2 à S6 |
| 02/11 | Apprenants en lecture seule pour l'enseignant | S5 |
| 03/11 | Espace famille, lots 1 à 7 | S1 à S9 |

---

## S0 · Préparation (5 min)

- [ ] **0.1** Ouvrir `https://demonstration.bilaleducation.fr/api/version` : une valeur s'affiche. Si un onglet du
  site était déjà ouvert avant le dernier déploiement : Ctrl+F5.
- [ ] **0.2** Avoir sous la main : un ordinateur, un téléphone, le mot de passe commun de la démonstration (console,
  fiche de la démonstration, encadré des notes) et l'application d'authentification (2FA) des comptes du personnel.
- [ ] **0.3** Comptes utilisés : `direction@`, `secretariat@`, `pedagogie@`, `comptable@`, `enseignant1@`,
  `parent1@`, `parent2@` (domaine `@demonstration.invalid`), et votre compte éditeur (console).

---

## S1 · Console éditeur (votre compte)

**Remise à zéro**

- [ ] **1.1** Fiche de l'école de démonstration → « Réinitialiser » → confirmer. Attendu : message de réussite ; la
  liste des comptes contient `parent1@` et `parent2@demonstration.invalid`.

**Encadré « Espace famille » (colonne du milieu)**

- [ ] **1.2** L'encadré affiche « Souscrit · ouvert par l'école » et des compteurs du type « 2 tuteurs invités ·
  2 accès configurés ».
- [ ] **1.3** La page ne défile pas (la liste des utilisateurs absorbe la hauteur).
- [ ] **1.4** Saisir un forfait (ex. 20) et un prix par inscrit (ex. 0,50) → « Enregistrer le tarif ». Attendu :
  « Tarif enregistré. » ; les valeurs restent après rechargement de la page.
- [ ] **1.5** Saisir un montant négatif → « Montant invalide. », bouton grisé.
- [ ] **1.6** « Désactiver l'espace famille » est GRISÉ ; au survol : « L'établissement doit d'abord désactiver
  l'espace famille (Paramètres · Établissement). »
- [ ] **1.7** Ouvrir la fiche d'une école RÉELLE (sans rien modifier) : l'encadré dit « Non souscrit » et
  « Activer l'espace famille » est grisé, raison « L'espace famille est en développement… ». Ne rien enregistrer.

**Facturation** (rien à attendre de neuf sur la démonstration, qui n'est jamais facturée)

- [ ] **1.8** Écran Facturation, vue « Tous » puis une école : les montants s'affichent comme avant, sans erreur.

---

## S2 · Direction (`direction@demonstration.invalid`)

**Tableau de bord et aide intégrée**

- [ ] **2.1** Tableau de bord : en-tête (bonjour, date, période), « À traiter », sans barre de défilement.
- [ ] **2.2** Languette « ? » au bord droit : 3 pulsations à la 1re visite d'un écran, pas aux suivantes dans la
  session. Clic : le panneau coulisse sous la barre du haut, l'écran derrière ne bouge pas ; Échap le referme.
- [ ] **2.3** Dans le panneau : « Ouvrir dans un onglet » ouvre la procédure en pleine page.
- [ ] **2.4** Menu « Aide » (bas de la barre latérale) : recherche (« chèque », « absence ») ; « Mise en route » en
  tête ; « Guide PDF » s'ouvre dans un nouvel onglet (présentation par rôle, puis procédures).
- [ ] **2.5** Un écran sans procédure n'a pas de languette.
- [ ] **2.6** Thème sombre (barre du haut) : languette et panneau lisibles.

**Paramètres · Établissement**

- [ ] **2.7** Encadré « Espace famille » : « Activé », bouton « Désactiver l'espace famille » (ne pas cliquer
  maintenant : c'est la session S9).
- [ ] **2.8** Aide de l'écran : tâche « Activer ou désactiver l'espace famille » présente.

**Paramètres · Utilisateurs**

- [ ] **2.9** Onglets « Équipe » et « Parents ». Onglet Parents : `parent1` et `parent2` (Tuteur 1 ou 2), statut
  « Accès en ligne », dernière connexion (« · » si jamais connecté).
- [ ] **2.10** « Envoyer les invitations » (en haut à droite) ouvre la fenêtre : une ligne par foyer ; les deux
  tuteurs configurés sont cochés et verrouillés (survol : « Accès en ligne configuré ») ; un tuteur sans email est
  verrouillé (« Aucun email ») ; « Tout sélectionner » / « Tout désélectionner », recherche, compteur
  « 2 en ligne / N ». Fermer avec « Annuler » (aucun envoi : la démonstration n'a pas de messagerie).
- [ ] **2.11** Sur `parent1` : « Désactiver » → confirmation → statut « Désactivé » ; puis « Réactiver » → statut
  « Accès en ligne ».
- [ ] **2.12** Aide de l'écran : la procédure « Utilisateurs » contient la tâche « Comptes parents (espace
  famille) » et renvoie à « Comptes parents ».

**Parents (Vie scolaire)**

- [ ] **2.13** Liste : colonne « Accès en ligne » avec un badge T1 ou T2 pour les deux foyers reliés.
- [ ] **2.14** Fiche du foyer de `parent1` : badge « Accès en ligne · NOM Prénom » dans l'en-tête.
- [ ] **2.15** Créer un foyer de test (« TEST Plan », email `test.plan@demonstration.invalid`) → retour à la liste,
  AUCUN mot de passe affiché.
- [ ] **2.16** Ce foyer : Utilisateurs > Parents → « Envoyer les invitations » → cocher son tuteur → envoyer.
  Attendu : échec listé « L'invitation est prête mais l'email n'a pas pu partir… » (pas de messagerie) ; le tuteur
  apparaît dans l'onglet Parents avec « Invité le … ».
- [ ] **2.17** Modifier l'email de ce tuteur sur sa fiche (ex. `test.plan2@demonstration.invalid`) → on RESTE sur la
  fiche, message de confirmation ; Utilisateurs > Parents montre la nouvelle adresse.
- [ ] **2.18** Supprimer ce foyer de test (liste des parents, corbeille) → son compte disparaît d'Utilisateurs >
  Parents.

**Fiches : on reste sur la fiche (30/10)**

- [ ] **2.19** Depuis une liste FILTRÉE, ouvrir puis modifier et enregistrer : une classe, un apprenant, un foyer, un
  enseignant, un utilisateur, une année. Attendu à chaque fois : on reste sur la fiche, message, données à jour ;
  « Retour à la liste » retrouve le filtre.
- [ ] **2.20** Fiche classe : ajouter un créneau, enregistrer deux fois → pas de doublon. Créer une nouvelle
  classe → effectif proposé 25, retour à la liste.
- [ ] **2.21** Changer le titulaire d'une classe : le nouveau s'affiche partout en temps réel ; l'historique dit
  « initial puis remplaçant ».
- [ ] **2.22** Fiche d'un élève avec frère ou sœur : carte fratrie = classe de l'année en cours ; « Non affecté » /
  « Non affectée », « Non actif » / « Non active » selon le genre.

**Cahier de texte : matière (02/11)**

- [ ] **2.23** Classe à UNE matière : séance et devoir → champ matière verrouillé sur elle.
- [ ] **2.24** Classe à PLUSIEURS matières : choix proposé sur celle du jour ; changer la date de la séance change la
  proposition.
- [ ] **2.25** Classe sans matière : « Général ». Pastille de matière dans la liste et le détail.
- [ ] **2.26** Ouvrir un devoir d'une classe de `parent1` : « Suivi » montre l'enfant de ce foyer (Vu / Effectué
  s'il a été pointé en S7).

**Financements et passage d'année**

- [ ] **2.27** Règlements : ouvrir le foyer de `parent1` ; noter **dû, payé, reste** (à comparer en S7.12).
- [ ] **2.28** Statistiques et tableau de bord financier : montants cohérents avec Règlements (pas de changement
  inattendu).
- [ ] **2.29** Bilans annuels : bilan PROVISOIRE de l'année en cours = chiffres de Situation financière ; « PDF » et
  « Excel » (6 feuilles) s'ouvrent.
- [ ] **2.30** Un PDF avec un montant de 1 000 € ou plus (attestation, bilan) : « 1 000,00 € » lisible, sans
  caractère parasite.
- [ ] **2.31** Historique des classes : onglets Remplacements et Cahier de texte visibles (archives d'années
  passées, s'il y en a).

**Bulletins (préparation de S7)**

- [ ] **2.32** Bulletins : archiver une période d'une classe d'un enfant de `parent1` (et, si possible, de la classe
  adulte de `parent2`).

**Absences enseignants (préparation de S7)**

- [ ] **2.33** Déclarer une absence de l'enseignant d'une classe de `parent1` sur un jour de la semaine en cours :
  une séance « Annulée », une autre « Remplacée par » quelqu'un.

---

## S3 · Secrétaire (`secretariat@demonstration.invalid`)

- [ ] **3.1** Menu Paramètres : « Utilisateurs » présent ; à l'intérieur, SEUL l'onglet « Parents » (pas d'Équipe).
- [ ] **3.2** « Envoyer les invitations » utilisable (fenêtre identique à 2.10 ; fermer sans envoyer).
- [ ] **3.3** « Désactiver » / « Réactiver » grisés ; survol : « Couper ou rouvrir l'accès d'une famille est réservé
  à la direction. » ; sur téléphone, la raison est écrite sous la liste.
- [ ] **3.4** Aide de l'écran = procédure « Comptes parents (espace famille) », sans la tâche « Désactiver ».
- [ ] **3.5** Fiche d'un foyer, liste des parents : badge et colonne « Accès en ligne » présents.

## S4 · Responsable pédagogique (`pedagogie@demonstration.invalid`)

- [ ] **4.1** Mêmes points que S3.1 à S3.4.
- [ ] **4.2** Aide d'un écran pédagogique (Feuille d'appel, Cahier de texte) : procédure à son rôle.

## S5 · Enseignant (`enseignant1@demonstration.invalid`)

- [ ] **5.1** Apprenants : ni « Ajouter », ni « Mettre à jour les statuts », ni actions de ligne ; la ligne ouvre la
  fiche en lecture ; taper `/dashboard/students/new` → retour à la liste.
- [ ] **5.2** Cahier de texte : créer, modifier, supprimer une séance et un devoir ; matière comme en 2.23 à 2.25.
- [ ] **5.3** Détail d'un devoir de sa classe : « Suivi des familles » lisible.
- [ ] **5.4** Pas de menu « Utilisateurs » ; aide de ses écrans à son rôle.

## S6 · Comptable (`comptable@demonstration.invalid`)

- [ ] **6.1** Bilans annuels : provisoire, PDF, Excel (comme 2.29).
- [ ] **6.2** Règlements : foyer de `parent1` = mêmes chiffres qu'en 2.27.
- [ ] **6.3** Pas de menu « Utilisateurs » ; aide de Règlements et Cotisations à son rôle.

---

## S7 · Parent 1 (`parent1@demonstration.invalid`), sur ORDINATEUR puis sur TÉLÉPHONE

- [ ] **7.1** Connexion : pas de 2FA demandée.
- [ ] **7.2** Menu : Tableau de bord, Notifications, Mes enfants, Devoirs, Absences, Emploi du temps, Bulletins,
  Règlements. Rien d'autre (ni Aide, ni écrans du personnel).
- [ ] **7.3** Tableau de bord : tuiles Mes enfants, Devoirs (à rendre dans les 7 jours), Absences, Règlements (reste
  à payer) ; listes « Devoirs à rendre cette semaine » et « Dernières absences » ; mention RGPD en bas.
- [ ] **7.4** Mes enfants : une carte par enfant (classe, titulaire, date de naissance) ; un enfant parti porte
  « Parti le … » / « Partie le … ».
- [ ] **7.5** Devoirs : « à rendre » / « passés » ; sélecteur « Tous · prénoms » si plusieurs enfants. Ouvrir un devoir
  → « Vu » se pose seul ; « Effectué » se coche puis se décoche ; la liste suit après fermeture.
- [ ] **7.6** Un devoir à date de rendu PASSÉE : « Effectué » grisé, raison « La date de rendu est passée… ».
- [ ] **7.7** Absences : absences et retards de l'année, justifiés ou non, commentaire visible ; filtre Absences /
  Retards.
- [ ] **7.8** Emploi du temps : semaine en cours, « Semaine précédente » / « Aujourd'hui » / « Semaine suivante » ;
  la séance déclarée en 2.33 apparaît « Annulée » et l'autre « Remplacée » avec le nom du remplaçant (jamais le
  motif) ; un jour de vacances affiche « Vacances ».
- [ ] **7.9** Bulletins : la période archivée en 2.32 ; « Ouvrir le bulletin » ouvre le PDF dans un nouvel onglet.
- [ ] **7.10** Notifications : cliquer une notification la marque lue (pas d'erreur) ; le compteur de la cloche
  baisse.
- [ ] **7.11** Taper à la main `/dashboard/students` puis `/dashboard/financements/reglements` → retour à l'accueil.
- [ ] **7.12** Règlements : dû, payé, reste = **mêmes chiffres qu'en 2.27** ; détail des cotisations, chaque
  paiement (date, moyen, reçu), échéances.
- [ ] **7.13** Sur téléphone : menu complet dans le tiroir, emploi du temps jour par jour, listes lisibles, sélecteur
  qui défile au doigt.

## S8 · Parent 2 (`parent2@demonstration.invalid`), tuteur d'un cours adulte

- [ ] **8.1** Mes enfants : carte « Mon cours » (classe, enseignant).
- [ ] **8.2** Sélecteur « Tous · prénoms · Moi » sur Devoirs, Absences, Emploi du temps, Bulletins.
- [ ] **8.3** Devoirs du cours adulte : la fenêtre s'ouvre en mode adulte, « Effectué » à son nom.
- [ ] **8.4** Emploi du temps : les séances de son cours apparaissent, marquées « Moi ».
- [ ] **8.5** Bulletins : son bulletin adulte (si archivé en 2.32).
- [ ] **8.6** Il ne voit QUE son cours (pas celui de l'autre tuteur du foyer, s'il en avait un).

---

## S9 · Les interrupteurs (dans cet ordre)

- [ ] **9.1** Direction, Paramètres · Établissement : « Désactiver l'espace famille » → confirmation → « Désactivé ».
- [ ] **9.2** `parent1` (onglet privé) : se connecter → retour à la connexion, « L'espace famille n'est pas
  disponible. »
- [ ] **9.3** Direction, Utilisateurs > Parents : onglet toujours visible ; « Envoyer les invitations » et
  « Renvoyer l'invitation » grisés, raison « Activez d'abord l'espace famille dans Paramètres · Établissement. »
- [ ] **9.4** Console : l'encadré dit « Souscrit · fermé par l'école » ; « Désactiver l'espace famille » est
  maintenant cliquable → confirmer → « Non souscrit ».
- [ ] **9.5** Direction : Paramètres · Établissement n'a plus l'encadré ; Utilisateurs n'a plus l'onglet Parents ;
  plus de colonne ni de badge « Accès en ligne » ; l'aide ne parle plus de l'espace famille.
- [ ] **9.6** Remise en état : console « Activer l'espace famille », puis direction « Activer l'espace famille ».
- [ ] **9.7** `parent1` se reconnecte avec SON mot de passe, sans nouvelle invitation, et retrouve tout.

---

## S10 · Contrôles techniques (je m'en charge, sur demande)

- [ ] **10.1** Contrôles SQL rejouables 24 et 35 à 43 : tous à « 0 KO ».
- [ ] **10.2** `npm test` (224 tests), `npm run lint`, `npm run type-check`, `npm run build` : sans erreur.

## Hors de portée de la démonstration (à faire avec la première école réelle)

- Email d'invitation réel (messagerie configurée) : réception, bouton « Activer mon accès », lien réutilisé =
  « Ce lien n'est plus valable », nouvelle invitation = ancien lien refusé.
- Facturation : « dont espace famille » sur le relevé d'une école à l'option (la démonstration n'est jamais relevée).
- Parcours complet de purge d'une année (carte grisée avec la liste des manques, ré-archivage) : vraie fin d'année.

## Fin de campagne

- [ ] Console : « Réinitialiser » la démonstration (efface les essais : foyer de test, absences, archives).

---

## Anomalies

| Étape | Rôle | Constaté | Attendu |
|---|---|---|---|
| | | | |
