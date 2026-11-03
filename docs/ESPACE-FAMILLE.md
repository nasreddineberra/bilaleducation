# Espace famille (accès parent) · plan de suivi

Option PAYANTE par établissement. Développée à l'abri : tant qu'elle n'est pas prête, elle ne
s'active que sur l'école de démonstration. Le jour où tout est prêt : un commit d'une ligne, puis
l'option se vend école par école depuis la console.

État : **lots 1 à 5 terminés, lot 6a fait (03/11)**. Prochain : lot 6b.

---

## Principe

- **Verrou de développement (global, code)** : `ESPACE_FAMILLE_DISPONIBLE = false`. Tant qu'il est
  fermé, la console refuse d'activer l'option ailleurs que sur la démonstration.
- **Option par école** : `etablissements.option_espace_famille` (faux par défaut), basculée par
  l'éditeur seul. Tarif modèle (c) : `forfait + base facturable x prix par inscrit`, propre à
  l'option, saisi école par école, figé chaque mois dans `releves_facturation` comme le tarif de base.
- **Le juge est la base** : `foyer_du_compte()` rend NULL si l'option est coupée, l'école inactive
  ou expirée, ou le compte n'est pas un parent. Toute règle d'accès parent passe par elle : option
  coupée = le parent ne lit plus rien, ses comptes sont conservés.

## Décisions (03/11)

1. Un tuteur inscrit à un cours adulte voit aussi son propre cours (EDT, devoirs, bulletin adulte).
2. Notes : seulement par les bulletins archivés (pas de lecture de `grades` / `evaluations`).
3. « Bulletin disponible » : TOUJOURS une action manuelle de l'équipe, par Communications > Parents (email +
   notification dans l'espace famille). Aucune automatisation (révisé le 03/11).
4. Finances : visibles en lecture (dû, payé, reste, échéances).
5. Après le départ du dernier enfant : accès fermé, sauf les bulletins archivés, consultables
   jusqu'à la fin de l'année scolaire.
6. « Fait » réversible jusqu'à la date de rendu incluse, figé ensuite (jugé par la base).
7. Pas de justification d'absence en ligne.
8. Tarif de l'option : modèle (c), forfait + prix par inscrit.
9. Option activée en cours de mois : le mois est dû (proposé, à confirmer au lot 7 ; le relevé du mois en cours
   est alors mis à jour, comme pour un changement de tarif).
10. Le commentaire d'une absence est visible de la famille ; bulletins : année en cours seulement (03/11).
11. Pas de notification du navigateur (push) pour les parents : email et notification dans l'espace famille
    seulement (03/11). Aucun SMS. Le code du push reste en place, en sommeil.

## Lots

| Lot | Contenu | État |
|---|---|---|
| 1 | Fondations en base : lien compte ↔ tuteur, option et tarif, fonctions, règles existantes réécrites, retrait de `parents.user_id` | fait (migrations A et B jouées, contrôle 37 vert) |
| 2 | Règles de lecture « mon foyer » (fiche, enfants, classes, EDT sans motif, absences, bulletins archivés, finances, cours adultes, décision 5) | fait (migration jouée, contrôle 38 vert) |
| 3 | Devoir fait : gel à la date de rendu, interface parent, suivi enseignant | fait (migration jouée après déploiement, contrôle 39 vert) |
| 4 | ~~Notification « Bulletin disponible »~~ : abandonné (décision 3 révisée) ; push des parents mis en sommeil | fait |
| 5 | Comptes et invitations : email d'invitation, badge « Accès en ligne », Utilisateurs > Parents, envoi en lot, comptes parents de démonstration | fait (5a, 5b, rôles et aide) |
| 6 | Écrans de l'espace famille (téléphone d'abord), notifications lues | 6a fait ; 6b à faire |
| 7 | Console (option, tarif, relevé, comptes), aide parent, RGPD, recette, jour J | à faire |

---

## Lot 1 · détail

### Migration A · `espace-famille-fondations.sql` (additive, jouée en premier)

Aucun compte parent n'existe : réécrire les règles parent ne retire rien à personne.

