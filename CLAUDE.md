# BILAL EDUCATION

Application de gestion scolaire (ecoles du soir / week-end : enfants ET cours adultes), vendue en
**editeur logiciel** : abonnement par etablissement, **un sous-domaine par ecole**
(`ecole.bilaleducation.fr`), **un deploiement et une base uniques** (multi-tenant).

- **Etat** : v1.0 en mise en production. Plan de suivi : `MISE_EN_PRODUCTION.md`.
- **Journal complet** (le POURQUOI de chaque decision) : `docs/JOURNAL.md`. Les nouvelles entrees
  s'y ajoutent EN FIN de fichier ; ce fichier-ci ne garde que l'essentiel.
- **Methode de travail** : ne rien modifier sans accord. Presenter le plan, attendre « go » ou
  « ok » (une preference exprimee n'est pas un go). Commit seulement sur « commit + push ».
- **Ne jamais utiliser ECOLE BILAL pour des tests destructifs** (ecole reelle). Ne jamais faire
  d'essais sur le compte de l'utilisateur pendant qu'il utilise le site.
- **Fichiers `.xlsx` et enregistrements d'ecran a la racine : jamais commites** (donnees reelles).

---

## 1. Stack et commandes

- **Next.js 16.3** (App Router + Turbopack), **React 19.2**, TypeScript.
- **Supabase** (PostgreSQL + RLS + Auth + Storage), projet en Europe.
- **Vercel**, fonctions epinglees en **`cdg1`** (`vercel.json`) — en `iad1` chaque requete
  traversait l'Atlantique.
- **Tailwind CSS 3** (`darkMode: ['selector', '[data-theme="dark"]']`).
- TipTap 3 (editeur riche), jsPDF 4 + autoTable (PDF), Recharts 3 (statistiques), dnd-kit,
  nodemailer 9 (SMTP par ecole), web-push, date-fns, DOMPurify, `read-excel-file` (import),
  `fflate` (export ZIP), lucide-react.
- **Sanitisation** : `src/lib/security/sanitize.ts` isomorphe (window natif au navigateur, jsdom
  au SSR via `require` paresseux). **jsdom epingle en 26.1.0** : Vercel lance les fonctions avec
  `--no-experimental-require-module`, jsdom >= 27.4 ne s'y charge plus. jsdom exclu du bundle
  client (`"browser": {"jsdom": false}` + `serverExternalPackages`).
- **Polices locales** (`src/app/fonts/`, `next/font/local`) : Inter + Noto Sans Arabic variables.
  Aucune dependance reseau au build. `public/fonts/NotoSansArabic-*.ttf` sert au PDF (jsPDF).

```bash
npm run dev          # http://localhost:3000
npm run build
npm run lint         # ESLint 9 (eslint.config.mjs) : 0 erreur ; ~515 avertissements (any)
npm run type-check
npm test             # node --test natif, 0 dependance (src/**/*.test.ts, scripts/**/*.test.mjs)
npm run sauvegarde   # sauvegarde locale complete (scripts/sauvegarder.mjs)
node scripts/migrations-etat.mjs   # ecart depot / registre des migrations
```

- **Sauvegarde** : `scripts/sauvegarder.mjs` -> `D:\# 2. Sauvegardes Supabase - BilalEducation`
  (pg_dump + fichiers Storage + configuration Supabase via jeton + manifeste + verification).
  Tache planifiee Windows (`sauvegarder.cmd`, ASCII + CRLF). Retention dans `scripts/lib/retention.mjs`.
- **psql** : `C:\Program Files\PostgreSQL\17\bin\psql.exe`, `SUPABASE_DB_URL` dans `.env.local`.

## 2. Structure

```
src/app/dashboard/      # ecrans de l'ecole (App Router)
src/app/superadmin/     # console de l'editeur (sous-domaine superadmin)
src/app/auth/, login/   # parcours d'authentification
src/components/         # composants par domaine ; ui/ = composants partages
src/lib/                # sources uniques (calculs, libelles, regles), clients Supabase
src/proxy.ts            # middleware : tenant, session, 2FA, abonnement
supabase/migrations/    # migrations (README.md = procedure)
supabase/controles/     # scripts de controle rejouables (bloc DO a exception volontaire)
supabase/email-templates/  # gabarits auth Supabase, generes par build.mjs (ne pas editer les .html)
scripts/                # sauvegarde, migrations-etat, generateurs (logos, gabarit d'import)
docs/JOURNAL.md         # journal de developpement complet
```

Architecture : **ecritures = server actions** (ou ecritures client protegees par la RLS),
**lectures = requetes dans les pages serveur**. Le « repository pattern » (`lib/database`) est
abandonne : ne pas y remettre d'ecriture.

## 3. Roles et droits

Roles (`profiles.role`, unique par compte) : `super_admin`, `admin`, `direction`, `comptable`,
`secretaire`, `responsable_pedagogique`, `enseignant`, `parent`.

- **`admin` = droits `direction` partout.** Exception : « ecrire a la direction » (CCI, destinataires)
  n'inclut pas l'admin.
- **Comptes parents suspendus en V1** (`CREATE_PARENT_ACCOUNTS = false`) ; le parcours parent est code.
- **Ecran Utilisateurs** = comptes SANS fiche metier (direction, comptable, secretaire, resp. pedago).
  Enseignant -> fiche enseignant (compte + profil + `teachers` atomique) ; parent -> fiche parents.
- **Enseignant** : ses classes (`teaches_class`, fenetre `effective_from/until`), ses eleves
  (`teaches_student`), sa propre ligne `teachers`. Lit l'EDT de toute l'ecole (document collectif,
  decision du 29/09) mais l'ecran ne lui montre que SON planning (+ classes qu'il remplace). Ne
  communique que les devoirs. Valide ses propres seances.
