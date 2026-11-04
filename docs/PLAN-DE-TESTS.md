# Plan de tests complet · V1

Recette de toute l'application, sur le site DÉPLOYÉ, dans l'**école de démonstration** uniquement, **juste après
« Réinitialiser »** (console). Jamais ÉCOLE BILAL : la seule action permise sur une école réelle est une tentative de
connexion refusée (S11.6) et l'ouverture d'une fiche dans la console sans rien enregistrer (S1.9).

Ordre pensé pour ne se connecter qu'une fois par compte : une session = un compte. Chaque ligne : ce que vous faites
→ ce que vous devez voir. Cochez `[x]` au fur et à mesure ; notez tout écart dans « Anomalies » en bas avec l'étape
(ex. « S2.41 »). Les étapes marquées **🔒** sont des transactions sensibles : argent, suppression, départ, comptes,
validation, accès. Pour elles, vérifier aussi l'effet AILLEURS (autre écran, autre rôle, journal).

Durée indicative : S1 à S2 une demi-journée, S3 à S9 une demi-journée, S10 à S11 deux heures.

---

## Données de la démonstration après remise à zéro

Elles sont recréées à la date du jour : les dates ci-dessous sont relatives.

| Élément | Contenu |
|---|---|
| Année | année en cours (septembre → juin), 3 trimestres T1 · T2 · T3, période en cours = celle du jour |
| Cotisations | ENFANTS 250 € + 20 € d'inscription, réduction fratrie 10, 3 échéances · ADULTES 180 €, 2 échéances |
| Référentiel | Français (Lecture, Écriture) · Mathématiques (Calcul, Problèmes) |
| Classes | **CP** (BENSAID Yasmina) · **CE1** (LEFEBVRE Camille) · **CM1** (OKAFOR Daniel) · **ADULTES** (BENSAID) |
| Horaires | samedi 09:00-12:00 (enfants), samedi 14:00-16:00 (adultes), activité le mercredi après-midi (enfants) |
| Foyers | 30 foyers (MARTIN, FERNANDES, RUSSO, GARCIA, NOWAK, YILMAZ, HADDAD, DIOP, TRAN, CHEN…), 2 enfants chacun |
| Apprenants | 60 enfants, 20 par classe ; 6 adultes : la mère des 6 premiers foyers (MARTIN à YILMAZ), classe ADULTES |
| Notes | 3 évaluations par période commencée et par classe (Lecture, Dictée notées /20, Problèmes en AC / EC / NA) |
| Absences | une dizaine d'absences et de retards sur les samedis passés, certains justifiés (« Certificat médical ») |
| Cahier de texte | 3 séances passées par classe d'enfants, 1 devoir « Apprendre la table de 7 » au samedi suivant |
| Règlements | 1 foyer sur 3 soldé (MARTIN, GARCIA, HADDAD, CHEN…), 1 sur 3 à 250 € (FERNANDES, NOWAK…), 1 sur 3 à 0 € (RUSSO, YILMAZ…) |

| Compte (`@demonstration.invalid`) | Rôle | Particularité |
|---|---|---|
| `direction@` | direction | MOREAU Laurent |
| `comptable@` | comptable | COSTA Ana |
| `secretariat@` | secrétaire | NGUYEN Linh |
| `pedagogie@` | resp. pédagogique | BIANCHI Marco |
| `enseignant1@` | enseignant | LEFEBVRE Camille, titulaire du **CE1** |
| `enseignant2@` | enseignant | OKAFOR Daniel, titulaire du **CM1** |
| `enseignant3@` | enseignant | BENSAID Yasmina, titulaire du **CP** et des **ADULTES** |
| `parent1@` | parent | tuteur 1 du foyer **CHEN** (normalement CHEN Wei : enfants CHEN Ling en CP, CHEN Hao en CE1) |
| `parent2@` | parent | la mère d'un des 6 premiers foyers, inscrite en ADULTES (nom visible dans Utilisateurs > Parents) |

Le foyer **CHEN** a les deux enfants dans des classes différentes, dont le CE1 de `enseignant1@` : c'est le fil
rouge des sessions S2, S5 et S7. Le foyer **RUSSO** (rien payé) sert aux essais d'argent.

---

## S0 · Préparation (10 min)

- [ ] **0.1** Ouvrir `https://demonstration.bilaleducation.fr/api/version` : une valeur s'affiche. Si un onglet du
  site était ouvert avant le dernier déploiement : Ctrl+F5.
- [ ] **0.2** Avoir sous la main : un ordinateur, un téléphone, le mot de passe commun (console, fiche de la
  démonstration, encadré des notes), l'application d'authentification (2FA) des comptes du personnel, et une adresse
  email À VOUS non utilisée dans l'application (ex. `nberra+essai@hotmail.com`) pour S1.6 et S2.6.