1. **Option** : `etablissements.option_espace_famille boolean NOT NULL DEFAULT false` ; activée
   sur les écoles `est_demo`.
2. **Tarif** : `etablissement_facturation.famille_forfait` et `famille_prix_inscrit` (numeric,
   NULL = non fixé, `CHECK >= 0`).
3. **Relevé** : `releves_facturation.option_espace_famille boolean NOT NULL DEFAULT false`,
   `famille_forfait`, `famille_prix_inscrit` ; `fn_releve_facturation()` les fige (la définition en
   base est comparée à celle attendue avant réécriture : la migration lève si elle a dérivé).
4. **Un compte = un tuteur d'un seul foyer** : index uniques partiels sur `tutor1_user_id` et
   `tutor2_user_id`, et déclencheur qui refuse un même compte tuteur 1 ici et tuteur 2 ailleurs
   (ou les deux sur la même fiche).
5. **Fonctions** (STABLE, SECURITY DEFINER, `search_path` fixe, `authenticated` seul) :
   - `foyer_du_compte()` : le foyer du compte connecté, ou NULL (rôle autre que `parent`, option
     coupée, école inactive ou expirée via `current_etablissement_id()`) ;
   - `tuteur_du_compte()` : 1 ou 2 ;
   - `devoir_de_mon_enfant()`, `devoir_de_mon_cours()` : appartenance d'un devoir (fonctions et non
     sous-requêtes : la règle d'accès de `students` ne laisse rien lire au parent) ;
   - `classes_du_compte()` : classes de l'année en cours où un enfant actif du foyer est affecté
     (`enrollments.status = 'active'`), plus les classes adultes où CE tuteur est inscrit.
6. **Règles d'accès réécrites** :
   - `journal_parent_select` **supprimée** : les séances du cahier de texte sont internes ;
   - `homework_parent_select` : devoirs de `classes_du_compte()` ;
   - `notifications_select_parent` : `parent_id = foyer_du_compte()` ;
   - `hwstatus_parent_select / insert / update` : son foyer, un enfant DU foyer, un devoir d'une
     classe de `classes_du_compte()` (le gel à la date de rendu vient au lot 3) ;
   - `adult_hwstatus_participant` : son foyer, SON numéro de tuteur, une classe de
     `classes_du_compte()`.
7. Ligne `enregistrer_migration`.

### Code (poussé avant la migration B)

- `lib/parents/foyer.ts` : `foyerDuCompte()` (RPC `foyer_du_compte`), source unique du foyer d'un
  compte. Remplace les lectures `parents.user_id` de `app/dashboard/layout.tsx`,
  `lib/dashboard/commun.ts`, `lib/cahier-texte/donnees.ts`, `lib/communications/notifications.ts`,
  `components/cahier-texte/DevoirDetailModal.tsx`.
- `lib/notifications.ts` : le push part vers `tutor1_user_id` ET `tutor2_user_id`.

### Migration B · `espace-famille-retrait-user-id.sql` (restrictive, après déploiement du code)

Suppression de `parents.user_id` (colonne, index `idx_parents_user_id`, clé étrangère), puis
`npm run types-db` et `npm run type-check`.

### Contrôle 37 · `supabase/controles/37-espace-famille-fondations.sql`

Deux écoles jetables (option ouverte / coupée), trois foyers, des comptes parents (tuteur 1, tuteur
2, tuteur inscrit à un cours adulte), un compte direction. Vérifie :

- `foyer_du_compte()` : le bon foyer pour chaque tuteur ; NULL pour la direction, pour l'école
  sans option, après coupure de l'option, après expiration de l'école ;
- devoirs : ceux des classes de ses enfants et de son cours adulte, jamais d'une autre classe ;
- séances du cahier de texte : 0 ligne pour un parent ;
- notifications : les siennes seulement ;
- devoir fait : accepté pour son enfant, refusé pour l'enfant d'un autre foyer ou un devoir d'une
  autre classe ; statut adulte refusé sous le numéro de l'autre tuteur ;
- un même compte tuteur de deux foyers : refusé ;
- `anon` ne peut exécuter aucune des nouvelles fonctions ;
- le relevé fige l'option et son tarif, la démonstration reste exclue.