- **Remplacant** : ligne `class_teachers` `is_main_teacher = false` + dates. Voit le cahier de texte
  7 j avant sa prise de poste (RLS), voit et valide les seances de la classe pendant sa periode
  (heures a son nom, `replaced_profile_id` = titulaire). Le titulaire remplace ne valide plus.
- **Comptable** : Financements + Parametres -> Cotisations ; pas de notes/absences.
- **Resp. pedagogique** : pedagogie complete, enseignants dans Temps de presence (sans couts).
- **Secretaire** : eleves, parents, enseignants (sans suppression), classes, gabarits, notes,
  bulletins, affectations, feuille d'appel.
- **`super_admin`** (editeur) : console `/superadmin`, `etablissement_id` NULL. **Acces support** :
  il se RATTACHE a une ecole (« Intervenir », expiration 1 h) et `get_user_role()` repond alors
  `admin`. Rattachement exclusif, trace, theme non modifiable pendant l'intervention.
  `effectiveRole()` cote app ; `requireEditor()` (colonne brute) pour les actions de la console.
- **2FA (TOTP)** obligatoire pour tout le staff (`app_metadata.role` dans le jeton), et pour la console.
- Matrices RLS detaillees : `pg_policies` fait foi (jamais un fichier du depot).

## 4. Fonctionnalites par module

**Principal**
- **Tableau de bord** : 6 variantes par role (stats, recouvrement, a traiter, effectifs eleves +
  adultes, rappel de bascule de periode, raccourcis).
