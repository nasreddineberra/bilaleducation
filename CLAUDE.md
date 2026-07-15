# BILAL EDUCATION

Application de gestion scolaire complete.

## Reprise v1.0 (en cours — juin 2026)

Le projet compte ~26 modules / 45 pages, trop pour une premiere mise en ligne.
Objectif : reduire le perimetre a une **v1.0 deployable** et ameliorer chaque
fonctionnalite gardee (technique + graphique), module par module.

- **Approche retenue** : garder la base technique existante (Next.js + Supabase + auth +
  layout), elaguer / mettre en suspens les modules hors v1.0, refondre ceux qu'on garde.
- **Methode** : revue module par module avec l'utilisateur. Ne rien modifier sans son
  accord : presenter le plan, attendre le « go ».
- **Perimetre v1.0** : non fige, decide module par module.

### Travaux v1.0 realises
- **Apprenants (liste)** : densite reduite pour supprimer le scroll ; colonne « Classe »
  (jointure `enrollments` → `classes`, badge « Non affecte » si aucune inscription active) ;
  ligne entiere cliquable vers la fiche.
- **Apprenants (fiche)** : les freres/soeurs inactifs s'affichent (badge « inactif », grises)
  au lieu d'etre masques.
- Seed `supabase/seed-parents-students-bulk.sql` : 30 parents + 45 eleves (numeros dynamiques).

#### 29 juin 2026
- **Coherence des listes** : meme densite (police, espacement des lignes) et memes cartes
  statistiques sur les 4 listes principales (Apprenants, Parents, Enseignants, Classes).
- **Apprenants (liste)** : colonne « Discipline » (absences / retards / avertissements de
  l'annee scolaire en cours, couleurs de l'onglet discipline, actifs uniquement) ; avatar
  genre neutre (gris beige) avec lisere bleu/rose ; carte « actifs » et icones d'autorisation
  passees au turquoise (`primary-600`).
- **Parents (liste)** : densite alignee ; ligne cliquable vers la fiche ; colonne « Situation
  familiale » (centree) ; carte « Inscrits aux cours » avec lisere assorti aux chiffres.
- **Enseignants (liste)** : densite + cartes identiques (filtres cliquables, compteur
  « actifs » corrige en global) ; ligne cliquable vers la fiche ; style « inactif » aligne
  sur les apprenants.
- **Classes (liste)** : densite/typo et carte alignees sur le style commun.
- **Centralisation UI** : classes `.list-th` / `.list-td` / `.list-name` (globals.css) +
  composant `src/components/ui/ListStatCard.tsx` ; les 4 listes refactorisees (sans
  changement visuel). Point d'extension pour les autres listes globales.
- **Fix etablissement** : le changement de nom/logo se reflete desormais immediatement dans
  la sidebar (invalidation du cache via `updateTag`, server action
  `src/app/dashboard/etablissement/actions.ts`). Next 16 : `revalidateTag` a 1 argument est
  deprecie, utiliser `updateTag`.
- Seed `supabase/seed-teachers-bulk.sql` cree (10 enseignants) puis abandonne : la creation
  passe par le formulaire (compte auth + profil + fiche via RPC `create_profile_and_teacher`),
  ce qu'un seed SQL ne fait pas.

#### 1er juillet 2026 — Parametres Financiers (`/dashboard/cotisations`)
Refonte de la page (`src/components/cotisations/CotisationsClient.tsx`).
- **Harmonisation** : tableau des cotisations passe aux classes centralisees `.list-th` /
  `.list-td` / `.list-name` ; en-tetes de meme hauteur que le tableau (`py-1.5`, `leading-4`).
- **Grille taux** : `grid-cols-8` fixe remplace par `grid-cols-[repeat(auto-fill,minmax(130px,1fr))]`.
- **Formulaire d'ajout/edition** : champs en flex (largeurs reduites, `Type de scolarite` en
  MAJUSCULES a la volee), boutons sur la meme ligne, champs obligatoires marques `*` +
  mention « champs obligatoires », bouton valider grise tant que les champs requis sont vides.
  `Frais de dossier` / `Reduction fratrie` non pre-remplis a l'ajout.
- **Saisie numerique** : fleches +/-10 sur les champs tarifaires, +/-0.10 sur les taux ;
  affichage force a 2 decimales partout (formatage `onBlur` + `fmtEur` a `minimumFractionDigits: 2`).
- **Taux horaires** : le(s) type(s) `is_absence` en tete de liste, champ force a 0 et desactive ;
  bouton « Enregistrer » grise si aucun taux modifie (comparaison avec les valeurs BDD).
- **Historique** : l'ancienne colonne globale a droite est eclatee en une sous-colonne
  « Historique » (1/3) dans chaque encadre (tableau/champs = 2/3), toujours cote a cote
  (`flex-row`) pour que le formulaire ne pousse que le tableau et non l'historique.
  Cotisations : memes colonnes que le tableau ; taux : grille 2 colonnes type + taux.
- **Seed** `supabase/seed-cotisations-history.sql` : simulation d'historique (annees 2024-2025
  et 2025-2026) pour les 2 encadres — idempotent, ne touche pas l'annee en cours.

#### 3 juillet 2026 — Audits accessibilite / UX (skills `ui-ux-pro-max` + `make-interfaces-feel-better`)
Methode : audit lecture seule d'un module, puis corrections par lots apres accord.
- **Sidebar + logo** (`DashboardSidebar.tsx`, `globals.css`, `dashboard/layout.tsx`) :
  focus clavier visible (`.sidebar-item` + toggle), skip-link « Aller au contenu » +
  `<main id="main-content">`, `aria-label` sur `<nav>`, hit-area du toggle (32px),
  accordeons animes (`grid-rows 0fr→1fr` + `inert` quand fermes), scrollbar fine
  (`.sidebar-scroll`) au lieu de `scrollbar-hide`, `prefers-reduced-motion`, contraste du
  footer, tooltip au focus, transitions scopees, logo cliquable vers `/dashboard`, accent
  actif unifie (`amber-400`).
- **Apprenants (liste + fiche)** (`StudentsTable.tsx`, `StudentDetail.tsx`) :
  nom = vrai `<Link>` (clavier), `aria-label` + focus sur les boutons d'action, `amber-700`
  pour « retards ». Fiche : **bandeau d'en-tete** (avatar + NOM + N° + classe + badges),
  onglets **ARIA** (`role=tab/tablist/tabpanel`, roving tabindex, fleches ← →) + **deep-link
  `?tab=`** (via `history.replaceState`, sans refetch), contraste onglet actif (`primary-700`).
- **Parents (liste + fiche)** (`ParentsTable.tsx`, `ParentForm.tsx`) : nom Tuteur 1 = `<Link>`,
  **pastille de statut** enfant accessible (hit-area elargie, `aria-label`, focus), focus sur
  tous les boutons, `aria-expanded` sur « Enfants », icone cours adultes `primary-700`.
  Fiche : bandeau d'en-tete (`h1` NOM + situation + badge cours adultes).
- **Tooltips homogeneises** (Apprenants + Parents + Sidebar) : tout passe par le composant
  `ui/Tooltip.tsx` (+ **declenchement au focus clavier**) ; `SidebarTooltip` aligne ;
  suppression des `title=` natifs et bulles inline sur ces modules.