Joué AVANT la migration (doit être rouge), puis après (vert).

### Déroulé

1. Contrôle 37 écrit et joué : rouge attendu.
2. Migration A éprouvée en transaction annulée avec le contrôle, puis jouée ; contrôle vert ;
   contrôles 16, 25, 26 et 35 rejoués.
3. Code ; `npm run lint`, `type-check`, `test`, `build` ; commit + push sur accord.
4. Après déploiement : migration B, `npm run types-db`, `type-check`.
5. `CLAUDE.md` (ligne « Comptes parents suspendus en V1 »), entrée au journal.

---

## Lot 2 · détail (fait le 03/11)

Une seule migration ADDITIVE (`espace-famille-lecture.sql`) : uniquement des droits de lecture NOUVEAUX
pour le parent, rien de retiré au personnel. Aucun code applicatif (les écrans sont au lot 6).

### Deux voies de lecture

La RLS ouvre une ligne ENTIÈRE. Une table qui porte une donnée interne ne s'ouvre donc pas au parent :
il la lit par une fonction qui ne rend que les colonnes affichables.

**Voie 1 · règles d'accès (tables sans donnée interne)**

| Table | Le parent lit |
|---|---|
| `students` | ses enfants (actifs et partis : le nom d'un enfant parti sert à ses bulletins) |
| `classes` | `classes_du_compte()` + classes de ses bulletins lisibles |
| `schedule_slots`, `schedule_exceptions` | créneaux et exceptions de `classes_du_compte()` |
| `rooms`, `unites_enseignement` | référentiels de son école (noms de salle et de matière de l'EDT) |
| `school_years`, `periods` | années et périodes de son école |
| `absences` | absences et retards de ses enfants ACTIFS, année en cours |
| `adult_absences` | les siennes (son numéro de tuteur) |
| `parent_class_enrollments` | ses propres inscriptions adultes |
| `bulletin_archives`, `adult_bulletin_archives` | voir « Décision 5 » |
| `storage.objects` (bucket `bulletins`) | le fichier d'un bulletin qu'il peut lire, et lui seul |
| `announcements`, `announcement_recipients`, `announcement_attachments` (+ bucket `communication-attachments`) | les messages adressés à son foyer et leurs pièces jointes |

**Voie 2 · fonctions (colonnes choisies)**

| Fonction | Rend | Ne rend jamais |
|---|---|---|
| `famille_foyer()` | tuteurs : nom, prénom, lien, email, téléphone, adresse | `parents.notes` (note interne) |
| `famille_enseignants()` | titulaires de ses classes : civilité, NOM, prénom, dates d'effet | téléphone, email, notes de la fiche |
| `famille_seances_modifiees(debut, fin)` | séance annulée ou remplacée, nom du remplaçant | l'absence de l'enseignant, son motif |
| `famille_finances()` | année en cours : cotisations, participants, départs et règle, dossier, échéances (dû, payé, date, moyen, reçu), réductions | `notes` et auteur des écritures, échanges internes |

`famille_finances()` rend les DONNÉES du calcul ; le calcul reste `lib/financements/compute.ts` (source unique,
même résultat que l'écran Règlements).

### Décision 5 · `foyer_actif()`

Vrai si un enfant du foyer est actif et affecté cette année, ou si CE tuteur suit un cours adulte actif.

- Foyer actif : tout ce qui précède.
- Foyer non actif (dernier enfant parti) : seulement `famille_foyer()`, les noms de ses enfants et leurs
  bulletins archivés de l'année en cours, jusqu'à `school_years.end_date` incluse.
- Un enfant parti alors qu'un frère ou une sœur reste : ses absences ne se lisent plus, ses bulletins de
  l'année en cours restent lisibles jusqu'à la fin de l'année.
- Bulletins : année en cours seulement (les années passées sont archivées puis purgées).

### Contrôle 38 · `38-espace-famille-lecture.sql`

Deux foyers, deux écoles, un enfant parti, un tuteur adulte. Pour chaque table et chaque fonction : son foyer
oui, l'autre foyer non, l'autre école non, option coupée non, foyer non actif = bulletins seuls (jusqu'à la fin
d'année), aucune colonne interne rendue (notes, motif, téléphone d'enseignant), fichier de bulletin d'un autre
foyer refusé. Rouge avant, vert après ; contrôles 16, 25, 26, 35 et 37 rejoués.

### Ajouts faits pendant le lot 2

- `rooms_select` et `materials_select` ne portaient que l'école, sans le rôle : tout compte de l'école, parent
  compris, les lisait. Réservées au personnel ; le parent lit les salles par `rooms_parent_select` (foyer actif).
  Les documents requis (`doc_type_configs_select`) restent lisibles du parent : décision du contrôle 12.
- Règles de stockage parent : dossier racine = l'école et rôle `parent` en plus de la fonction (contrôle 14).
- Dans les règles, les appels sans argument sont écrits `(SELECT foyer_du_compte())` : évalués une fois par
  requête, y compris pour le personnel (les règles permissives s'additionnent).
- `famille_finances()` rend les données BRUTES (inscriptions actives et retirées, cours adultes, mouvements de
  départ, dossiers) : au lot 6, le calcul par foyer est extrait de `family-financials.ts` pour servir les deux.
- Tous les contrôles rejoués avec la migration : seuls 12 et 14 ont bougé, corrigés avant de jouer.

---

## Lot 3 · détail

Existant : la fenêtre du devoir (`DevoirDetailModal`) porte déjà « Vu » / « Effectué » par enfant (ou pour soi,
cours adulte) et le tableau de suivi de l'enseignant. Il manque le gel, et l'écriture a des défauts.

### Migration `espace-famille-devoir-fait.sql` (restrictive, aucun compte parent : sans effet aujourd'hui)

1. Déclencheur `fn_statut_devoir` (BEFORE INSERT OR UPDATE) sur `homework_status` et `adult_homework_status` :
   - **gel (décision 6)** : « Effectué » ne change plus après la date de rendu (jour de Paris > `due_date`) ;
     « Vu » reste possible (ouvrir un devoir passé n'est pas tricher) ;
   - **horodatage par la base** : `done_at` / `seen_at` = `now()` à la bascule vers vrai, NULL vers faux ;
     la valeur envoyée par le navigateur est ignorée ;
   - **identité figée** : devoir, enfant, foyer et numéro de tuteur ne changent pas à la modification.
2. `adult_hwstatus_participant` (FOR ALL) remplacée par lecture + création + modification : un participant
   ne supprime plus son statut (la suppression contournait le gel).

### Code (`DevoirDetailModal`)

- « Vu » se pose seul à l'ouverture du devoir par le parent (une écriture, une fois), affiché en état.
- « Effectué » / « Pas fait » : bouton par enfant ; après la date de rendu, grisé avec la raison
  (« La date de rendu est passée. », `Tooltip` + `RaisonBloquee` sur téléphone).
- Écriture par `upsert` sur la clé unique (deux tuteurs du même enfant ne se gênent plus) et erreur affichée
  (la création échouait sans un mot).
- Suivi de l'enseignant : inchangé (colonnes Vu / Effectué avec date), vérifié.
- Procédure d'aide du cahier de texte relue.

### Contrôle 39

Parent : coche avant la date (ok), décoche avant la date (ok), coche ou décoche après (refusé), « Vu » après
(ok) ; `done_at` envoyé faux = remplacé par l'heure de la base ; changer d'enfant ou de devoir en
modification (refusé) ; adulte : suppression refusée, gel identique. Rouge avant, vert après ; tous les
contrôles rejoués.

### Ajouts faits pendant le lot 3

- La fenêtre du devoir proposait un bouton pour CHAQUE enfant du foyer, même hors de la classe du devoir (écriture
  refusée par la base) : seuls les enfants pour qui `devoir_de_mon_enfant()` répond vrai sont listés.
- Contrôle 37 : le devoir de l'ancienne classe est daté dans le futur, pour que son refus reste celui de la règle
  d'accès et non celui du gel.

---

## Lot 4 · ABANDONNÉ tel quel (décision 3 révisée le 03/11)

Remplacé par la mise en sommeil du push des parents (voir plus bas). Le texte qui suit est conservé pour
mémoire.

### Ancienne proposition

La LECTURE d'un bulletin (ligne et fichier PDF) est en base depuis le lot 2 ; l'écran qui les liste et les ouvre
est celui de l'espace famille (lot 6). Ce lot porte la notification « Bulletin disponible » (décision 3).

### Migration `espace-famille-bulletin-disponible.sql` (additive)

1. `notifications.type` accepte `bulletin`.
2. Déclencheurs sur `bulletin_archives` et `adult_bulletin_archives` :
   - à l'ARCHIVAGE, si l'option de l'école est active : une notification « Bulletin disponible » pour le foyer
     (« Le bulletin du T1 de NOM Prénom est disponible. »), avec la référence de l'archive ; pour un cours adulte,
     le numéro du tuteur concerné ;
   - au DÉSARCHIVAGE : la notification de cette archive est retirée (un bulletin désarchivé n'est plus lisible,
     sa notification mènerait à un document absent).
   La base écrit la notification dans la même transaction que l'archive : ni oubli, ni doublon.
3. `notifications_select_parent` : une notification adressée à UN tuteur (cours adulte) n'est lue que par lui.

### Code

- Après un archivage réussi, l'écran Bulletins demande l'envoi des notifications sur téléphone (push) aux
  comptes du foyer, option active seulement (action serveur, sans email : décision 3). Un échec du push ne
  touche pas l'archivage.
- Le push sort de `createNotification` dans une fonction partagée (`lib/notifications.ts`), une seule règle
  « quels comptes d'un foyer reçoivent le push ».
- Libellé du type `bulletin` dans l'écran Notifications.

### Contrôle 40

Archivage par la direction, école avec option : notification du bon foyer, lisible par ses deux tuteurs, pas par
un autre foyer ; cours adulte : lisible par le seul tuteur concerné ; école sans option : aucune notification ;
désarchivage : notification retirée ; ré-archivage : une seule notification. Rouge avant, vert après ; tous les
contrôles rejoués.

### Lot 4 révisé · push des parents en sommeil (fait le 03/11)

Le push n'existe que pour les parents (bouton « Activer les notifications » de l'écran Notifications, envoi par
`createNotification`). Décision 11 : en sommeil, réversible par une constante, comme l'était
`CREATE_PARENT_ACCOUNTS`.

- `lib/push-actif.ts` : `PUSH_ACTIF = false` (constante unique ; module à part de `lib/push.ts`, qui charge
  `web-push`, pour que l'écran client puisse la lire).
- `lib/notifications.ts` : aucun envoi push tant qu'elle est fausse (`push_status` = `no_sub`) ; email et
  notification inchangés.
- `NotificationsClient` : bouton d'abonnement masqué.
- `/api/notifications/subscribe` : refuse l'abonnement (aucun abonnement ne peut s'enregistrer par l'adresse).
- Aucune migration ; la table `push_subscriptions` reste (vide).

---

## Lot 5 · détail (révisé le 03/11 ; fait)

### Décisions (03/11)

12. Invitation valable **7 jours**, usage unique ; une nouvelle invitation annule la précédente.
13. Inviter, renvoyer, « Inviter les familles » : direction, secrétaire, resp. pédagogique (onglet « Parents »
    d'Utilisateurs seul pour ces deux rôles, option active) ; « Désactiver » / « Réactiver » : direction (révisé le 03/11).
14. Pas de case « Accès en ligne » : un **badge** « Accès en ligne » quand le tuteur a CONFIGURÉ son compte
    (mot de passe choisi). Couper l'accès d'un tuteur = « Désactiver » dans Utilisateurs > Parents.
15. Fiche parents : le badge seul. Liste des parents : colonne « Accès en ligne ». Statut et TOUS les boutons :
    Utilisateurs > Parents.
16. Le mot de passe temporaire (ancien code V1) disparaît : le parent choisit le sien par l'email d'invitation.

### Parcours d'invitation

1. Utilisateurs > Parents, « Inviter les familles » : fenêtre sur le modèle de « Cours adultes en lot »
   (`ParentsAdultSyncModal`) : une ligne par foyer, colonnes Tuteur 1 / Tuteur 2, un interrupteur par tuteur.
   - compte configuré : interrupteur COCHÉ et VERROUILLÉ (« Accès en ligne configuré ») ;
   - sans email : verrouillé décoché (« Aucun email ») ;
   - déjà invité, pas encore configuré : sélectionnable, « Invité le ... » affiché ;
   - « Tout sélectionner » / « Tout désélectionner » (sauf verrouillés), recherche, compteur ;
   - « Envoyer les invitations (n) » : envoi par paquets avec progression, compte rendu à la fin.
2. Pour chaque tuteur choisi, le serveur vérifie l'option et l'email, crée le compte s'il n'existe pas (rôle
   `parent`, sans mot de passe utilisable), le relie au tuteur, crée le jeton (7 jours, empreinte seule stockée).
3. Email par le SMTP de l'école, à sa marque : bouton « Activer mon accès », mention RGPD.
4. Page « Activer mon accès » (bouton POST, contre les antivirus qui ouvrent les liens) : jeton vérifié, session
   ouverte côté serveur, jeton consommé, puis « Choisissez votre mot de passe » (page existante). Le mot de passe
   enregistré, le tuteur est « configuré » (date posée par le serveur).

### Base (migration additive)

- `parents.tutor1_invite_le`, `tutor2_invite_le`, `tutor1_acces_configure_le`, `tutor2_acces_configure_le`.
- `foyer_du_compte()` exige en plus un profil ACTIF (« Désactiver » coupe l'accès immédiatement).
- Table `invitations_famille` (serveur uniquement : RLS sans règle, droits retirés).
- Garde : `tutor1/2_user_id` ne désigne qu'un compte `parent` de la MÊME école.

### Écrans

- **Utilisateurs > Parents** (onglet existant, masqué si l'option est coupée) : comptes parents avec foyer,
  tuteur, statut (Invité le ... / Accès en ligne, dernière connexion / Désactivé), actions « Renvoyer
  l'invitation » (non configuré), « Désactiver » / « Réactiver » ; bouton « Inviter les familles ».
- **Fiche parents** : badge « Accès en ligne » par tuteur configuré (rien d'autre).
- **Liste des parents** : colonne « Accès en ligne » (badge par tuteur configuré).
- Badge et colonne masqués si l'option est coupée.

### Vie du compte, sécurité, démonstration, aide

- Email du tuteur modifié = email du compte ; foyer supprimé = comptes supprimés (chemin existant, vérifié).
- Middleware : compte parent d'une école sans l'option = déconnecté, « L'espace famille n'est pas disponible. »
- `CREATE_PARENT_ACCOUNTS` et le mot de passe temporaire retirés.
- Démonstration : `parent1@` (foyer à deux enfants) et `parent2@demonstration.invalid` (cours adulte),
  configurés, recréés par « Réinitialiser ».
- Aide : « Inviter les familles », « Renvoyer une invitation », « Désactiver l'accès d'un parent ».

### Contrôle 40

Invitations illisibles (personnel, parent, anonyme) ; profil désactivé = plus de foyer ; tuteur relié à un compte
d'une autre école ou non parent = refusé.

### Livraison en deux temps

- 5a : base, invitation (envoi unitaire côté serveur, page d'activation), middleware, retrait de l'ancien code.
- 5b : Utilisateurs > Parents (statut, actions, fenêtre en lot), badge, colonne, démonstration, aide.

### Fait au 5a (03/11)

- Migration `espace-famille-invitations.sql` (jouée), contrôle 40 (20 essais, vert) ; contrôle 26 : la table
  `invitations_famille` rejoint la liste des tables serveur.
- `inviterTuteur` (`app/dashboard/utilisateurs/famille-actions.ts`) : compte créé au premier envoi, invitation
  préparée par la base, email à la marque de l'école (`lib/espace-famille/email-invitation.ts`). Sans écran : il
  est appelé par les écrans du 5b.
- Page `/auth/activer-acces` (bouton POST) : jeton vérifié côté serveur, session ouverte par un lien de
  réinitialisation généré et vérifié sans email, puis « Choisissez votre mot de passe » ; la date « accès
  configuré » est posée à l'enregistrement du mot de passe (`marquer_acces_configure`).
- Middleware : un compte `parent` (rôle explicite) d'une école sans l'option est renvoyé à la connexion,
  « L'espace famille n'est pas disponible. »
- Retirés : `CREATE_PARENT_ACCOUNTS`, la création de comptes à la création d'une fiche parents, l'affichage des
  mots de passe temporaires, `createParentAccount` (jamais appelé).
- Reporté au 5b : email du tuteur modifié = email du compte.

### Fait au 5b (03/11)

- Migration `espace-famille-comptes-parents.sql` (jouée) : `comptes_parents_ecole()` (admin, direction) rend chaque
  compte parent de l'école avec ses dates et sa DERNIÈRE CONNEXION (`auth.users`). Contrôle 41 (vert).
- Migration `espace-famille-depart.sql` (jouée) : `invitations_famille` effacée au départ d'une école mais jamais
  exportée (données techniques, comme `push_subscriptions`). Contrôle 08 vert (62 tables exportées).
- Utilisateurs > Parents (`ParentsComptesTable`) : tuteur, email, statut (Désactivé / Accès en ligne / Invité le ...
  / Invitation expirée), dernière connexion ; « Renvoyer l'invitation », « Désactiver » (confirmation) /
  « Réactiver » ; la ligne ouvre la fiche du foyer. Onglet absent sans l'option.
- « Inviter les familles » (`InviterFamillesModal`, modèle `ParentsAdultSyncModal`) : verrous « Accès en ligne
  configuré », « Aucun email », « Accès désactivé » ; envoi par paquets de 5, progression, échecs listés.
- Liste des parents : colonne « Accès en ligne » (T1 / T2) ; fiche : badge « Accès en ligne · NOM Prénom ».
- Email du tuteur modifié = adresse du compte modifiée AVANT la fiche (adresse prise = fiche inchangée), profil
  suivi, alerte à l'ancienne adresse. Foyer supprimé = comptes en ligne supprimés (ils restaient orphelins).
- Démonstration : `parent1@` (tuteur 1 du premier foyer à deux enfants) et `parent2@demonstration.invalid`
  (tuteur d'un cours adulte, autre foyer), mot de passe commun, accès configuré, reliés après chaque peuplement
  (`relierParentsDemo`) ; une démonstration créée a l'option active.
- **Constat** : l'écran Utilisateurs est réservé à l'admin et à la direction ; les boutons y étant tous
  (décision 15), seule la direction invite en pratique. Le serveur accepterait aussi la secrétaire et le
  responsable pédagogique (décision 13) : à trancher si un bouton doit leur être ouvert ailleurs.
- **Reporté au lot 7** : procédures d'aide (« Inviter les familles », « Renvoyer une invitation », « Désactiver
  l'accès d'un parent ») ; l'aide n'a pas de condition d'option, elle les montrerait à toutes les écoles.

### Après le 5b (03/11) : rôles et aide

- Utilisateurs ouvert à la secrétaire et au responsable pédagogique, onglet « Parents » SEUL, option active
  (entrée de menu `rolesEspaceFamille`) ; « Désactiver » / « Réactiver » grisés pour eux avec la raison.
  `comptes_parents_ecole()` leur est ouverte (`espace-famille-comptes-parents-roles.sql`, contrôle 41).
- Aide : condition `option: 'espace_famille'` sur une procédure ou un élément (`lib/aide/types.ts`), lue par la
  languette, le menu Aide, la page d'une procédure et le guide PDF. Procédure « Comptes parents (espace famille) »,
  tâche d'orientation dans « Utilisateurs », deux règles dans « Parents ». Plus de report au lot 7.

---

## Lot 6 · détail (6a fait le 03/11)

### Constats

- Le menu du parent pointe aujourd'hui vers des écrans du PERSONNEL (Saisie des notes, Bulletins, Feuille d'appel,
  Cahier de texte, Règlements) : sélection de classe, saisie, toute la classe. Décision 2 (pas de notes au fil de
  l'eau) : « Saisie des notes » ne doit plus lui être proposé.
- Le tableau de bord parent existant (`DashboardParent`, `lib/dashboard/parent.ts`) lit les NOTES et des tables
  que la base ne lui ouvre pas : à refaire.
- Un parent ne peut pas marquer une notification comme lue (aucune règle d'écriture) : l'écran échoue en silence.
- Le calcul financier d'UN foyer n'existe pas à part : il est noyé dans `family-financials.ts` (toute l'école).

### Menu du parent (tous visibles sur téléphone)

Accueil · Mes enfants · Emploi du temps · Devoirs · Absences · Bulletins · Règlements · Notifications ;
« Mes cours » pour un tuteur inscrit à un cours adulte. Les écrans du personnel lui sont retirés du menu ET
fermés par leur page (redirection vers l'espace famille).

### Écrans (`/dashboard/famille/...`, lecture seule sauf « Effectué »)

- **Accueil** (`/dashboard` pour le parent) : bonjour, ses enfants (classe, titulaire), les devoirs à rendre
  bientôt, les dernières absences, le reste à payer, les notifications non lues. Une page, sans défilement sur
  ordinateur.
- **Mes enfants** : pour chaque enfant, identité, classe de l'année, titulaire ; un enfant parti est signalé.
- **Emploi du temps** : semaine de l'enfant (jour par jour sur téléphone), séances annulées ou assurées par un
  remplaçant, vacances et jours fériés (même calcul que l'EDT de l'école : `lib/edt/seance.ts`,
  `lib/school-year/jours-fermes.ts`).
- **Devoirs** : à rendre / passés, par enfant ; le détail s'ouvre dans la fenêtre du devoir (« Vu »,
  « Effectué », lot 3).
- **Absences** : absences et retards de l'année, justifiés ou non, avec leur commentaire.
- **Bulletins** : par enfant, les périodes archivées de l'année ; « Ouvrir le bulletin » (PDF dans un onglet).
- **Règlements** : dû, payé, reste, échéances et réductions de l'année ; même calcul que l'écran Règlements de
  l'école (calcul d'UN foyer extrait de `family-financials.ts`, servi par `famille_finances()`).
- **Notifications** : l'écran existant, avec le marquage « lu » qui fonctionne.
- **Mes cours** (tuteur adulte) : son cours, son emploi du temps, ses devoirs, ses absences, son bulletin.
- Sélecteur d'enfant en tête des écrans quand il y en a plusieurs (mémorisé).

### Base (migration additive)

- `marquer_notifications_lues(ids)` : le parent marque SES notifications (et messages) lus ; rien d'autre.

### Livraison en deux temps

- 6a : menu, fermeture des écrans du personnel, Accueil, Mes enfants, Devoirs, Absences, Notifications (lues).
- 6b : Emploi du temps, Bulletins, Règlements, Mes cours.

Test sur le site déployé avec `parent1@` et `parent2@demonstration.invalid`.

### Fait au 6a (03/11)

- Migration `espace-famille-ecrans.sql` (jouée) : `famille_enfants()` (enfants, classe de l'année ou dernière
  retirée, départ) et `marquer_notification_lue(id, source)` (SA ligne seulement). Contrôle 42 (vert).
- Menu du parent : Tableau de bord, Notifications, Mes enfants, Devoirs, Absences (tous sur téléphone) ; retiré des
  entrées du personnel (Évaluations, EDT, Feuille d'appel, Cahier de texte, Financements).
- Middleware : un compte parent n'atteint que `/dashboard`, `/dashboard/famille/*`, Notifications et Mon compte ;
  `famille/layout.tsx` renvoie le personnel à son tableau de bord.
- Tableau de bord parent refait (tuiles enfants, devoirs de la semaine, absences, notifications ; plus de notes).
- Écrans `famille/enfants`, `famille/devoirs` (fenêtre du devoir du lot 3), `famille/absences` ; sélecteur
  d'enfant mémorisé (`SelecteurEnfant`).
- Notifications : le parent marque lu par la fonction (l'écriture directe était refusée).
- Le libellé du menu reste « Tableau de bord » (entrée commune à tous les rôles).