- **Notifications** : cloche in-app (messages internes), push.
- **Temps de presence** : saisie des heures/absences du staff par type de presence (codes 3 car.,
  types RESERVES absence/cours/activite lies a l'EDT), demi-journees d'absence, remplacements,
  recaps mensuel/annuel en modales + export PDF, couts selon role. Saisie reservee aux gestionnaires.
- **Mon compte** : identite, email (admin/direction), mot de passe, 2FA, theme, releve de temps.

**Vie scolaire**
- **Apprenants** : liste (classe, discipline, cartes filtres), fiche a onglets (identite, scolarite
  = archives des bulletins, discipline, documents), statuts en lot, suppression d'une fiche VIERGE
  seulement (sinon « Rendre inactif »).
- **Parents (foyers)** : 2 tuteurs, situation familiale, cours adultes par tuteur, onglet Scolarite
  adulte. Email du tuteur 1 obligatoire (NOT NULL en base).
- **Importation** (admin/direction) : `.xlsx` (gabarit `public/gabarit-import-apprenants.xlsx`),
  lecture et rapprochement dans le navigateur, `import_foyer()` atomique par foyer, notes medicales.
- **Affectations** apprenants et adultes (clic, une classe active par eleve et par annee).
- **Feuille d'appel** apprenants et adultes (trombinoscope, justificatifs prives, vue « toutes les
  classes » pour l'encadrement, feuille vierge et impression PDF).

**Pedagogie**
- **Gabarits d'evaluation** (date obligatoire, ordre UE/modules/evaluations par classe et periode),
  **Saisie des notes** (absences reportees de l'appel, garde anti-perte), **Bulletins** (PDF
  bilingue FR/AR, appreciations, archivage avec chiffres figes).
- **Emploi du temps** : vues jour / semaine / mois, grille 15 min (8 h-19 h, s'elargit au creneau le
  plus matinal), creneaux recurrents avec dates d'effet, menu « ... », validation de presence,
  vacances et jours feries bloquants, marquage des absences et remplacements.
- **Cahier de texte** : seances (internes) et devoirs (email aux familles par foyer) separes, en
  modales ; modification/suppression avec fenetre (devoir : avant la date de rendu ; seance : 7 j).
  Matiere forcee « General » en V1.

**Gestion**
- **Communications** : Parents (par classe, choisis, actifs, tous les contacts) et Equipe (email /
  notification / les deux), 1 email par foyer, CCI direction, Reply-To = contact de l'ecole,
  signature auto, PJ 1 Mo, historique « Messages envoyes » (perimetre en RLS).
- **Financements** : Reglements (plan de travail familles, paiements, reductions, echeances, relance
  par email, attestation PDF totale ou partielle, journal comptable), Statistiques (Recharts),
  Situation financiere (depenses/revenus, justificatifs prives). Calcul unique
  `src/lib/financements/compute.ts` ; ecritures d'argent atomiques (4 RPC).
- **Support technique** (admin/direction) : demandes ecrites en base AVANT l'email, historique.

**Cloture**
- **Passage d'annee** (admin/direction) : 6 audits relancables a volonte (Auditer / Reinitialiser,
  ordre alphabetique, liens « Corriger » vers les fiches), cloture apres la date de fin + 6 audits
  sans anomalie bloquante, archivage, purge (seul point de non-retour). Etat porte par
  `school_years` (`closed_at`, `archived_at`, `purged_at`).

**Parametres**
- Annees scolaires (periodes, periode en cours, vacances + jours feries, verrouillage des annees non
  courantes), Classes (titulaire, remplacements, historique, creneaux), Referentiel des cours
  (3 colonnes UE / modules / cours, FR + AR, suppression du vide seulement), Enseignants (documents,
  assiduite), Utilisateurs, Cotisations et taux, Types de presence, Ressources, Journal d'activite,
  Etablissement (identite, logo, documents requis, **Messagerie SMTP** + procedure integree).

**Console editeur (`superadmin.bilaleducation.fr`)**
- Liste des ecoles (inscrits / limite, derniere connexion), Sante, Facturation (releve mensuel
  pg_cron, tarif fige par releve), Demandes de support, Interventions.