- **Skills installes** (`~/.claude/skills/`) : `ui-ux-pro-max` (scripts Python — `python3.exe`
  cree dans l'install Python 3.14) et `make-interfaces-feel-better`. `npx skillsadd` est casse,
  installation manuelle depuis les repos GitHub.

#### 5 juillet 2026 — Enseignants (audit + Notes + Documents)
- **Audit accessibilite liste + fiche** (`TeachersTable.tsx`, `TeacherForm.tsx`) : nom = `<Link>`
  clavier, Modifier/Supprimer en `<Tooltip>` + `aria-label` + focus, bandeau d'en-tete de fiche
  (avatar + `h1` NOM + N° emp + specialisation + badge inactif).
- **Champ Notes** (remarques internes) sur la fiche enseignant : colonne `teachers.notes`
  (migration `add-teacher-notes.sql`), encadre « Remarques » (FloatTextarea), cable dans
  `updateTeacher` + `createTeacherWithAccount` (update apres le RPC) + `CreateTeacherSchema`.
- **Documents lies a la fiche** : la fiche passe en **onglets Identite / Documents**
  (`TeacherDetail.tsx`, memes onglets ARIA + deep-link `?tab=` que la fiche eleve ; le bandeau
  d'en-tete est deplace de TeacherForm vers TeacherDetail). Nouveau composant
  `TeacherDocuments.tsx` : upload (bucket prive `teacher-documents`, URL signees, **1 Mo max**
  cote client ET cote Storage via `storage.buckets.file_size_limit`),
  **tableau** trie par categorie (colonnes Categorie / Document / Fichier / Expiration / actions),
  compteur en direct dans le libelle de l'onglet « Documents (N) » (etat remonte dans TeacherDetail).
  - Categories en dur : Contrat / Diplome / Identite / Autre. Champ **« Document »** (colonne
    `label`) **toujours visible + obligatoire** (precise le diplome / type de contrat / type de
    piece), 1ere lettre en majuscule auto.
  - Migration `add-teacher-documents.sql` : table `teacher_documents` + RLS (tenant, calquee sur
    `student_documents`) + bucket + policies storage + colonne `label` (ajout idempotent).
  - Garde anti-double-clic (`uploadingRef`) + `router.refresh()` apres ajout/suppression.
- **Regle UI (memoire)** : les selects demarrent **vides** (`value=''` + option placeholder
  `disabled hidden`, jamais de quadratin `—`), obligatoires si pertinent.
- **Debug** : requetes directes en base via script service-role (`.env.local`) pour lever un
  doute (lignes reelles vs cache) ; ne jamais confondre suppression Storage et suppression table.

#### 6 juillet 2026 — Cotisations, Types de presence (par annee), Ressources
- **Parametres Financiers (audit a11y + FloatFields)** (`CotisationsClient.tsx`) : boutons
  Modifier/Supprimer en `<Tooltip>` + `aria-label` + focus ; helper `InfoHint` (bouton focusable
  au lieu de `title=` natif) ; `aria-label` sur les tableaux ; `aria-live` sur « Taux enregistres ».
  Formulaire de cotisation converti en `FloatInput` (label flottant + `*` auto), suffixe **€**
  (au lieu de « EUR ») centre via wrapper relatif, labels courts (« Cotis. annuelle »,
  « Reduc. fratrie ») pour eviter le chevauchement label/symbole ; « Max echeances » **vide par
  defaut** (meme police au repos que les autres champs).
- **Encadre « Taux horaires generalises — {annee} »** (renomme) : **bandeau de statut**
  (`role=status`) 3 etats — vert « Tous les taux sont enregistres » / ambre « N type(s) sans taux
  enregistre » / bleu « Modifications non enregistrees » ; **indice ambre par champ** pour le type
  sans taux en base ; bouton Enregistrer debloque quand il manque un taux (cas taux = 0).
- **Types de presence (audit a11y)** (`TypesPresenceClient.tsx`) : Valider/Annuler + Modifier/
  Supprimer en `<Tooltip>` + `aria-label` + focus ; **selecteur de couleur** en `role=radiogroup`
  (par pastille `role=radio` + `aria-checked` + `aria-label` + focus, **`<Tooltip>` et non `title=`**) ;
  `role=alert` sur les erreurs ; en-tetes en `.list-th` ; « Reserve » en `warm-500`. **Pas de
  couleur pre-selectionnee** a la creation (pastille pointillee, couleur obligatoire).
- **Types de presence rattaches a l'annee scolaire** (modele par annee) : migration
  `add-school-year-to-presence-types.sql` (colonne `school_year_id` + backfill vers l'annee en
  cours de chaque etablissement + unicite **`(etablissement, annee, code)`** + `NOT NULL` + index).
  Page filtree sur l'annee en cours (message si aucune) ; en-tete « Types de presence — {annee} » ;
  bouton **« Copier depuis {annee precedente} »** (copie les types absents) ; controle de suppression
  = **etablissement (RLS) + annee en cours** ; libelle en MAJUSCULES.
  - **Consommateurs filtres par annee** (`.eq('school_year_id', currentYear.id)`) : cotisations
    (encadre Taux, historique intact), temps-presence, financements. Evite l'ambiguite code→taux
    quand un code se repete d'une annee a l'autre. EDT non impacte (n'utilise pas la table de config).
- **Ressources (audit + refonte design-system)** (`ResourcesClient.tsx`) : conversion complete en
  `FloatInput`/`FloatSelect`/`FloatTextarea`/`FloatCheckbox`/`FloatButton` ; Modifier/Supprimer en
  `<Tooltip>` + `aria-label` + focus ; `role=alert` sur erreurs ; recherche via `SearchField`
  (nouveau prop `ariaLabel`) ; selects sans quadratin `—` (placeholder `disabled hidden`, « Aucune »
  pour la salle) ; **Etat** vide + obligatoire ; boutons « Ajouter/Creer » passes de amber → `submit` ;
  `<h1>` « Ressources » ajoute ; listes en `<ul>/<li>`.
- **Regle UI (memoire)** : **ne jamais mettre d'icone « + » (Plus) sur les boutons** (libelle seul).
  Applique sur Cotisations/Types de presence/Ressources ; reste ~22 fichiers a nettoyer au fil des audits.

#### 7 juillet 2026 — Audits Journal / Etablissement / Utilisateurs / Annee scolaire / Cours + tracabilite
- **Journal d'activite** (`AuditLogsClient.tsx`, `logs/page.tsx`) : audit a11y (modale de purge accessible
  `role=dialog`+Echap+fond, filtres avec `aria-label`, pagination `aria-label`+`aria-current`, onglets
  `aria-current`, table `aria-label`, erreur `role=alert`, detail `title=`→`<Tooltip>`). **Bug corrige** :
  classe inexistante `input-field`→`.input` (filtres non styles). Libelle bouton « Purger (> 1 mois) ».
  Les logs de **documents** affichent l'enseignant/apprenant concerne (resolution `teacher_id`/`student_id`→nom
  cote page) + libelle du doc en detail.
- **Tracabilite utilisateur du journal** : `updateTeacher` / `createTeacherWithAccount` / `createParentAccount`
  ecrivaient via le **client admin** (service-role) → trigger `fn_audit_log()` sans `auth.uid()` → logs **sans
  utilisateur**. Correctif : ecritures de tables via le **client session** ; RPC de creation passees en
  **`SECURITY DEFINER`** + garde de role (migration `fix-audit-user-tracking.sql`, nouveau `create_parent_login_profile`).
  Migration `add-audit-triggers-documents.sql` : triggers d'audit sur `teacher_documents` + `student_documents`.
- **Etablissement** (`EtablissementForm.tsx`, `DocumentTypesConfig.tsx`) : refonte design-system (FloatFields/
  FloatButton/Tooltip), modale de recadrage logo accessible (Echap/fond/focus, slider labellise), poignee
  `GripVertical` trompeuse retiree (pas de DnD), inputs diag `aria-label`, selects sans quadratin.
- **Utilisateurs** (liste + fiche) : a11y + design-system (FloatFields, `SearchField`, `.list-th/td`), **ligne
  cliquable**, actions Tooltip+`aria-label`. **Bug corrige** : `export type { UserRole }` dans un fichier
  `'use server'` → 500 sur toute modif (Next 16). Retour a la liste + message distinct apres save.
- **Annee scolaire** (`SchoolYearsClient.tsx`, `SchoolYearForm.tsx`) : liste ligne cliquable + actions
  accessibles + `.list-th/td` ; modale vacances accessible (Echap/fond/focus). Fiche deja conforme.
- **Referentiel des cours** (`CoursTree.tsx`) : a11y complet (Tooltip+`aria-label`+focus sur toutes les
  actions et poignees DnD, InlineForm `aria-label`, modale suppression accessible, `SearchField`), plus d'icones
  sur les boutons. **REF en MAJUSCULES**, **Nom (FR) 1re lettre majuscule**. Recherche etendue aux **REF** et
  rendue **insensible aux accents ET a la casse** (helper `norm()` = NFD + `\p{Diacritic}`, filtre + surlignage).
  **L'arbre reste deroule** apres creation/modification (effet recherche via `prevSearchRef`, ne reagit qu'aux
  vrais changements de recherche).
- **Regles UI (memoire)** ajoutees : aucune icone sur les boutons a libelle (exception icone-seule) ; pas de
  `<h1>` de titre de page (DashboardNav le rend deja) ; **lignes de liste cliquables** vers la fiche ; **retour a
  la liste** apres create/modif (+ message distinct) ; **couleur du bouton** `variant={isEditing ? 'edit' : 'submit'}`.

#### 7 juillet 2026 (suite) — Classes (audit + refonte mono-mode), copie mdp, cycle de vie enseignant/compte
- **Classes — audit a11y liste + fiche** (`ClassesClient.tsx`, `ClassForm.tsx`) : lignes cliquables + nom `<Link>`,
  actions Tooltip+`aria-label`+focus, `role=alert`/vrai `X` sur erreurs, `aria-label` tables, retrait des icones
  `Plus`, modales accessibles (`role=dialog`/`aria-modal`/Escape/fond/focus) pour la clôture d'affectation et
  `SlotFormModal`, **retour a la liste apres modif** (messages distincts).
- **Abandon du Secondaire (mode `multi`) en V1** — decision utilisateur. **Aucune consequence BDD** (colonnes
  conservees, `teaching_mode` deja `DEFAULT 'single'`). Refonte **mono-mode Primaire** de la fiche classe :
  suppression du selecteur de mode (force `single`), colonne **Enseignant principal** unique (clôture datée +
  historique conservés via `class_teachers.effective_from/until`), Planning EDT toujours affiche, cascade
  submit ciblant le **principal actif**, nettoyage (`ues`/`UEOption`/`weekStartDay`/`DAY_NAMES` retires, pages
  `new`/`[id]` allegees). Page EDT : `isDndActive = false` (palette `SubjectPalette` neutralisee, composant
  conserve dans le repo, recuperable si le Secondaire revient).
- **Bouton copie du mot de passe temporaire** (`TeacherForm.tsx`) : sur l'ecran « Enseignant et compte cree »,
  icone `Copy`→`Check` (« Copié » 2 s) via `navigator.clipboard`, Tooltip + `aria-label` + focus, fallback toast.
- **Cycle de vie enseignant ↔ compte de connexion** :
  - **Suppression** (`TeachersTable.tsx` + server action `deleteTeacher`) : comptage des dependances (classes /
    EDT = slots+exceptions+schedules / evaluations / notes) dans une `ConfirmModal`. Si dependances → pas de
    suppression, **« Rendre inactif »** (ambre) ; sinon **« Supprimer definitivement »** (rouge) qui supprime
    fichiers Storage + fiche (client session, tracé) + **compte auth** (profil en cascade).
  - **Sync actif/inactif** : basculer la fiche bascule le compte (RPC `set_teacher_profile_active` + `setTeacherActive`
    + sync dans `updateTeacher`). Message explicatif sous le switch ACTIF/INACTIF.
  - **Login** (`auth.ts` + `login/page.tsx`) : si `profiles.is_active = false` → `signOut` + message « compte desactive ».
- **Securite RPC** : la garde `IF get_user_role() NOT IN (...)` ne bloque PAS un role NULL (anonyme), car
  `NULL NOT IN (...)` vaut NULL. Correctif **`coalesce(get_user_role(), '')`** applique sur `set_teacher_profile_active`,
  `create_profile_and_teacher`, `create_parent_login_profile`. **Regle** : toujours `coalesce` dans les gardes
  de RPC SECURITY DEFINER.
- **Debug BDD** : scripts service-role jetables (`.env.local`) dans le dossier projet (resolution `node_modules`),
  supprimes apres usage — utilises pour verifier l'absence de classes `multi` et le comportement des gardes RPC.