- [ ] **0.3** Un fichier `.xlsx` d'import préparé (S2.30) : télécharger le gabarit depuis l'écran Importation et y
  saisir 2 foyers fictifs (un avec 1 enfant, un avec 2 enfants), et une 3e ligne qui reprend un enfant existant
  (ex. CHEN Ling, même date de naissance) pour le test de doublon.

---

## S1 · Console éditeur (votre compte)

**Remise à zéro**

- [ ] **1.1** 🔒 Fiche de l'école de démonstration → « Réinitialiser » → confirmer. Attendu : message de réussite ;
  la liste des comptes contient les 9 comptes `@demonstration.invalid` ; tout compte créé à la main pendant une
  démonstration a disparu (message « N compte(s) ajouté(s) pendant la démonstration supprimé(s) »).
- [ ] **1.2** « Intervenir » est de nouveau cliquable ; « Réinitialiser » pendant une intervention ouverte est refusé
  (« quittez-la d'abord »).

**Console : navigation**

- [ ] **1.3** Liste des écoles, Santé (la démonstration n'y apparaît jamais en alerte), Facturation (vue « Tous »
  puis une école), Support, Interventions : chaque écran s'affiche sans erreur.
- [ ] **1.4** Ctrl+K : rechercher « demo » puis une école → la fiche s'ouvre.

**Encadré « Espace famille »**

- [ ] **1.5** L'encadré affiche « Souscrit · ouvert par l'école » et « 2 tuteurs invités · 2 accès configurés ».
  Saisir un tarif (forfait 20, par inscrit 0,50) → « Tarif enregistré. », conservé au rechargement ; un montant
  négatif → « Montant invalide. ». « Désactiver l'espace famille » est GRISÉ (raison au survol).

**Accès prospect** 🔒

- [ ] **1.6** Sur `enseignant2@` : « Ouvrir un accès prospect » avec VOTRE adresse (0.2) et un mot de passe propre.
  Attendu : le compte affiche votre adresse. Dans une fenêtre privée, se connecter avec cette adresse : la 2FA est
  demandée À ENRÔLER (pas celle de l'éditeur) ; après enrôlement, on arrive sur le tableau de bord d'OKAFOR.
- [ ] **1.7** Laisser cette fenêtre ouverte. Console : « Rétablir » le compte. Attendu : adresse d'origine
  `enseignant2@demonstration.invalid`. Dans la fenêtre privée, cliquer n'importe où : renvoi à la connexion (session
  coupée) ; votre adresse ne permet plus de se connecter.
- [ ] **1.8** Ouvrir un accès prospect avec une adresse `@demonstration.invalid` → refus ; avec l'adresse d'un autre
  compte existant → « Cette adresse est déjà utilisée… ».

**Une école réelle (lecture seule)**

- [ ] **1.9** Ouvrir la fiche d'une école RÉELLE sans rien modifier : « Espace famille » dit « Non souscrit »,
  « Activer » grisé (« en développement »). Ne rien enregistrer, ne pas cliquer « Intervenir ».

---

## S2 · Direction (`direction@demonstration.invalid`), sur ordinateur

**Connexion et compte**

- [ ] **2.1** Connexion : mot de passe puis code 2FA (6 cases, collage accepté). Tableau de bord : bonjour à gauche,
  date et période à droite, « À traiter », aucune barre de défilement ; icône plein écran.
- [ ] **2.2** Mon compte : modifier son téléphone → enregistré ; thème sombre puis clair (barre du haut) : le choix
  est conservé à la reconnexion.
- [ ] **2.3** Aide intégrée : languette « ? » au bord droit (3 pulsations à la 1re visite d'un écran dans la session
  seulement), panneau sous la barre du haut, Échap le referme, « Ouvrir dans un onglet » ; menu « Aide » :
  recherche (« chèque », « absence »), « Mise en route » en tête, « Guide PDF » dans un nouvel onglet.

**Paramétrage**

- [ ] **2.4** Paramètres · Établissement : coordonnées, logo (déposer une image puis la remettre), jours ouvrés ;
  enregistrer → on reste sur l'écran, message. Encadré « Espace famille » : « Activé » (ne pas désactiver : S9).
- [ ] **2.5** Année scolaire : fiche de l'année en cours, 3 périodes ; ajouter une **période de vacances** couvrant
  le samedi de la semaine prochaine (sert à S7.8) et un **jour férié** ; enregistrer → on reste sur la fiche.
- [ ] **2.6** 🔒 Utilisateurs > Équipe : créer un compte « TEST Comptable » (rôle comptable) avec VOTRE adresse (0.2)
  et un mot de passe conforme. Attendu : retour à la liste ; un mot de passe trop faible ou contenant le nom est
  refusé ; une adresse déjà prise est refusée. (Ce compte sera supprimé par la prochaine remise à zéro.)
- [ ] **2.7** Ce compte : le modifier (téléphone) → on reste sur la fiche ; le désactiver puis le réactiver.
- [ ] **2.8** Cotisations : les deux cotisations, la règle de départ « Due en totalité » sélectionnée (encadré en
  tête). Ne pas la changer maintenant (S2.47).
- [ ] **2.9** Types de présence, Ressources (salles), Cours (référentiel) : chaque écran s'ouvre ; créer une salle
  « Salle TEST », la modifier, la supprimer.

**Enseignants**

- [ ] **2.10** 🔒 Créer un enseignant « TEST Enseignant » (compte + fiche). Attendu : numéro `ENS-AAAAMM-NNN`
  attribué, retour à la liste. Recréer le même nom → refus de doublon (insensible à la casse et aux accents).
- [ ] **2.11** 🔒 Supprimer cette fiche VIERGE → elle disparaît, son compte aussi (absent d'Utilisateurs).
- [ ] **2.12** 🔒 Tenter de supprimer LEFEBVRE Camille → « Suppression impossible » avec la liste (affectation en
  cours, évaluations, séances…) ; proposer « Rendre inactif » ; **Annuler** (ne pas la rendre inactive).

**Classes et emploi du temps**

- [ ] **2.13** Créer une classe « TEST » (effectif proposé 25) → retour à la liste. L'ouvrir, ajouter un créneau
  (type Cours, samedi 13:00-14:00), enregistrer deux fois → aucun doublon ; le type n'est plus modifiable après
  création.
- [ ] **2.14** 🔒 Supprimer la classe TEST : la confirmation exige de RETAPER son nom ; un collage est refusé ; la
  classe disparaît.
- [ ] **2.15** Fiche CM1 : changer le titulaire (OKAFOR → BENSAID) à partir d'aujourd'hui → le nouveau s'affiche
  partout en temps réel ; l'historique dit « initial puis remplaçant ». Remettre OKAFOR.
- [ ] **2.16** Emploi du temps : grille par 15 min, colonne du jour teintée, créneaux enfants du samedi et activités
  du mercredi ; un créneau sans enseignant afficherait « Prof non affecté » en rouge. Créer une séance PONCTUELLE
  pour le CE1, puis la supprimer (confirmation « SUPPRESSION » à retaper).
- [ ] **2.17** 🔒 Annuler la séance du CM1 de samedi prochain : confirmation « ANNULATION » à retaper → séance
  « Annulée » ; la rétablir.

**Absences enseignants** 🔒

- [ ] **2.18** Déclarer une absence de LEFEBVRE (CE1, classe de CHEN Hao) couvrant samedi prochain matin, heure
  exacte. Attendu : la séance touchée apparaît « À décider » ; le tableau de bord la montre en ligne URGENTE
  (bandeau ambre) dans « À traiter ».
- [ ] **2.19** Décider « Remplacée par » BIANCHI Marco ; la case « prévenir les familles » est décochée par défaut.
  Un remplaçant déjà occupé sur ce créneau n'est pas proposé.
- [ ] **2.20** Déclarer une 2e absence de BENSAID sur la séance CP de samedi prochain et décider « Annulée » (case
  familles cochée). Les familles de la démonstration ont des adresses fictives : l'envoi est refusé foyer par foyer
  (« Adresse fictive de démonstration… », ou « Messagerie non configurée » sans messagerie), sans bloquer la
  décision.
- [ ] **2.21** EDT de samedi prochain : CE1 « Remplacée » (BIANCHI), CP « Annulée ».

**Apprenants, parents, affectations**

- [ ] **2.22** Apprenants : filtres (classe, actif / inactif), recherche (2 caractères minimum), ligne cliquable
  vers la fiche. Fiche de CHEN Ling : 5 onglets, carte fratrie (CHEN Hao, classe de l'année), photo (déposer une
  image de moins de 500 Ko ; une image plus lourde est refusée).
- [ ] **2.23** Sur cette fiche : déposer un document, l'ouvrir (nouvel onglet), le supprimer ; ajouter puis
  supprimer un avertissement.
- [ ] **2.24** Depuis la liste FILTRÉE (CP), modifier et enregistrer CHEN Ling → on RESTE sur la fiche, message ;
  « Retour à la liste » retrouve le filtre CP. Faire de même pour un foyer, un enseignant, un utilisateur, une année.
- [ ] **2.25** 🔒 Créer un apprenant « TEST Élève » dans le foyer RUSSO, puis le recréer avec la même date de
  naissance → refus de doublon. Supprimer la fiche VIERGE → elle disparaît.
- [ ] **2.26** 🔒 Tenter de supprimer CHEN Ling → refus (données rattachées), proposition « Rendre inactif » ;
  Annuler.
- [ ] **2.27** Parents : colonne « Accès en ligne » (badge T1 / T2 pour les foyers reliés) ; fiche CHEN : badge
  « Accès en ligne · CHEN Wei », 2 tuteurs, cours adultes par tuteur.
- [ ] **2.28** Créer un foyer « TEST Plan » (email du tuteur 1 obligatoire, `test.plan@demonstration.invalid`) →
  retour à la liste, aucun mot de passe affiché. Recréer un tuteur identique (même personne) → refus de doublon.
- [ ] **2.29** Inscrire le tuteur 1 de TEST Plan au cours ADULTES depuis sa fiche → il apparaît dans Affectations >
  Adultes.
- [ ] **2.30** 🔒 Importation : déposer le fichier de 0.3. Attendu : aperçu avec les 2 foyers valides et la ligne en
  doublon signalée ; importer → 2 foyers créés d'un bloc (un foyer en erreur n'est pas créé à moitié).
- [ ] **2.31** 🔒 Affectations : affecter les enfants importés au CP. **Correction** : retirer l'un d'eux (sans
  données) → inscription supprimée. Un enfant n'a qu'une classe active par année (une 2e affectation déplace).
- [ ] **2.32** 🔒 **Départ** : « Déclarer un départ » pour un enfant AVEC données (ex. RUSSO, classe CP) à la date du
  jour. Attendu : élève inactif, « Parti le… » / « Partie le… », trace dans l'historique des mouvements.
- [ ] **2.33** 🔒 Réinscrire ce même enfant dans l'année (retour) → le départ est annulé, l'élève redevient actif.
  Redéclarer le départ (il sert en S2.47).

**Feuille d'appel, temps de présence**

- [ ] **2.34** Feuilles d'appel : CE1, samedi dernier ; marquer un absent, un retard, justifier une absence avec
  commentaire ; enregistrer. Même chose pour ADULTES (onglet adultes).
- [ ] **2.35** 🔒 Temps de présence : valider la séance CE1 du samedi dernier pour LEFEBVRE → heures à son nom. Une
  séance validée n'est plus modifiable (EDT : créneau de cette date verrouillé) ; « Retirer la validation » la rouvre.
  Saisir une ligne manuelle (type saisissable, ni absence ni cours ni activité) ; les coûts sont visibles en
  direction.

**Notes et bulletins**

- [ ] **2.36** Évaluations : créer une évaluation datée pour le CE1 (date obligatoire) ; l'ordre des gabarits suit la
  date. Notes : saisir des notes /20, une absence, un diagnostic AC / EC / NA ; enregistrer.
- [ ] **2.37** Bulletins : CE1, période en cours : appréciation, aperçu PDF bilingue FR / AR dans un nouvel onglet
  (arabe lisible, sans carré). **Archiver** la période pour le CE1 et pour ADULTES (sert à S7.9 et S8.5) : le PDF
  archivé garde ses chiffres même si une note change ensuite (changer une note, rouvrir l'archive : inchangée).

**Cahier de texte, communications**

- [ ] **2.38** Cahier de texte, CE1 (une matière ou plusieurs selon les créneaux) : créer une séance et un devoir ;
  matière verrouillée s'il n'y en a qu'une, proposée sur celle du jour s'il y en a plusieurs, « Général » sinon.
  Ouvrir le devoir « Apprendre la table de 7 » du CE1 : « Suivi » montre CHEN Hao.
- [ ] **2.39** Communications : message à une classe (pièce jointe de moins de 1 Mo ; plus lourde = refus, jauge),
  message à l'équipe ; détail (destinataires). Adresses fictives (ou pas de messagerie) : chaque échec est listé
  avec sa raison, le message est conservé. Les vrais envois se testent en S13.
- [ ] **2.40** Notifications : la cloche affiche le compteur ; ouvrir une notification la marque lue.

**Financements** 🔒 (foyer RUSSO : rien payé)

- [ ] **2.41** Règlements, foyer CHEN : noter **dû, payé, reste** (comparaison en S6.2 et S7.12).
- [ ] **2.42** Foyer RUSSO : noter dû et reste. Enregistrer un paiement partiel de 100 € (chèque, numéro) →
  reste diminué de 100 ; reçu / attestation PDF dans un nouvel onglet.
- [ ] **2.43** Double clic rapide sur « Enregistrer » d'un paiement de 50 € → UN SEUL paiement créé.
- [ ] **2.44** Montant négatif ou nul → « Le montant doit être positif. », aucune écriture. Montant SUPÉRIEUR au
  reste : aucune règle ne le refuse aujourd'hui ; noter ce qui s'affiche (reste négatif ? statut ?) dans Anomalies,
  décision à prendre.
- [ ] **2.45** Ajouter une réduction de 30 € (motif) → dû diminué ; la supprimer → dû rétabli.
- [ ] **2.46** Supprimer le paiement de 50 € → reste remonté de 50. Ouvrir Règlements dans DEUX onglets, supprimer
  le paiement de 100 € dans le premier, puis tenter la même suppression dans le second → message d'erreur, aucun
  effet en double.
- [ ] **2.47** Règle de départ (encadré de Cotisations) : passer à « Au prorata » → le dû de l'enfant RUSSO parti
  (S2.32) est recalculé au prorata des mois commencés, frais d'inscription toujours dus ; « Au cas par cas » → le
  départ apparaît « Décider » dans Règlements ; revenir à « Due en totalité » → dû d'origine.
- [ ] **2.48** Situation financière, Vue globale, Statistiques, tableau de bord : montants cohérents avec Règlements
  (paiements ci-dessus compris).
- [ ] **2.49** Bilans annuels : bilan PROVISOIRE de l'année = Situation financière ; « PDF » et « Excel » (6 feuilles)
  s'ouvrent ; un montant de 1 000 € ou plus s'écrit « 1 000,00 € » sans caractère parasite.

**Passage d'année, historique, journal, support**

- [ ] **2.50** Passage d'année : les 6 audits se lancent et se relancent ; la clôture est grisée (date de fin non
  atteinte), raison affichée. Ne rien archiver.
- [ ] **2.51** Historique des classes : s'ouvre (vide d'années archivées sur la démonstration).
- [ ] **2.52** 🔒 Journal d'activité : les actions de S2 apparaissent (paiements, suppressions, départ, création de
  comptes) avec l'auteur MOREAU Laurent ; aucune ligne de l'éditeur (S1, intervention).