- Fiche ecole : informations + facturation, acces et abonnement (activation, echeance, limite
  d'inscrits), mise en service (checklist), comptes, notes internes, depart d'une ecole (export ZIP
  puis effacement RGPD, fiche conservee et reouvrable).
- **Ecole de demonstration** (`est_demo`, slug `demonstration`) : donnees fictives cosmopolites,
  7 comptes `@demonstration.invalid`, bouton « Reinitialiser » (contenu date depuis le jour).

**Abonnement** : echeance = jour inclus (coupure le lendemain 0 h Paris, `lib/tenant/abonnement.ts`).
La base coupe aussi (18/10) : `current_etablissement_id()` rend NULL pour une ecole inactive ou
expiree (meme regle en SQL), sauf pour l'editeur en intervention. Toute policy doit donc porter l'ecole
via cette fonction, jamais via une sous-requete `profiles` (controle 16).
**Limite d'inscrits** = base facturable (eleves actifs + adultes inscrits), controlee en base.

## 5. Conventions et architecture

- **Multi-tenant** : tenant = sous-domaine (`x-etablissement-id` pose par le middleware, a preferer a
  une requete `profiles`). `app_metadata = { role, etablissement_id }` dans le jeton (middleware
  seulement ; l'autorite reste `profiles`).
- **RLS** : chaque policy porte le **tenant ET le role** (le cloisonnement ne remplace pas le role).
  `current_etablissement_id()` et `get_user_role()` (STABLE, `search_path` fixe). Gardes de RPC
  SECURITY DEFINER en `coalesce(get_user_role(), '')`. `FOR ALL` = les 4 commandes. Policies
  permissives s'ADDITIONNENT. Recursion entre policies -> fonction SECURITY DEFINER.
- **Tables sensibles « serveur uniquement »** (RLS sans policy + REVOKE) : `etablissement_smtp`,
  `etablissement_notes`, `etablissement_facturation`, `releves_facturation`, `support_interventions`,
  `migrations_appliquees`.
  Jamais de policy de lecture ; pas de trigger d'audit sur `etablissement_smtp` (secret).
- **Journal d'activite** : trigger `fn_audit_log()` (lit `auth.uid()`) + `logAudit` (colonne
  `description`). Tables ecrites avec le **client SESSION** ; client admin reserve aux comptes `auth`.
  Une ligne porte l'ecole et le `user_id` de l'appelant (policy) ; nom et email reecrits depuis
  `profiles` (`fn_audit_logs_auteur`).
  **Les comptes `admin` et l'editeur (`super_admin`) ne sont JAMAIS traces** (16/10) : declencheur
  `BEFORE INSERT` sur `audit_logs` (`fn_audit_logs_sans_editeur`), controle 10.
- **Adultes** : classe adulte = `cotisation_types.is_adult`. Participants =
  `parent_class_enrollments` (cle `parentId-tutorNumber`), tables miroir `adult_grades`,
  `adult_bulletin_appreciations`, `adult_bulletin_archives`, `adult_homework_status`,
  `adult_absences`. Jamais un adulte dans une table liee a `students`.
- **Fichiers** : buckets prives + URL signee (60 s), chemins `{etablissement_id}/...`, plafonds de
  taille et types MIME. Jamais `getPublicUrl` sauf logos. Supprimer **la ligne d'abord, le fichier
  ensuite**. Le SQL ne touche jamais `storage.objects`.
- **PDF et fichiers s'AFFICHENT dans un nouvel onglet** (20/10), jamais d'enregistrement force :
  `lib/pdf/ouvrir.ts` (`ouvrirOngletPdf` AU CLIC avant tout `await`, `afficherPdf` pour un jsPDF,
  `ouvrirDansOnglet` pour une URL signee). Jamais `doc.save()` ni `a.download` (sauf `.xlsx` / ZIP).
- **Emails** : SMTP par ecole (`etablissement_smtp`), `From` = adresse du compte SMTP (SPF/DKIM),
  nom de l'ecole en nom d'affichage, `Reply-To` = contact de l'ecole (auteur pour l'equipe).
  Coque unique `src/lib/email/shell.mjs` (marque EDITEUR pour auth/securite/support, marque ECOLE
  pour le reste). Auth : SMTP du projet Supabase, gabarits `supabase/email-templates/`, liens
  valables **1 heure** (`VALIDITE` de `build.mjs` = reglage Supabase), `token_hash` + bouton POST
  (`/auth/confirm`, anti Safe Links).
- **Session** : 24 h depuis `last_sign_in_at`, inactivite 20 min, traceur `app-session` consultatif
  (1 h 20), FAIL-OPEN, un seul ecrivain (le middleware), purge des deux variantes de domaine.
  Decision pure dans `src/lib/auth/session-decision.ts` (testee).
- **Numerotation** : eleves `ELV-AAAAMM-NNN`, enseignants `ENS-AAAAMM-NNN` (increment annuel,
  verrouille apres enregistrement).
- **Doublons** : enseignants (nom+prenom), apprenants (nom+prenom+date de naissance), tuteurs (une
  personne une seule fois par ecole), insensibles a la casse et aux accents (`norm_name` en base,
  `normalizeNom` / `sameName` cote app, `lib/doublons.ts` pour les messages).
