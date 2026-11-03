# Espace famille (accès parent) · plan de suivi

Option PAYANTE par établissement. Développée à l'abri : tant qu'elle n'est pas prête, elle ne
s'active que sur l'école de démonstration. Le jour où tout est prêt : un commit d'une ligne, puis
l'option se vend école par école depuis la console.

État : **lots 1 et 2 terminés, lot 3 codé (03/11)** : migration à jouer après déploiement.

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
3. Notification « Bulletin disponible » : oui.
4. Finances : visibles en lecture (dû, payé, reste, échéances).
5. Après le départ du dernier enfant : accès fermé, sauf les bulletins archivés, consultables
   jusqu'à la fin de l'année scolaire.
6. « Fait » réversible jusqu'à la date de rendu incluse, figé ensuite (jugé par la base).
7. Pas de justification d'absence en ligne.
8. Tarif de l'option : modèle (c), forfait + prix par inscrit.
9. Option activée en cours de mois : le mois est dû (proposé, à confirmer au lot 7 ; le relevé du mois en cours
   est alors mis à jour, comme pour un changement de tarif).
10. Le commentaire d'une absence est visible de la famille ; bulletins : année en cours seulement (03/11).

## Lots

| Lot | Contenu | État |
|---|---|---|
| 1 | Fondations en base : lien compte ↔ tuteur, option et tarif, fonctions, règles existantes réécrites, retrait de `parents.user_id` | fait (migrations A et B jouées, contrôle 37 vert) |
| 2 | Règles de lecture « mon foyer » (fiche, enfants, classes, EDT sans motif, absences, bulletins archivés, finances, cours adultes, décision 5) | fait (migration jouée, contrôle 38 vert) |
| 3 | Devoir fait : gel à la date de rendu, interface parent, suivi enseignant | codé, contrôle 39 vert en essai ; migration après déploiement |
| 4 | Bulletins : lecture du fichier, notification « Bulletin disponible » | à faire |
| 5 | Comptes et invitations : email d'invitation, case « Accès en ligne » par tuteur, Utilisateurs > Parents, envoi en lot, comptes parents de démonstration | à faire |
| 6 | Écrans de l'espace famille (téléphone d'abord), notifications lues | à faire |
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
