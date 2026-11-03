# Espace famille (accès parent) · plan de suivi

Option PAYANTE par établissement. Développée à l'abri : tant qu'elle n'est pas prête, elle ne
s'active que sur l'école de démonstration. Le jour où tout est prêt : un commit d'une ligne, puis
l'option se vend école par école depuis la console.

État : **lot 1 terminé (03/11)**. Prochain : lot 2.

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

## Lots

| Lot | Contenu | État |
|---|---|---|
| 1 | Fondations en base : lien compte ↔ tuteur, option et tarif, fonctions, règles existantes réécrites, retrait de `parents.user_id` | fait (migrations A et B jouées, contrôle 37 vert) |
| 2 | Règles de lecture « mon foyer » (fiche, enfants, classes, EDT sans motif, absences, bulletins archivés, finances, cours adultes, décision 5) | à faire |
| 3 | Devoir fait : gel à la date de rendu, interface parent, suivi enseignant | à faire |
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