- **Sources uniques** (ne jamais recopier) : `lib/financements/compute.ts`, `lib/auth/role-labels` (libelles + `tonRole`),
  `lib/teachers/nom`, `lib/school-year/jours-fermes.ts`, `lib/parents/situation-familiale.ts`,
  `lib/temps-presence/*`, `lib/evaluations/ordre.ts`, `lib/closure/ordre.ts`, `lib/mobile.ts`,
  `lib/navigation/retour.ts`, `lib/supabase/ecriture.ts`, `lib/tenant/*`, `lib/pdf/ouvrir.ts`.
- **Migrations** (`supabase/migrations/README.md`) : derniere ligne
  `SELECT enregistrer_migration('<fichier>','<sha>');` (empreinte via
  `node scripts/migrations-etat.mjs --ligne <fichier>`). **Additive -> migration d'abord ;
  restrictive -> code d'abord.** Tester en transaction annulee + controle (bloc DO a exception
  volontaire). Delimiteurs nommes (`$fn$`). Apres `REVOKE ... FROM public`, revoquer aussi `anon`.

## 6. Charte graphique

### Couleurs (tailwind.config.ts)
| Palette | Base | Role |
|---|---|---|
| `primary` (turquoise) | `#18aa99` (500) | EN COURS DE RETRAIT (18/10) : remplace page par page par le vert de marque |
| `secondary` (ardoise) | `#507583` (500) | textes forts (`secondary-800` = encre `#1f2e35`) |
| `amber` (orange dore) | `#ffa200` (500) | avertissements (ambre `-700` en texte) |
| `warm` (beige) | `#b6a798` (500) | neutres, fonds, bordures |
| `red` (Tailwind) | | erreurs, suppression, danger |
| `violet` | | categorie « adulte » (pastille) |
- **Aucune couleur nouvelle sans go** : reutiliser palettes et jetons existants. Pas de `green`
  pour un etat (-> `primary`), pas de `success`/`danger` (palettes supprimees), pas de bleu hors
  charte. Couleurs de CATEGORIE (emerald « activite » EDT, vert « Lecon ») a distinguer des ETATS.
- **Texte lisible = `text-warm-700`** (5,04:1). `warm-400` uniquement pour un etat inactif /
  verrouille. Jamais `warm-300/400/500/600` pour du texte.
- **Jetons de theme** (`globals.css`, `:root` + `[data-theme="dark"]`) : `--surface-page`,
  `--surface-card`, `--surface-sunken`, `--ink`, `--ink-muted`, `--line`, `--line-strong`,
  `--card-border`, `--card-shadow`, `--brand-surface` (`#0c5b51`) / `--brand-surface-2` /
  `--brand-accent` / `--brand-text|label|icon|muted`, **`--brand-tint` / `--brand-line` / `--brand-focus`**
  (fonds doux 8 %, bordures 30 %, halos 50 % ; accent en sombre), `--logo-shadow`, `--silhouette-ink`,
  `--scroll-thumb`, `--edt-absent-hachure`. **Une ombre ou couleur nouvelle = un jeton, jamais une
  valeur en dur dans une regle.**
- **Theme clair / sombre** : choix par utilisateur (`profiles.theme`), `data-theme` sur `<html>`.
  Le sombre passe par un **pont** dans `globals.css` (selecteurs PLATS scopes
  `:is(#main-content, [role="dialog"], [role="menu"])`) qui remappe les classes Tailwind ; tout nouveau composant
  hors `#main-content` (portail, toast) doit etre couvert. `bg-[#ffffff]` = blanc force (plaque de
  logo), `bg-white` est remappe.
- **Graphiques** : palette dataviz validee (clair `#18aa99 · #cc8200 · #2a78d6 · #e87ba4 · #4a3aa7`,
  sombre `#18aa99 · #cc8200 · #2a78d6 · #d9628f · #7d6bd0`), couleur liee a l'entite et non au rang.
- **Editeur riche** : 6 couleurs d'encre >= 5:1 (Encre `#1f2e35`, Marque `#0c5b51`, Bleu `#1d5aa8`,
  Violet `#4a3aa7`, Rouge `#b3261e`, Orange `#a35c00`).