- [ ] **2.53** Support : créer une demande « TEST » → elle apparaît dans la liste (et dans la console, S10.4).

---

## S3 · Secrétaire (`secretariat@demonstration.invalid`)

- [ ] **3.1** Menus : élèves, parents, enseignants, classes, notes, bulletins, affectations, feuille d'appel ; pas
  de Financements ni de Passage d'année.
- [ ] **3.2** Enseignants : créer, modifier ; **aucun** bouton de suppression.
- [ ] **3.3** Utilisateurs : SEUL l'onglet « Parents » ; « Envoyer les invitations » utilisable ; « Désactiver » /
  « Réactiver » grisés (« réservé à la direction »).
- [ ] **3.4** Absences enseignants : peut déclarer ; Feuille d'appel : saisie possible.
- [ ] **3.5** 🔒 Taper à la main `/dashboard/financements/reglements`, `/dashboard/passage-annee`, `/dashboard/logs`
  → renvoi (jamais l'écran).

## S4 · Responsable pédagogique (`pedagogie@demonstration.invalid`)

- [ ] **4.1** Pédagogie complète (notes, bulletins, cahier de texte, EDT, absences enseignants) ; Temps de présence
  avec les enseignants mais **sans coûts**.
- [ ] **4.2** Utilisateurs : seul l'onglet « Parents » (comme S3.3).
- [ ] **4.3** Il est le remplaçant de S2.19 : EDT de samedi prochain, la séance du CE1 est à son nom ; Absences
  enseignants : il peut déclarer et décider.
- [ ] **4.4** 🔒 `/dashboard/financements` et `/dashboard/cotisations` tapés à la main → renvoi.

## S5 · Enseignant (`enseignant1@demonstration.invalid`, LEFEBVRE, CE1)

- [ ] **5.1** EDT : SON planning seul (CE1), plus les classes qu'il remplace ; la séance de samedi prochain apparaît
  remplacée par BIANCHI.
- [ ] **5.2** Apprenants : ses élèves du CE1 seulement, en lecture (ni « Ajouter », ni actions de ligne) ;
  `/dashboard/students/new` → retour à la liste ; la fiche d'un élève du CP tapée à la main (identifiant d'un élève
  du CP pris en direction) → refus.