- **Classes (liste)** : `card p-0` (tableau a ras des bords, standard des autres listes ; corrige un tableau en retrait).
- **Ressources (`page.tsx` + `ResourcesClient.tsx`)** :
  - **Bug corrige** : `profile!.etablissement_id` plantait quand la requete RLS `profiles` renvoyait `null` →
    la page lit desormais l'etablissement depuis le **header `x-etablissement-id`** (pose par le middleware,
    fiable). **Regle** : preferer ce header a une requete `profiles` fragile pour l'etablissement courant.
  - **Refonte densite** : listes Salles/Materiels converties de cartes 2 lignes en **tableaux compacts**
    (`.list-th/.list-td/.list-name`, `card p-0`) → une dizaine d'items sans scroll. Type de salle **« Autre »**
    affiche le debut de la description. **Lignes cliquables** → ouvrent le formulaire d'edition (pas de fiche
    separee ici). Bouton **`edit`** (ambre) + **grise si aucune modification** (comparaison au formulaire d'origine).
    En-tete condense : titre + recherche (largeur fixe, collee a gauche du bouton) + « Ajouter » sur une seule ligne.
- **Fiche classe — modale « Nouveau creneau »** : le select **Jour** respecte le parametrage etablissement
  (`week_start_day` + `working_days`) via `buildWorkingDayNames` (memes regles que l'EDT : N jours consecutifs a
  partir du 1er jour ; Lun+5 → Lun-Ven, Mar+5 → Mar-Sam). `weekStartDay`/`workingDays` recharges dans les pages
  `new`/`[id]` et transmis a `ClassForm` → `SlotFormModal`.

#### 8 juillet 2026 — Profil / compte utilisateur connecte + securite + divers parametrage
- **Page « Mon compte »** (`/dashboard/mon-compte`, tous roles ; `MonCompteClient.tsx` + `actions.ts`) :
  ordre Mes informations → **Compte** → Mot de passe → 2FA. Edition civilite/prenom/nom/telephone
  (`updateOwnProfile`, client session, colonnes non sensibles) ; **mot de passe** self-service
  (`auth.updateUser`, checklist `PASSWORD_RULES`, pas de re-auth pour ne pas casser le 2FA) ;
  **2FA** self-service (`TwoFactorCard`, statut + reinitialisation, masque pour parent) ;
  **email** editable **uniquement admin/direction** (`updateOwnEmail`, changement direct auth+profil
  + modale de confirmation). Rible/etablissement en lecture seule. L'avatar du top-nav pointe desormais ici.
- **Securite — anti auto-escalade** (migration `add-profile-sensitive-columns-guard.sql`) : trigger
  `BEFORE UPDATE` sur `profiles` interdisant la modif de `role`/`is_active`/`etablissement_id` sauf
  service-role (`auth.jwt()->>'role'='service_role'`) ou admin/direction. **Regle** : la policy RLS
  « update own profile » n'a pas de restriction de colonnes → sans ce trigger, un non-admin pouvait
  s'auto-promouvoir admin (`get_user_role()` pilote la RLS).
- **Gardes de route** (`utilisateurs` liste + `[id]` + `new`) : reservees admin/direction ; l'edition
  de **son propre** compte redirige vers Mon compte (empeche le changement de son propre role).
- **Email d'un utilisateur** (`UtilisateurForm.tsx`) : champ Email **toujours editable** sur la fiche
  (etait verrouille a tort pour les non-admin/direction) → l'admin peut changer l'email de n'importe qui.
- **Statut 2FA cote admin** (migration `add-get-verified-totp-user-ids-rpc.sql` — RPC SECURITY DEFINER,
  garde admin/direction, lit `auth.mfa_factors`) : **colonne 2FA** dans la liste Utilisateurs
  (Activee/Non/— parent) + **reinitialisation admin** (`resetUserTwoFactor` via `admin.auth.admin.mfa.deleteFactor`,
  tracee) en **liste** (bouton `ShieldX`) et **fiche** (sous-bloc dans la carte « Informations du compte »).
- **Login / session** (`login/page.tsx`, `proxy.ts`, `useInactivityLogout.ts`, `lib/session-config.ts`) :
  `role="alert"` sur l'erreur, message **« session expiree »** (`?reason=session` pose par le middleware),
  a11y du bouton oeil (aria-label/aria-pressed/focus), constante **30 min centralisee**.
- **Liste Utilisateurs triee** par **role** (ordre hierarchique) puis nom puis prenom.
- **Comptes parents suspendus (V1)** (`parents/actions.ts`) : flag `CREATE_PARENT_ACCOUNTS = false` →
  la creation d'une fiche parents ne cree plus de comptes de connexion (note du formulaire retiree).
  Reversible. Les comptes deja crees restent fonctionnels.
- **Suppression d'un type de presence** (`TypesPresenceClient.tsx`) : un **taux horaire** parametre mais
  non utilise ne bloque plus (on supprime d'abord `presence_type_rates` puis le type) ; la vraie barriere
  reste l'usage dans `staff_time_entries` de l'annee. Message convivial en repli sur FK (`23503`).
- **Standardisation listes** (`card p-0` + `.list-th/.list-td/.list-name`, `text-xs`) : Annee scolaire,
  Types de presence. **Regle** : tableau de liste = `card p-0` (jamais `card` seul → sinon retrait de 24px).
- **Sidebar** (`DashboardSidebar.tsx`) : ordre revu — Affectations puis Evaluations places sous Parents.

#### 9 juillet 2026 — Statuts apprenants en lot + refonte des affectations (apprenants & adultes)
- **Mise a jour des statuts apprenants en lot** (`students/actions.ts` + `StudentsStatusSyncModal.tsx`,
  bouton dans la liste) : modale listant TOUS les apprenants avec **classe (si affecte cette annee)** +
  **interrupteur actif/inactif** par ligne ; **verrouille actif** si l'apprenant est inscrit dans une classe
  de l'annee (garde aussi cote serveur). Boutons **Tout actif / Tout inactif** (icones, excluent les affectes)
  + **Recharger depuis la base** ; recherche ; compteur. Server actions `getStudentsForStatusModal` +
  `saveStudentsActive` (garde admin/direction, tracees). Regle « inscrit ⟹ non desactivable » appliquee aussi
  sur la fiche eleve (`StudentDetail` : `hasActiveEnrollment` restreint a l'annee en cours).
- **Tooltip classe standardise** (liste apprenants + modale) : `Prof (NOM Prenom) · Cotisation · Niveau · Jour HH:MM–HH:MM`,
  **une seule ligne** (`maxWidth="max-w-none"` + `whitespace-nowrap`), construit cote serveur.
- **Affectation apprenants** (`AffectationClient.tsx` + `affectation/actions.ts`) :
  - **Clic pour affecter** (dnd-kit **retire**) : carte du vivier = `<button>` (clavier + `aria-label`), croix pour retirer.
  - Densite : vivier `py-0.5` (20 sans scroll), lignes classe compactes, **liseret retire** quand la classe est peuplee.
  - **Bouton recharger** en haut a droite de l'encadre classe (= reclic de la selection).
  - Filtre **« Non affectes »** + en-tete **« Eleves (N actifs · X non affectes) »**.
  - **Tracabilite** : sauvegarde via server action `saveStudentEnrollments` (garde admin/direction/resp. pedagogique,
    `logAudit`), plus d'ecriture client directe.
  - Nettoyage : `page.tsx` ne requete plus les classes 2 fois.
- **Affectation adultes** (`AffectationAdultesClient.tsx`) : **memes** changements repliques (clic, densite, recharger,
  filtre, compteur « Participants (N inscrits · X non affectes) », tracabilite `saveParentEnrollments` sur
  `parent_class_enrollments`, tooltip une ligne). **Pas d'avatar** (contrairement aux apprenants) : hauteur de ligne
  compensee par `py-1` ; badge sexe M/F conserve.
- **Regle UI (memoire)** : **jamais de tiret quadratin `—`** dans l'UI (utiliser `·` / `-` / parentheses) ; plages
  horaires en demi-cadratin `–` tolerees. **Passe globale de nettoyage prevue en FIN DE V1** (ne pas la faire avant).

#### 10 juillet 2026 — Montee Next 16.2.10 + React 19 + fix build (sanitisation isomorphe)
- **Bump Next** `16.1.6` → `16.2.10` (+ `eslint-config-next`), montee mineure sans rupture. Verifie que le
  build echouait **a l'identique en 16.1.6** → le bump n'etait pas en cause.
- **Fix build de production (bug preexistant)** : `next build` cassait (« Module not found: Can't resolve 'fs' »)
  car `src/lib/security/sanitize.ts` importait **jsdom** en statique, tire dans le **bundle navigateur** de 4
  Client Components (`CahierTexteDetail`, `NotificationDetailClient`, `StaffMessageClient`, `NewMessageClient`).
  Correctif : `sanitize.ts` rendu **isomorphe** (window natif au navigateur, jsdom uniquement au SSR via `require`
  paresseux + instance mise en cache) ; jsdom exclu du bundle client via **`"browser": {"jsdom": false}`**
  (package.json) et garde externe serveur via **`serverExternalPackages: ['jsdom']`** (next.config.js).
  **0 composant touche**, API `sanitize()` toujours synchrone. Sanitisation serveur re-testee (XSS neutralise).
  **Regle** : ne jamais importer jsdom statiquement dans un module atteignable par un Client Component (il est
  SSR-rendu cote serveur ET bundle cote client).
- **React `18.2` → `19.2`** (+ `@types/react`/`@types/react-dom` en 19) : **aucune reecriture**. Audit prealable
  = 0 usage d'API supprimees/depreciees (forwardRef, defaultProps, findDOMNode, useFormState, propTypes) et 0
  motif a friction de types (`useRef()` no-arg, `JSX.Element` global, `React.FC`). Toutes les libs tierces
  declaraient deja React 19 (dnd-kit, TipTap 3, react-easy-crop, supabase/ssr), seule friction = **lucide-react**
  bumpe `0.312` → `1.24.0` (saut majeur, 0 icone cassee au type-check).
- Verifs : `type-check` vert, `build` complet vert, dev `/login` 200, sanitize serveur OK.
- **Leviers React 19 disponibles pour la suite** (non encore exploites) : `useActionState`/`useFormStatus`
  (formulaires), `useOptimistic` (affectations au clic, statuts en lot), `ref` en prop directe.

#### 10 juillet 2026 (suite) — Audits Evaluations (Gabarits + Saisie notes + Bulletins) + Notation des adultes
- **Audits a11y des 3 modules Evaluations** (Gabarits `EvaluationsClient`, Saisie notes `GradesClient`,
  Bulletins `BulletinsClient`) : `aria-label` sur tous les boutons icone, `group-focus-within` (actions
  revelees au clavier), `role=alert`, `aria-pressed` sur les onglets periode, tableaux `aria-label`, tooltip
  de troncature maison remplace par le `Tooltip` standard (nouvelle prop `className`), quadratins `—` → `·`,
  `error.tsx` sans icones. **StarInput** (saisie etoilee) en `role=group` + `aria-label`/`aria-pressed` par
  demi-etoile. **Garde-fou anti-perte de saisie** (Saisie notes) : navigation classe/periode/eval via
  `navigate()` + `ConfirmModal` si notes non enregistrees. Bulletins : desarchivage (destructif) en
  `ConfirmModal`, echec d'appreciation rendu visible, **fix calcul moyennes de classe** (rattachement par
  `ev.id` au lieu d'un matching fragile par nom, helper `weightedAvg` + `Map coursById`). Fallbacks migration
  morts retires des 3 `page.tsx`.
- **Notation des adultes (cours adultes) — chaine complete** : une classe est « adulte » si sa cotisation a
  `is_adult = true` ; ses participants sont des **tuteurs** (`parent_class_enrollments`, cle composite
  `parentId-tutorNumber`), pas des `students`. Comme `grades`/`bulletin_*` sont FK vers `students`, on ajoute
  un **flux parallele** via 3 tables miroir (migration `add-adult-grading.sql`) : `adult_grades`,
  `adult_bulletin_appreciations`, `adult_bulletin_archives` (RLS calquees + audit ; bucket `bulletins`
  reutilise, chemin `adultes/`). **Les gabarits `evaluations` sont partages** (rattaches a `class_id`).
  Les 3 pages (Gabarits/Saisie notes/Bulletins) **branchent** sur `cotisation.is_adult` : participants depuis
  `parent_class_enrollments`, notes/bulletins dans les tables `adult_*`. PDF adulte : « Participant : » au lieu
  de « Eleve : », matricule masque, bloc absences conserve (0). Cle participant unifiee cote client :
  `student_id` = uuid eleve **ou** `parentId-tutorNumber` (parse via `lastIndexOf('-')`, l'uuid contient des `-`).
- **Regle (memoire)** : classe adulte (`cotisation.is_adult`) ⟹ participants = `parent_class_enrollments`
  (tuteurs), notes/bulletins dans les tables `adult_*`. Ne jamais ecrire une note d'adulte dans `grades`
  (FK `students`).

#### 10 juillet 2026 (suite) — Audit Emploi du temps (module jamais audite : 0 aria a l'origine)
- **a11y (6 fichiers)** : capsules (`SlotCapsule`, `MonthGrid`/`MonthSlotCapsule`) rendues focusables/activables
  au clavier (`role="button"` **si `canEdit`**, `aria-label` descriptif, Entree/Espace) ; boutons Valider/Annuler/
  Supprimer en `Tooltip` + `aria-label` contextualise (fin des `title=` natifs) ; toolbar : `aria-pressed` sur les
  toggles (Globale/Classe/Enseignant, Semaine/Mois, filtre jour), `aria-label` sur nav/outils, dropdowns
  classe/enseignant en `role="listbox"/option` + `aria-expanded` + Echap ; `SlotFormModal` en `role="dialog"` +
  `aria-modal` + Echap + fond cliquable + X `aria-label`, toggles Type/Frequence `aria-pressed`+`role="group"`,
  conflits/vacances en `role="alert"`.
- **Regles UI** : icones retirees des boutons a libelle (Ajouter sans Plus, Semaine/Mois, `error.tsx`) ;
  quadratins `—` nettoyes (placeholders, libelle semaine, option classe) ; format de donnees `CODE — Nom`
  (`class_teachers.subject`) laisse (lie aux donnees + UI DnD inerte).
- **Menu d'actions du creneau** (remplace l'ouverture de fiche au clic) : **le clic sur le corps d'un creneau
  existant ne fait plus rien** (ni fiche, ni menu) ; on agit **uniquement via le bouton « ⋯ »** (visible au
  survol/focus, en haut a droite de la capsule), present sur **tous** les creneaux existants (recurrents ET
  ponctuels). Le menu est **accessible** (`role="menu"/menuitem`, Echap, focus auto, fleches). Contenu adapte :
  recurrent → sections « Ce creneau » / « Toute la serie » ; **ponctuel → Modifier / Supprimer**. La suppression
  au survol (ancien bouton corbeille des ponctuels) est retiree → elle passe par le menu.
  **Vue mois** : pas de place pour un « ⋯ » lisible → le **clic ouvre le menu** (et non la fiche). Clic droit
  conserve comme accelerateur (meme menu). Menu **redesign** (variante « groupe + contexte ») : en-tete date +
  sections, icones Pencil/Trash2, danger rouge, hover doux. **Calque de fermeture** plein ecran (`z-[99]`) : un
  clic hors du menu **ferme juste le menu** sans atteindre le creneau en dessous. **Surbrillance** de la capsule
  dont le menu est ouvert (anneau turquoise + elevation), utile quand des creneaux se chevauchent (scindes cote a cote).
- **Fix positionnement Tooltip** : boutons en `position:absolute` → porter l'absolu sur le **wrapper** du
  `Tooltip` (prop `className`), sinon le wrapper mesure une zone nulle et la bulle est mal placee.
- **Bug corrige — faux conflit horaire** (`SlotFormModal`) : la detection ne regardait que jour + horaire et
  **ignorait les dates d'effet** (`effective_from`/`effective_until`). Deux creneaux recurrents qui se succedent
  (ex. clotures au 11/09 vs a partir du 12/09) etaient signales en conflit a tort. Correctif : pour deux
  recurrents, ignorer si les periodes **Du → Au** sont **disjointes** (`A.from > B.until` ou `B.from > A.until`,
  null = borne ouverte). Nouveau creneau = periode ouverte (alertes conservees). Type `SlotData` du modal enrichi
  des colonnes d'effet (deja presentes au runtime).
- **Dette** : `schedule_exceptions` desormais filtrees sur les creneaux de l'annee (`in schedule_slot_id`),
  fin du `select('*')` non filtre. DnD reste monte mais inerte (`isDndActive = false`, futur Secondaire).
- **Bug corrige — « duplicate key » + creneau incoherent au changement d'horaire** : (1) l'index d'unicite
  `idx_schedule_no_class_overlap_recurring` ignorait les dates d'effet → deux creneaux recurrents de memes
  horaires a periodes DISJOINTES etaient rejetes. Migration `fix-schedule-overlap-effective-dates.sql` :
  remplacement par une contrainte `EXCLUDE USING gist` (classe/jour/debut/fin `=` + `daterange(from,until,'[]')`
  `&&`, `WHERE is_active AND is_recurring`, extension `btree_gist`) ; garde `'empty'::daterange` si `from > until`
  (evite l'erreur « range lower bound must be ... »). (2) Flux « Modifier toute la serie » : il **cloturait
  toujours** l'ancien creneau a la veille du pivot, ce qui inversait la plage (`from > until`) quand l'ancien
  commencait pile au pivot. Correctif : si `effective_from >= pivot` (rien a conserver avant), on **supprime**
  l'ancien au lieu de le cloturer (cascade exceptions/validations) ; sinon cloture la veille (historique conserve).
- **Parcours enseignant sur l'EDT (2 fixes)** : (1) **vue par defaut vide** — `selectedTeacherId` etait initialise
  a `currentUserId` (id du profil) alors que le filtre compare `slot.teacher_id` (= `teachers.id`) → jamais de
  match. Corrige : `ownTeacherId = teachers.find(t => t.user_id === currentUserId)?.id` (init + re-clic « Par
  enseignant »). (2) **validation de la presence d'autrui** — le bouton ✓ s'affichait pour tout enseignant sur
  n'importe quel creneau. Corrige : `showValidation = canEdit || (isTeacher && isOwnSlot)` (prop `isOwnSlot` =
  `slot.teacher_id === ownTeacherId`, plombee via `DayColumn`). **Durcissement BDD** (migration
  `harden-time-tracking-rls.sql`) : RLS de `staff_time_entries` + `schedule_validations` — SELECT reste tenant ;
  ECRITURE = gestionnaires (admin/direction/resp.pedago/secretaire) tout, enseignant uniquement `profile_id =
  auth.uid()`. Un enseignant ne peut plus ecrire une presence/validation au nom d'un autre, meme par API.

#### 10 juillet 2026 (suite) — Audit Feuille d'appel (module jamais audite : 0 aria a l'origine)
- **a11y** : modales Saisie + Justification en `role="dialog"` + `aria-modal` + `aria-labelledby` + Echap + fond
  cliquable + X `aria-label` ; **trombinoscope** (cœur de l'appel) avec `aria-label` annoncant le statut
  (« NOM Prenom : Absent… ») car il etait distingue par la **couleur seule** ; **ligne eleve** depliable au
  clavier (`tabIndex`/`aria-expanded`/Entree-Espace) ; `aria-pressed` periodes, `aria-label` table, `role=alert`
  erreurs, `aria-label` boutons icone (Supprimer, X commentaire).
- **Regles UI** : icones retirees des boutons a libelle (Ajouter/Imprimer/Importer), quadratins `—` → `·`,
  `error.tsx` sans icones.
- **Bug corrige — justificatif inaccessible** : le bucket `absence-justificatifs` est **prive** mais le code
  stockait `getPublicUrl()` (URL publique → 403 sur bucket prive). Correctif : on stocke le **chemin** et on
  genere une **URL signee** (`createSignedUrl`, 60 s) a la consultation ; ajout du lien **« Voir »** dans l'etat
  justifie (qui manquait). \+ **validation** a l'upload (PDF/image, max 5 Mo) et `accept` sur l'input.
  **Regle** : justificatifs/documents sensibles = bucket prive + URL signee, jamais `getPublicUrl`.
- **Role `secretaire`** desormais inclus dans l'acces feuille d'appel (`page.tsx`) — il voyait 0 classe avant.

#### 10 juillet 2026 (suite) — Audit Cahier de texte + implementation edition + regle admin=direction
- **a11y** (module jamais audite) : onglets Journal/Devoirs en **ARIA tabs** (`role=tab`/`aria-selected`/`tabpanel`),
  retours (ArrowLeft) `aria-label`, toggles Vu/Effectue `aria-pressed`, tableau de suivi `aria-label`, statuts
  Vu/Effectue en `Tooltip` + `aria-label` (« Vu le … ») au lieu de `title=` natif, placeholders `—` → `·` +
  `aria-label` (« Non vu »), `SearchField` `ariaLabel`.
- **Regles UI** : icones retirees des boutons a libelle (Ajouter, Ajouter un devoir, Retirer, Modifier),
  quadratins `—` → `·`, imports lucide nettoyes, **`error.tsx` cree** (manquait).
- **Bug corrige — edition non implementee** : le bouton « Modifier » pointait vers `[id]/edit` **inexistant**
  (404) et `CahierTexteForm.handleSubmit` faisait **toujours un `insert`**. Correctif : **nouvelle route
  `[id]/edit/page.tsx`** (garde auteur ou direction/resp-pedago, charge seance + devoir + classes) ; le formulaire
  **met a jour** en edition (seance + devoir : create/update/delete selon l'etat), prerempli ; notification parent
  seulement sur **nouveau** devoir. \+ doublon d'`<option value="">` du select Matiere corrige. Le formulaire ne
  gere **qu'un seul devoir par seance**.
- **Regle (memoire) — `admin` = droits `direction` partout** : tout controle de permission autorisant `direction`
  doit aussi autoriser `admin`. Trou corrige dans le cahier de texte (canCreate/isStaff/gardes/canEdit). Ne PAS
  confondre avec les attributions de role et les **requetes de destinataires** (« envoyer a la direction »
  **n'inclut pas** l'admin — decision utilisateur).
- **Cahier de texte — creation/edition en modale verrouillee** (remaniement, **peaufinage affichage a finir**) :
  `CahierTexteForm` reecrit en **modale** (creation depuis la liste, edition depuis le detail), fermable
  **uniquement** par X / Annuler / Valider (pas de clic sur le fond ni Echap — volontaire, pas de perte de saisie).
  **Classe + Enseignant pre-remplis et verrouilles** (`LockedField`, lecture seule ; enseignant = prof principal,
  un seul prof par classe). Bouton « Ajouter » **grise tant qu'aucune classe** filtree. Select **Matiere** : option
  « General » avec valeur sentinelle `__general__` (→ `null` en base) pour que le label flottant monte. **Routes
  `new/` et `[id]/edit/` supprimees.** Prof principal + matieres derives du prop `classes` (select page enrichi
  `class_teachers(..., teachers(id, ...))`). NB : des **bugs d'affichage restent a corriger** (repris le 11/07).

#### 11 juillet 2026 — Cahier de texte (fix modale + scission seance/devoir) + Remplacant enseignant
- **Fix affichage modale** (`SeanceForm`/`DevoirForm`) : la modale etait rognee par le haut. Cause = la modale
  etait rendue dans `.animate-fade-in` qui **garde un `transform: translateY(0)`** (fill `both`) → devient le bloc
  conteneur du `position: fixed`. Correctif : rendu via **`createPortal(..., document.body)`** (comme `Tooltip`) +
  `min-h-0` sur le corps scrollable. **Regle** : une modale `fixed` doit sortir de tout ancetre transforme (portail).
- **Scission Seance / Devoir** (decision : devoir **totalement autonome**, jamais rattache a une seance) :
  `CahierTexteForm` remplace par **`SeanceForm`** (`class_journal` seul) + **`DevoirForm`** (`homework`,
  `journal_entry_id = null`). Bouton **« Ajouter »** contextuel a l'onglet (« Ajouter une seance » / « … un devoir »).
  Nouvelle **fiche devoir** `devoir/[id]/page.tsx` + `DevoirDetail.tsx` (consignes + suivi parent/staff + Modifier) ;
  la fiche seance n'affiche plus de devoir embarque. Lien liste devoir → `/dashboard/cahier-texte/devoir/[id]`.
- **Gating par classe** : tant qu'aucune classe n'est selectionnee, les onglets affichent une invite
  « Selectionnez une classe … » et le filtre Matiere est masque. **Selection de classe memorisee dans l'URL**
  (`?class=`) : liens « Retour » des fiches + restauration au montage (marche avec le bouton Precedent).
- **Matiere forcee « General » en V1** (mono-mode Primaire) : champ **verrouille** (`LockedField`) dans les 2 modales
  ET filtre Matiere de la barre verrouille/grise sur « General ». Le select reviendra en Secondaire.
- **Libelle « Lecon » → « Leçon »** partout dans l'affichage (badges liste/fiche, option formulaire, dashboard parent,
  texte notification). La valeur BDD `homework_type = 'lecon'` (CHECK) reste inchangee.
- **Envoi devoir par email aux tuteurs** : deja en place via `createNotification` (`tutor1_email` + `tutor2_email`).
  Ajout de `responsable_pedagogique` a la garde de `/api/notifications/homework` (il peut creer des devoirs).
  Seance = **consultation interne** (aucun envoi). Parcours parent **entierement code** (on active plus tard via
  `CREATE_PARENT_ACCOUNTS`). **Reste** : classes adultes (participants via `parent_class_enrollments`) → 0 email
  (pas d'`enrollments`) — a traiter.
- **IMPORTANT — tables cahier de texte absentes** : `class_journal` / `homework` / `homework_status` n'existaient
  **pas** en base (migration `create-cahier-texte.sql` jamais jouee) ; le code avalait l'erreur (`data ?? []`) → listes
  vides. Migration **executee** le 11/07. Seeds `seed-seances-test.sql` / `seed-homework-test.sql` reecrits :
  **contenu par classe** (adultes / maternelles), matiere « General » uniquement, idempotents.
- **Remplacant enseignant — Phase A (fiche classe)** (`ClassForm.tsx`) : nouveau bloc **« Remplaçant(s) »** sous le
  prof principal = ligne `class_teachers` **`is_main_teacher = false`** + `effective_from`/`until` (**aucune migration**,
  colonnes deja presentes). « Au » facultatif = **remplacement ouvert** (retour inconnu). Action **« Terminer »**
  (retour de l'enseignant) → pose `effective_until` via la modale de cloture → bascule en **« Historique des
  remplacements »** (borne `<= aujourd'hui`). **« Retirer »** (corbeille) = suppression physique (erreur de saisie).
  **Garde-fou anti-chevauchement** : un seul remplacant par periode (message si chevauchement + « fin >= debut »).
  Le tableau « Enseignant principal » est scope aux principaux ; cascade EDT non impactee.
  - **Phase B a faire** : RLS **par classe** (SELECT `class_journal`/`homework`/`homework_status` = classes ou je suis
    affecte aujourd'hui via `class_teachers` + dates) au lieu de « par auteur » ; **attribution** de l'auteur dans la
    modale = enseignant connecte (et non le prof principal) ; filtrage `class_teachers` par dates cote page.
  - **Test en base** : 2 remplacants inseres sur MAT-SM-BD1 (script service-role) — **a supprimer** apres verif visuelle.

#### 12 juillet 2026 — Auth : double login apres inactivite + delai 1h + message dedie
- **Bug « double login » corrige** : apres une deconnexion pour inactivite, la 1re reconnexion echouait (retour
  sur `/login` « session expiree »), il fallait se connecter 2 fois. Cause : le cookie **httpOnly `app-session`**
  (qui stocke `lastActivity`, gere par le middleware `proxy.ts`) ne peut **pas** etre efface par le logout client
  (`window.location.href='/login'`, hard-nav) → il restait avec un `lastActivity` perime → au retour sur `/dashboard`
  le middleware detectait `inactive` et re-deconnectait aussitot. **Fix** : le middleware **purge `app-session` sur
  chaque `/login`** (`proxy.ts`, avant `return response`). **Regle** : un cookie httpOnly ne se nettoie que
  cote serveur (middleware), jamais via JS client.
- **Delai d'inactivite 30 min → 1h** (`src/lib/session-config.ts`, `INACTIVITY_SECONDS` = source unique middleware
  + hook `useInactivityLogout`). Duree max de session inchangee (24h).
- **Message dedie inactivite** : la deconnexion par inactivite redirige vers `/login?reason=inactivity` →
  « Votre session a expire pour inactivite. Veuillez vous reconnecter. » (`login/page.tsx`). L'expiration 24h garde
  `?reason=session` ; la **deconnexion manuelle** n'affiche aucun message. Cote client, `DashboardNav` distingue
  `handleLogout()` (manuel, `/login`) et le hook inactivite (`doLogout('inactivity')`) ; cote middleware, le motif
  est `inactivity` si inactif, `session` si duree max depassee.

#### 13 juillet 2026 — Remplacant (refonte fiche + liste) + Phase B RLS cahier de texte + modales detail + suivi adulte
- **Session (correctif securite)** : le cookie `app-session` (tracker inactivite/duree max) avait un `maxAge` de 24h →
  passe 24h d'inactivite il disparaissait, et son absence etait prise pour une session neuve → **la protection
  d'inactivite s'auto-desactivait** (Supabase gardant la session). Fix : `SESSION_COOKIE_MAX_AGE = 30 jours`
  (`session-config.ts`, utilise dans `proxy.ts`). **Regle** : le cookie tracker doit vivre plus longtemps que la
  fenetre surveillee, sinon son absence = fausse session neuve.
- **Sidebar** (`DashboardSidebar.tsx`) : accordeon — un clic sur un item **frere** d'un sous-groupe (ex. items de
  Parametres a cote de Pedagogie) referme le sous-groupe (`setOpenSubGroup(null)`). Pedagogie ne restait plus deplie.
- **Fiche classe — encadre Enseignant redeveloppe** (`ClassForm.tsx`) : un seul encadre **Titulaire + Remplacement +
  Historique**. Convention **`effective_until` = dernier jour de remplacement (INCLUS)** : « en cours » =
  `effective_until >= aujourd'hui`, historique = `< aujourd'hui`. **Titulaire** : une ligne + « Changer » (cloture
  date + trace « Ancien titulaire »). **Remplacement en cours** : « Declarer » (Du + Au facultatif = ouvert),
  « Terminer » (modale = **dernier jour**, defaut aujourd'hui, ajustable) → historique le lendemain ; un remplacant
  **pas encore commence** n'affiche que « Retirer » (pas « Terminer », evite plage inversee). **Historique des
  remplacements** toujours deplie, **trie date decroissante**, correction dates (niveau B : editer/supprimer,
  confirme). Toute suppression **confirmee** (`ConfirmModal`). `availableTeachers` n'exclut que les affectations
  **actives** (un enseignant d'historique reste selectionnable).
- **Liste des classes** (`ClassesClient.tsx`, `classes/page.tsx`) : colonne « Enseignants » → **« Titulaire »**
  (actif seul) + nouvelle colonne **« Remplacements »** (NOM Prenom · du — au / en cours), **triee date
  decroissante**, hauteur de ligne = contenu (tous les remplacements affiches). Requete enrichie
  (`class_teachers(..., effective_from, effective_until)`).
- **Phase B — visibilite cahier de texte PAR CLASSE** (migration `cahier-texte-rls-par-classe.sql`) : les policies
  **enseignant** de `class_journal`/`homework`/`homework_status` passent de « par auteur » a « par classe » :
  - **Lecture** : classes ou je suis affecte, avec **fenetre de preparation 7 j** (`effective_from − 7j <=
    aujourd'hui <= effective_until`) → un remplacant lit le cahier de texte du titulaire 7 j avant sa prise de poste.
  - **Ecriture** : seulement mes propres entrees, sur une classe affectee **periode stricte** (`effective_from <=
    aujourd'hui <= effective_until`). Auteur = enseignant connecte.
  - `admin` ajoute a `journal_staff_crud`/`homework_staff_crud` (regle admin = direction).
  - App : `cahier-texte/page.tsx` filtre les classes de l'enseignant sur la fenetre 7 j ; `CahierTexteClient`
    attribue l'auteur d'une creation a l'**enseignant connecte** (titulaire OU remplacant), plus le titulaire par defaut.
  - **Resp. pedagogique / direction / admin** = visibilite **complete** (staff_crud FOR ALL), non limitee.
- **Cahier de texte — « Toutes les classes »** (`CahierTexteClient.tsx`) : option staff dans le filtre Classe →
  affiche toutes les classes, **triees date puis classe**. Bas de carte enrichi : « **Enseignant · Cotisation ·
  Jour HH:MM–HH:MM** ». « Ajouter » desactive en mode « Toutes les classes ». Choix memorise en URL (`?class=__all__`).
- **Cartes → modales verrouillees** (option B, pages detail supprimees) : clic sur une carte ouvre
  `SeanceDetailModal` / `DevoirDetailModal` (portail, **non fermable hors** — X / Fermer). « Modifier » enchaine sur
  la modale d'edition. Pages `[id]` et `devoir/[id]` **supprimees** + composants `CahierTexteDetail`/`DevoirDetail`.
- **Suivi devoir — classes adultes** (migration `add-adult-homework-status.sql`) : table parallele
  `adult_homework_status` (cle `homework_id + parent_id + tutor_number`) car un adulte n'est pas un `student`.
  `DevoirDetailModal` **generalise** (cle participant unifiee) : classe enfants → « Suivi des familles » (eleves,
  `homework_status`) ; classe adulte → « Suivi des participants » (tuteurs `parent_class_enrollments`,
  `adult_homework_status`). Le suivi (vu/effectue) n'apparait que si la classe a des participants.
- **Debug** : scripts SQL `inspect-class-teachers.sql` (etat derive actif/historique) + `delete-test-substitutes.sql`.

#### 14 juillet 2026 — Auth (message session) + email devoir adultes + audit Temps de presence
- **Auth — message d'inactivite au demarrage a froid** (`proxy.ts`, `login/page.tsx`) : le message « session
  expiree pour inactivite » s'affichait a tort quand on **rouvrait le navigateur** (PC eteint) — le cookie
  `app-session` (persistant 30 j) survit, le middleware voyait un `lastActivity` perime et redirigeait en
  `?reason=inactivity`. Correctif : **marqueur de session navigateur `app-open`** (cookie httpOnly **sans
  maxAge** → supprime a la fermeture du navigateur), pose a chaque requete `/dashboard` valide. En inactivite/
  expiration : `?reason=` ajoute **seulement si `app-open` present** (navigateur reste ouvert = vraie inactivite) ;
  sinon (demarrage a froid) redirection `/login` **nue, sans message**. Marqueur purge partout ou `app-session`
  l'etait. **Regle** : un cookie de session (sans maxAge) distingue « navigateur reste ouvert » de « rouvert ».
  Limite : navigateur regle sur « reprendre la session » restaure les cookies de session (message reapparait, cas rare).
- **Email devoir — classes adultes** (`lib/notifications.ts`, `api/notifications/homework/route.ts`) : un devoir de
  classe adulte n'envoyait **0 email** (destinataires pris via `enrollments` eleves). Ajout de `emailsOverride?` a
  `createNotification` ; la route detecte `isAdult` (via `cotisation_types.is_adult`) → **classe enfant** = 2 tuteurs
  du foyer (inchange), **classe adulte** = email au **seul tuteur inscrit** (`parent_class_enrollments` actif,
  `tutor1/2_email` selon `tutor_number`, override toujours force meme vide). Push/in-app inchange (comptes parents
  suspendus). Suivi adulte deja fait le 13/07.
- **Audit module Temps de presence** (`temps-presence/`) — jamais audite. Voir memoire `temps-presence-audit.md`.
  - **P1 permissions & correctness** : bug **`resp_pedagogique`** (role inexistant, le vrai = `responsable_pedagogique`)
    a 2 endroits → le resp. pedago ne voyait ni le recap ni les saisies des enseignants. Modele de permissions
    **decide** : admin/direction/**comptable**/secretaire gerent tout le staff ; **responsable_pedagogique** gere
    **uniquement les enseignants** (+ soi), voit le recap, pas les couts ; enseignant = sa propre presence.
    Client aligne (`canManageAll`, `canManage`, `assignableStaff`, `canEdit` par ligne) + migration
    **`adjust-time-tracking-roles.sql`** (policy manage → `admin/direction/comptable/secretaire` ; nouvelle policy
    `resp_pedago` = ecriture enseignants ou soi). Detection d'absence uniformisee sur **`is_absence`** (fin du
    `entry_type === 'absence'` en dur). Recap absences comptees en **jours distincts**.
  - **P2 a11y** : toolbar `aria-pressed`, nav `aria-label`, cellules jour `aria-label`/`aria-pressed`/`aria-current`,
    actions Modifier/Supprimer en `Tooltip`+`aria-label`+focus, `TimeEntryModal` en `role=dialog`/`aria-modal`/
    `aria-labelledby`/focus initial, erreur `role=alert`, table recap `aria-label`. **Modale de saisie = fermeture
    X / Annuler uniquement** (pas de clic hors ni Echap : evite la perte de saisie, comme cahier de texte).
  - **P3 charte** : quadratins `—` → `·` (plage semaine en `–`), icone `Plus` retiree de « Ajouter »,
    suppression via `ConfirmModal` standard, `FloatSelect label=""` → « Personne remplacee », accents
    (« Recapitulatif » → Récapitulatif, « Cout » → Coût, mois, messages).
  - **P4 export PDF** : nouveau `staffTimePdf.ts` (jsPDF + autoTable, **import dynamique** hors bundle SSR, paysage
    A4, en-tete logo + nom etab, TOTAL, respecte `canSeeCosts`) ; bouton « Exporter PDF » (label-only) dans l'en-tete
    du recap ; `page.tsx` recupere l'etab (nom/logo via `x-etablissement-id`).
  - **P4 garde « aucun type configure »** : `Ajouter` grise + Tooltip si aucune annee OU aucun type de presence ;
    banniere ambre avec lien vers `Parametres → Types de presence` (evite une modale de saisie sans aucun type a choisir).
  - **Reste P4 (a la carte)** : filtre par membre, demi-journees d'absence.

#### 14 juillet 2026 (suite) — Temps de presence P4 (complet) + exclusivite absence/presence + ergonomie
- **P4 termine** (module Temps de presence) :
  - **Filtre par membre** : select « Membre » dans la toolbar (roles gestionnaires + resp. pedago), filtre calendrier +
    recaps. `staffList` (page.tsx) **exclut admin** (parent/super_admin deja exclus) : membres pointables = direction/
    comptable/secretaire/resp.pedago/enseignant.
  - **Enseignant voit ses couts** : `canSeeRecap`/`canSeeCosts` incluent `enseignant` (ne voit que sa propre ligne ;
    RLS `presence_type_rates` = tenant, lecture OK).
  - **Recaps = 2 modales SEPAREES** : boutons « Recap. mensuel » (a droite du selecteur de mois) + « Recap. annuel »
    (groupe droite). Chaque modale = 1 tableau pleine largeur (`renderRecapTable`), en-tete titre + Export PDF + X,
    legende des taux 1 ligne, `tabular-nums`, fermable X/fond/Echap. `buildRecap` mutualise mensuel/annuel ; annuel =
    requete `start_date→end_date` de l'annee (`yearEntries`, rafraichi apres save/delete). PDF : `periodLabel` +
    **taux horaires en haut a droite** (si couts) + **colonnes centrees**.
  - **Demi-journees d'absence** (migration `add-absence-period.sql`) : colonne `absence_period ('full'|'am'|'pm')`.
    Modale = toggle Journee/Matin/Apres-midi (si absence). Recap compte en **fractions** (journee=1, demi=0,5,
    matin+aprem meme jour=1), affiche « 1,5j » (`fmtDays`) ; panneau du jour affiche Matin/Apres-midi.
  - **Garde « aucun type configure »** : Ajouter grise + Tooltip + banniere ambre (lien Types de presence).
- **Exclusivite absence / presence** (`TimeEntryModal`) : **Type choisi en premier** (membre grise tant qu'aucun type),
  liste des membres filtree — saisie d'**absence** = exclure toute personne ayant **deja une entree ce jour** (une seule
  absence/jour) ; saisie de **presence** = exclure les **absents**. **Personne remplacee** = uniquement les **absents** du
  jour (message si aucun). **Blocage suppression** d'une absence tant que des **remplacements du jour la referencent**
  (`replaced_profile_id`) : modale « Suppression impossible » (Supprimer grise) + garde-fou dans `handleDelete`.
  La modale de suppression **normale** affiche un **recap de la saisie** (membre, type colore, date, horaire ou
  periode+motif, remplacement) via le prop `children` de `ConfirmModal` → confirmer la bonne donnee.
- **Ergonomie panneau du jour** : chaque personne en **2 colonnes** (identite avatar+nom a gauche sur une ligne,
  saisies a droite) ; `TruncatedText` (tooltip **uniquement si tronque**, mesure `scrollWidth`) sur nom/notes/rempl/motif ;
  filet `divide-y divide-warm-100` entre personnes ; panneau `self-start` (hauteur = contenu, `max-h-[65vh]` scroll) ;
  en-tete du panneau `h-9` **aligne sur la bande de jours du calendrier**.
- **Calendrier** : badges en **wrap horizontal dans une 2e colonne** a droite du numero ; **plafond +N supprime**
  (tous les badges affiches).
- **Fix decalage de date** : `dateKey` en composantes **locales** (plus `toISOString`/UTC) → « aujourd'hui » + badges
  sur le bon jour.
- **Fix badge « ABS » en dur** : le badge d'absence affichait `'ABS'` en dur → `pt?.code ?? data.type` (vrai code BDD).
  Voir memoire `temps-presence-audit.md` : **passe fin de V1** pour traquer les valeurs en dur (`'ABS'`, `'cours'`…).
- **Migrations executees** : `adjust-time-tracking-roles.sql`, `add-absence-period.sql`.

#### 15 juillet 2026 — Couplage EDT ↔ Temps de presence : types de presence RESERVES
- **Bug de fond corrige** (latent, 0 validation en base au moment du fix) : `handleValidate` (EDT) inserait
  `staff_time_entries.entry_type = schedule_slots.slot_type` = **`cours`/`activite`**, alors que le recap Temps de
  presence regroupe par **CODE** de `presence_types` (ici `CRS`/`ACT`). Aucune correspondance → l'heure validee
  etait comptee en base mais **invisible** dans le recap (pas de colonne). **Confusion code / libelle** a l'origine.
- **Migration `add-presence-type-reserved-kind.sql`** (idempotente) :
  - colonne **`reserved_kind`** (`absence`|`cours`|`activite`) : marque le type **RESERVE** ET sert de
    **correspondance EDT** (aucune valeur en dur cote app) ; backfill des types existants ; unicite partielle
    `(etablissement, annee, reserved_kind)`.
  - **`CHECK (char_length(code) = 3)`** : code de type = exactement 3 caracteres (`AB.`/`CRS`/`ACT`/`MEN`).
  - **`fn_ensure_reserved_presence_types(etab, annee)`** idempotente (`IF NOT EXISTS`) : cree les 3 types manquants
    en **reprenant code/libelle/couleur de l'annee precedente**, sinon defauts. Backfill de toutes les annees.
  - **Trigger `school_years` AFTER INSERT** → toute nouvelle annee recoit les 3 types reserves (annees saisies a
    l'avance incluses, rejeu sans effet).
  - **Trigger `presence_types` BEFORE UPDATE/DELETE** → suppression interdite, `code`/`reserved_kind`/`is_absence`/
    `is_active` non modifiables. **La garde DELETE ne mord que si l'annee existe encore** → la CASCADE de suppression
    d'une annee/etablissement passe (FK `ON DELETE CASCADE`).
  - **Consequence** : les codes reserves sont toujours "pris" → **non reutilisables** par un autre type (unicite
    existante `presence_types_etab_year_code_key`).
- **EDT** (`EmploiDuTempsClient` + `page.tsx`) : `handleValidate` **resout** `slot_type` → type reserve de l'annee →
  ecrit son **vrai code**. Si aucun type reserve → **blocage + message** (« Configurez-le dans Parametres → Types de
  presence ») au lieu d'orpheliner l'heure. La page charge `reservedPresenceTypes` (code + reserved_kind).
- **Types de presence** (`TypesPresenceClient` + `page.tsx`) : « Reserve » pilote par **`reserved_kind`** (couvre les 3,
  au lieu de `is_absence`) ; les reserves gardent l'icone **Modifier** mais **seule la couleur** est editable
  (Libelle/Code en `locked`, Actif `disabled`) ; pas de suppression ; bandeau d'info reecrit (ABSENCE + COURS +
  ACTIVITE) ; code borne a 3 caracteres (`maxLength`, validation `!== 3`).
- **Piege UI (memoire)** : `FloatInput` n'a **pas** de prop `disabled` utilisable — il expose **`locked`** (et
  `disabled={locked}` est ecrit APRES le `{...props}`, donc un `disabled` passe en prop est **ecrase**). Utiliser
  `locked` (qui applique aussi le style grise).
- **Verifie en base** : backfill (3 types x 3 annees), DELETE/UPDATE code/is_active bloques, couleur autorisee,
  type normal (MEN) toujours modifiable/supprimable, nouvelle annee → 3 types crees avec les codes de l'etablissement,
  suppression d'annee → cascade OK, codes a 2 ou 4 caracteres rejetes (23514).
- **Migration executee** : `add-presence-type-reserved-kind.sql`.

#### 15 juillet 2026 (suite) — Audit module Utilisateurs + tracabilite du journal (profiles / parents)
- **P1 securite / correctness** :
  - **Lock-out corrige** : le toggle actif/inactif n'etait bloque que pour `admin` cote UI, et `toggleActive`
    n'avait **aucun controle du role cible** → une direction pouvait desactiver le **super_admin** (et l'admin via
    l'API). Desormais : garde **serveur** (refus si cible `admin`/`super_admin`) + UI grisee (`isCore`).
    NB : le super_admin (espace `/superadmin`, gestion des etablissements/licences) a `etablissement_id` NULL →
    la RLS tenant l'exclut deja de cet ecran ; la garde est de la defense en profondeur.
  - **Role du select vide a la creation** (etait pre-rempli a `enseignant`) + obligatoire (`vRole`) — regle projet.
  - **`parent` retire des roles creables** (comptes parents suspendus en V1). Role **verrouille** en edition pour
    `admin`/`super_admin`/`parent` (`LOCKED_ROLES`).
- **P2 charte / ergonomie** : **bandeau d'en-tete** sur la fiche (avatar + `h1` NOM Prenom + role · email + badges
  Inactif / 2FA), calque sur la fiche enseignant ; **`ListStatCard`** (fini le `card` maison en `text-2xl`) rendues
  **cliquables (filtres)** comme les autres listes ; bouton « Ajouter » au style charte `FloatButton` ; tableau en
  **`text-xs`**, email sans `font-mono`, quadratin `—` → `·` ; **vrais onglets ARIA** (`tablist/tab/tabpanel`,
  roving tabindex, fleches) + **deep-link `?tab=`** ; **`space-y-6` → `space-y-2`** (les 4 listes principales sont
  en `space-y-2`).
- **P3 confirmations** : **desactivation** d'un compte (perte d'acces) et **envoi du lien de reinitialisation**
  (email) passent par `ConfirmModal` — la reinit. 2FA en avait deja une.
- **Champ « Remarques »** (`profiles.notes`, migration `add-profile-notes.sql`) : affiche **uniquement** pour les
  roles **sans fiche metier** (direction / comptable / secretaire / responsable_pedagogique) — les enseignants
  (`teachers.notes`) et parents (`parents.notes`) ont deja le leur (evite deux champs concurrents). Suit le role
  choisi. Place en fin de carte, apres le mot de passe. Schemas Zod mis a jour (sinon rejet a la validation).
  A la creation, pose apres le RPC `create_profile_only` (signature fixe), echec non bloquant.
- **Checklist mot de passe** : ne s'affichait qu'au **blur** (d'ou l'impression qu'elle dependait de l'oeil, qui
  blure le champ). Desormais visible **pendant le focus** uniquement, et le bouton oeil ne vole plus le focus
  (`onMouseDown` neutralise).
- **TRACABILITE DU JOURNAL — cause generale** : le trigger `fn_audit_log()` lit `auth.uid()` ; une ecriture de
  **table** via `createAdminClient()` (service-role) n'a **pas de session** → `audit_logs.user_id` NULL →
  colonne « Utilisateur » vide. **Regle : les tables s'ecrivent avec le client SESSION ; le client admin est
  reserve aux comptes `auth`** (`auth.admin.*`, `resetPasswordForEmail`).
  - **`profiles`** : `createUser` / `updateProfile` / `toggleActive` / `updateEmail` passes en client session.
    Il **manquait la policy RLS UPDATE** pour admin/direction (seule « update own profile » existait) — c'est ce
    qui forcait le contournement en service-role → migration **`fix-profiles-audit-user.sql`** (policy scopee a
    l'etablissement, garde `coalesce(get_user_role(), '')`). N'elargit aucun pouvoir (les server actions etaient
    deja gardees par `requireRoleServer`). **Verifie : acteur capte.**
  - **`parents`** : `createParentAccount` (insert fiche) + `updateParent` passes en client session. **Aucune
    migration** : la policy « Admin, direction and secretaire can manage parents » (FOR ALL) existait deja.
    **Verifie : acteur capte.**
  - **`sendPasswordReset`** : n'etait **pas trace** (contrairement a la reinit. 2FA) → `logAudit` ajoute.
  - **Sains** (verifies) : `school_years`, `students`, `teachers`, `cotisation_types`, `staff_time_entries`.
  - **Piege de diagnostic** : les **scripts service-role jetables** produisent eux aussi des logs sans acteur
    (ex. test du trigger `school_years` du 15/07 13:42) — verifier l'**origine**, pas seulement la date.
  - **Passe globale « tracabilite » a faire en fin de V1** (voir memoire `audit-trail-actor.md`).
- **Piege UI (memoire)** : `FloatInput` n'a pas de prop `disabled` utilisable → utiliser **`locked`**.
- **Migrations executees** : `add-profile-notes.sql`, `fix-profiles-audit-user.sql`.

#### 15 juillet 2026 (fin) — Roles creables, synchro d'identite profiles/teachers
- **`enseignant` retire des roles creables** depuis la fiche utilisateur : le creer ici produisait un enseignant
  **FANTOME** (profil `role='enseignant'` **sans ligne `teachers`**) → absent de la liste Enseignants, non affectable
  a une classe (`class_teachers` → `teachers.id`), invisible pour la validation EDT (`teachers.user_id`), mais
  present dans Utilisateurs et Temps de presence. Les enseignants se creent depuis la **fiche enseignant**
  (`createTeacherWithAccount` : compte auth + profil + ligne `teachers`, atomique). Verifie : aucun fantome en base.
  → `enseignant` ajoute a `LOCKED_ROLES` (changer le role laisserait une ligne `teachers` orpheline).
  - **Modele resultant** : `ROLE_OPTIONS` (creables ici) = **direction / comptable / secretaire / resp. pedagogique**
    = exactement `ROLES_WITH_NOTES`. **L'ecran Utilisateurs gere les comptes des roles SANS fiche metier** ;
    enseignant → fiche enseignant, parent → fiche parents.
- **Synchro d'identite `profiles` ↔ `teachers`** (migration `sync-identity-profile-teacher.sql`) :
  `civilite / first_name / last_name` sont **dupliques** dans les 2 tables et **3 chemins** les modifiaient sans
  jamais synchroniser l'autre — **Mon compte** (`updateOwnProfile`) et **fiche utilisateur** (`updateProfile`) →
  `profiles` seul ; **fiche enseignant** (`updateTeacher`) → `teachers` seul. Un enseignant pouvait donc s'appeler
  « X » cote compte et « Y » cote fiche. Correctif : **triggers bidirectionnels** (couvre tous les chemins, y
  compris les scripts), **`SECURITY DEFINER`** — indispensable car la RLS `teachers` n'autorise l'ecriture qu'a
  admin/direction : sans cela, un enseignant se renommant depuis Mon compte aurait vu la synchro **echouer
  silencieusement**. Anti-recursion par `IS DISTINCT FROM` (la MAJ retour ne touche 0 ligne). Rattrapage inclus.
  **Teste** : synchro OK dans les 2 sens, sans recursion. **Parents non concernes** (comptes suspendus en V1,
  `tutor1/2_user_id` vides) → a traiter le jour de leur activation.
- **Message EDT corrige** : « *Veuillez d'abord lier un compte dans la fiche enseignant* » renvoyait vers une
  fonction **inexistante** (`TeacherForm` ne gere pas `user_id` ; aucun ecran de rattachement). Remplace par un
  message vrai. Cas defensif inatteignable aujourd'hui (les 3 fiches ont toutes un compte).
- **Cumul resp. pedagogique + enseignant** : impossible (role unique). Cas **absent aujourd'hui** → rien developpe.
  Si ca revient : privilegier `role='responsable_pedagogique'` + fiche enseignant **rattachee au meme compte**
  (necessite le rattachement + ajuster 2 tests `role === 'enseignant'`) ; **deux profils = depannage seulement**
  (2 emails, 2 logins, heures/journal eclates). Multi-roles = V2. Voir memoire `role-cumul-enseignant.md`.
- **Migration executee** : `sync-identity-profile-teacher.sql`.

#### 15 juillet 2026 (soir) — Communications : audit + refonte de l'envoi aux parents (LOT 1)
Module a 3 sous-menus (Parents / Staff-Enseignants / Messages envoyes), jamais audite. **Constat central : le
module affichait « envoye » sans envoyer.** Refonte en 4 lots ; seul le **lot 1 (socle d'envoi)** est fait.

- **DECOUVERTE MAJEURE — aucun email n'est JAMAIS parti de l'application** : `.env.local` ne contient que
  `DEFAULT_TENANT_SLUG` + les 3 cles Supabase. **Pas de `SMTP_HOST`** → `src/lib/email.ts` construit son
  transporteur uniquement si `SMTP_HOST` existe, sinon `null` → tout envoi retourne « Email non configure ».
  Concerne devoirs, absences, recus de paiement, annonces. (Les mails de reinit. mdp passent par Supabase Auth,
  d'ou l'illusion.) Explique pourquoi personne n'avait vu les bugs ci-dessous. **Prerequis prod ajoute.**
- **Perimetre decide** : la communication aux parents = **voix de l'etablissement** → `admin` / `direction` /
  `secretaire` / `responsable_pedagogique`. **L'enseignant ne communique que les devoirs** (cahier de texte) ;
  le **comptable** ecrit aux familles **depuis Financements** (transactionnel : recu, relance) — son historique
  d'envoi sera propre a ce module, `announcements` reste la table de la seule communication d'etablissement.
  - Matrice : `class` / `selected` / `all_active` = les 4 roles ; **`all_registered`** (toute la base,
    non-inscrits compris) = admin/direction/secretaire **seuls**. **« Parents choisis » = parents d'eleves
    inscrits** → `all_registered` est le seul mode qui atteint les non-inscrits.
  - NB : ce n'etait **pas** une decision d'origine mais un **accident** (la route API oubliait les autres roles).
- **P1 corriges (7)** : (1) sous-menu **Staff** n'appelait **aucune** route → messages jamais envoyes (reste a
  traiter a son tour) ; (2) route `/api/notifications/announcement` gardee `admin/direction/secretaire` alors que
  l'UI ouvrait a d'autres → **403 avale** par un `fetch` fire-and-forget → faux succes ; (3) **« Direction en CCI »
  etait une fiction** (`directionEmails` calcule, passe en prop, **jamais utilise** ; `bcc` inexistant dans tout le
  code) ; (4) **classes adultes = 0 destinataire** (ciblage via `enrollments`/students seulement) ; (5) **PJ jamais
  envoyees** (ni attachees, ni liees dans l'email) ; (6) **bucket public** + `getPublicUrl` + **aucune limite** ;
  (7) permissions de ciblage **client-only** (la policy RLS autorisait tout type a tout role staff).
- **Refonte** : **server action unique** `communications/actions.ts` (`sendParentMessage`) — garde de role **et**
  de mode, **resolution des destinataires cote serveur** (source unique : enfants `enrollments` + adultes
  `parent_class_enrollments` selon `cotisation.is_adult`, seul le tuteur inscrit servi), sanitisation **avant**
  stockage/envoi, envoi par lots, et **retour d'un vrai compte rendu** (`sent` / `failed` / `withoutEmail`) →
  fin du faux succes. **Route API supprimee** (morte + 2e point d'entree permettant de renvoyer un message).
- **Plomberie partagee** (Financements s'y branchera) : `sendNotificationEmail` gagne `bcc` / `replyTo` /
  `attachments` ; `createNotification` gagne `emailBcc` / `emailReplyTo` / `emailAttachments` et **retourne**
  desormais un statut (`NotificationResult`) au lieu d'avaler ses erreurs.
- **Regles d'envoi decidees** : **1 email par foyer** (`To` = adresses du foyer) → **aucune adresse d'un autre
  foyer n'est exposee**, et le decoupage est inherent (pas de blast CCI, qui serait un motif spam, tuerait le
  suivi par famille et buterait sur la limite ~100 dest./message). **CCI = role `direction` seul** (pas l'admin,
  conforme a la regle « ecrire a la direction n'inclut pas l'admin »). **`Reply-To` = `etablissements.contact`,
  OBLIGATOIRE** : si vide → **envoi refuse avant tout enregistrement** (pas de repli sur l'auteur, decision
  utilisateur). **PJ : 1 Mo au total**, garde client + action + Storage, **reellement attachees** au mail (une URL
  signee expirerait avant l'ouverture).
- **Migration `rework-communications-security.sql`** (executee) : type d'annonce **controle en RLS**
  (`announcements_insert_scoped`) ; bucket **prive** + `file_size_limit` 1 Mo + 8 types MIME ; policies storage
  **cloisonnees par etablissement** (chemin `{etablissement_id}/...`) ; `announcement_attachments.file_url`
  **remplacee** par `file_path` NOT NULL (URL signee a la consultation, meme regle que les justificatifs) ;
  statut **`skipped`** ajoute (foyer sans adresse : marquer `failed` mentirait).
- **Verifie en base** (scripts service-role jetables, supprimes) : bucket prive/1 Mo/8 types OK, `file_path`
  NOT NULL OK (`23502`), `file_url` absente OK, `skipped` accepte et statut invalide refuse (`23514`).
  **Module vierge** (0 annonce / 0 destinataire / 0 PJ / 0 fichier) → a permis de **durcir** la migration
  (aucune clause d'heritage, policy strictement cloisonnee) plutot que de trainer du legacy.
- **Bugs rattrapes par la verification en base, avant livraison** : **`etablissements.name` n'existe pas**
  (colonne = **`nom`**) → l'action aurait plante a chaque envoi ; **`file_url` etait NOT NULL** → violation a la
  1re PJ. Le pied de mail « Bilal Education » en dur devient le vrai `nom` de l'etablissement.
- **Volume reel : 200-300 foyers** (et non ~45 comme le laissait croire le seed) → **Gmail gratuit hors jeu**
  (~500 dest./jour : un envoi « tous les parents » = 60 % du quota). Workspace (~2 000/j) passe, mais a ce volume
  un **service transactionnel** (Brevo/Resend/Mailgun) est le bon outil (rebonds, delivrabilite, reputation).
  **Non bloquant pour l'architecture** : tous parlent SMTP → 4 champs de config, 0 ligne de code.
  **Regle delivrabilite** : le `From` doit rester l'adresse du **compte SMTP** (alignement SPF/DKIM) ; on met le
  **nom de l'etablissement en nom d'affichage**. Mettre `contact@mon-domaine` en `From` tout en passant par Gmail
  = indesirable/rejet.
- **Dettes constatees (non traitees)** : `current_etablissement_id()` est utilisee par des dizaines de migrations
  mais **sa definition n'est nulle part dans le depot** (la base la connait, pas le code) → bloquera une
  reconstruction d'environnement. `fn_audit_log()` prend l'etablissement dans le **profil de `auth.uid()`** et ne
  se rabat sur `NEW.etablissement_id` qu'a defaut → **toute ecriture service-role sur une table SANS colonne
  `etablissement_id` echoue** (`audit_logs.etablissement_id` NOT NULL) : piege pour le prochain script.
  `src/lib/auth/requireRole.ts` definit un `UserRole` local **qui oublie `comptable`**.
- **Reste a faire** : **lot Messagerie** (`Parametres → Etablissement → Messagerie` : config SMTP **par
  etablissement** en base — table dediee, secret **jamais renvoye au navigateur**, transporteur **en pool avec
  limite de debit**, bouton « Tester la connexion ») ; **lot 2 interface** (2/3 composition · 1/3 destinataires
  collant, compteur vivant, alerte familles sans email, apercu en modale, `ConfirmModal` avant envoi, bouton
  grise + banniere si contact etablissement absent) ; **lot 3 a11y + charte** ; **sous-menu Staff**.

## Prochaine etape
- **Communications** : lot Messagerie (config SMTP), puis lot 2 (interface), lot 3 (a11y/charte), puis Staff.
- Poursuite des **fonctionnalites utilisateurs**.
- Passes de **fin de V1** : plan de test (l'utilisateur le demandera), tracabilite globale, valeurs en dur,
  quadratins `—`, et les **prerequis de mise en production** ci-dessus.

## Stack technique

- **Framework** : Next.js 16.2.10 (App Router + Turbopack, Server + Client Components)
- **UI** : React 19.2
- **Base de donnees** : Supabase (PostgreSQL + Row Level Security)
- **Styles** : Tailwind CSS (palette turquoise #18aa99 / orange #f97316)
- **Editeur riche** : TipTap
- **PDF** : jsPDF
- **Drag & Drop** : dnd-kit
- **Notifications push** : web-push + nodemailer (emails)
- **Dates** : date-fns
- **Sanitisation HTML** : DOMPurify (isomorphe via `src/lib/security/sanitize.ts`, jsdom au SSR)

## Commandes

```bash
npm run dev          # Serveur de developpement (http://localhost:3000)
npm run build        # Build production
npm run lint         # Linting ESLint
npm run type-check   # Verification TypeScript (tsc --noEmit)
```

## Structure du projet

```
src/
  app/dashboard/       # Pages par module (App Router)
  components/          # Composants par domaine
  lib/                 # Utilitaires, clients Supabase, validation
supabase/
  schema.sql           # Schema de la base
  policies.sql         # Politiques RLS
  migrations/          # Scripts de migration
  seed-*.sql           # Donnees de demo
```

## Modules implementes (32 commits)

1. **Eleves** (students) : CRUD, fiche identite, freres/soeurs, onglets discipline/documents, archivage
2. **Parents** (parents) : CRUD, affectation aux eleves, pagination
3. **Enseignants** (teachers) : CRUD, profil identite, recherche, stats
4. **Classes** (classes) : gestion des classes et affectations
5. **Evaluations** : gabarits, saisie de notes, regles de suppression
6. **Bulletins** : edition et archivage PDF
7. **Cahier de texte** : suivi pedagogique
8. **Emploi du temps** : saisie EDT, controles, vacances, 1er jour semaine
9. **Absences** : feuille d'appel, trombinoscope, notifications temps reel
10. **Temps de presence** : feuille de presence
11. **Financements / Cotisations** : detail, vue globale, corrections
12. **Communications** : menus et canaux de communication
13. **Notifications** : notifications temps reel (push + email)
14. **Journal d'activite** (logs) : audit trail
15. **Comptes utilisateurs** : creation automatique des comptes
16. **Etablissement** : configuration, logo

## Conventions

### Numerotation des fiches
- Eleves : `ELV-YYYYMM-NNN` (prefixe = annee+mois inscription, increment annuel)
- Enseignants : `ENS-YYYYMM-NNN` (prefixe = annee+mois embauche, increment annuel)
- Les numeros sont verrouilles apres enregistrement en base

### Validation des doublons
- Pas de doublon nom+prenom sur toutes les fiches (tuteurs, eleves, enseignants)
- Insensible a la casse et aux accents : `ilike` cote DB + `normalizeNom` (NFD) cote client
- Erreur affichee via banniere au submit

### Architecture des entites
Chaque entite suit le pattern : Table + Form + Client wrapper + pages (list, new, [id])

### UI
- En-tetes de pages sur une seule ligne : "Fiche eleve NOM Prenom"
- Theme Material Design
- Pas d'emojis dans l'interface
- Reponses concises dans les echanges avec Claude

## Plan en cours : Gestion Primaire / Secondaire + EDT Drag & Drop

### Phase 1 — Fondations (TERMINEE)
- [x] Migration SQL : `teaching_mode` sur classes, `working_days` (5/7) sur etablissements, `color` sur matieres
- [x] Page Etablissement : selecteur 5/7 jours travailles
- [x] ClassForm : selecteur mode Primaire (`single`) / Secondaire (`multi`)
  - Single : 1 prof principal, creneaux recurrents dans le form, pas de matiere
  - Multi : N profs avec 1+ matieres (prof optionnel), section creneaux masquee (renvoi vers EDT)
- [x] Couleur par matiere dans le referentiel cours (palette 15 couleurs, suggestion auto)
- [x] EDT : vue semaine par defaut, grille 15min, filtrage colonnes selon working_days

### Phase 2 — Palette matieres + Drag & Drop creation
- [x] Nouveau composant `SubjectPalette.tsx` : panneau lateral gauche (vue semaine + filtre classe + mode multi)
- [x] Chaque tranche 15min de la grille = zone droppable (dnd-kit)
- [x] Drop matiere sur grille → creation auto du slot (prof + matiere + horaire)
- [x] DndContext + DragOverlay (meme pattern que AffectationClient)

### Phase 3 — Deplacement de creneaux existants (TERMINEE)
- [x] Capsules EDT draggables (vue semaine + filtre classe uniquement)
- [x] Drop sur autre creneau → deplacement (conservation duree, MAJ day_of_week + start_time)
- [x] Detection collisions avant validation, blocage drop jours non travailles / vacances

### Phase 4 — Cascade et coherence (TERMINEE)
- [x] Mode single : changement prof principal → MAJ auto tous les slots de la classe
- [x] Mode multi : retrait prof → slots passes en "sans prof" avec alerte
- [x] Matiere sans prof autorisee : bordure pointillee + badge "Prof non affecte" sur EDT
- [x] Suppression classe : double confirmation (liste dependances + saisie nom classe)
- [x] Suppression classe : bloquer si des eleves sont affectes a la classe (verification avant suppression)

### Phase 5 — Historique affectations en cours d'annee (TERMINEE)
- [x] Migration SQL : `effective_from` / `effective_until` sur `class_teachers`
- [x] Modification affectation en cours d'annee : cloture ancienne + creation nouvelle avec date d'effet
- [x] Suppression affectation en cours d'annee : cloture avec date d'effet (pas de suppression physique)
- [x] Modale de confirmation avec date picker (defaut = aujourd'hui, anticipation possible)
- [x] Hors periode scolaire : modification/suppression directe (pas de cloture)
- [x] Cloture automatique des slots EDT lies aux affectations cloturees
- [x] Historique des affectations cloturees visible sur la fiche classe (lignes grisees avec dates)

### Fichiers impactes
| Fichier | Phases |
|---|---|
| `supabase/migrations/add-teaching-mode-working-days-color.sql` | 1 |
| `src/components/etablissement/EtablissementForm.tsx` | 1 |
| `src/components/classes/ClassForm.tsx` | 1, 4, 5 |
| `src/components/classes/ClassesClient.tsx` | 4 |
| `src/app/dashboard/classes/new/page.tsx` | 1 |
| `src/app/dashboard/classes/[id]/page.tsx` | 1, 5 |
| `supabase/migrations/add-class-teachers-effective-dates.sql` | 5 |
| `src/components/emploi-du-temps/EmploiDuTempsClient.tsx` | 1, 2, 3 |
| `src/components/emploi-du-temps/DayColumn.tsx` | 1, 2 |
| `src/components/emploi-du-temps/SlotCapsule.tsx` | 3, 4 |
| `src/components/emploi-du-temps/SubjectPalette.tsx` | 2 (nouveau) |
| `src/components/emploi-du-temps/SlotFormModal.tsx` | 2 |
| `src/app/dashboard/emploi-du-temps/page.tsx` | 1, 2 |
| Formulaire cours/UE | 1 |

---

## Prerequis MISE EN PRODUCTION (bloquants)

- [ ] **AUCUN ENVOI D'EMAIL NE FONCTIONNE** (constate le 15/07/2026) : `.env.local` n'a **ni `SMTP_HOST`, ni
  `SMTP_USER`, ni `EMAIL_FROM`**. `src/lib/email.ts` ne cree son transporteur que si `SMTP_HOST` existe → sinon
  `null` et **tout envoi echoue silencieusement** (« Email non configure »). **Aucun email applicatif n'est jamais
  parti** : devoirs, absences, recus de paiement, annonces. Seuls les mails d'Auth (reinit. mdp) fonctionnent,
  car ils passent par Supabase. → Traite par le **lot Messagerie** (config SMTP par etablissement dans la fiche,
  et non par variable d'environnement : l'app est multi-etablissement).
  **Volume reel : 200-300 foyers** → Gmail **gratuit** insuffisant (~500 dest./jour) ; Workspace (~2 000/j) tient,
  un service transactionnel (Brevo/Resend/Mailgun) est preferable a ce volume.
- [ ] **`NEXT_PUBLIC_SITE_URL`** : **absent de `.env.local`**. `sendPasswordReset` (utilisateurs) et tout lien de mail
  auth retombent sur le fallback **`http://localhost:3000`** → en production, le mail de reinitialisation de mot de
  passe enverrait l'utilisateur **sur localhost** (lien mort). Definir la variable ET ajouter l'URL aux
  **Redirect URLs** autorisees du projet Supabase (Auth → URL Configuration).
- [ ] Verifier la **duree de validite des liens auth** (Supabase → Auth → *Email OTP expiration*, **1 h par defaut**) :
  les liens de reinitialisation sont a **usage unique** et expirent selon ce reglage.

## Actions SQL en attente

- [x] Executer `supabase/migrations/fix-student-numbers-add-month.sql` dans Supabase SQL Editor
- [x] Executer `supabase/seed-teachers-demo.sql` dans Supabase SQL Editor
- [x] Executer `supabase/migrations/add-teaching-mode-working-days-color.sql` (apres phase 1)
- [x] Executer `supabase/migrations/add-class-teachers-effective-dates.sql` (phase 5)
- [x] Executer `supabase/migrations/add-teacher-notes.sql` (colonne `teachers.notes`)
- [x] Executer `supabase/migrations/add-teacher-documents.sql` (table + bucket + RLS ; colonne `label` ajoutee)
- [x] Executer `supabase/migrations/add-school-year-to-presence-types.sql` (colonne `school_year_id`
  + backfill + unicite `(etablissement, annee, code)` + NOT NULL).
- [x] Executer `supabase/migrations/fix-audit-user-tracking.sql` (RPC creation en SECURITY DEFINER +
  `create_parent_login_profile` ; tracabilite utilisateur du journal).
- [x] Executer `supabase/migrations/add-audit-triggers-documents.sql` (triggers audit sur
  `teacher_documents` + `student_documents`).
- [x] Executer `supabase/migrations/add-teacher-account-cascade.sql` (`profiles.id`→auth CASCADE,
  `audit_logs.user_id`→profiles SET NULL ; suppression complete d'un compte enseignant).
- [x] Executer `supabase/migrations/add-set-teacher-profile-active-rpc.sql` (RPC `set_teacher_profile_active`
  SECURITY DEFINER, garde `coalesce`).
- [x] Executer `supabase/migrations/fix-rpc-guard-null-role.sql` (durcissement garde NULL sur
  `create_profile_and_teacher` + `create_parent_login_profile`).
- [x] Executer `supabase/migrations/add-profile-sensitive-columns-guard.sql` (trigger anti auto-escalade
  sur `profiles` : role/is_active/etablissement_id).
- [x] Executer `supabase/migrations/add-get-verified-totp-user-ids-rpc.sql` (RPC statut 2FA visible admin).
- [x] Executer `supabase/migrations/add-adult-grading.sql` (tables `adult_grades`, `adult_bulletin_appreciations`,
  `adult_bulletin_archives` + RLS + audit ; notation des adultes).
- [x] Executer `supabase/migrations/fix-schedule-overlap-effective-dates.sql` (contrainte anti-doublon EDT
  rendue date-aware : `EXCLUDE gist` sur classe/jour/horaires + chevauchement des dates d'effet, `btree_gist`).
- [x] Executer `supabase/migrations/harden-time-tracking-rls.sql` (RLS `staff_time_entries` +
  `schedule_validations` : ecriture reservee aux gestionnaires ou a sa propre presence pour un enseignant).