### Typographie
- **Inter** (latin), **Noto Sans Arabic** (`font-arabic`, `dir="rtl"` sur les champs AR, sans gras).
- Listes : `text-xs` ; `.list-th` (11 px, majuscules, `--ink-muted`), `.list-th-compact` (px-2),
  `.list-td` (`py-[2px]`), `.list-name` (13 px medium) ; `.stat-label` (10 px gras majuscules) ;
  `.section-title` (titre d'encadre) ; `tabular-nums` pour les chiffres.

### Classes et composants partages
- **`.card`** (fond carte, bordure `--card-border`, `rounded-lg`, `p-6`). Tableau de liste =
  **`card p-0`** (jamais `card` seul). `.list-scroll` (scrollbar fine fond clair), `.sidebar-scroll`,
  `.h-ecran` (100dvh avec repli), `.logo-relief`, `.animate-fade-in`, `.nom-vague` (connexion).
- **Champs** (`ui/FloatFields.tsx`) : `FloatInput`, `FloatSelect`, `FloatTextarea`,
  `FloatCheckbox` (`card` / `danger-card` / `switch` / `compact`), `FloatPhoneInput`.
  Libelle flottant, `*` automatique si `required`. Props : `compact`, `locked` (pas `disabled`,
  ecrase), **`bordure`** (libelle sur le trait du cadre) = **style par defaut** ; `bordure={false}` seulement
  sur les ecrans de connexion.
  `FloatSelect` : `wrapperClassName` (souvent `w-fit`), valeur jamais vide si une option doit
  s'afficher (sentinelle `__all__`).
- **Boutons** (`FloatButton`) : `submit` (surface de marque — Valider/Enregistrer), `edit`
  (contour de marque — Modifier), `secondary` (Annuler), `danger` (Supprimer), `primary`, `brand`.
  `size="normal" | "mini"`, `loading`, `href` (rend un lien). En formulaire :
  `variant={isEditing ? 'edit' : 'submit'}`. Les classes `.btn-*` sont abandonnees.
- **Modales** : `FormModal` (saisie, portail), `ConfirmModal` (confirmation, recap via `children`).
  Toujours **portalisees dans `<body>`** (`animate-fade-in` capture le `fixed`).
- **Refonte du 15/10** : `.liste` / `.liste-entete` / `.ligne-active` (listes sans cadre, en-tete teinte,
  barre des actifs ; **survol des lignes integre a `.liste`**, jeton `--survol-ligne`, aucun `hover:` sur une
  ligne ; `.sans-survol` pour un total, un intertitre, un message vide ou un fond d'ETAT qui garde son
  propre survol ; tableau hors `.liste` = `hover:bg-warm-100` provisoire jusqu'a sa refonte), `FiltreSwitch` (filtres de liste en switch segmente), `.encadre-titre` (bandeau en
  degrade estompe des encadres de fiche, hauteur fixe), `Onglets` + `classeOnglet` (soulignement anime),
  `SwitchOuiNon` (choix binaire, option `seul`), jeton `--champ-verrou`. Le **vert de marque**
  (`--brand-surface`, sombre : `--brand-accent`) remplace le turquoise au fil des pages.
- **Autres** : `Tooltip` (jamais `title=`), `TruncatedText` (infobulle si coupe), `SearchField`
  (2 caracteres minimum), `ListStatCard` (cartes stat cliquables = filtres), `RaisonBloquee`
  (raison d'un bouton grise, sur telephone), `Cliquable`, `RouteSkeleton` (chargements), `Toast`
  (`useToast`), `OtpInput` (2FA 6 cases), `PasswordChecklist`, `RichTextEditor`.

### Regles d'interface
- **NOM avant Prenom** partout (`Civilite NOM Prenom` pour un enseignant).
- **Aucun tiret long** (`—` ni `–`) : separateur `·`, plages `09:00-12:00`.
- **Aucune icone sur un bouton a libelle** (pas de `+`) ; icone seule = `Tooltip` + `aria-label`.
- **Pas de `<h1>` de titre de page** (DashboardNav le rend). Pas de texte explicatif oisif. Pas d'emoji.
- **Lignes de liste cliquables** vers la fiche (`stopPropagation` sur nom/actions).
- **Apres enregistrement : retour a l'origine** (liste par defaut, `?from=` pour audit/parents),
  avec les filtres de la liste conserves (URL ou `sessionStorage`).
- **Selects demarrent vides** (placeholder `disabled hidden`), obligatoires si pertinent.
- **Modales de SAISIE** : fermeture X / Annuler seulement (ni fond ni Echap). Echap autorise sur
  une modale de confirmation.
- **Masquer** ce qui n'est jamais possible pour ce role ; **griser** (avec infobulle) ce qui l'est
  dans d'autres circonstances.
- **Ecrans sans barre de defilement de page** quand c'est possible (encadres resserres,
  listes bornees en hauteur).
- **Accessibilite** : onglets ARIA + deep-link `?tab=`, `role="alert"` sur les erreurs, `aria-pressed`
  sur les bascules, focus visible, contraste AA (4,5:1 petit texte).
- **Mobile** : sous 1024 px la sidebar devient un tiroir ; sous 768 px seuls 7 menus restent
  (Tableau de bord, Notifications, Temps de presence, Feuilles d'appel, EDT, Cahier de texte,
  Support). Liens des tableaux de bord vers les ecrans exclus neutralises (`Cliquable`).

## 7. Pieges a connaitre (une ligne chacun, details dans le journal)

- Une ecriture refusee par la RLS **ne leve rien**, elle touche 0 ligne : `.select()` +
  `verifierEcriture` (`lib/supabase/ecriture.ts`).
- Comptage `{ head: true }` impossible -> `count: null` ET `error: null` : jamais de `?? 0`.
- Filtre sur ressource imbriquee PostgREST : **`!inner`** obligatoire. `table(count)` compte tout.
- `.in()` sur tableau vide : sentinelle UUID. Deux `.or()` chaines = ET.
- Fonction `unstable_cache` = service-role = sans RLS : cloisonner chaque requete.
- Declencheur generique : jamais `OLD.col`/`NEW.col` par nom (`to_jsonb(...)->>'col'`) ;
  l'eprouver sur une table SANS la colonne.
- Une colonne NOT NULL sans defaut peut etre remplie par un declencheur `BEFORE INSERT`.
- Fichier `'use server'` : n exporte que des fonctions async (sinon 500).
- Jamais jsdom en import statique dans un module atteignable par un Client Component.
- Pipeline PostCSS sans nesting : CSS **plat** ; toujours **verifier le CSS SERVI**
  (`.next/static/chunks/*.css`) ; `hover:` sans `dark:hover:` deborde sur le sombre ; variantes
  d'opacite = classes distinctes ; le minifieur deduplique les replis (`@supports`).
- `flex-wrap` ne se propage pas aux enfants ; un groupe `shrink-0` deborde.
- Dates : jamais `toISOString()` pour une date locale ; `new Date('AAAA-MM-JJ')` = UTC
  (ajouter `T00:00`) ; comparer des chaines `AAAA-MM-JJ`.
- Un cookie n'a qu'un ecrivain ; un cookie httpOnly ne se purge que cote serveur.
- Popup : ouvrir l'onglet AVANT l'`await` (`window.open('', '_blank')`).
- `useFormStatus` dans un composant ENFANT du `<form>`. Drapeau d'hydratation = `state`, pas `ref`.
- `exhaustive-deps` signale la ligne du tableau de dependances, pas celle du hook.
- Apostrophes, backslashes et backticks cassent les scripts en ligne : passer par un fichier.
- Un controle qui ne mesure rien annonce « 0 » : verifier qu'il a lu quelque chose, et le voir
  ROUGE avant de le croire vert.
- Apres un deploiement, un onglet ouvert peut lever « An unexpected response was received from the
  server » (client perime) : banniere « nouvelle version » (`/api/version`), Ctrl+F5.
- `auth.admin.listUsers()` ne rend pas `factors` : utiliser `getUserById()`.
- Un joker TLS couvre UN niveau : jamais de `www.` sur un sous-domaine d'ecole.
- Une `NEXT_PUBLIC_*` se verifie en production dans le bundle servi.

## 8. Taches

### Fait (v1)
Tous les modules ci-dessus, audites (accessibilite, charte, theme sombre, mobile), RLS reprise sur
toutes les tables (role + tenant), audit des ecritures silencieuses, multi-etablissement,
console editeur, messagerie d'ecole eprouvee en reel, authentification eprouvee en reel, import reel
(103 foyers / 176 apprenants), tableau de bord refondu par role (une page sans defilement),
sauvegarde locale automatisee, tests automatises (session, ordre,
financements, retention…), ecole de demonstration.

### Reste a faire
1. **Refonte de l'interface** (15/10, page modele `/dashboard/test-design`, a GARDER) : lots 1 a 6 faits
   (champs `bordure`, recherche, en-tete en biais, listes, intitules d'encadres, onglets). **Passe PAGE PAR
   PAGE en cours (18/10)** : turquoise -> vert de marque, ETATS COMPRIS (decision utilisateur). Regle : texte
   `text-[var(--brand-surface)] dark:text-[var(--brand-accent)]` ; plein `bg-[var(--brand-surface)]
   dark:bg-[var(--brand-accent)]` (+ `dark:text-[var(--brand-surface-2)]` sur texte blanc) ; fond doux
   `--brand-tint` ; bordure `--brand-line` ; halo `--brand-focus` ; sur sidebar / header, halo
   `--brand-accent`. Pastilles d'etat = `Puce` (`components/dashboard/tdb.tsx`). Carte ou pilules qui
   FILTRENT une liste -> `FiltreSwitch` (compteur optionnel ; periodes aussi). Confirmations en
   `ConfirmModal`, saisies en `FormModal`, actions de ligne toujours visibles. Script de conversion :
   `scratchpad/marque.py` (a recreer si besoin, regle ci-dessus).
   **Etat au 21/10 au soir : refonte faite sur TOUTES les pages de l'ecole** (Principal, Vie scolaire,
   Pedagogie, Gestion, Cloture, Parametres, Mon compte, barre laterale). **Reste : la console editeur.**
   Regles appliquees partout (memoire `refonte-structure-pas-couleurs`) : listes en `.liste` SANS `card p-0`
   (survol integre, `--survol-ligne`, `.sans-survol`, `.ligne-active`) ; bandeaux `.encadre-titre` ; saisies
   en `FormModal`, confirmations en `ConfirmModal` (jamais « Confirmer / Annuler » en ligne) ; actions de ligne
   visibles ; `Puce` / `ton-*` pour les etats ; `Float*` et `SwitchOuiNon` pour les champs et choix oui / non ;
   etats vides d'une phrase ; grise = `--champ-verrou` / `warm-400` ; page sans defilement = un element
   elastique absorbe la hauteur. Graphiques : palette dataviz validee CONSERVEE (option A, 21/10).
   Sources uniques ajoutees le 21/10 : `tonRole()` (role-labels), `tonCategorie()` (support),
   `cahier-texte/commun.ts` (types de devoir, dates locales).
   **Ecart connu** : Bulletins, Classes archivees et Messages envoyes gardent une `card p-0` autour de leur
   `.liste` (faits avant la correction de la regle, 21/10) : a retirer a leur prochain passage.
   Methode : l'utilisateur inspecte une page, je propose, il valide (« go »), puis commit + push.
2. **Console editeur** : historique des actions editeur sur la fiche (point 4), etat 2FA dans la
   section Utilisateurs (point 5), filtres de la liste des ecoles (point 6).
3. **Ecole de demonstration** : enroler la 2FA des comptes ; y tester le depart d'une ecole et
   l'ordre des Gabarits.
4. **Jour J** : effacer les donnees de test, creer l'etablissement reel (admin + direction).
   `clean-all-data.sql` NE DOIT PAS servir tel quel (vide le registre des migrations et les tables
   editeur, laisse `auth.users` et Storage).
5. **Messagerie** : DMARC `p=none` -> `quarantine` -> `reject` quand les rapports sont propres ;
   montee en charge progressive ; service transactionnel a envisager a 200-300 foyers.
6. **Signale, non traite** : `description` des lignes manuelles du journal reste libre ; avis `npm audit` (brace-expansion, braces) ; email aux familles a la MODIFICATION d'un devoir ;
   `family_fees.subtotal` jamais rafraichi ; `import_foyer` ne compte que les eleves au pre-controle ;
   sortie des 503 `any` ; `.card-flush`
   inutilisee (adopter ou supprimer).
7. **Passes de fin de V1** : plan de test, tracabilite globale, valeurs en dur, accords « (s) »
   des toasts d'envoi.
8. **Secondaire (multi-professeurs, matieres)** : abandonne en V1, code conserve (palette de
   matieres, `isDndActive = false`, matiere « General »).

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