- [ ] **5.3** Cahier de texte : créer, modifier, supprimer une séance et un devoir pour le CE1 ; une séance de plus
  de 7 jours n'est plus modifiable ; un devoir n'est plus modifiable après sa date de rendu.
- [ ] **5.4** Feuille d'appel CE1 : saisie ; notes de ses évaluations ; il ne communique que les devoirs (pas de
  message libre aux familles).
- [ ] **5.5** 🔒 Valider SA séance d'un samedi passé → validée ; la séance de samedi prochain (remplacée) ne peut pas
  être validée par lui.
- [ ] **5.6** Absences enseignants : liste et fiches lisibles (motif visible), aucune déclaration possible.
- [ ] **5.7** 🔒 `/dashboard/financements`, `/dashboard/utilisateurs`, `/dashboard/logs` → renvoi.

## S6 · Comptable (`comptable@demonstration.invalid`)

- [ ] **6.1** Menus : Financements et Paramètres > Cotisations ; ni notes, ni absences, ni bulletins.
- [ ] **6.2** Règlements, foyer CHEN = chiffres de S2.41 ; foyer RUSSO = état laissé en S2.46.
- [ ] **6.3** 🔒 Enregistrer un paiement de 20 € sur RUSSO, le supprimer ; Bilans annuels (provisoire, PDF, Excel).
- [ ] **6.4** Absences enseignants : lecture seule.
- [ ] **6.5** 🔒 `/dashboard/grades`, `/dashboard/absences`, `/dashboard/students/new` → renvoi.

