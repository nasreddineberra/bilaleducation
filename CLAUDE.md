# BILAL EDUCATION

Application de gestion scolaire (ecoles du soir / week-end : enfants ET cours adultes), vendue en
**editeur logiciel** : abonnement par etablissement, **un sous-domaine par ecole**
(`ecole.bilaleducation.fr`), **un deploiement et une base uniques** (multi-tenant).

- **Etat** : v1.0 en mise en production. Plan de suivi : `MISE_EN_PRODUCTION.md`.
- **Journal complet** (le POURQUOI de chaque decision, l'historique des chantiers) : `docs/JOURNAL.md`
  (700 Ko : chercher par Grep, jamais le lire en entier). Les nouvelles entrees s'y ajoutent EN FIN de
  fichier ; ce fichier-ci ne garde que les regles et ce qui reste a faire.
- **Methode de travail** : ne rien modifier sans accord. Presenter le plan, attendre « go » ou
  « ok » (une preference exprimee n'est pas un go). Commit seulement sur « commit + push ».
- **Ne jamais utiliser ECOLE BILAL pour des tests destructifs** (ecole reelle). Ne jamais faire
  d'essais sur le compte de l'utilisateur pendant qu'il utilise le site. Pas de serveur local : les
  essais se font sur le site deploye (ecole de demonstration).
- **Fichiers `.xlsx` et enregistrements d'ecran a la racine : jamais commites** (donnees reelles).

---

## 1. Stack et commandes

- **Next.js 16.4.2** (App Router + Turbopack), **React 19.2**, TypeScript. **Node.js 24.x** fixe par `engines`
  (version executee visible dans la console, infobulle de la pastille de version).
- **Supabase** (PostgreSQL + RLS + Auth + Storage), projet en Europe.
- **Vercel**, fonctions epinglees en **`cdg1`** (`vercel.json`) : en `iad1` chaque requete
  traversait l'Atlantique.
- **Tailwind CSS 3** (`darkMode: ['selector', '[data-theme="dark"]']`).
- TipTap 3 (editeur riche), jsPDF 4 + autoTable (PDF), Recharts 3 (statistiques), dnd-kit,
  nodemailer 10 (SMTP par ecole), web-push, date-fns, DOMPurify, `read-excel-file` (import),
  `fflate` (export ZIP), lucide-react, zod 4.
- **Sanitisation** : `src/lib/security/sanitize.ts` isomorphe (window natif au navigateur, jsdom
  au SSR via `require` paresseux). **jsdom epingle en 26.1.0** : Vercel lance les fonctions avec
  `--no-experimental-require-module`, jsdom >= 27.4 ne s'y charge plus. jsdom exclu du bundle
  client (`"browser": {"jsdom": false}` + `serverExternalPackages`).
- **Polices locales** (`src/app/fonts/`, `next/font/local`) : Inter + Noto Sans Arabic variables.
  Aucune dependance reseau au build. `public/fonts/NotoSansArabic-*.ttf` sert au PDF (jsPDF).

```bash
npm run build
npm run lint         # ESLint 9 (eslint.config.mjs) : 0 erreur ; ~161 avertissements (153 any au lint au 30/10)
npm run type-check
npm test             # node --test natif, 0 dependance (src/**/*.test.ts, scripts/**/*.test.mjs)
npm run sauvegarde   # sauvegarde locale complete (scripts/sauvegarder.mjs)
npm run types-db     # types de la base -> src/types/supabase.ts (A RELANCER apres toute migration)
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
scripts/                # sauvegarde, migrations-etat, generateurs (logos, gabarit d'import, pont console)
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
  (`teaches_student`), sa propre ligne `teachers`. Lit l'EDT de toute l'ecole (document collectif)
  mais l'ecran ne lui montre que SON planning (+ classes qu'il remplace). Ne communique que les
  devoirs. Valide ses propres seances.
- **Remplacant** : decision « Remplacee par » d'une absence d'enseignant, seance par seance (plus jamais une ligne
  `class_teachers`, refusee depuis le lot 5). Voit le cahier de texte 7 j avant a 7 j apres, valide les seances qu'il
  assure (heures a son nom, `replaced_profile_id` = titulaire). Le titulaire remplace ne valide plus.
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

## 4. Modules (regles metier qui ne se lisent pas d'un coup d'oeil dans le code)

- **Tableau de bord** : une variante par role, une page sans defilement. En-tete : bonjour a gauche, date et
  periode a droite, plus de raccourcis (28/10). Plein ecran : icone de la barre du haut, ordinateur seulement (`Maximize2`).
  « A traiter » : une ligne URGENTE (seances d'absence a decider) passe en tete, bandeau ambre `.ligne-urgente`.
- **Temps de presence** : codes 3 car. ; types RESERVES absence/cours/activite lies a l'EDT ; saisie
  reservee aux gestionnaires ; couts selon le role.
- **Apprenants** : suppression d'une fiche VIERGE seulement (sinon « Rendre inactif »).
- **Parents (foyers)** : 2 tuteurs, cours adultes par tuteur. Email du tuteur 1 obligatoire (NOT NULL).
- **Importation** (admin/direction) : `.xlsx` (gabarit `public/gabarit-import-apprenants.xlsx`), lecture
  dans le navigateur, `import_foyer()` atomique par foyer.
- **Affectations** : une classe active par eleve et par annee. **Correction** = retrait d'un enfant SANS
  donnees (inscription supprimee) ; **Depart** = « Declarer un depart » d'un enfant AVEC donnees
  (`declarer_depart_*` : `withdrawn` + `date_depart`, eleve inactif, trace `mouvements_inscription`
  ecrite par la base). Un retour dans l'annee annule le depart ; seul le DERNIER depart compte.
- **Notes / bulletins** : gabarits a date obligatoire (ordre `lib/evaluations/ordre.ts`), absences
  reportees de l'appel, bulletins PDF bilingues FR/AR archives avec chiffres figes.
- **Planning, absences, presence** (chantier TERMINE le 29/10, `docs/CONCEPTION-PLANNING-ABSENCES.md`) : une
  information = un ecran qui l'ecrit. QUI ASSURE une seance se DEDUIT a la date (`lib/edt/seance.ts`) : rien n'est
  recopie sur un creneau (plus de `schedule_slots.teacher_id`, `class_teachers` = titulaires seuls, seance
  « modifiee » = salle seule, controle 34). Validation par la base (`valider_seance`), seance validee intouchable.
- **Absences enseignants** (seul ecran qui les ecrit) : date + HEURE exactes, seance touchee des qu'elle chevauche ;
  decisions par seance : Remplacee par (tout membre actif de l'equipe, jamais occupe) / Annulee / A decider (= aucune
  ligne) ; declarent encadrement + secretaire ; enseignant et comptable LISENT tout (liste + fiche via
  `absences_enseignants_information`) ; motif visible de tout le personnel, jamais des parents. Familles prevenues
  (case) d'une annulation, d'un retablissement, d'un remplacement (decochee). Heures du remplacant a la validation.
  Lecture unique : `chargerAbsencesEtSeances` / `chargerAbsencesInformation` (`lib/absences-enseignants/contexte.ts`).
- **EDT** : grille 15 min (8 h-19 h, elargie au creneau le plus matinal), creneaux recurrents avec dates
  d'effet, vacances et jours feries bloquants (`lib/school-year/jours-fermes.ts`). Creneau = cours (matiere
  = unite d'enseignement, facultative) ou activite (nom facultatif) ; type FIGE apres creation (il decide du
  code de presence) ; enseignant facultatif (« Prof non affecte », en rouge). Intitule : `lib/edt/intitule.ts`.
- **Cahier de texte** : seances (internes) et devoirs (email aux familles par foyer). Modification :
  devoir avant la date de rendu, seance 7 j. Matiere forcee « General » en V1.
- **Communications** : 1 email par foyer, CCI direction, Reply-To = contact de l'ecole, PJ 1 Mo.
- **Financements** : calcul unique `lib/financements/compute.ts` (`lignesCotisation`) ; ecritures
  d'argent atomiques (4 RPC). **Regle de depart** (encadre en tete de Cotisations,
  `definir_regle_ajustement(p_regle, p_retroactif)`) : Due en totalite (DEFAUT) / Au prorata (mois
  commence depuis la rentree, frais d'inscription toujours dus) / Au cas par cas (« Decider » dans
  Reglements) / Sans ajustement ; une arrivee doit l'annee ; departs charges par
  `lib/financements/departs.ts`. Controles 21 a 23.
- **Support** : demande ecrite en base AVANT l'email.
- **Passage d'annee** (admin/direction) : 6 audits relancables, cloture apres la date de fin sans
  anomalie bloquante, archivage, purge (seul point de non-retour). Etat porte par `school_years`
  (`closed_at`, `archived_at`, `purged_at`).
- **Console editeur** : ecoles, Sante (`lib/tenant/sante.ts` : 1 signal = a surveiller, 2+ = critique,
  demo jamais), Facturation (releve mensuel pg_cron, tarif fige), Support, Interventions, recherche
  Ctrl+K. Depart d'une ecole : export ZIP OBLIGATOIRE puis effacement RGPD, fiche reouvrable.
- **Ecole de demonstration** (`est_demo`, slug `demonstration`) : donnees fictives, 7 comptes
  `@demonstration.invalid`, « Reinitialiser » (recree aussi les comptes disparus ; leur 2FA est alors
  a reenroler). « Intervenir » grise tant qu'elle n'est pas reinitialisee. JAMAIS de donnees reelles.
- **Abonnement** : echeance = jour inclus (coupure le lendemain 0 h Paris, `lib/tenant/abonnement.ts`).
  La base coupe aussi : `current_etablissement_id()` rend NULL pour une ecole inactive ou expiree, sauf
  pour l'editeur en intervention. Toute policy porte donc l'ecole via cette fonction, jamais via une
  sous-requete `profiles` (controle 16). **Limite d'inscrits** = eleves actifs + adultes inscrits,
  controlee en base (seul juge).
- `clean-all-data.sql` NE DOIT JAMAIS servir tel quel (vide le registre des migrations et les tables
  editeur, laisse `auth.users` et Storage).

## 5. Conventions et architecture

- **Multi-tenant** : tenant = sous-domaine (`x-etablissement-id` pose par le middleware, a preferer a
  une requete `profiles`). `app_metadata = { role, etablissement_id }` dans le jeton (middleware
  seulement ; l'autorite reste `profiles`). Jamais une ecole nommee dans une regle ou une procedure.
- **Types de la base** : clients Supabase types (`createClient<Database>`). `src/types/supabase.ts` est
  GENERE (`npm run types-db`, jamais edite) : CHECK `IN (...)` lus en unions, `etablissement_id` facultatif
  a l'insertion des tables a declencheur `set_etablissement_id`, parametres SQL acceptant NULL. Forme des
  colonnes jsonb : `src/types/json.ts` (`ColonnesJson`, a tenir a jour). `src/types/database.ts` DERIVE
  des types generes (aucune copie a la main). Rendu jsonb d'une RPC : type declare + `as unknown as`.
- **RLS** : chaque policy porte le **tenant ET le role** (le cloisonnement ne remplace pas le role).
  `current_etablissement_id()` et `get_user_role()` (STABLE, `search_path` fixe). Gardes de RPC
  SECURITY DEFINER en `coalesce(get_user_role(), '')`. `FOR ALL` = les 4 commandes. Policies
  permissives s'ADDITIONNENT. Recursion entre policies -> fonction SECURITY DEFINER.
- **Tables sensibles « serveur uniquement »** (RLS sans policy + REVOKE) : `etablissement_smtp`,
  `etablissement_notes`, `etablissement_facturation`, `releves_facturation`, `support_interventions`,
  `migrations_appliquees`. Jamais de policy de lecture ; pas de trigger d'audit sur `etablissement_smtp`.
- **Journal d'activite** : trigger `fn_audit_log()` (lit `auth.uid()`) + `logAudit` (colonne
  `description`). Tables ecrites avec le **client SESSION** ; client admin reserve aux comptes `auth`.
  Nom et email reecrits depuis `profiles` (`fn_audit_logs_auteur`). **Les comptes `admin` et
  l'editeur ne sont JAMAIS traces** (`fn_audit_logs_sans_editeur`, controle 10).
- **Adultes** : classe adulte = `cotisation_types.is_adult`. Participants =
  `parent_class_enrollments` (cle `parentId-tutorNumber`), tables miroir `adult_grades`,
  `adult_bulletin_appreciations`, `adult_bulletin_archives`, `adult_homework_status`,
  `adult_absences`. Jamais un adulte dans une table liee a `students`.
- **Fichiers** : buckets prives + URL signee (60 s), chemins `{etablissement_id}/...`, plafonds de
  taille et types MIME. Jamais `getPublicUrl` sauf logos. Photos d'eleves : `students.photo_url` = CHEMIN,
  adresse signee 1 h a l'affichage (`lib/students/photo.ts`, exception justifiee : liste reaffichee), 500 Ko. Supprimer **la ligne d'abord, le fichier
  ensuite**. Le SQL ne touche jamais `storage.objects`.
- **PDF et fichiers s'AFFICHENT dans un nouvel onglet** : `lib/pdf/ouvrir.ts` (`ouvrirOngletPdf` AU
  CLIC avant tout `await`, `afficherPdf` pour un jsPDF, `ouvrirDansOnglet` pour une URL signee).
  Jamais `doc.save()` ni `a.download` (sauf `.xlsx` / ZIP).
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
- **Sources uniques** (ne jamais recopier) : `lib/financements/compute.ts`, `lib/auth/role-labels`
  (libelles + `tonRole`), `lib/teachers/nom`, `lib/school-year/jours-fermes.ts`,
  `lib/parents/situation-familiale.ts`, `lib/temps-presence/*`, `lib/evaluations/ordre.ts`,
  `lib/closure/ordre.ts`, `lib/mobile.ts`, `lib/navigation/retour.ts`, `lib/supabase/ecriture.ts`,
  `lib/tenant/*`, `lib/pdf/ouvrir.ts`, `components/cahier-texte/commun.ts`, `lib/parents/participant.ts`
  (cle adulte `parentId-tutorNumber`), `tonCategorie()` (support),
  `lib/texte/pluriel.ts` (`pluriel` / `accord` : jamais « (s) » dans un texte affiche),
  `lib/texte/genre.ts` (`accordGenre` : jamais « (e) », tournure neutre hors masculin / feminin),
  `lib/students/photo.ts`, `lib/edt/intitule.ts`, `lib/teachers/titulaire.ts` (temps reel : `titulaireActuel` = principal
  sans date de fin ; recapitulatif / historique : `libelleTitulaires` = « initial puis remplacant »), `lib/edt/salles.ts` (salles de cours libres pour une seance),
  `lib/edt/absences.ts` (seances touchees par une absence d'enseignant ; meme regle que la base, controle 29),
  `lib/absences-enseignants/familles.ts` (emails seance annulee / maintenue, 1 par foyer et par classe),
  `lib/email/destinataires-classe.ts` (foyers d'une classe : devoirs, seances), `lib/temps-presence/saisie.ts`
  (`estTypeSaisissable` : ni absence, ni cours, ni activite),
  `lib/erreur.ts` (`messageErreur` : message d'une erreur levee, `Error` ou PostgREST),
  `lib/edt/seance.ts` (QUI ASSURE une seance, deduit a la date : annulee, remplacant,
  titulaire en poste, sinon « Prof non affecte » ; jamais `schedule_slots.teacher_id`).
- **Migrations** (`supabase/migrations/README.md`) : derniere ligne
  `SELECT enregistrer_migration('<fichier>','<sha>');` (empreinte via
  `node scripts/migrations-etat.mjs --ligne <fichier>`). **Additive -> migration d'abord ;
  restrictive -> code d'abord.** Tester en transaction annulee + controle (bloc DO a exception
  volontaire). Delimiteurs nommes (`$fn$`). Apres `REVOKE ... FROM public`, revoquer aussi `anon`.
  **Apres une migration de structure : `npm run types-db` puis `npm run type-check`** (jeton
  `SUPABASE_TYPES_TOKEN` de `.env.local`, permission Database = Read, a recreer a expiration).
  Une fonction NOUVELLE n'est executable ni par PUBLIC ni par `anon` (defauts changes le 26/10,
  controle 25) : l'octroyer explicitement a `authenticated` ; a `anon` seulement si une page publique
  en a besoin (une regle d'acces qui l'appelle ferait sinon lever les requetes anonymes).
  Depuis le 27/10 `anon` n'a AUCUN droit de table ni de sequence dans `public`, nouvelles comprises
  (controle 26) : une page publique lit par la cle serveur, jamais en anonyme. Une nouvelle table
  active TOUJOURS la RLS (le controle 26 le verifie aussi).

## 6. Charte graphique

### Couleurs (tailwind.config.ts)
| Palette | Base | Role |
|---|---|---|
| `primary` (turquoise) | `#18aa99` (500) | RETIRE de l'interface : ne plus l'utiliser (vert de marque a la place) ; reste dans la palette dataviz |
| `secondary` (ardoise) | `#507583` (500) | textes forts (`secondary-800` = encre `#1f2e35`) |
| `amber` (orange dore) | `#ffa200` (500) | avertissements (ambre `-700` en texte) |
| `warm` (beige) | `#b6a798` (500) | neutres, fonds, bordures |
| `red` (Tailwind) | | erreurs, suppression, danger |
| `violet` | | categorie « adulte » (pastille) |
- **Vert de marque** (etats compris) : texte `text-[var(--brand-surface)] dark:text-[var(--brand-accent)]` ;
  plein `bg-[var(--brand-surface)] dark:bg-[var(--brand-accent)]` (+ `dark:text-[var(--brand-surface-2)]`
  sur texte blanc) ; fond doux `--brand-tint` ; bordure `--brand-line` ; halo `--brand-focus` (sur
  sidebar / header : `--brand-accent`). Pastilles d'etat = `Puce` / `ton-*` (`components/dashboard/tdb.tsx`).
- **Aucune couleur nouvelle sans go** : reutiliser palettes et jetons existants. Pas de `green`
  pour un etat, pas de `success`/`danger` (palettes supprimees), pas de bleu hors charte. Couleurs de
  CATEGORIE (emerald « activite » EDT, vert « Lecon ») a distinguer des ETATS.
- **Texte lisible = `text-warm-700`** (5,04:1). `warm-400` uniquement pour un etat inactif /
  verrouille. Jamais `warm-300/400/500/600` pour du texte.
- **Jetons de theme** (`globals.css`, `:root` + `[data-theme="dark"]`) : `--surface-page`,
  `--surface-card`, `--surface-sunken`, `--ink`, `--ink-muted`, `--line`, `--line-strong`,
  `--card-border`, `--card-shadow`, `--brand-surface` (`#0c5b51`) / `--brand-surface-2` /
  `--brand-accent` / `--brand-text|label|icon|muted`, `--brand-tint` / `--brand-line` / `--brand-focus`
  (fonds doux 8 %, bordures 30 %, halos 50 % ; accent en sombre), `--survol-ligne`, `--champ-verrou`,
  `--logo-shadow`, `--silhouette-ink`, `--scroll-thumb`, `--edt-absent-hachure`, `--edt-jour` (colonne du jour, 4 %).
  **Une ombre ou couleur
  nouvelle = un jeton, jamais une valeur en dur dans une regle.**
- **Theme clair / sombre** : choix par utilisateur (`profiles.theme`), `data-theme` sur `<html>`.
  Le sombre passe par un **pont** dans `globals.css` (selecteurs PLATS scopes
  `:is(#main-content, [role="dialog"], [role="menu"])`) qui remappe les classes Tailwind ; tout nouveau
  composant hors `#main-content` (portail, toast) doit etre couvert. `bg-[#ffffff]` = blanc force
  (plaque de logo), `bg-white` est remappe.
- **Graphiques** : palette dataviz validee (clair `#18aa99 · #cc8200 · #2a78d6 · #e87ba4 · #4a3aa7`,
  sombre `#18aa99 · #cc8200 · #2a78d6 · #d9628f · #7d6bd0`), couleur liee a l'entite et non au rang.
- **Editeur riche** : 6 couleurs d'encre >= 5:1 (Encre `#1f2e35`, Marque `#0c5b51`, Bleu `#1d5aa8`,
  Violet `#4a3aa7`, Rouge `#b3261e`, Orange `#a35c00`).

### Console editeur (palette propre)
- **Graphite `#16181d` + citron vert `#c8f169`**. `data-espace="console"` sur `<html>` (script de
  `app/layout.tsx`, theme clair impose) ; bloc `:root[data-espace="console"]` de `globals.css` qui
  redefinit `--brand-*`, les neutres, `--etat-*` et ajoute `--console-*`. L'ecole n'est jamais touchee.
- Citron vert JAMAIS en indicateur sur blanc (l'actif y est graphite) ; **tout bouton citron vert a une
  bordure** (`--console-accent-trait`) ; `FloatButton submit` = citron vert via `bouton-principal` ;
  `.mono` = police a chasse fixe du systeme. Pas de titre de page (l'onglet suffit).
- Pont des beiges `warm-*` vers les gris console : bloc genere en fin de `globals.css` par
  `scripts/generer-pont-console.cjs`, **a relancer si une classe `warm-*` nouvelle apparait**.

### Typographie
- **Inter** (latin), **Noto Sans Arabic** (`font-arabic`, `dir="rtl"` sur les champs AR, sans gras).
- Listes : `text-xs` ; `.list-th` (11 px, majuscules, `--ink-muted`), `.list-th-compact` (px-2),
  `.list-td` (`py-[2px]`), `.list-name` (13 px medium) ; `.stat-label` (10 px gras majuscules) ;
  `.section-title` (titre d'encadre) ; `tabular-nums` pour les chiffres.

### Classes et composants partages
- Page modele : `/dashboard/test-design` (a GARDER).
- **Listes** : `.liste` / `.liste-entete` / `.ligne-active` (sans cadre, en-tete teinte, barre des actifs).
  **Le survol est integre a `.liste`** (`--survol-ligne`) : aucun `hover:` sur une ligne ; `.sans-survol`
  pour un total, un intertitre, un message vide ou un fond d'ETAT. L'ancien cadre `card p-0` ne sert plus
  aux nouvelles listes (il en reste quelques-uns).
- **`.card`** (fond carte, bordure `--card-border`, `rounded-lg`, `p-6`). `.encadre-titre` (bandeau en
  degrade des encadres de fiche, hauteur fixe). `.list-scroll`, `.sidebar-scroll`, `.h-ecran` (100dvh avec
  repli), `.logo-relief`, `.animate-fade-in`, `.nom-vague` (connexion).
- **Champs** (`ui/FloatFields.tsx`) : `FloatInput`, `FloatSelect`, `FloatTextarea`,
  `FloatCheckbox` (`card` / `danger-card` / `switch` / `compact`), `FloatPhoneInput`.
  Libelle flottant, `*` automatique si `required`. Props : `compact`, `locked` (pas `disabled`),
  **`bordure`** = **style par defaut** ; `bordure={false}` seulement sur les ecrans de connexion.
  `FloatSelect` : `wrapperClassName` (souvent `w-fit`), valeur jamais vide si une option doit
  s'afficher (sentinelle `__all__`). Choix oui / non = `SwitchOuiNon` (option `seul`).
- **Filtres de liste** : `FiltreSwitch` (switch segmente, compteur optionnel, periodes aussi) ; toute carte
  ou pilule qui FILTRE une liste devient un `FiltreSwitch` (`ListStatCard` ne reste qu'a l'existant).
- **Boutons** (`FloatButton`) : `submit` (surface de marque, Valider/Enregistrer), `edit`
  (contour de marque, Modifier), `secondary` (Annuler), `danger` (Supprimer), `primary`, `brand`.
  `size="normal" | "mini"`, `loading`, `href` (rend un lien). En formulaire :
  `variant={isEditing ? 'edit' : 'submit'}`. Les classes `.btn-*` sont abandonnees.
- **Modales** : `FormModal` (saisie), `ConfirmModal` (confirmation, recap via `children` ; jamais
  « Confirmer / Annuler » en ligne). Toujours **portalisees dans `<body>`** (`animate-fade-in` capture le `fixed`).
- **Autres** : `Onglets` + `classeOnglet`, `Tooltip` (jamais `title=`), `TruncatedText`, `SearchField`
  (2 caracteres minimum), `RaisonBloquee` (raison d'un bouton grise, sur telephone), `Cliquable`,
  `RouteSkeleton`, `Toast` (`useToast`), `OtpInput` (2FA 6 cases), `PasswordChecklist`, `RichTextEditor`,
  `SaisieConfirmation` (texte a retaper avant une action grave : collage refuse, espace entre deux mots
  seulement, juge par `saisieConforme` de `lib/texte/saisie-confirmation.ts` ; jamais un `FloatInput` nu).

### Regles d'interface
- **NOM avant Prenom** partout (`Civilite NOM Prenom` pour un enseignant).
- **Aucun tiret long** (`—` ni `–`) : separateur `·`, plages `09:00-12:00`.
- **Aucune icone sur un bouton a libelle** (pas de `+`) ; icone seule = `Tooltip` + `aria-label`.
- **Pas de `<h1>` de titre de page** (DashboardNav le rend). Pas de texte explicatif oisif. Pas d'emoji.
  Etats vides d'une phrase.
- **Lignes de liste cliquables** vers la fiche (`stopPropagation` sur nom/actions) ; actions de ligne
  toujours visibles.
- **Apres enregistrement : retour a l'origine** (liste par defaut, `?from=` pour audit/parents),
  avec les filtres de la liste conserves (URL ou `sessionStorage`).
- **Selects demarrent vides** (placeholder `disabled hidden`), obligatoires si pertinent.
- **Modales de SAISIE** : fermeture X / Annuler seulement (ni fond ni Echap). Echap autorise sur
  une modale de confirmation.
- **Masquer** ce qui n'est jamais possible pour ce role ; **griser** (`--champ-verrou` / `warm-400`,
  avec infobulle) ce qui l'est dans d'autres circonstances.
- **Ecrans sans barre de defilement de page** quand c'est possible : un element elastique absorbe la
  hauteur, listes bornees.
- **Accessibilite** : onglets ARIA + deep-link `?tab=`, `role="alert"` sur les erreurs, `aria-pressed`
  sur les bascules, focus visible, contraste AA (4,5:1 petit texte).
- **Mobile** : sous 1024 px la sidebar devient un tiroir ; sous 768 px seuls 7 menus restent
  (Tableau de bord, Notifications, Temps de presence, Feuilles d'appel, EDT, Cahier de texte,
  Support). Liens des tableaux de bord vers les ecrans exclus neutralises (`Cliquable`).
- **Refonte = la structure, pas seulement les couleurs** : verifier bandeaux, listes, modales,
  confirmations, actions visibles. Methode : l'utilisateur inspecte, je propose, « go », commit + push.

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
- Fichier `'use server'` : n'exporte que des fonctions async (sinon 500).
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
  ROUGE avant de le croire vert. Un `catch` silencieux peut cacher une panne : verifier en base.
- Apres un deploiement, un onglet ouvert peut lever « An unexpected response was received from the
  server » (client perime) : banniere « nouvelle version » (`/api/version`), Ctrl+F5.
- `auth.admin.listUsers()` ne rend pas `factors` : utiliser `getUserById()`.
- Un joker TLS couvre UN niveau : jamais de `www.` sur un sous-domaine d'ecole.
- Une `NEXT_PUBLIC_*` se verifie en production dans le bundle servi.

## 8. Reste a faire

Tous les modules sont faits et audites (accessibilite, charte, theme sombre, mobile, RLS role + tenant,
ecritures silencieuses) ; refonte de l'interface faite sur l'ecole ET la console. Historique : journal.

0. **A CHAQUE REPRISE · Node2Shell (CVE-2026-111497)** : projet en **24.x** (`engines` + reglage Vercel
   « Node.js Version »). Le correctif (**24.22.1**) depend de Vercel seul : encore **24.21.0** le 27/10,
   pare-feu Vercel actif en attendant. Survoler la pastille de version de la console ; aucun
   redeploiement utile tant que Vercel n'a pas publie 24.22.1 (la version se lit au demarrage de la fonction).
1. **A la reprise (arret du 29/10 au soir, tout pousse, aucune migration en attente)** :
   - **A TESTER a l'ecran** (demonstration) :
     - **Fiche classe · Planning EDT avec des seances DEJA VALIDEES** : ajouter, modifier, supprimer un creneau
       (et changer le titulaire) quand des seances passees de ce creneau sont validees. Attendu : les validations,
       les heures de Temps de presence et l'historique restent justes ; rien de valide ne se perd ni ne se
       recalcule en silence.
     - Lot 5 : EDT (creation d'une seance ponctuelle, glisser-deposer), fiche classe (titulaire, encadre
       Remplacements).
     - Sortie des `any` lots 3 et 4 : 6 audits du passage d'annee, Historique des classes ; Reglements (famille,
       infobulle de classe avec niveau, historique, impayes anterieurs), Synthese, Vue globale, ouverture d'un
       paiement sans enregistrer, tableaux de bord comptable et direction.
     - Absences (messagerie configuree) : annulation annoncee puis retablissement, remplacement annonce.
     - Sortie des `any` lot 5 (30/10) : fiche eleve (5 onglets, fratrie, document, avertissement, depart), fiche
       parent avec cours adulte, affectation enfants et adultes (correction, depart).
     - Titulaire (30/10) : changer le titulaire d'une classe ; temps reel = le nouveau seul, historique = « initial
       puis remplacant ».
     - Carte fratrie (30/10) : classe de l'annee en cours, mentions Non affecte et Non actif accordees au genre.
     - Sortie des `any` lot 6 (30/10) : cahier de texte en direction puis en enseignant (seance et devoir : creer,
       modifier, supprimer ; detail d'un devoir enfants et adulte ; filtre par classe ; jour en francais).
     - Sortie des `any` lot 7 (30/10) : message a une classe enfants, adulte, a l'equipe (piece jointe) ; detail
       (destinataires, enseignant, horaire) ; filtre par classe ; notifications ; email de devoir.
   - **Ensuite** : sortie des `any`, dossier suivant (voir le point 4). Plan a presenter avant de coder.
   - **A decider** : `class_year_history.remplacements` est vide depuis le lot 5 (lu dans `class_teachers`) ;
     archiver les remplacements depuis `absences_enseignants_seances` ?
   - Ecarts notes : fiche classe 30 eleves par defaut contre 25 en base ; matiere du cahier de texte « General »
     a relier un jour a celle du creneau.
2. **Essai d'un prospect et passage en service** : essai dans la demonstration (« Ouvrir un acces
   prospect ») ou dans SON etablissement (borne par une echeance et/ou une limite d'eleves, donnees
   conservees). Jour J : essai dans son etablissement -> lever la borne, remplir la facturation, retirer
   seulement les saisies d'essai qu'il designe (liste validee avant suppression) ; sinon creation depuis la
   console puis import `.xlsx` ; s'il ne signe pas -> depart (export, puis effacement).
3. **Messagerie** : DMARC `p=none` -> `quarantine` -> `reject` quand les rapports sont propres ;
   montee en charge progressive ; service transactionnel a envisager a 200-300 foyers.
4. **Signale, non traite** : `description` des lignes manuelles du journal reste libre ; avis `npm audit`
   (brace-expansion, braces) ; email aux familles a la MODIFICATION d'un devoir ; sortie des `any`
   (153 au lint au 30/10) : lot 1 FAIT (clients Supabase types, `src/types/supabase.ts` genere), lot 2 FAIT
   (`lib/dashboard`), lot 3 FAIT (`lib/closure` : lignes d'archive typees par leurs tables, colonnes jsonb de
   l'historique dans `json.ts`), lot 4 FAIT (financements : lectures de Reglements dans
   `lib/financements/reglements.ts`, types des ecrans tires de ses requetes), lot 5 FAIT (eleves, parents,
   affectation : `lib/students/fiche.ts`, `lib/parents/fiche.ts`), lot 6 FAIT (cahier de texte : `lib/cahier-texte/donnees.ts`), lot 7 FAIT (communications et notifications :
   `lib/communications/donnees.ts`, `lib/communications/notifications.ts`), suite par dossier (lot 8 propose :
   tableau de bord, `dashboard/page.tsx` + `components/dashboard`) ; puis rendre NOT NULL les 57 colonnes a
   defaut jamais NULL (quand toutes les ecritures seront typees).
5. **Passes de fin de V1** : plan de test, tracabilite globale, valeurs en dur.
6. **Secondaire (multi-professeurs, matieres)** : abandonne en V1, code conserve (palette de
   matieres, `isDndActive = false`, matiere « General »).

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