---

## S7 · Parent 1 (`parent1@demonstration.invalid`, foyer CHEN), ordinateur puis téléphone

- [ ] **7.1** Connexion : pas de 2FA demandée.
- [ ] **7.2** Menu : Tableau de bord, Notifications, Mes enfants, Devoirs, Absences, Emploi du temps, Bulletins,
  Règlements. Rien d'autre (ni Aide, ni écran du personnel).
- [ ] **7.3** Tableau de bord : tuiles (enfants, devoirs des 7 jours, absences, reste à payer), mention RGPD.
- [ ] **7.4** Mes enfants : CHEN Ling (CP) et CHEN Hao (CE1), classe et titulaire.
- [ ] **7.5** Devoirs : sélecteur « Tous · Ling · Hao » ; ouvrir « Apprendre la table de 7 » → « Vu » se pose seul ;
  « Effectué » se coche puis se décoche. En direction (S2.38), « Suivi » refléterait l'état.
- [ ] **7.6** Un devoir à date de rendu PASSÉE : « Effectué » grisé, raison affichée.
- [ ] **7.7** Absences : celles de S2.34 si l'enfant était concerné ; commentaire visible ; filtre Absences / Retards.
- [ ] **7.8** Emploi du temps : samedi prochain = CP « Annulée », CE1 « Remplacée » (nom du remplaçant, JAMAIS le
  motif) ; la semaine de vacances de S2.5 affiche « Vacances ».
- [ ] **7.9** Bulletins : la période archivée du CE1 (CHEN Hao) ; « Ouvrir le bulletin » dans un nouvel onglet.
- [ ] **7.10** Notifications : marquer lu, le compteur baisse.
- [ ] **7.11** 🔒 Taper `/dashboard/students`, `/dashboard/financements/reglements`, `/dashboard/cahier-texte` →
  retour à l'accueil. Les séances du cahier de texte ne sont jamais visibles.
- [ ] **7.12** Règlements : dû, payé, reste = **S2.41** ; chaque paiement (date, moyen), échéances.
- [ ] **7.13** Téléphone : menu dans le tiroir, emploi du temps jour par jour, listes lisibles.

## S8 · Parent 2 (`parent2@demonstration.invalid`), tutrice inscrite en ADULTES

- [ ] **8.1** Mes enfants : ses 2 enfants et une carte « Mon cours » (ADULTES, BENSAID).
- [ ] **8.2** Sélecteur « Tous · prénoms · Moi » sur Devoirs, Absences, Emploi du temps, Bulletins.
- [ ] **8.3** Emploi du temps : le cours du samedi 14:00-16:00 marqué « Moi ». Bulletins : son bulletin adulte
  (S2.37).
- [ ] **8.4** 🔒 Elle ne voit QUE son foyer : aucun autre foyer, aucun autre adulte.

---

## S9 · Les interrupteurs de l'espace famille (dans cet ordre)

- [ ] **9.1** Direction, Paramètres · Établissement : « Désactiver l'espace famille » → « Désactivé ».
- [ ] **9.2** 🔒 `parent1` (fenêtre privée) : connexion → retour à la connexion, « L'espace famille n'est pas
  disponible. » ; s'il était connecté, la page suivante le déconnecte.
- [ ] **9.3** Direction : « Envoyer les invitations » grisé (« Activez d'abord l'espace famille… »).
- [ ] **9.4** Console : « Souscrit · fermé par l'école » ; « Désactiver l'espace famille » cliquable → « Non
  souscrit ». Direction : plus d'onglet Parents, de colonne ni de badge « Accès en ligne », l'aide n'en parle plus.
- [ ] **9.5** Remise en état : console « Activer », puis direction « Activer ». `parent1` se reconnecte avec SON mot
  de passe, sans invitation, et retrouve tout.

---

## S10 · Console : transactions sensibles de l'éditeur 🔒

- [ ] **10.1** **Intervention** : « Intervenir » sur la démonstration → vous voyez l'école en tant qu'admin
  (droits direction), un bandeau l'indique, le thème n'est pas modifiable. Faire une modification anodine (téléphone
  de l'école) puis « Quitter ». Attendu : l'intervention est listée (Interventions) avec début et fin ; le journal
  d'activité de l'école (en direction) ne montre PAS cette modification à votre nom.
- [ ] **10.2** Intervention laissée ouverte plus d'une heure (ou lire l'heure d'expiration affichée) : à expiration,
  l'accès à l'école se referme seul.
- [ ] **10.3** **Abonnement** : fiche de la démonstration, échéance = HIER, enregistrer. Direction (fenêtre privée) :
  accès coupé (écran d'abonnement), aucune donnée lisible. Remettre l'échéance vide → accès rendu.
- [ ] **10.4** **Limite d'inscrits** : fixer la limite au nombre actuel d'inscrits (élèves actifs + adultes, affiché
  sur la fiche). Direction : créer un apprenant → refusé par la base, message clair ; importer un foyer → refusé.
  Retirer la limite.
- [ ] **10.5** **Support** : la demande « TEST » de S2.53 est dans Support ; y répondre, la clore.
- [ ] **10.6** **École désactivée** : décocher « école active » pour la démonstration → direction coupée ; recocher.
- [ ] **10.7** Départ d'une école (export ZIP puis effacement RGPD) : **ne pas le jouer** sur la démonstration au
  cours de cette campagne (il supprime les comptes et leur 2FA). Vérifier seulement que l'effacement est grisé tant
  que l'export n'est pas fait, et que la confirmation exige de retaper le slug.

---

## S11 · Sécurité transverse 🔒

**Authentification**

- [ ] **11.1** Mauvais mot de passe, puis adresse inconnue → même message « Email ou mot de passe incorrect. » ; mauvais code 2FA → refus,
  pas d'accès.
- [ ] **11.2** Compte « TEST Comptable » de S2.6 : 1re connexion → enrôlement 2FA OBLIGATOIRE (QR code), impossible
  d'aller ailleurs avant ; après enrôlement, accès comptable.
- [ ] **11.3** Inactivité : rester 20 minutes sans rien faire en direction, puis cliquer → renvoi à la connexion.
- [ ] **11.4** Mon compte > « Déconnecter les autres appareils » : connecté sur ordinateur ET téléphone, le faire
  depuis l'ordinateur → le téléphone est renvoyé à la connexion à sa page suivante.
- [ ] **11.5** Direction désactive « TEST Comptable » (S2.7) pendant qu'il est connecté : sa page suivante le
  déconnecte ; il ne peut plus se reconnecter. Le réactiver.

**Cloisonnement**

- [ ] **11.6** Sur le sous-domaine d'une école RÉELLE, tenter de se connecter avec `direction@demonstration.invalid`
  → refus. (Rien d'autre sur l'école réelle.)
- [ ] **11.7** Connecté en direction de la démonstration, ouvrir `/superadmin` → refus (console réservée à
  l'éditeur).
- [ ] **11.8** Rôles : chaque adresse tapée à la main en S3.5, S4.4, S5.7, S6.5, S7.11 renvoie hors de l'écran.

**Fichiers**

- [ ] **11.9** Ouvrir un document d'élève (S2.23) ou un bulletin : copier l'adresse de l'onglet, attendre 2 minutes,
  la coller dans une fenêtre privée → refus (lien signé expiré). Aucun téléchargement automatique : PDF et
  fichiers s'ouvrent dans un onglet (sauf `.xlsx` et ZIP).

**Confirmations et intégrité**

- [ ] **11.10** Chaque confirmation à retaper (classe, utilisateur, séance « ANNULATION » / « SUPPRESSION », slug)
  refuse le collage et une saisie approchante ; le bouton reste grisé.
- [ ] **11.11** Séance validée (S2.35) : ni annulation, ni changement de salle, ni suppression du créneau ne la
  modifient ; les heures de Temps de présence restent identiques après un changement de titulaire de la classe.
- [ ] **11.12** Le journal d'activité (direction) trace les opérations sensibles de S2 à S9 avec le bon auteur
  (secrétaire, comptable, enseignant), jamais l'éditeur.

---

## S12 · Contrôles techniques (je m'en charge, sur demande)

- [ ] **12.1** Contrôles SQL rejouables `supabase/controles/01` à `43`, en transaction annulée : tous verts.
- [ ] **12.2** `npm test`, `npm run lint`, `npm run type-check`, `npm run build` : sans erreur.
- [ ] **12.3** Matrice des droits : pour chaque rôle de la démonstration, lecture et écriture des tables sensibles
  (règlements, notes, comptes) simulées en base sous ce rôle, en transaction annulée.

## S13 · Messagerie (avec le compte de messagerie de démonstration)

Les adresses `@demonstration.invalid` ne reçoivent JAMAIS rien : l'envoi les écarte. Les essais passent donc par
des adresses à VOUS, avec un `+` (ex. `nberra+tuteur1@hotmail.com`), toutes différentes entre elles. La messagerie
est conservée par « Réinitialiser » (migration `demo-garder-messagerie.sql`).

**Préparation**

- [ ] **13.1** Direction, Paramètres · Établissement · Messagerie : saisir le compte de messagerie de démonstration
  (serveur, port, identifiant, mot de passe, adresse d'envoi, nom d'affichage = nom de l'école) ; « Tester » vers
  `nberra+test@…` → email « La messagerie fonctionne » reçu, expéditeur = l'adresse du compte.
- [ ] **13.2** Paramètres · Établissement : email de contact de l'école = `nberra+ecole@…` (sert de Reply-To).
- [ ] **13.3** Console : « Ouvrir un accès prospect » sur `direction@` avec `nberra+direction@…` (la direction
  reçoit les copies cachées). Se reconnecter en direction avec cette adresse (2FA à enrôler).
- [ ] **13.4** Créer un foyer « TEST Messagerie » : tuteur 1 `nberra+tuteur1@…`, tuteur 2 `nberra+tuteur2@…` ; un
  enfant affecté au CE1 ; tuteur 2 inscrit au cours ADULTES.

**Envois de l'école** (vérifier pour chacun : reçu, en-tête à la marque de l'ÉCOLE, nom de l'école en expéditeur,
« Répondre » adresse `nberra+ecole@…`, aucun autre destinataire visible, rien reçu par un foyer fictif)

- [ ] **13.5** Utilisateurs > Parents, « Envoyer les invitations » : cocher les deux tuteurs du foyer TEST et un
  foyer fictif. Attendu : 2 emails reçus ; le foyer fictif est listé en échec « Adresse fictive de
  démonstration… ». Ouvrir le lien du tuteur 1 → « Activer mon accès », choisir un mot de passe, connexion à
  l'espace famille. Rouvrir le même lien → « Ce lien n'est plus valable ».
- [ ] **13.6** Renvoyer l'invitation du tuteur 2 deux fois → seul le DERNIER lien fonctionne.
- [ ] **13.7** Cahier de texte (enseignant1 ou direction) : nouveau devoir pour le CE1 → email reçu par les deux
  tuteurs du foyer TEST (un email par foyer), ligne « Matière », copie cachée à la direction (`nberra+direction`).
  Devoir pour le cours ADULTES → reçu par le tuteur 2 seul.
- [ ] **13.8** Absences enseignants : absence de LEFEBVRE sur une séance du CE1, décision « Annulée », case
  familles cochée → email d'annulation reçu ; rétablir la séance → email de rétablissement ; décider « Remplacée
  par » avec la case cochée → email de remplacement (nom du remplaçant, jamais le motif).
- [ ] **13.9** Communications : message au CE1 avec une pièce jointe de moins de 1 Mo → reçu avec la pièce jointe,
  un seul email par foyer, copie cachée direction ; message à l'équipe → reçu par la direction, Reply-To = auteur.
- [ ] **13.10** Règlements, foyer TEST : « Relance » → email de relance reçu (montants = Règlements).
- [ ] **13.11** Support : nouvelle demande → l'email part à la marque de l'ÉDITEUR, la demande existe même si
  l'email échoue.

**Envois d'authentification** (messagerie du projet, marque de l'éditeur, liens valables 1 heure)

- [ ] **13.12** Connexion, « Mot de passe oublié » avec `nberra+direction@…` → email reçu, le bouton ouvre la page
  de nouveau mot de passe ; le lien rouvert après usage est refusé.
- [ ] **13.13** Mon compte, connecté en « TEST Comptable » (S2.6) : changer son adresse vers `nberra+comptable2@…`
  → email de confirmation à la nouvelle adresse, alerte de sécurité à l'ancienne ; la connexion se fait avec la
  nouvelle une fois confirmée.

**Remise en état**

- [ ] **13.14** Console : « Rétablir » le compte `direction@`. Le foyer TEST et ses comptes partiront à la prochaine
  remise à zéro ; la messagerie reste.

## Hors de portée de la démonstration

- Clôture, archivage et purge d'une année (date de fin non atteinte) ; « dont espace famille » sur la facturation.
- Délivrabilité réelle à grande échelle (200 à 300 foyers, Gmail et Outlook, DMARC) : avec la première école.

## Fin de campagne

- [ ] Console : « Réinitialiser » la démonstration. Attendu : « TEST Comptable » et tout compte ajouté supprimés,
  foyers et paiements de test effacés, 9 comptes de démonstration intacts (2FA comprise).

---

## Anomalies

| Étape | Rôle | Constaté | Attendu |
|---|---|---|---|
| | | | |
