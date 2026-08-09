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

#### 15 juillet 2026 (soir, suite) — Messagerie par etablissement (SOCLE) + refonte de l'ecran d'envoi (LOT 2)

**LOT MESSAGERIE — `Parametres → Etablissement → Messagerie`** (le vrai socle : sans lui, rien ne part).
- **Migration `add-etablissement-smtp.sql`** (executee) : table `etablissement_smtp` (host, port, secure,
  username, password, from_name, from_email ; PK = `etablissement_id`). **Config en base et non en variable
  d'environnement** : l'app est multi-etablissement, une variable est globale par nature.
- **Regime « serveur uniquement »** : RLS activee et **AUCUNE policy** + `REVOKE ALL ON ... FROM anon,
  authenticated` → meme un admin ne peut pas lire le mot de passe depuis la console du navigateur. Seul le
  service-role (donc le serveur) y accede. **Ne JAMAIS ajouter de policy de lecture** : ce serait exposer le
  secret. Consequence assumee : toute lecture/ecriture passe par une server action.
  - **Pas de trigger d'audit sur cette table** : `fn_audit_log()` copie `to_jsonb(NEW)` dans
    `audit_logs.new_data` → **le mot de passe SMTP y atterrirait en clair**. Tracabilite via un `logAudit`
    explicite (client session → acteur capte), qui note serveur/expediteur mais **jamais le secret**.
  - `getSmtpSettings()` est **le seul point de sortie** vers le navigateur : il **retire le mot de passe** et
    renvoie `hasPassword: boolean`. Champ **en ecriture seule** (vide a l'affichage, saisi seulement pour
    changer). Reserve **admin/direction** (la section ne s'affiche pas pour les autres).
- **Service email refondu** (`src/lib/email.ts`) : `sendNotificationEmail` prend desormais **`etablissementId`**
  et charge la config de l'etablissement ; transporteur **en pool avec limite de debit** (3 connexions,
  ~5 msg/s) **mis en cache par etablissement** avec invalidation par signature de config. A 200-300 foyers,
  envoyer d'un seul elan = blocage temporaire cote fournisseur. Seul appelant : `notifications.ts` (qui a deja
  `etablissement_id`) → changement contenu. \+ `hasSmtpConfig()` (existence sans toucher au secret).
- **« Tester la connexion »** : va jusqu'a l'**envoi reel** vers `etablissements.contact`. Une connexion qui
  repond ne prouve rien (quota, expediteur refuse, compte restreint). Teste la config **saisie**, pas
  enregistree → on valide avant de sauvegarder, sans jamais renvoyer le mot de passe au client.
- **Regle delivrabilite (rappel)** : `from_email` **doit** etre l'adresse du compte SMTP (alignement SPF/DKIM).
  `from_name` = nom d'affichage (defaut : nom de l'etablissement). **Distinction a retenir** :
  *Adresse d'expedition* (`From`, technique, imposee par le compte) ≠ *Email de contact*
  (`Reply-To`, humaine, choisie, destinataire du test). Elles peuvent etre identiques.
- **Fiche etablissement — mise en page** : **2 colonnes** (Identite + Messagerie a gauche, Documents requis a
  droite) separees d'un **filet vertical**, alignees en haut, **sans scrollbar de page** (`overflow-y-auto`
  retire). Titre **« Identite »** ajoute au 1er encadre (meme charte que « Messagerie »). Bouton **Valider
  rentre dans l'encadre** ; mention **« * obligatoire » commune**, sous la colonne gauche.

**LOT 2 — refonte de l'ecran d'envoi aux parents** (`NewMessageClient`) :
- **2 colonnes** : composition a gauche, **panneau destinataires collant** a droite. Les ciblages interdits
  **n'apparaissent plus** (au lieu d'etre grises) : on ne montre pas ce qu'on refuse.
- **Fin du mur d'adresses** (`<textarea>` de 300 emails) → **compteur vivant** : « N foyers cibles · N emails ·
  un envoi par foyer ». Familles injoignables **nommees** (alerte ambre) + modale « Voir le detail ».
- **Compteur exact pour les classes adultes** : `classParticipants` (page) porte `tutorNumber`
  (`null` = foyer, 1|2 = classe adulte) → le calcul client **reproduit la resolution serveur**. Libelle adapte
  (« participants » et non « foyers »). Sans ca l'ecran aurait affiche autre chose que ce qui part.
- **Apercu + detail en modales portees dans `<body>`** (`createPortal`) : rappel du piege `animate-fade-in`,
  dont le `transform` capture le `position: fixed` (deja rencontre sur le cahier de texte).
- **`ConfirmModal` avant envoi** (irreversible) : recap objet / cible / volume / PJ + avertissement explicite
  quand le ciblage inclut les non-inscrits.
- **Blocage en amont** : banniere + « Envoyer » grise si la **messagerie** ou l'**email de contact** manquent
  (lien vers les parametres) → on ne redige plus pour rien.
- **Libelles** : « Parents {annee en cours} » (dynamique, repli si aucune annee) et **« Tous les contacts »**
  (ex-« Tous les parents enregistres ») — **aligne aussi dans l'historique et la fiche message**, qui gardaient
  deux autres noms. **« Tout selectionner » supprime** (tout le monde = le bouton « Parents {annee} », pas une
  selection manuelle) ; recherche placee a droite de « Tout deselectionner ». Liste des familles a **hauteur
  fixe de 10 lignes** (fixe et non `max-h` : sinon le panneau saute au filtrage). **Mention « direction en copie
  invisible » retiree** du recap (l'info ne concerne qu'admin/direction) — la CCI part toujours.
- **Infos de classe sur 3 lignes** (`<dl>` Enseignant / Cotisation / Horaire), toujours affichees avec
  « Non affecte » / « Non renseigne » pour que la hauteur ne varie pas.
- **Nouvelle classe `.list-scroll`** (globals.css) : scrollbar fine sur **fond clair**, pendant de
  `.sidebar-scroll` (taillee pour la sidebar sombre, pouce blanc). Point d'extension pour les listes bornees.

**REGLE (memoire `name-before-firstname`) — le NOM vient TOUJOURS avant le prenom.** Enoncee par l'utilisateur
apres **3 inversions** introduites ici : prof principal construit en `${first_name} ${last_name}` (page), et
expediteur inverse dans l'historique **et** la fiche message. CLAUDE.md ne l'enoncait qu'en creux (« Fiche eleve
NOM Prenom »). Controle : `grep -rn "first_name}[^\`]*last_name}"` — toute occurrence en **affichage** est un bug.

- **Dette** : `npm run lint` est **casse** (`next lint` a disparu en Next 16) — non traite.
- **Migration executee** : `add-etablissement-smtp.sql`.

#### 16 juillet 2026 — Communications LOT 3 (a11y + charte historique & fiche message)
- **P1 bug (introduit par le lot 1)** : le statut **`skipped`** (foyer sans adresse) etait invisible sur la
  fiche message — pas de badge (`STATUS_BADGE` s'arretait a pending/sent/delivered/failed) → affiche « En attente »
  a tort, et **absent des compteurs** (boucle sur 4 cles en dur). Correctif : badge « Sans email » (ambre),
  **compteurs derives des statuts reellement presents** (`reduce`, plus de liste figee). **`delivered` retire**
  (jamais pose par le code — pas d'accuse de reception ; le vert va a « Envoye »).
- **Historique (`SentMessagesClient`)** : `card p-0` + `.list-th/.list-td/.list-name` + `text-xs`, **ligne
  cliquable** (nom = `<Link>` avec `stopPropagation`), boutons **sans icone**, filtres `aria-pressed`, table
  `aria-label`, `th scope`, recherche `ariaLabel`, quadratins → `·`. **Bouton « Parents » masque** pour
  comptable/enseignant (via le `role`, qui etait passe mais inutilise).
- **Sous-filtre classe** : quand « Parents d'une classe » est actif, un **`FloatSelect`** (copie exacte
  d'« Affectations apprenants » : `wrapperClassName="w-fit"`, libelle « Nom · Civilite NOM Prenom », requete
  enrichie `class_teachers(teachers(...))`) place **a droite** (`ml-auto`), en `compact` (mini hauteur), option
  **« Toutes les classes »** avec sentinelle **`__all__`** (valeur NON vide, sinon le label flottant chevauche
  le texte de l'option — piege `FloatSelect`). Ne propose que les classes reellement presentes.
- **Filtres memorises** (recherche + type + classe) en **`sessionStorage`** : retrouves au retour d'une fiche
  (lien ou Precedent). **Piege corrige** : le flag d'hydratation doit etre un **`state`, pas un `ref`** — un ref
  passe a true des l'effet de restauration, et l'effet de persistance (meme commit) reecrit alors les defauts
  par-dessus le stockage AVANT que les valeurs restaurees s'appliquent. En `state`, il reste false durant le
  commit de montage → pas d'ecrasement.
- **Fiche message (`MessageDetailClient`)** : **condensee** (3 cartes serrees au lieu de 5), **labels**
  (capitales) sur chaque champ ; **Objet = 1er champ pleine largeur de la carte infos** (choix utilisateur),
  **Message** en label sur le corps. **Infos classe** ajoutees (Enseignant / Cotisation / Horaire — requete
  `[id]/page.tsx` enrichie). **Destinataires** : encadre a **hauteur figee** (320px, `.list-scroll`) + **champ
  de recherche** + entete collant. **« Retour a la liste »** rendu **au niveau page** (`ChevronLeft` + style
  commun), identique a classes/[id] et annee-scolaire/[id].
- **Lecon apprise (frustration utilisateur)** : « comme X » = aller **lire le composant X et le recopier**
  (mêmes classes Tailwind, mêmes infos affichees) au 1er coup, pas le reconstruire de memoire. Le `FloatSelect`
  a coute plusieurs allers-retours (largeur `w-56` au lieu de `w-fit` → tronque ; libelle sans l'enseignant).
- **Lecon apprise (recherche)** : ne pas elargir une recherche a l'email + au libelle de role sans y penser —
  domaine email commun + roles repetes → une chaine courte matche presque tout, la recherche « semble » ne
  filtrer qu'au 5e caractere. Rechercher sur **NOM Prenom** (comme « Parents choisis »), insensible aux accents.

#### 16 juillet 2026 (suite) — Communications sous-menu STAFF (refonte complete)
Le staff a des comptes ET une boite in-app (`/dashboard/notifications` lit `announcement_staff_recipients`) qui
**fonctionnait deja**. Ce qui etait casse : **l'email ne partait jamais** (aucune route/action), permissions
client-only, CCI fiction, PJ publiques. Meme traitement que le lot 1 parents.
- **Decisions utilisateur** : envoi reserve a l'**encadrement = tout staff SAUF enseignant** (le **comptable
  ecrit** : paie / sujets comptables ; l'enseignant reste **destinataire**). **3 canaux** au choix (Email /
  Notification / Les deux — reels car ils ont un compte). **Direction en CCI**. Selection en masse (Tous /
  Staff / Enseignants d'un clic).
- **Migration `rework-communications-staff.sql`** : insertion d'une annonce `staff` ET des destinataires staff
  **reservee a l'encadrement** en RLS (retire `enseignant` de `announcements_insert_scoped` ; remplace la policy
  `FOR ALL` des destinataires par une `staff_recipients_write_scoped`). SELECT/`marquer comme lu` inchanges
  (l'enseignant garde sa boite).
- **Server action `staff-actions.ts` (`sendStaffMessage`)** : garde encadrement, resolution serveur (union
  group `all|staff|teachers` + roles + ids), envoi email via `sendNotificationEmail` (**un envoi par
  destinataire**, aucune adresse de collegue exposee ; CCI direction sans doublon ; `Reply-To` = l'auteur car
  interne), PJ privees 1 Mo, vrai compte rendu (notifie / envoye / echec). Destinataires **toujours
  enregistres** (trace) ; `email_status = 'skipped'` si canal notification seul.
- **Canal in-app filtre** : un message **`channel = 'email'` n'apparait PAS dans la cloche** → jointure
  **`announcements!inner(channel)` + `.neq('announcements.channel','email')`** aux **3 endroits** qui comptent
  la boite : `layout.tsx` (badge), `dashboard/page.tsx` (badge + recents), `notifications/page.tsx`.
- **Page (`StaffMessageClient`)** refondue comme Parents : 2 colonnes, canal (`aria-pressed`), compteur vivant,
  aperçu + detail en modales portail, `ConfirmModal`, upload prive, blocage si canal email sans messagerie,
  a11y/charte. **Badges de role = memes couleurs que la liste utilisateurs** (`ROLE_COLORS` recopie). Liste
  **triee par role (hierarchie) puis NOM Prenom** (meme `ROLE_ORDER`/tri que la liste utilisateurs).
  **« Tout deselectionner »** a gauche de la recherche. Sidebar « Staff / Enseignants » masquee pour enseignant.
- **Reste** : configurer une messagerie et **tester un envoi reel** (canaux notif / email / les deux).

#### 16 juillet 2026 (suite) — Financements sous-menu REGLEMENTS : refonte en plan de travail + fix comptable
Audit puis refonte complete du cœur (`FinancementsClient`, 1000+ lignes) et de `PaymentModal`.
- **Bug comptable majeur (reporte par l'utilisateur)** : les **reductions / avoirs / remboursements** etaient
  retranches du **PERÇU** au lieu de reduire le **DÛ**. Consequence : payer toute sa cotisation + un remboursement
  de 20 → affiche « Partiel » (doit encore 20). Corrige : `totalDue = subtotal + adjustmentsTotal` (les
  ajustements < 0 reduisent le du), `netPercu = paiements seuls`. Helper unique **`feeStatus(paid, due)`**
  (pending/partial/paid/**overpaid**) partage par le calcul, l'affichage ET la persistance
  (`handlePaymentSaved`, `removePayment`, `add/removeAdjustment` persistent `total_due` = subtotal + ajustements
  + le statut). **« Trop perçu »** : carte du bas passe de « RESTE » a **« TROP PERÇU »** (rouge) avec le montant
  excedentaire ; ligne worklist affiche **« + 20 € » rouge** (plus « 0 € »).
- **Plan de travail (master-detail)** : la recherche-combobox devient une **liste de familles a gauche**
  (`w-fit` = largeur de la ligne de filtres, hauteur fixe + scroll interne `.list-scroll`), triee **alphabetique**,
  pastille de statut + reste du + barre de progression ; **bandeau tresorerie** en haut (Facture / Encaisse /
  Reste) + **compteurs-filtres cliquables** (En attente / Partiel / Solde, + **Trop perçu rouge** seulement s'il
  en existe) ; **filtres aussi sous la recherche** (Tous / En attente / Partiels / Soldes / Trop perçu, 1 ligne).
  Detail a droite : **bandeau famille** (avatar + NOM Prenom des tuteurs + situation familiale + statut, calque
  fiche parent ; requete enrichie `situation_familiale`). **Aucune nouvelle requete** : tout se calcule des
  donnees deja chargees (helper `computeFamilyFinancials`, `familyStats`, `kpi`, `worklist`).
- **Echeances (option A, sans blocage)** : max effectif = **plus grand `max_installments`** parmi les types de la
  famille (eleves **+** adultes ; `max_installments` ajoute a la requete adultes). Badge en-tete Paiements
  **« N echeances / max »** vert (≤) / orange (>), tooltip explicatif ; **numero « # » orange** sur les lignes au
  dela ; « Echeances max : X » sur la ligne Total cotisations du recap. **On ne grise pas** (cas exceptionnel de
  difficulte familiale). `max_installments` 0/absent = pas de limite → pas de badge.
- **Reçu supprime, remplace par attestation (lot 2 a venir)** : le `fetch('/api/notifications/payment')`
  fire-and-forget (casse : garde oubliait le comptable) est **retire de PaymentModal**. Boutons **Relancer**
  (impayes/partiels) et **Attestation** (solde) poses en **placeholder desactive** (tooltip « lot 2 »), a cabler
  avec PDF + relance + historique propre a Financements.
- **Charte + a11y + ergo** (maniaque assume) : `card p-0`/tables condensees `text-xs` `px-2`, quadratins `—` → `·`,
  `EUR` → `€`, accents (Especes/Cheque/Recapitulatif/Eleve...), modale paiement accessible (`role=dialog`,
  fermeture X/Annuler), methodes `aria-pressed`, boutons sans icone, messages en **toast** (`useToast`, plus de
  banniere qui pousse le contenu), **suppressions paiement ET reduction en `ConfirmModal`** (fini le 2-clics
  inline), **modale ajout reduction** (comme paiement), **Sous-total → Total cotisations**, cartes Paiements /
  Reductions **fusionnees en 1 carte** (en-tetes h-9 identiques, totaux « Total : X » centres), reference tronquee
  + tooltip (sinon poussait les icones hors cadre), **step des montants `any`** (fleches +/-1, decimales OK),
  **banque (cheque) en select** des principales banques triees + « Autre » saisie libre. Couleurs : « solde/
  encaisse/positif » = **primary** (turquoise, comme les cartes stat des listes), pas un vert generique.
  Changer de moyen de paiement en edition **reconstruit la reference** (les infos de l'ancien moyen sont effacees).
- **`step="any"`** applique aussi aux 2 champs montant de `SyntheseClient` (Situation financiere), par coherence.
- **Aucune migration** (tout applicatif + enrichissement de requetes). **Reste** : lot 2 (attestation PDF +
  relance + historique), et l'audit des 2 autres sous-menus (Stats reglements, Situation financiere — dont le
  **bucket `documents-expenses` public a passer en prive**, repere a l'audit).

#### 16 juillet 2026 (suite) — Financements LOT 2 : communication comptable (relance + attestation + historique)
Volet communication du comptable, propre au module (decision : ne vit PAS dans `announcements`).
- **Migration `create-financement-communications.sql`** (executee) : table `financement_communications`
  (etablissement, parent, annee, `type` relance|attestation, subject, body_html, recipients, sent_by, sent_at,
  status). **Append-only**, RLS finance (admin/direction/comptable). C'est LA table d'historique (relance ET
  attestation). Verifiee en base (CHECK type/status refuses).
- **Encadre « Communication comptable »** sous le Recapitulatif famille : historique des envois de la famille
  (date · badge Relance/Attestation · objet). L'historique se rafraichit apres chaque action (etat local).
- **Relance d'impayes** (`sendRelance`, `actions.ts`) : bouton « Relancer » (en attente/partiel) → modale
  **pre-remplie** (objet « Rappel de paiement · cotisation(s) {annee} », corps avec reste du / total / percu
  injectes, **accord singulier/pluriel** selon le nombre de cotisations du recap), envoi **aux deux tuteurs du
  foyer** via la messagerie (`sendNotificationEmail`, Reply-To = contact ecole), puis log dans l'historique.
  Bloque proprement si pas de messagerie / pas d'email.
- **Attestation de paiement** (`attestationPdf.ts` + `logAttestation`) : bouton « Attestation » (soldee) →
  **ouvre le PDF directement dans un nouvel onglet** (imprimable), PLUS d'email, PLUS de modale (le tuteur retire
  le document signe/cachete a l'ecole). Etablie pour le **foyer** (tuteur 1 + 2), accord « a/ont regle ». Le PDF
  (jsPDF, cote client) a le **meme en-tete que les bulletins** (logo gauche + nom/adresse, titre a droite, sans
  turquoise), corps « L'etablissement mentionne ci-dessus atteste que ... a regle l'integralite des cotisations
  ... activites culturelles et linguistiques ... pour un montant total de X », tableau des inscriptions +
  reduction eventuelle + total, « Fait le X · Pour faire valoir ce que de droit ». **Delivrance tracee** dans
  l'historique (`logAttestation`, insert seul, sans email/SMTP). **Piege gere** : ouvrir l'onglet AVANT le
  `await` de generation (`window.open('', '_blank')` puis `win.location.href = url`) sinon le popup est bloque.
- **Reste Financements** : audit des 2 autres sous-menus (Stats reglements, Situation financiere — bucket
  `documents-expenses` public a passer en prive) ; test d'un **envoi reel** de relance (depend du SMTP).

#### 17 juillet 2026 — Signature auto de mail + relance en editeur riche
- **Signature de mail automatique (editable) en fin de corps** — helper partage
  `src/lib/communications/signature.ts` (`buildSignatureHtml`) : « Cordialement, » + **nom / adresse /
  Tél : {telephone} / contact** de l'etablissement (seules les lignes renseignees). Rendue en HTML.
  - **Communications → Parents** (`NewMessageClient` + `new/page.tsx`) et **→ Staff** (`StaffMessageClient` +
    `staff/page.tsx`) : le corps (`RichTextEditor`) s'ouvre **pre-rempli** avec la signature (deux lignes vides
    au-dessus pour rediger), prop `signatureHtml` construite cote serveur depuis `etablissements`
    (nom, adresse, telephone, contact). NB Staff : la signature apparait aussi en canal Notification seule.
  - **Relance Financements** : signature integree au gabarit (voir ci-dessous). Cote serveur, aucune signature
    en dur (elle vit dans le corps edite).
- **Relance de paiement passee en editeur riche** (alignement sur Communications, decision utilisateur :
  « ca fait plus pro… le destinataire le recoit en HTML ») :
  - `FinancementsClient` : `FloatTextarea` → `RichTextEditor` (lazy + Suspense) dans la modale de relance ;
    gabarit `openRelance` reecrit en **HTML** avec le **montant restant du en gras** (`<strong>`) + signature
    HTML en fin de corps.
  - `sendRelance` (`actions.ts`) : le corps est **sanitise** (`sanitize()`, comme `sendParentMessage`) au lieu de
    `escapeHtml + nl2br` — sinon les balises seraient echappees ; c'est aussi la protection XSS. `body_html`
    stocke = HTML sanitise. L'historique/fiche n'affiche jamais le corps (date · type · objet), rien d'autre a
    ajuster. **Aucune migration.**
- **Financements Reglements — carte « Trop perçu » dans le bandeau tresorerie** : le trop-percu gonflait
  visuellement le RESTE (identite reelle : `FACTURE = ENCAISSE + RESTE − TROP-PERCU`). Choix utilisateur :
  garder ENCAISSE = cash recu (trop-percu inclus) et **expliciter le trop-percu par une carte dediee** (nombre +
  montant total, `kpi.overpaid`). Carte **cliquable** (filtre la worklist sur `overpaid`, comme les compteurs) ;
  n'apparait que si `kpi.counts.overpaid > 0` (meme condition que la puce worklist) → bandeau en 7 colonnes
  seulement dans ce cas. Nombre a gauche / montant a droite, meme police.

#### 17 juillet 2026 (suite) — Financements : helper comptable partage + Stats reglements + Situation financiere
- **BUG COMPTABLE EN 3 EXEMPLAIRES** : le calcul (remise fratrie + modele) etait **copie-colle dans les 3
  sous-menus**, et seul Reglements avait ete corrige le 16/07 → Stats reglements ET Situation financiere
  retranchaient encore les reductions du **percu** au lieu du **du**, affichant donc des chiffres differents de
  Reglements pour la meme famille. Nouveau **`src/lib/financements/compute.ts`** (source unique, isomorphe) :
  `feeStatus`, `computeFamilyFinancials(subtotal, fee|fee[])`, `siblingDiscounts(cotisations[])`, `lineTotal`.
  Les **3 pages** y sont branchees. Ecart supprime au passage : Reglements comptait un eleve sans cotisation dans
  l'ordre de la fratrie, les 2 autres le sautaient (`continue`). `countByType` (code mort) retire des 3 copies.
  **Regle** : ne jamais reimplementer le calcul dans une page.
- **`src/lib/financements/roles.ts`** (`FINANCE_ROLES` = admin/direction/comptable, `isFinanceRole`) : module
  ordinaire car `actions.ts` est `'use server'` et ne peut exporter **que des fonctions async** (piege deja paye
  sur Utilisateurs : `export type` → 500).

**STATS REGLEMENTS (`vue-globale`) — refonte en tableau de bord** (la page n'avait AUCUN graphique : 2 tableaux
faisant doublon avec la worklist de Reglements). **Recharts 3.9.2** ajoute (aucune lib de graphes n'existait).
- **Skill `dataviz` chargee avant d'ecrire la 1re ligne de chart** — elle a rattrape 2 erreurs :
  (1) « encaissements mensuels en barres + cumul en courbe » = **double axe**, l'anti-pattern n°1 → remplace par
  la **courbe de cumul seule + ligne de repere « Facture »** (meme unite, meme axe) ;
  (2) ma palette choisie a l'oeil **echouait** au script de validation. Les rampes **`secondary` (ardoise) et
  `warm` (beige) de la charte tombent sous le plancher de chroma → **inutilisables comme couleurs categorielles**
  (elles « lisent gris »). Palette retenue et **validee** (`scripts/validate_palette.js`, surface `#ffffff`) :
  marque en tete `#18aa99` + `#cc8200`, puis `#2a78d6` / `#e87ba4` / `#4a3aa7`.
- Contenu : bandeau **DOSSIERS · FACTURE · ENCAISSE · RESTE A ENCAISSER · TROP PERCU · TAUX DE RECOUVREMENT**
  (memes intitules que Reglements) ; encadre **« Repartitions »** (2 donuts : statut + moyens de paiement) ;
  **Facture par activite** ; **Top 10 debitrices** en **liste HTML** (et non Recharts : vrais `<button>`
  clavier + `Tooltip` du projet + troncature 1 ligne, impossible proprement dans un axe SVG) ; **Rythme de
  collecte** ; **tableau des dossiers** trie par reste du decroissant.
- **Limite assumee** : « Facture par activite » n'a **pas d'equivalent encaisse** — un paiement est enregistre au
  niveau du **foyer**, jamais rattache a une inscription. Ventiler supposerait un prorata = un chiffre invente.
- Ventilation par moyen de paiement corrigee : portait **seulement sur les familles soldees** (sous-estimait la
  caisse) → desormais sur tout l'encaisse.
- Titre header : « Stats reglements » → **« Statistiques sur reglements »** (`DashboardNav`, titre + fil d'Ariane).

**SITUATION FINANCIERE (`/dashboard/financements`) — audit + securisation** (migration
`secure-financements-situation.sql`, **executee et verifiee**) :
- **P1 SECURITE — RLS sans role** : `expenses` / `other_revenues` n'etaient filtrees que par tenant → **un
  ENSEIGNANT** pouvait lire ET ecrire le CA, le cout des salaires et les depenses. \+ **aucune page Financements
  n'avait de garde de role**. Corrige : policies `FOR ALL` reservees a **admin/direction/comptable**
  (`coalesce(get_user_role(), '')`) + garde sur les **3 pages**.
- **P1 SECURITE — bucket `documents-expenses` PUBLIC** (`getPublicUrl`) → factures et justificatifs lisibles
  **sans authentification** par toute personne ayant l'URL ; chemin `expenses/<ts>.<ext>` **non cloisonne** ;
  aucune validation type/taille. Corrige : bucket **prive**, 2 Mo, 4 types MIME, chemin **`{etablissement_id}/`**,
  policies storage cloisonnees, **URL signee** (60 s) a la consultation, gardes client type+taille.
  **`document_url` → `document_path`** (tables vides : 0 depense / 0 revenu → durci sans clause d'heritage).
- **PIEGE MIGRATION** : `DELETE FROM storage.objects` est **interdit** (`storage.protect_delete()` → 42501) ; le
  SQL Editor etant transactionnel, **toute la migration etait annulee**. Le menage des objets passe par l'**API
  Storage** (script service-role jetable). **Regle** : en SQL on touche `storage.buckets` et les policies, jamais
  les objets.
- **P1 PERTE DE DONNEES** : `deleteConfirmStep` etait un etat **partage entre toutes les lignes** → armer la
  ligne A puis cliquer la corbeille de la ligne **B** supprimait B **immediatement, sans confirmation**.
  Remplace par `ConfirmModal` (recap libelle/date/montant ; le justificatif part avec la depense).
- **P1 dates en dur** : `${label.split('-')[0]}-08-01` supposait un libelle « AAAA-AAAA » **et** une annee aout→aout
  → remplace par les vraies bornes `start_date`/`end_date`. Filtre `is_active` retire sur `presence_types` (un type
  desactive en cours d'annee a pu servir a des heures deja saisies).
- **P1 taux manquant silencieux** : `rateByCode[...] ?? 0` → les heures sans taux comptaient **0 € sans signal**.
  Desormais **banniere ambre** (code + heures non valorisees + lien vers le parametrage).
- **P3 charte** : modales refondues en coque **`FormModal`** partagee (`role=dialog`/`aria-modal`/`aria-labelledby`/
  **Echap**, fermeture X/Annuler/Echap **sans clic sur le fond**, **portee dans `<body>`** — `animate-fade-in` garde
  un `transform` qui capturerait le `fixed`) ; `card` → **`card p-0`** (les 4 encadres avaient le retrait de 24 px) ;
  `aria-label` sur les 3 tables ; `title=` → `Tooltip` ; quadratins des selects (« Loyer — Location » → « · ») ;
  `<h3>` → `<h2>` ; 2 decimales obligatoires ; « Montant (EUR) » → **€** ; `select('*')` remplace ; **palette**
  `success-*`/`danger-*`/`amber` → **primary/orange/red** de la charte (+ remise fratrie `green-600` → `primary-600`
  dans Reglements).
- **Saisie** : libelle en **1re lettre majuscule** (`capFirst`, motif du referentiel des cours) ; **categorie** et
  **source** rendues **obligatoires** ; categorie **« Maintenance »** ajoutee.
- **Stats discretes** sur les 3 encadres : **barre empilee 100 % (5 px) + legende avec %**, en **pied de carte
  epingle** (TOTAL sorti du `<tfoot>` ; la liste pousse en `flex-1` → les 3 pieds s'alignent). **Top 4 + « Autres »**.
  **Degrades d'UNE teinte** (rouge = sortie, turquoise = entree), valides `--ordinal` : une couleur categorielle
  doit suivre **l'entite, jamais son rang** (sinon « Loyer » changerait de couleur quand « Charges » le depasse).
  « Autres » en **gris neutre** hors degrade (un reliquat n'est pas une magnitude) — ce qui regle aussi le fait que
  le rouge ne peut pas produire 5 pas valides.

**CONTRASTE DES INTITULES (design system)** : mesure — `warm-400` = **2,06:1**, `warm-500` = 2,34:1,
`warm-600` = 3,20:1, **`warm-700` = 5,04:1**. Le seuil WCAG AA du **petit texte est 4,5:1** (le 3:1 ne vaut que
pour du texte ≥ 24 px) → les intitules etaient a **moins de la moitie du minimum**.
- **`.list-th` passe en `warm-700`** : 1 ligne dans `globals.css` → **tous les en-tetes de liste de l'app**
  deviennent conformes.
- **`.stat-label`** cree (`text-[10px] font-bold text-warm-700 uppercase tracking-wide`), pendant de `.list-th`
  pour les cartes ; adopte sur les **3 pages Financements** (15 intitules qui utilisaient **3 combinaisons
  concurrentes**). **Pas de `sed` sur les 146 lignes `warm-400/500 + uppercase`** de l'app : toutes ne sont pas
  des intitules.
- **Reste** : 24 occurrences dans Reglements (titres `<h3>` du panneau de detail + `<th>` maison en `px-2`, la
  ou `.list-th` impose `px-4`) → arbitrer entre `.stat-label` et une variante compacte `.list-th-compact`.

#### 18 juillet 2026 — Passe globale de LISIBILITE (beige clair → warm-700)
- **Constat** : `text-warm-400` = 2,06:1, `warm-500` = 2,34:1, `warm-600` = 3,20:1 sur blanc —
  tous **sous** le seuil WCAG AA petit texte (4,5:1). Decision utilisateur : **plus de beige
  clair**, tout le texte lisible en **`text-warm-700`** (5,04:1).
- **Module Apprenants (reference)** : liste + fiche + 3 onglets + composants partages. Regles
  fixees : texte/intitules/infos/**placeholders**/**icones accessoires** → warm-700 ; **grise
  d'etat preserve** (ligne inactive, valeur verrouillee) en warm-400 ; **3 niveaux de fond**
  (actif blanc / inactif `warm-50` / survol `warm-100`, survol toujours + fonce que l'inactif) ;
  age & « Non affecte » **conditionnels** (fonce si actif, grise si inactif) ; pas d'icone `+`
  sur « Ajouter ».
- **Champ de recherche** (`SearchField`) : placeholder + loupe + croix → warm-700 (le texte
  saisi est `secondary-800`, quasi-noir → placeholder warm-700 reste nettement plus clair,
  pas de confusion « champ pre-rempli »).
- **Composants partages** (impact toute l'app) : `FloatFields` (labels Input/Select/Textarea/
  Checkbox, chevron, hint, bouton « ? », **labels de champs verrouilles**), `ListStatCard`
  (libelle), `.list-th` (deja fait 17/07), `.stat-label`.
- **Passe GLOBALE** : bump `text-warm-300/400/500/600 → warm-700` sur les **114 fichiers** via
  sed (hors `FloatFields`, traite a la main). **Restauration ciblee** du grise semantique :
  branche INACTIVE des ternaires `is_active ?` (nom inactif → warm-400) sur ParentsTable,
  TeachersTable, UtilisateursTable, StudentsTable, StudentForm (freres/sœurs), StudentsStatusSyncModal ;
  valeur verrouillee + case decochee (FloatFields). **Piege** : le sed re-bumpe les branches
  inactives soigneusement mises a warm-400 → toujours restaurer APRES le bump global. **Regle
  (memoire `label-contrast-pass`)** : nouveau texte lisible = warm-700 ; warm-400 UNIQUEMENT
  pour un etat desactive/inactif.
- **Divers** : quadratins d'affichage `—` → `·` sur la fiche apprenant (enseignant frere/sœur,
  cartes « Pere · … », contact vide) + colonne « Situation familiale » (liste parents) ; ordre
  du bloc frere/sœur corrige (**classe · enseignant · horaires**) ; « Niveau » masque si vide
  (onglet Scolarite) ; icone `+` retiree de « Ajouter » (Apprenants + Parents).

#### 18 juillet 2026 (suite) — Tirets bannis, ordre enseignant, ergonomie EDT / temps de presence
- **AUCUN tiret long dans l'UI** (regle durcie) : ni quadratin `—` ni demi-cadratin `–` (le `–` etait
  tolere pour les horaires, il ne l'est plus). Sweep : **0 `–` restant** (22 fichiers ; plages → `-`,
  separateurs → `·`), **64 `—` UI corriges** (31 fichiers ; classifieur non-commentaire — les `—` en
  **commentaires** restent, non visibles). Voir memoire `dropdown-simple-dash`.
- **Enseignant = `Civilite NOM Prenom`** (memoire `name-before-firstname`) : ~13 constructeurs faisaient
  `${civ} ${first_name} ${last_name}` → corriges (cahier de texte, bulletins, absences, evaluations,
  notes, EDT, affectation, parents, notif devoir). Un `.select()` SQL n'est pas un affichage.
- **EDT** : en-tete de jour agrandi (abrev `text-sm`, date `text-xs`/opacite 80) ; horaire de la capsule
  `text-[8px] opacity-50` → **`text-[10px] font-bold`** (meme police/taille que le nom de classe).
- **Espacement des sous-titres de classe** (affectation, bulletins) : le rendu segment-par-segment
  (flex `gap` + `·` en `mx-1`) doublait l'espacement → un seul span `parts.join(' · ')`. « Niveau »
  masque si vide (affectation).
- **Temps de presence — boutons TYPE** : `flex flex-wrap` (largeurs inegales, libelles debordants) →
  **grille 2 colonnes** (boutons de largeur identique, `truncate`).

#### 19 juillet 2026 — Modales cahier de texte + refonte destinataires Communication Staff
- **Modales detail seance/devoir** (`SeanceDetailModal`/`DevoirDetailModal`) : date de rendu/seance
  **deplacee** du header vers le corps (a cote du badge type pour le devoir, sur la ligne
  « CONTENU DE LA SEANCE » pour la seance) ; badge type de devoir en **MAJUSCULES sans icone**,
  place juste au-dessus des consignes, espace reduit ; icones retirees des titres CONTENU/CONSIGNES ;
  accent « Exposé ».
- **Communication Staff — selection destinataires simplifiee** (`StaffMessageClient`) : suppression
  du double niveau (raccourcis groupes Tous/Staff/Enseignants + rôles) qui creait un **doublon
  « Enseignants »/« Enseignant »**. Desormais **une seule rangee** : bouton **« Tous »** (coche/decoche
  tous les roles) + chips de rôle. Etat `group` retire cote client (`group: null` au serveur, qui
  resout par roles — inchange). **Libelles des chips = SERVICE/groupe** (plusieurs personnes possibles) :
  Enseignants / Comptabilite / Secretariat (map `CHIP_LABELS`), tandis que le **badge d'un membre**
  garde son rôle au singulier (`ROLE_LABELS`).

#### 19 juillet 2026 (suite) — Periode « en cours » + verrouillage des annees non courantes
- **Migration `add-period-is-current.sql`** (a jouer) : `periods.is_current` (bool) + index d'unicite
  partiel (une seule periode courante par annee). Pas de backfill → sans marquage, les ecrans
  retombent sur la 1re periode (aucune regression) ; le code lit `is_current` de façon tolerante
  (marche avant/apres migration).
- **Feature « periode en cours »** : la direction choisit UNE periode courante (les periodes n'ont pas
  de dates → choix manuel). Sert de **defaut du selecteur de periode** sur Bulletins, Notes,
  Evaluations, Feuille d'appel, et le formulaire discipline de la fiche eleve
  (`(periods.find(p => p.is_current) ?? periods[0])`). Encadre autonome `CurrentPeriodCard` (radio +
  bouton) place **dans** `SchoolYearForm` via un slot (2e position, meme taille), editable **admin/
  direction** et **uniquement sur l'annee en cours**. Server action `annee-scolaire/actions.ts`
  (`setCurrentPeriod`, garde + trace). `Period.is_current` ajoute au type partage.
- **Verrouillage des annees NON courantes** (`SchoolYearForm`) : une annee qui n'est pas l'annee en
  cours est **en lecture seule** (dates, repartition, vacances, types d'eval verrouilles ; « Modifier »
  inactif ; banniere). **Seule exception** : la case « Annee en cours » (seul moyen d'activer une annee —
  la liste n'a pas d'action « activer »). Cette case est **desactivee si une AUTRE annee est deja en
  cours** (prop `anotherYearIsCurrent`, requetee page detail + creation). **Consequence assumee** :
  changer d'annee en cours = 2 etapes (desactiver A, activer B) avec un etat transitoire « aucune annee
  en cours ».
- **Fusion des encadres** : Identite + Repartition + Type d'evaluation + boutons Annuler/Modifier
  regroupes en **un seul encadre** (sous-blocs separes par un filet) ; « Periode en cours » en dessous.
- **RÉPARTITION en 1er = Semestriel** (avant Trimestriel). **Liste des annees** : titre header au
  **pluriel** (« Années scolaires » ; la fiche reste au singulier) ; badge de **periode en cours**
  colore en turquoise **uniquement** sur l'annee en cours (les autres restent en badge normal).

#### 25-26 juillet 2026 — Theme clair/sombre (choix utilisateur) + sidebar/header + passe modules
- **Bucket `bulletins` prive** (migration `secure-bulletins-bucket.sql`, jouee) : bucket prive, **1 Mo**,
  `application/pdf` seul, policies storage cloisonnees par `(storage.foldername(name))[1] = current_etablissement_id()`.
  **Lecture = 5 roles** (admin/direction/secretaire/responsable_pedagogique/enseignant), **comptable exclu**
  (decision utilisateur) ; ecriture admin/direction. `file_url` rendue nullable (URL signee a la consultation).
- **Revue securite des 6 phases de cloture d'annee** (corrigee point par point) : `purge_school_year` a recu une
  **garde de tenant** (`SECURITY DEFINER` contourne la RLS → l'annee d'un autre etablissement etait purgeable) et
  la purge finance **recalcule le reste du** au lieu de se fier a `status` ; `family-financials` borne desormais les
  inscriptions adultes a l'annee (`classes.academic_year`) ; `reopenStep` supprime les 2 tables de snapshot.
  Nouvelle colonne `year_closure.purge_intent` (`purge`|`keep`, migration `add-purge-intent.sql`) : **carte de choix
  en fin d'assistant** — l'utilisateur decide d'epurer ou non.
- **THEME CLAIR / SOMBRE, choix utilisateur** (clair = « Marque profonde » teal, sombre = « Ardoise premium ») :
  attribut `data-theme` sur `<html>`, `darkMode: ['selector', '[data-theme="dark"]']`, script anti-FOUC dans le
  layout racine (scope `/dashboard` + `/auth`). **Persiste par utilisateur** : colonne `profiles.theme`
  (migration `add-profile-theme.sql`) + `setOwnTheme` (avec `.select('id')` pour detecter un UPDATE filtre par RLS)
  + `updateTag('profile')` ; `ThemeContext` initialise depuis le profil et miroir `localStorage`. Le theme
  s'applique **des l'ecran 2FA** (pas seulement dans le dashboard).
  - **Tokens de contenu** dans `globals.css` : `--surface-page/-card/-sunken`, `--ink`, `--ink-muted`, `--line`,
    `--line-strong`, `--card-shadow`, `--brand-surface/-2/-accent/-text/-label/-icon/-muted`, `--silhouette-ink`.
  - **« PONT » theme sombre** : plutot que de retoucher 100+ fichiers, un jeu de selecteurs **plats** scopes
    `:root[data-theme="dark"] :is(#main-content, [role="dialog"])` remappe les classes Tailwind existantes
    (bg-white, warm-50/100/200/300 **avec toutes leurs variantes d'opacite et de hover**, textes secondary/warm,
    bordures, `divide-*`, et **8 teintes semantiques** red/orange/amber/green/blue/purple/primary/**pink**).
  - **PIEGES PAYES (a retenir)** : (1) le pipeline PostCSS = `tailwindcss` + `autoprefixer` **sans plugin de
    nesting** → tout bloc **imbrique est ignore en silence** : ecrire **plat** et **verifier le CSS SERVI**
    (curl du chunk). (2) Une utilitaire `hover:` **sans prefixe `dark:`** deborde sur le theme sombre (meme
    specificite, emise apres) → il faut un `dark:hover:*` explicite. (3) Les variantes d'opacite sont des
    **classes distinctes** (`bg-warm-100/70` != `bg-warm-100`) → la liste du pont doit etre exhaustive (grep).
    (4) `color-scheme` est le **seul** moyen de theminger les widgets natifs (icone de `input[type=time]`,
    pickers, `select`, scrollbars).
  - **`animate-fade-in` corrige a la racine** : le `transform` du keyframe final + `fill: both` faisait de
    l'element un **bloc conteneur pour `position: fixed`** → le haut des modales passait sous le header.
- **Sidebar + header refondus** : 5 sections **repliables** (Principal / Vie scolaire / Pedagogie / Gestion /
  Parametres), pastille active pleine + barre d'accent detachee, mode reduit en **grille d'icones 2 colonnes par
  section** (titre de section rappele sous chaque filet, tuile active = `ring` accent, icone non accentuee),
  sous-menus reprenant l'icone du parent, **tooltip sur chaque icone** au format `menu - sous-menu`.
  Header `h-[61px]` aligne sur le filet de la sidebar, fond `--brand-surface-2` en sombre (pour que les tooltips
  restent lisibles), bascule de theme segmentee (soleil/lune), ordre theme → notifications → **logout** (`Power`,
  copie conforme du style de la cloche) → separateur → avatar (rond, fond surface, anneau accent).
  `Tooltip` gagne `position="bottom"` + fleche a bordure accent.
- **2FA en 6 cases** : nouveau `ui/OtpInput.tsx` (6 caracteres, avance auto, Backspace, fleches, collage,
  **validation automatique a la 6e saisie**), propage a tous les ecrans 2FA.
- **Boutons** (`FloatFields`) : `submit` = surface marque (accent en sombre) avec `dark:hover:*` explicite ;
  **`edit` passe en contour marque** (l'ambre est abandonne) ; variante `print` **supprimee** ; le `?` des hints
  passe par `Tooltip`.
- **Passe theme sombre + ergonomie module par module** (methode : script d'audit → inventaire couleurs →
  extension du **pont partage** plutot que patch fichier par fichier → re-audit a 0 → verif du CSS servi) :
  **2 sections COMPLETES de la sidebar** : **Principal** (Tableau de bord, Notifications, Temps de presence)
  et **Vie scolaire** (Apprenants, Parents, Affectations apprenants + adultes, Feuille d'appel). Cartes **« Non affectes »** ajoutees (Apprenants + Parents) et **« Alertes discipline »**
  (Apprenants) : ensembles calcules **cote serveur** puis reutilises pour le filtrage (sentinelle UUID
  obligatoire pour un `.in()` sur tableau vide, sinon PostgREST renvoie tout).
- **Silhouettes d'avatar refaites** (`absences/AvatarSilhouette.tsx`) : silhouette **pleine d'une seule teinte**
  (`--silhouette-ink`, qui bascule avec le theme), sans rectangle de fond. Variante masculine validee = tete +
  cheveux en **un seul trace** (empiler un croissant de cheveux sur une ellipse donnait un rendu casse).
- **Feuille d'appel — impression fiabilisee** : (1) le meme nom de PDF servait a **deux documents differents**
  (feuille du jour vs periode) → renommes, et la feuille vierge datait en **UTC** (`toISOString`) donc pouvait
  afficher la veille → date **locale**. (2) Libelles clarifies : « Feuille vierge » / « Imprimer la saisie ».
  (3) **On n'imprime que ce qui est en base** : `canPrint = (isSaved || isEditMode) && !hasChanges`.
  **Cause reelle corrigee** : apres l'`insert`, `entries` gardait `existingId: null` sur les lignes creees, donc
  le diff comptait des « ajouts en attente » a vie — le code compensait en **masquant** le bouton via `isSaved`,
  ce qui **empechait toute correction** apres enregistrement. `entries` est desormais **reconstruit**
  (`buildEntries`) depuis la liste fraiche : le bouton Modifier reste visible et grise selon `hasChanges`,
  Imprimer se grise des qu'une modification est en attente, `setIsSubmitting(false)` ajoute au chemin de succes,
  et `isSaved` est **reinitialise au changement de date** (sinon impression d'une date vierge autorisee).
  Vert/`green-*` remplaces par le turquoise `primary` (present/justifie) ; 2 ecouteurs `Escape` retires des modales.

#### 2-3 aout 2026 — Sections Pedagogie, Gestion et debut Parametres + police arabe
- **Methode** : audit script (lecture seule) module par module, correction apres go, re-audit a 0,
  et **verification du CSS SERVI** (le fichier source ne prouve rien : le pont a ete casse deux fois).

**Section PEDAGOGIE (Evaluations / Notes / Bulletins, EDT, Cahier de texte)**
- **Pont sombre etendu** : teinte **`emerald`** complete (categorie « activite » de l'EDT), **`violet`**
  complete (badges de role Utilisateurs + Communication Staff, bandeau « Cours adultes »), `text-secondary-400`,
  et surtout les **textes colores en `-900`** (`text-blue-900` des capsules EDT) que le pont s'arretait a `-800`.
  \+ **106 `hover:text-*`** dans toute l'app : en clair le survol FONCE le texte, en sombre il devait
  l'eclaircir — sans mapping, l'icone survolee disparaissait.
- **EDT** : `SIDEBAR_COLOR = '#2e4550'` (couleur figee d'avant les themes) remplacee par les tokens de
  marque sur toutes les bascules ; `SlotFormModal` portalisee + Echap retire ; **creneaux repeints sur la
  palette de MARQUE** (choix utilisateur) en **aplats opaques** — cours = famille turquoise, activite =
  famille ardoise — via des classes dediees `.edt-slot-*` dans globals.css (les 3 definitions dupliquees de
  `SLOT_COLORS` sont supprimees, dont une **morte**) ; **validation** = liseré accent en ombre INTERNE et non
  plus un repeint complet (sinon la categorie serait perdue) ; **lignes de grille** `.edt-line-hour/half/quarter`
  (la hierarchie etait INVERSEE en sombre : `border-warm-100/60` et `/80` n'etaient pas dans le pont) ;
  **case de validation** = case VIDE quand non valide (un ✓ plein se lit « fait ») ; **densite adaptative**
  des capsules (1-2 : tout · 3-4 : sans salle · 5+ : cours + classe, detail en infobulle).
  - **PIEGES** : (1) les regles `.edt-slot-*` sont en **`:where()`** (specificite nulle) — sinon elles
    ecrasaient `border-orange-400` (prof non affecte) et `border-amber-400` (modifie), utilitaires de meme
    poids emis plus haut. (2) Le wrapper du `Tooltip` est **inline** : il reserve la place du jambage sous la
    ligne de base et decalait le contenu de la capsule → capsule passee en `flex`.
- **Verts d'ETAT → turquoise `primary`** (12 endroits) : badge « Notee », barres de progression, creneau
  valide, « Effectue » du cahier de texte. Les verts de **CATEGORIE** sont conserves (emerald « activite »,
  vert « Lecon ») : une categorie n'est pas un etat.

**Evaluations / Notes / Bulletins — corrections fonctionnelles**
- **Date du gabarit OBLIGATOIRE** (pre-remplie a aujourd'hui en LOCAL, Valider grise si vide) : c'est le
  prerequis du point suivant. Les gabarits sans date ont ete **supprimes en base** par l'utilisateur.
- **Absent automatique a la saisie des notes** : requete d'absences **ciblee** (`absence_type='absence'` ×
  classes eleves × **dates reellement portees par un gabarit**, aucune requete sans date). Case **cochee et
  verrouillee**, champ de note desactive, tooltip « Absent le JJ/MM (feuille d'appel) ».
  - **Conflit appel / note** : si une note est DEJA enregistree, le report est **suspendu** — on n'ecrase
    rien. Ligne en fond ambre + icone + bandeau ; l'utilisateur tranche (corriger l'appel, ou cocher
    l'absence, ce qui efface la note **parce qu'il l'a decide**). Sans ce garde-fou, pointer une absence
    apres coup **detruisait la note en silence**.
  - **Message honnete** : les absences reportees ne s'annoncent plus « Modifications non enregistrees »
    (l'utilisateur n'a rien saisi) mais « N absences reportees de la feuille d'appel · a enregistrer », et
    le garde-fou de navigation ne se declenche que sur de VRAIES saisies (marqueur `auto` sur l'entree).
  - **Compteurs vivants** : `getCompletion` compte l'ECRAN pour l'evaluation ouverte, et **base + absences
    connues** pour les autres (sinon l'arbre annonçait « 0/4 » alors qu'il ne restait que 2 notes).
    Moyenne et badge « Saisie complete » alignes sur la meme source.
  - **« Reinitialiser » renomme** « Supprimer toutes les notes » (c'est un DELETE definitif, pas un retour
    a l'etat initial) + `ConfirmModal` annonçant le volume ; la reinitialisation **respecte l'appel**.
- **Bulletins** : etat vide distinct « Selectionnez une classe » (la periode, elle, est presaisie) ;
  majuscule initiale sur l'appreciation.

**Section GESTION (Communications + Financements)**
- **Graphiques Recharts adaptes au theme** (charte `dataviz` chargee) : le SVG porte ses couleurs EN LIGNE,
  le pont ne l'atteint pas → tout est decline par theme (`VIZ` / `RAMPS`). **Le mode sombre est CHOISI puis
  REVALIDE** : le script a montre que la palette validee sur blanc **echoue** sur ardoise (rose hors bande,
  violet a 1,95:1). Palette sombre validee (5 controles) = `#18aa99 · #cc8200 · #2a78d6 · #d9628f · #7d6bd0`
  (seuls rose et violet bougent). Rampes ordinales **inversees en sombre** (clair → fonce) : sinon le poste
  le PLUS important, peint du pas le plus fonce, devenait invisible. Liseres de donut sur la surface,
  grille/axes/encre sur les tokens. Les memos de couleur ont reçu la palette **en dependance**.
- **Journal des communications comptables** : la table etait **append-only** ; ouverture de la suppression
  ligne par ligne (migration `add-financement-communications-delete.sql`, policy `fin_comm_delete`
  **roles finance**), confirmation **en ligne Oui/Non** (motif de « Documents requis par dossier »).
  La suppression est **tracee dans audit_logs AVANT** d'effacer : la valeur probante repose desormais sur
  l'audit, plus sur l'immuabilite. `.select()` apres DELETE — une suppression filtree par la RLS ne renvoie
  **pas d'erreur**, elle supprime 0 ligne.
- **Divers** : `bg-blue-50/40` des sous-encadres de paiement → neutre (le bleu n'est pas dans la charte et
  le pont en faisait un bloc franchement bleu) ; « bientot » en `bg-warm-400`+texte blanc = **2,06:1**,
  illisible dans les DEUX themes ; Echap retire de `FormModal`.
- **Avatar du bandeau famille rogne — 4 hypotheses fausses avant la bonne** : ce n'etait ni la marge, ni
  l'anneau, ni les tokens, mais le **defilement** : le bandeau etait le premier enfant du panneau
  `overflow-y-auto`, et l'avatar (40 px) depasse le texte (~20 px centre) — lui seul se faisait couper.
  Bandeau **sorti de la zone de defilement** (en-tete fige). L'anneau `ring-1 ring-warm-200` de la fiche
  parent est conserve **a l'identique**.
  - **Piege de tokens** : `bg-warm-100` → `--line-strong` et `border-warm-200` → `--line` : en sombre, la
    bordure devient **plus sombre que le fond qu'elle entoure**, donc invisible. Deux classes beiges voisines
    peuvent etre rapprochees ou inversees par le pont.

**Section PARAMETRES (en cours)**
- **Annee scolaire** : 2 tirets longs (dont un dans un `aria-label`, lu par les lecteurs d'ecran), Echap
  retire de la modale des vacances.
- **Pedagogie (Classes + Referentiel)** : 4 modales portalisees, Echap retire des 2 modales de saisie de
  `ClassForm`, gris de repli d'une UE sans couleur → token.
- **DOCTRINE VALIDEE — Echap** : **oui sur les modales de CONFIRMATION** (sans champ, rien a perdre, c'est
  le comportement de `ConfirmModal`), **jamais sur une modale de SAISIE**. Leve la contradiction entre la
  regle generale et le composant partage.

**POLICE ARABE (referentiel + evaluations + notes)**
- **Amiri abandonnee au profit de Noto Sans Arabic** : Amiri est une **naskh d'imprime** (traits fins,
  petite hauteur de caracteres), inadaptee aux tailles d'interface. Noto Sans Arabic est la sans arabe de
  reference et s'accorde a Inter. Variable renommee **`--font-arabic`** (`--font-amiri` devenait mensonger),
  repli `sans-serif`, sous-ensemble latin retire (Inter s'en charge).
  - **Bug de fond** : `CoursTree` demandait `'Amiri Typewriter'`, **une famille chargee nulle part** — le
    texte arabe retombait sur le serif systeme, et les CHAMPS n'avaient aucune police arabe.
  - **`dir="rtl"` et non `"auto"`** sur les champs : `auto` deduit la direction du CONTENU, or un champ vide
    n'en a pas → curseur a gauche.
  - Hauteur des champs figee (`h-8`) : sinon la taille de police pilote la hauteur de la boite et le champ
    AR depasse ses voisins. **Gras retire** de l'arabe (il compensait la finesse d'Amiri).
- **Affichage bilingue** : helper partage `refLabel()` (ligne « Nom FR · Nom AR », tronquee) + `refTooltip()`
  (les deux noms en entier, **une seule ligne** → `maxWidth="max-w-none"`, la bulle est bornee a `max-w-xs`
  par defaut). Applique aux **arbres du referentiel** (Gabarits + Saisie notes), a l'**encadre Evaluations**
  (ou les codes UE/module/cours etaient rendus de **3 façons differentes**) et a l'**en-tete de saisie**.
  Colonne « Referentiel des cours » elargie de 50 % (`w-72` → `w-[27rem]`).
- Page de test `src/app/test-polices/` (comparaison de 5 polices arabes) : creee puis **supprimee**
  le 3 aout apres validation de Noto Sans Arabic.

#### 3 aout 2026 (suite) — Fin de la section Parametres + doublons + suppression de comptes + bulletin bilingue

**Section PARAMETRES terminee** (les 5 sections de la sidebar sont donc traitees)
- **Enseignants** : icone `Plus` retiree du bouton « Ajouter » (le `<Link>` stylé a la main est le motif
  delibere d'Apprenants/Parents — `FloatButton` rend un `<button>`, il ne peut pas porter de `href`).
  **Colonne « Classe actuelle »** : classes de l'annee en cours dont l'affectation est active AUJOURD'HUI
  (requete `class_teachers` + `classes!inner` filtree sur `academic_year`, jamais de `.in()` sur tableau vide) ;
  titulaire en pastille neutre, **remplacant** en pastille ambre ; infobulle via le helper partage
  `classInfoWithTeacher(c, '')` (enseignant omis : inutile de repeter son nom sur sa propre ligne).
  Categorie de document **« CV »** (migration `add-teacher-document-category-cv.sql` : le CHECK etait ferme,
  l'ajout cote app seul aurait ete rejete en 23514). Onglet Documents : les 2 boutons descendent sur la ligne
  du « * champs obligatoires », largeurs figees (`max-w-5xl/4xl/3xl`) remplacees par `w-fit` + `w-full` — les
  deux encadres prennent AUTOMATIQUEMENT la meme largeur.
- **Utilisateurs** : 8 verts d'etat → turquoise (l'app melangeait `green` ET `emerald` pour la meme idee) ;
  **interrupteur ACTIF/INACTIF sur la fiche**, calque de la fiche enseignant (dans le formulaire, enregistre
  avec Valider) — masque pour enseignant (sa fiche synchronise fiche + compte), admin et super_admin ;
  `updateProfile` accepte `is_active` avec les memes gardes que `toggleActive`.
  **Liste allegee** : activer/desactiver, reinitialiser le mot de passe et reinitialiser la 2FA retires
  (tout est sur la fiche) → 271 lignes ramenees a 160, etats/handlers/modales devenus inatteignables supprimes.
- **Financiers** : 0 signalement.
- **Types de presence** : les 12 hex sont le NUANCIER stocke en base (faux positifs).
- **Ressources** : l'echelle d'etat du materiel (neuf/bon/usage/HS) est conservee ; en revanche **`sky`
  manquait au pont** (badge « Bon » clair-sur-clair en sombre).
- **Journal d'activite** : « Connexion » passe d'`emerald` a `secondary` (indiscernable du vert de
  « Creation » dans la meme colonne, ou la couleur est le seul repere) ; accents « Creation »/« Deconnexion » ;
  modale de purge portalisee.
- **Etablissement** : modale de recadrage portalisee, **fond cliquable ET Echap retires** (c'est une saisie) ;
  bouton Valider au turquoise ; **plaque BLANCHE volontaire** derriere le logo dans les deux themes
  (`bg-[#ffffff]` et non `bg-white`, que le pont remapperait) — un logo est dessine pour un fond blanc.

**SUPPRESSION DE COMPTES UTILISATEURS** (n'existait pas)
- Aucune action de suppression n'existait pour les roles hors enseignant, et **une quinzaine de tables
  referencent `profiles.id` SANS clause ON DELETE** : une corbeille naive aurait produit une erreur 23503 brute.
- `getUserDeleteDeps` + `deleteUser` (`utilisateurs/actions.ts`) : comptage des dependances (finance /
  scolarite / presence / rattachement parents), refus des roles geres ailleurs (admin, super_admin,
  enseignant, parent) et de SON PROPRE compte, trace `logAudit` AVANT effacement, compte auth supprime
  (profil en cascade). **Double confirmation** : recapitulatif puis **saisie du NOM** (motif de la
  suppression de classe). Si des donnees bloquent → « Rendre inactif » a la place.
- **Piege** : le type de retour de `getUserDeleteDeps` est declare EN LIGNE — un fichier `'use server'` ne
  peut exporter que des fonctions async, un `export interface` y provoque un 500 (deja paye sur ce module).

**DOUBLONS ENSEIGNANTS — les 3 niveaux**
- Le controle etait **client seul**, et son `ilike` sur le nom ignorait la casse mais **pas les accents** :
  « BERRA » et « BÉRRA » n'etaient meme pas rapproches.
- Nouveau `src/lib/normalize-name.ts` (`normalizeNom`, `sameName`), **pendant exact** de la fonction SQL.
- Controle refait dans `createTeacherWithAccount`, **AVANT** la creation du compte auth (sinon un refus
  laisserait un compte orphelin).
- Migration `add-teachers-unique-name.sql` : `norm_name()` IMMUTABLE (sans `unaccent`, qui est seulement
  STABLE donc inutilisable en index) + index unique `(etablissement, nom, prenom)`. **Consequence assumee** :
  deux homonymes reels doivent etre distingues. Verifie avant : 0 doublon existant.

**TYPES DE PRESENCE — les 2 faiblesses**
- Controle d'usage deplace en **server action** (`types-presence/actions.ts`) + migration
  `guard-presence-type-delete.sql` : trigger BEFORE DELETE refusant un type utilise dans les saisies de
  temps de son annee. Necessaire car `staff_time_entries.entry_type` est un **code texte sans FK** (l'unicite
  cote types est composite, les saisies n'ont pas de `school_year_id`). **Sortie de secours** : si l'annee
  n'existe plus, la garde laisse passer — sinon elle bloquerait une CASCADE legitime.

**PALETTES `success` / `danger` SUPPRIMEES**
- **Mon script d'audit ne pouvait pas les voir** : il inventoriait les couleurs avec une LISTE DE PALETTES
  ECRITE EN DUR. Remplace par un **controle de couverture** qui compare les classes utilisees a celles que
  le pont remappe, sans rien presupposer.
- Ces palettes etaient des **alias exacts** de `green`/`red` mais **incompletes** (ni 200 ni 700) :
  `text-danger-700` (10x), `border-danger-200` (9x) et `text-success-700` **ne peignaient RIEN**, dans les
  deux themes. 60 occurrences remplacees dans 18 fichiers, palettes retirees de `tailwind.config.ts`.
- **Incident** : j'avais exclu `globals.css`, qui contenait 5 `@apply` sur ces palettes → la compilation CSS
  a casse et `/login` est tombe en 500. Le `type-check` ne voit rien de tout cela (TypeScript ne connait pas
  Tailwind) : seule la verification page par page l'attrape.

**PASSE GLOBALE THEME SOMBRE** (script `theme-sweep` : 3 angles morts du pont)
- **Toasts** : rendus par le layout RACINE, donc **hors `#main-content`** — le pont ne les atteint jamais.
  Quatre variantes en fond clair, aucune `dark:`. Variantes sombres ajoutees, semantique conservee
  (vert succes / rouge erreur / ambre avertissement / bleu information, choix utilisateur).
- **4 modales sans `role="dialog"`** (StudentDocuments, StudentForm x3) : elles marchaient parce qu'elles
  sont rendues DANS `#main-content`, mais seraient devenues blanches le jour de leur portalisation.
- **Nuance 200 ajoutee au pont** pour les 11 teintes + `bg-gray-100` / `text-gray-600-700`.
- Liseres d'avatar de la liste apprenants et des affectations alignes sur la FICHE (`ring-*-500` au lieu de
  `-300`) : les `ring-*` ne sont pas remappes, une variante pale se delavait sur fond sombre.

**BULLETIN PDF BILINGUE FR / AR** (chantier note la veille, ouvert apres l'ergonomie)
- **Deux des trois obstacles annonces n'existaient pas.** jsPDF 4.2 embarque **`processArabic`** (liaison
  contextuelle) : **aucune dependance** de reshaping. Et le TTF Noto Sans Arabic **encode les formes de
  presentation** (U+FE70–U+FEFF), ligature lam-alif comprise — verifie dans sa cmap AVANT de s'engager,
  sinon on embarquait 188 Ko pour n'obtenir que des carres.
- **Piege non anticipe** : la police couvre le latin accentue, le point median et les chevrons, **mais pas
  les etoiles ★ ☆**. Elle est donc appliquee **cellule par cellule**, jamais au tableau entier.
- **Deux graisses obligatoires** : les en-tetes d'UE sont en `fontStyle: 'bold'` ; une graisse non
  enregistree fait retomber jsPDF sur une police absente → charabia (les lignes de cours, en normal,
  sortaient correctement — d'ou un diagnostic trompeur).
- Police chargee **a la demande depuis `/public`** (hors bundle), mise en cache ; repli en francais seul si
  le chargement echoue.
- **Presentation** : francais a GAUCHE, arabe aligne a DROITE dans la meme cellule — impossible par
  concatenation (autoTable n'aligne qu'un bloc), donc dessine dans `didDrawCell`. Separateur **inverse**
  cote arabe (`‹` au lieu de `›` : le chevron doit pointer dans le sens de lecture) et **indentation
  miroir** des cours. Appreciation : texte libre, bascule sur la police arabe des qu'elle en contient.
- **Mise en page revue** : colonne d'espacement supprimee (elle dessinait un filet vertical en theme
  `grid`) → indentation par marge interieure ; encadre d'identite a **hauteur ajustee au contenu** ;
  **une seule constante `GAP`** pour les 3 jointures du corps ; **un seul encadre** regroupant Appreciation
  (en tete), Moyenne et Absences, sur une ligne chacun et **deux tailles de police** au lieu de cinq ;
  moyenne generale **masquee** si aucune evaluation notee ; legende `ABS : Absence` a gauche et acronymes
  a droite (au-dessus de la colonne Note).
- **Nommage des fichiers** : individuel = `NOM_Prenom_Annee_Periode.pdf`, groupe =
  `Annee_Periode_Classe.pdf` ; helper `fileChunk()` qui retire les caracteres interdits (`\\ / : * ? " < > |`).
- Gabarits : coefficient masque en diagnostique ; dates **avec l'annee** sur Gabarits et Saisie notes,
  parsees en `T00:00` (sans quoi `new Date('2026-08-03')` est lu en UTC et peut afficher la veille).

#### 3 aout 2026 (fin) — Identite de l'application : titre d'onglet, icone, manifeste

- **Titre d'onglet unifie** : le gabarit `'%s | Bilal Education'` de la racine est remplace par un titre
  ABSOLU `'Bilal Education'`, et les 4 titres de page sont retires (Tableau de bord, Eleves, Enseignants,
  Connexion). `src/app/login/layout.tsx` supprime : il n'existait que pour porter ce titre.
  **Regle** : ne pas reintroduire de `template` ni de `title` dans une page, ils repasseraient devant.
- **Icone d'application** (l'app n'en avait AUCUNE) — convention de fichiers Next, aucun code de cablage :
  - `src/app/icon.png` : logo 512x512 **avec transparence** → s'adapte au fond de l'onglet dans les 2 themes ;
  - `src/app/apple-icon.png` : 180x180 genere avec `sharp`, **aplati sur BLANC**. iOS ne gere pas la
    transparence et remplirait de NOIR ; choix mesure et non devine (luminosite moyenne du dessin 128/255,
    couverture 30 % de la surface → il se lit mieux sur clair).
  - `src/app/manifest.ts` : l'application devient **installable** sur telephone — pertinent, le service
    worker et les notifications push existent deja. `theme_color` = surface de marque du theme clair (le
    manifeste ne connait qu'une valeur ; la bascule interne reste pilotee par `data-theme`).
- **Logo en pied de sidebar** (`DashboardSidebar`) : 32 px en mode deploye (texte centre entre le logo et le
  badge de version, qui tient le bord droit), 28 px en mode reduit **a la place du sigle ©**. Rendu en
  `unoptimized` (servi par la convention de metadonnees, pas depuis `/public`) et legerement attenue : c'est
  un element d'identite, il ne doit pas concurrencer la pastille de menu actif.

#### 3 aout 2026 (fin, suite) — Refonte de l'ecran de connexion

Point de depart : la page plaisait, l'utilisateur a demande « est-ce qu'on ne pourrait pas faire encore
mieux ? ». Trois axes proposes, traites dans l'ordre 1 → 3 → 2.

**Axe 1 — ergonomie du formulaire** (`login/page.tsx`)
- **Focus initial** sur le champ email (`autoFocus`) : on tape sans toucher la souris.
- **Verr. Maj** detecte (`getModifierState('CapsLock')` sur keyDown/keyUp, remis a zero au blur) et signale
  sous le champ. C'est la cause n°1 des echecs de connexion, et **la seule que l'utilisateur ne peut pas voir**
  puisque le champ est masque.
- **Bouton actif meme a vide** : `disabled={loading}` seul, la validation se fait dans `handleSubmit` avec un
  message qui NOMME ce qui manque. Un bouton grise n'explique rien.
- **Porte de sortie** sous les erreurs : « Contactez l'administration de votre etablissement. » Mention
  **generique, sans adresse** — la page est publique, une adresse y serait offerte aux robots. La route
  `api/public/etablissement` n'expose donc toujours que le nom et le logo (commentaire ajoute pour que
  personne n'y ajoute le contact par commodite).

**Axe 3 — couleurs** : `#f0f5f7` (n'appartenait a aucune palette du projet) et `#0c5b51 → #063a33` (recopie
de `--brand-surface` / `--brand-surface-2`) remplaces par les **tokens**. Une teinte de marque qui evolue doit
entrainer cette page avec elle (piege deja paye sur l'EDT).

**Axe 2 — identite du panneau de gauche**, prototype sur une page locale `src/app/test-login/` (3 variantes,
5 fonds, champs inertes) **a la demande de l'utilisateur** : ne rien toucher a la vraie page avant arbitrage.
Page **supprimee** apres le choix.
- **Fond : degrade SEUL.** Les 3 cercles blancs a 4 % etaient invisibles sur la plupart des ecrans et
  cassaient le degrade sur les autres. Motif geometrique (entrelacs a 8 branches) et logo en filigrane
  proposes puis ecartes.
- **`IllustrationB` supprimee** (75 lignes de SVG) : plus rien ne l'appelait. Les **points de pagination**
  partent avec elle — ils suggeraient un carrousel pilotable, ce que l'utilisateur a explicitement refuse
  (« je ne veux pas de carroussel mais un defilement automatique »).
- **Bloc de marque** : le logo seul ne NOMME pas l'application → `icon.png` 104 px + **BILAL EDUCATION** sur
  2 lignes a cote, 40 px, gras, `leading-[0.95]`. Les 2 lignes sont **strictement identiques** (meme corps,
  meme graisse, meme interlettrage) ; la difference percue vient de la longueur des mots, pas du corps.
- **Slogan defilant** (`SloganDefilant`) : 4 citations, rotation **15 s**, traversee horizontale de 1,2 s.
  Distance **MESUREE** (`ResizeObserver`) et jamais ecrite en dur — une valeur fixe traverserait tout un petit
  ecran et a peine un grand. **Trois phases** (`in`/`out`/**`pre`**) : entre la sortie et l'entree il faut
  repositionner le texte a droite **sans transition**, sinon il traverse l'ecran a l'envers ; d'ou `pre`,
  appliquee sur **deux `requestAnimationFrame`**. Opacite 1 / 0 / **0,15** a l'entree (a 0 le texte
  apparaitrait d'un coup au bord droit). Hauteur reservee + `overflow-hidden` (sinon le bloc sautille).

**Onde de lumiere sur le nom** — classe **`.nom-vague`** (`globals.css`), plusieurs iterations :
- Remplissage = **les 2 teintes du panneau en sens inverse** (fond 145°, nom 325°), decoupe aux lettres via
  `bg-clip-text` + `text-transparent`. **C'est la POSITION du degrade qui est animee, jamais ses couleurs.**
- **Piege 1 — un degrade peint dans les couleurs du fond ne se percoit pas** : il n'a rien contre quoi se
  reveler. C'est la vague qui rend le lettrage lisible, pas le degrade de base.
- **Piege 2 — couture VERTICALE** (reperee par l'utilisateur : « j'ai l'impression qu'il y a deux effets ») :
  un motif **repete** horizontalement, avec un degrade **oblique**, n'a pas la meme couleur aux deux bords a
  une hauteur donnee → la jointure defile comme un second effet. Correctif : `background-repeat: no-repeat`
  \+ motif **400 %** positionne en pourcentage → il couvre le bloc en permanence, plus de bord a raccorder.
- **Boucle invisible** : les 2 **extremites du motif sont unies** (surface pleine sur 0-30 % et 70-100 %),
  donc au raccord les deux bouts affichent la meme teinte. Corollaire : **plus on etale les couleurs, plus le
  motif doit etre grand** (les zones unies doivent rester plus larges que la fenetre visible).
- **Allure LINEAIRE** : un `ease-in-out` ferait ralentir la vague en bout de course et trahirait la boucle.
- **Sens percu = INVERSE du sens de la position** : pour une vague **descendante**, la position doit
  **remonter** (`from 100% 100%` → `to 0% 0%`).
- Cycle **5 s**, coupe par `prefers-reduced-motion` (meme regle que la sidebar).
- **Piege d'ecriture** : des **accents graves** dans un commentaire CSS ferment le gabarit de chaine JS qui
  porte la feuille de style (erreur TS1005). Pas d'accent grave dans un CSS ecrit en template literal.

**Proportions : 50/50 conservees.** Le 2/3 marque / 1/3 formulaire vu sur d'autres sites appartient aux
produits **en acquisition** (la page sert de vitrine a un prospect). Ici l'outil est interne : rien a vendre.
Surtout, le tiers ne prend pas de la place a du vide mais **au champ de saisie** — carte `max-w-sm` (384 px)
\+ 96 px de marges : un tiers de 1440 px laisse exactement 384 px (zero respiration), un tiers de 1280 px n'en
laisse que 330 (la carte passe sous sa largeur naturelle).

#### 4 aout 2026 — Audit complet du TABLEAU DE BORD (6 profils) + corrections

Demande utilisateur : « il y a des erreurs de donnees d'affichage, controle complet + rapport ».
Audit lecture seule des 6 tableaux de bord, **verifie en base** par scripts service-role jetables
(supprimes), puis correction des 6 profils apres accord.

**P1 — erreurs visibles**
- **Carte « Classes » figee a « 0 inscriptions »** : `getCachedAdminStats` filtrait `enrollments` sur
  **`etablissement_id`, colonne qui n'existe pas** sur cette table. PostgREST ne remonte pas d'erreur
  exploitable, `count` vaut `null`, et le `?? 0` transformait l'echec en zero affiche. **10 inscriptions
  actives en base.** Le cloisonnement est indispensable (ce cache tourne en **service-role, donc sans
  RLS**) : il passe desormais par **`classes!inner`**, qui porte `etablissement_id` ET `academic_year`
  → la requete gagne au passage un bornage a l'annee qu'elle n'avait pas.
  **Regle** : dans une fonction `unstable_cache` (service-role), toute requete doit porter son propre
  cloisonnement — colonne `etablissement_id` ou jointure `!inner` vers une table qui la porte.
- **Eleves et adultes distingues** (demande utilisateur) : sous-titre « N eleves · N adultes ».
  Les adultes vivent dans `parent_class_enrollments` et n'apparaissaient **nulle part**.
- **« Absences non justifiees » comptait depuis TOUJOURS, retards inclus** — affiche en sous-titre de
  « Absences ce mois » (0) et dans « A traiter ». Le sous-titre contredisait le titre. Desormais :
  sous-titre **borne au meme mois**, « A traiter » borne a l'**annee en cours** (un pense-bete ne
  s'efface pas au changement de mois). **Retards exclus** des deux (la table ne connait que
  `absence`/`retard`, la carte s'intitule « Absences », la liste et la courbe les excluaient deja).
- **Fenetres assumees et differentes** (choix utilisateur) : carte = **mois calendaire**,
  courbe = **30 jours glissants**.
- **Annee scolaire en cache 24 h JAMAIS invalidee** : le tag `school-year` n'etait appele nulle part —
  et ne pouvait pas l'etre, l'annee etant ecrite depuis un composant **CLIENT** (`SchoolYearForm`), ou
  aucun `updateTag` ne s'accroche. Apres un changement d'annee, tout le tableau de bord (periodes,
  calcul financier, compteurs d'evaluations/bulletins) travaillait 24 h sur l'ancienne.
  **Cache SUPPRIME** (requete d'UNE ligne : le cache n'economisait rien et coutait une journee de
  chiffres faux). **Benefice second** : hors `unstable_cache`, on peut utiliser le client **SESSION**,
  donc la RLS cloisonne l'etablissement — ce que la version service-role sans filtre ne faisait pas.
  `getCachedCurrentYear` → **`getCurrentYear`**, renvoie aussi `start_date`/`end_date` → les 2 requetes
  `school_years` de rappel (admin + comptable) supprimees.
- **Bandeau « N notifications non lues » avec liste vide** : le compteur etait filtre, la liste prenait
  les **3 plus recentes toutes confondues** puis le composant ecartait les lues. Filtre `is_read`
  porte **dans la requete**. \+ cas **parent** (meme classe de bug) : ses notifications vivent dans
  `announcement_recipients` (cle `parent_id`), table que la liste n'interrogeait jamais alors que le
  compteur les additionnait → les 2 sources sont fusionnees, triees, et le lien porte le bon `rt=`.

**P2 — perimetres faux (latents : 3 classes, toutes de l'annee en cours, 0 radie)**
- **Effectifs par classe** : `enrollments(count)` etait faux DEUX fois — il ignorait le **statut** (un
  radie restait dans l'effectif) et ne connaissait que les eleves (**classe ADULTE affichee 0/20**).
  Remplace par un comptage explicite sur les 2 tables, `status = 'active'`, borne a l'annee.
  **Regle** : ne jamais utiliser l'agregat imbrique `table(count)` quand un statut ou un type doit
  filtrer — il compte TOUTES les lignes liees.
- **Enseignant** : memes corrections d'effectif, \+ classes bornees a l'annee via `classes!inner`
  (une affectation ancienne restee ouverte, `effective_until` nul, ramenait une classe de l'an passe).
- **Pedagogique** : « Classes » comptait toutes les annees alors que ses 2 cartes voisines etaient
  bornees — a la rentree suivante elle aurait double.
- **Secretaire** : « Inscriptions ce mois » construisait sa borne avec `toISOString()`.
- **Bornes de date** : `new Date(y, m, 1).toISOString()` produit `2026-07-31T22:00:00Z` pour « debut
  aout » (UTC+2) — sans consequence en UTC/UTC+2 mais le 1er du mois disparait sur un fuseau **negatif**.
  Toutes les bornes passent en **composantes locales**, \+ **borne haute** (une saisie datee dans le
  futur comptait pour « ce mois »).
- Cache des statistiques 5 min → **1 min** (le tag `dashboard-stats` n'est invalide nulle part non plus,
  meme cause : ecritures depuis des composants clients).

**P3**
- **Tableau de bord PARENT — filtre ignore** : `.eq('students.parent_id', …)` **sans `!inner`** est
  **ignore par PostgREST**. Mesure avant correction : **12 notes renvoyees au lieu de 3**, soit les
  notes des enfants d'AUTRES familles. Idem absences. `!inner` ajoute.
  NB : toutes les policies parent sont **commentees** dans `policies.sql` (comptes dormants en V1), donc
  la RLS bloquait sans doute deja — mais on ne s'appuie pas sur la RLS pour rattraper une requete fausse.
  **Regle** : un filtre sur ressource imbriquee EXIGE `!inner`.
- `authorized_absence` retire des 2 tables de libelles : la contrainte n'autorise que `absence`/`retard`.
- Requetes mortes supprimees du cache (`parentsCount`, `announcementsMonth` n'etaient lues nulle part).
- **Ergonomie** « Effectifs par classe » : **3 colonnes** \+ hauteur plafonnee (`.list-scroll`) — a 15
  classes la carte depassait 250 px et imposait sa hauteur au graphique d'en face, qui se retrouvait
  avec du vide sous lui.

**« A traiter » — definition revue (demande utilisateur)** : la ligne comptait toutes les familles avec
`remaining > 0`, donc aussi celles qui echelonnent normalement leurs paiements et n'appellent aucune
action. Elle compte desormais les familles au statut **`pending`** (aucun versement, cf. `feeStatus`),
et le libelle passe de « Familles avec impaye » a **« Familles sans aucun paiement »** — un compteur
doit dire ce qu'il compte. **Propage au COMPTABLE** (profil le plus concerne, qui n'affichait pas du
tout l'information) : la carte « Reste a encaisser » gagne le sous-titre « N familles sans aucun
paiement ». Le « Top familles debitrices » garde `remaining > 0` : un classement par montant du doit
inclure les paiements partiels.

**Non traite** : `getCachedEtablissement` fait toujours un `.single()` sans filtre d'etablissement
(sans effet a 1 etablissement, leverait avec un second). Chantier multi-tenant a part.

**Verifie a l'ecran** : profil admin (retour utilisateur). Les 5 autres profils demandent un compte
de chaque role.

#### 4 aout 2026 (suite) — Feuille d'appel « toutes les classes » + rappel de bascule de periode

**FEUILLE D'APPEL — vue globale** (`AbsencesClient`, prop `role` ajoutee par `page.tsx`)
- Option **« Toutes les classes »** en tete du select (sentinelle **`__all__`**, valeur NON vide : sur un
  `FloatSelect` une valeur vide fait retomber le libelle flottant par-dessus le texte de l'option).
  **Visible pour l'ENCADREMENT seul** (admin/direction/resp. pedago/secretaire, `GLOBAL_VIEW_ROLES`) et
  seulement s'il y a plus d'une classe — l'enseignant fait l'appel, il n'arbitre pas entre classes.
- **Aucune requete ajoutee** : la page chargeait deja eleves et absences de TOUTES les classes, seul le
  filtrage etait restrictif.
- Contenu : **tableau par classe** (enseignant, effectif, Abs, Abs NJ, Ret, Total) **trie par absences
  decroissantes** (choix utilisateur : la lecture repond a « ou agir ? »), **lignes cliquables** (clavier
  inclus) vers le detail de la classe ; puis **« Eleves les plus absents · tous cours »** (top 10, tries
  par absences NJ, icone d'alerte au seuil, infobulle de classe).
- **Ajouter** et **Feuille vierge** sont **grises** (pas masques — un bouton qui disparait se lit comme un
  bug) avec une infobulle qui dit pourquoi ; garde ajoutee sur la modale de saisie (la sentinelle n'est
  pas un id de classe).
- **Infos de classe** : le constructeur inline local est remplace par le helper PARTAGE
  `classInfoWithTeacher`. Il ecrivait la plage horaire avec un point median (« 09:00·12:00 ») au lieu du
  tiret et gerait le niveau autrement — deux formats concurrents dans la meme app.
- **Bug corrige (introduit puis rattrape)** : la barre de resume sommait les compteurs PAR ELEVE, donc
  limitee aux inscrits actuels, alors que le nouveau tableau par classe compte les absences directement.
  Un eleve desinscrit en cours d'annee aurait produit **deux totaux contradictoires sur le meme ecran**.
  Le resume derive desormais des absences elles-memes.
- `whitespace-nowrap` \+ `w-16` sur « Abs NJ » (et les autres en-tetes numeriques) : la colonne `w-14`
  repliait le libelle sur deux lignes.
- **Note metier (utilisateur)** : un eleve n'est **jamais inscrit dans deux classes a la fois** — le
  dedoublonnage defensif du palmares a ete retire. **Mais aucune contrainte ne l'impose en base** (pas
  d'index unique sur `enrollments`) : un index unique partiel sur `student_id WHERE status='active'`
  reste a arbitrer.

**RAPPEL DE BASCULE DE PERIODE** (`src/lib/school-year/current-period-hint.ts`)
- **Decision prealable** : l'idee de **griser les periodes** dans les ecrans de saisie a ete etudiee puis
  **abandonnee**. Griser le selecteur bloquerait la CONSULTATION des periodes passees en meme temps que
  l'ecriture ; et une variante « griser seulement les periodes superieures » n'interdisait que l'erreur
  improbable (saisir dans le futur) en laissant passer la courante (saisir dans le passe apres bascule).
  Retenu : **aucun blocage**, seulement un **rappel** a admin/direction. L'action reste manuelle.
- **Decoupage (en dur** — les periodes n'ont pas de dates en base, c'est pourquoi le choix est manuel) :
  T1 sept.-dec. / T2 janv.-mars / T3 avril-juin ; S1 sept.-janv. / S2 fevr.-aout. Juillet-aout hors
  trimestres = aucun rappel (intersaison). Decoupage deduit du NOMBRE de periodes (2 ou 3).
- **Declenchement** : des le **dernier mois** de la periode en cours, et maintenu tant que la periode
  enregistree ne correspond pas au mois. Message : « Période en cours : X, pensez à passer en Y. »
  En cas de retard de plusieurs periodes, Y = la periode **attendue** (pas la suivante).
- **TOLERANCE indispensable** : pendant le dernier mois d'une periode, la **suivante est acceptee en
  silence**. Sans elle, basculer en decembre (ce que le message demande) redeclenchait le rappel — on
  aurait puni celui qui obeit.
- **Affichage** : bandeau ambre **en tete du bloc « A traiter »** du tableau de bord admin/direction,
  cliquable vers l'annee scolaire. Pas de compteur : ca ne se compte pas, ca se lit.
- **Fiche annee scolaire** (`CurrentPeriodCard`) : quand **aucune periode n'est en cours** (cas de l'annee
  qu'on vient d'activer), la **premiere est PRE-SELECTIONNEE** et le message passe en **rouge**
  (« validez pour l'enregistrer »). Le bouton s'active seul, la selection differant de la valeur
  enregistree. Rien n'est ecrit sans clic.
- **13 cas de logique testes** (script jetable) : dernier mois, bascule anticipee, retard d'une et de deux
  periodes, avance, fin d'annee sans suite, intersaison, aucune periode.

#### 5 aout 2026 — Securite RLS : le controle de ROLE manquait sur les tables centrales

Chantier ouvert comme « passe multi-etablissement ». L'audit a montre que le cloisonnement
tenant etait SAIN et que le vrai trou etait ailleurs.

**METHODE — le depot mentait.** `supabase/policies.sql` montrait des policies de ROLE sans
tenant. La base montrait l'inverse : des policies `*_tenant` sans role. **Le fichier du depot
est perime depuis longtemps** ; seule `pg_policies` fait foi. Toute conclusion sur la RLS doit
partir d'une requete en base, jamais du depot.

**CONSTAT** : les 10 tables centrales n'avaient qu'UNE policy, en `FOR ALL`, pour `{public}`,
dont l'unique condition etait l'etablissement. Le cloisonnement avait **remplace** le controle
de role au lieu de s'y ajouter → tout compte authentifie de l'etablissement avait les 4 droits.
Un enseignant pouvait supprimer un eleve ou reecrire les notes d'une autre classe ; un compte
parent aussi. Les gardes de l'application (sidebar, server actions) ne protegent rien : le
navigateur detient un jeton valide et peut appeler l'API REST directement.
C'est le defaut deja corrige le 17/07 sur `expenses`/`other_revenues`, jamais etendu au reste.

**AUCUNE page du dashboard n'a de garde de role.** Les `['admin','direction',...].includes(role)`
qu'on y trouve sont des **selecteurs de perimetre** (l'encadrement voit toutes les classes,
l'enseignant les siennes), pas des gardes. Les seuls controles reels sont la sidebar (qui masque
des liens) et les server actions qui portent `requireRoleServer`.

**Migrations executees (3)**
- `harden-security-definer-functions.sql` : `get_user_role()` passe **VOLATILE → STABLE** et
  plpgsql → sql (donc **inlinable** ; une fonction volatile dans une policy est rejouee A CHAQUE
  LIGNE) ; `search_path` fixe sur les deux fonctions (vecteur classique d'elevation sur un
  SECURITY DEFINER) ; et surtout **leurs definitions entrent enfin dans le depot** —
  `current_etablissement_id()` pilote 81 policies et n'existait nulle part dans le code.
- `add-role-checks-to-core-rls.sql` : 2 policies par table (`_select` / `_write` FOR ALL) portant
  tenant ET role. Matrice **decidee par l'utilisateur**. 3 fonctions de perimetre enseignant :
  `teaches_class` (respecte la fenetre `effective_from/until`), `teaches_student`, `teaches_parent`.
  Toutes en `STABLE SECURITY DEFINER` — sans l'elevation, la policy de `students` s'appellerait
  elle-meme.
- `drop-dead-tables-payments-schedules.sql` : les 2 tables etaient **vides et sans chemin
  d'ecriture** (remplacees par `fee_installments` et `schedule_slots`). `DROP` **sans CASCADE**
  volontairement : il echoue au lieu d'emporter une dependance.

**Matrice retenue** (lecture / ecriture) : `students`, `parents` = staff sauf enseignant (limite
a SES eleves) / admin+direction+resp.pedago+secretaire. `teachers` = idem / admin+direction+
secretaire. `classes` = tout le staff / admin+direction+resp.pedago+secretaire. `enrollments`,
`evaluations`, `grades`, `absences` = encadrement + enseignant sur SES CLASSES, ecriture idem
\+ secretaire. **`parent` absent de toutes les listes** (comptes suspendus V1 — la policy
`*_tenant` leur donnait pourtant les 4 droits).

**EXCEPTION assumee** : la matrice n'accordait pas la lecture de `teachers` a l'enseignant. Or
l'EDT resout l'utilisateur par `teachers.find(t => t.user_id === currentUserId)` : sans acces a
SA PROPRE ligne, `ownTeacherId` reste indefini et **son planning s'affiche vide** (bug deja paye
le 10/07). Il lit donc sa seule ligne.

**Alignement applicatif** (un droit sans ecran ne sert a rien, un ecran sans droit echoue en
silence) : ecrans ouverts au resp. pedagogique (Apprenants, Parents, Param. Classes) et a la
secretaire (Enseignants, Param. Classes, Evaluations, Saisie notes, Affectations) ; gardes de
server actions alignees (students, parents, teachers, affectation) ; **selecteurs de perimetre**
de `grades`/`evaluations` elargis a la secretaire, sans quoi elle serait tombee dans la branche
« enseignant » et aurait vu **zero classe**.

**PIEGE PostgREST (2e fois en 3 jours)** : sur un comptage `{ head: true }`, une requete
impossible — table supprimee, colonne inexistante — renvoie **204 / `count: null` / `error: null`**.
Le champ `error` reste VIDE. Mon script de verification a conclu « tables toujours presentes »
alors qu'elles etaient bien supprimees. **Regle : sur un comptage `head`, le signal est
`count === null`, jamais `error`.** Meme cause que le « 0 inscriptions » du tableau de bord
(4 aout), ou le `?? 0` transformait l'echec en zero affiche.

**Correctifs du meme jour** (`fix-teacher-delete-and-referentiel-rls.sql`, executee) :
- **`FOR ALL` designe les COMMANDES, pas les personnes** (SELECT+INSERT+UPDATE+DELETE). La policy
  `teachers_write` ecrite « pour l'ecriture » donnait donc aussi le DELETE a la secretaire.
  Eclatee en **une policy par commande** : INSERT/UPDATE = admin+direction+secretaire,
  **DELETE = admin+direction** (elle entraine le compte auth et les fichiers Storage).
  Aligne cote app : garde de `deleteTeacher` + **bouton masque** dans la liste (prop `canDelete`
  descendue page → client → table). Masque et non grise : la secretaire n'a AUCUN cas ou la
  suppression serait possible.
  - NB : la colonne `roles` de `pg_policies` affiche `{public}` = tous les roles BDD (`anon`,
    `authenticated`), valeur par defaut faute de clause `TO`. Ce n'est pas un trou : la condition
    exige `current_etablissement_id()`/`get_user_role()`, donc un `auth.uid()` nul ne passe pas.
- **Referentiel des cours** (`unites_enseignement`, `cours_modules`, `cours`) : defaut INVERSE des
  tables centrales — **le role sans le tenant**. Les policies d'origine (`get_user_role() IN (...)`)
  n'avaient aucun filtre d'etablissement alors que `unites_enseignement` porte la colonne. Corrige,
  cloisonnement en cascade pour les deux autres via `unite_enseignement_id`.
  - **Bug prealable revele** : l'enseignant n'avait AUCUN acces a ces tables, alors que Gabarits et
    Saisie des notes chargent l'arbre du referentiel avec le client SESSION → **son arbre etait
    vide**. Lecture ouverte a tout le personnel.
  - Ecriture (admin/direction/resp. pedago) inchangee : les policies l'autorisaient deja, seule la
    **sidebar** fermait l'ecran au responsable pedagogique. Ouverte.

**Reste du chantier multi-etablissement** (les chemins qui ne passent PAS par la RLS) :
le middleware ne verifie pas que l'utilisateur appartient au tenant du sous-domaine ; les
operations sur les comptes `auth` (email, 2FA, reinitialisation) n'ont aucune garde
d'etablissement ; les 3 routes `/api/notifications/*` recoivent `etablissement_id` **du corps de
la requete** ; `getCachedEtablissement` et `/api/public/etablissement` font un `.single()` sans
filtre (leveront au 2e etablissement).

#### 5 aout 2026 (suite) — Multi-etablissement : les chemins hors RLS + identite dans le jeton

Seconde moitie du chantier. La RLS etant saine, restaient les chemins qui ne passent PAS par elle.

**DECOUVERTE — le controle 2FA du middleware etait INERTE.** Il lit
`user.app_metadata?.role ?? 'parent'` : or **7 comptes sur 9 n'avaient AUCUNE `app_metadata`**
(seuls le super_admin et l'admin, crees par un autre chemin, en avaient). Tous les autres etaient donc
traites comme des parents — role absent de `rolesRequiring2FA` — et echappaient au TOTP. La liste
contenait pourtant tous les roles staff depuis toujours : l'intention existait, elle ne s'appliquait
pas. Meme cause que le tenant : **le jeton ne portait aucune identite fiable**.

**Correctif : `app_metadata = { role, etablissement_id }`**, pose aux 4 points de creation de compte
(utilisateurs, enseignant, tuteur, superadmin), synchronise par `updateProfile` quand le role change,
et **rattrape sur les 9 comptes existants** (script service-role jetable). L'AUTORITE reste `profiles` :
la RLS lit `get_user_role()`, jamais le jeton — la copie ne sert qu'au middleware.
- **Consequence** : un changement de role ne prend effet dans le jeton qu'au renouvellement (1 h au
  plus). Sans effet sur les droits reels, qui viennent de la RLS.
- **Consequence immediate** : la 2FA redevient active pour les 7 comptes. Un seul (admin) a un facteur
  configure ; les autres seront rediriges vers l'enrolement TOTP a leur prochaine connexion.

**Middleware — controle d'appartenance au tenant** : le tenant vient du SOUS-DOMAINE, l'identite de la
SESSION, et rien ne verifiait qu'ils designent le meme etablissement. La comparaison est desormais
**gratuite** (`app_metadata.etablissement_id` voyage dans le jeton). En cas de discordance : `signOut`
+ `/login?reason=etablissement` + message dedie. Super_admin exempt. Un compte **sans** la donnee est
**laisse passer** avec un avertissement en journal — refuser l'acces sur une information absente ferait
plus de degats que le risque couvert.

**3 routes `/api/notifications/*`** : l'etablissement venait du **corps de la requete**, donc du client.
Il vient maintenant du PROFIL de l'appelant (`requireRole` le remonte), et **chaque ligne recuperee est
verifiee** comme lui appartenant — le service-role ignore la RLS. `comptable` ajoute au type `UserRole`,
qui l'oubliait depuis toujours.

**3 operations sur les comptes auth** (`updateEmail`, `resetUserTwoFactor`, `sendPasswordReset`) :
elles s'executaient en service-role, donc hors RLS, gardees par le seul role. Elles lisent desormais
leur cible avec le **client SESSION** avant d'agir — motif de `deleteUser`. `sendPasswordReset`
acceptait auparavant **n'importe quelle adresse**.

**Les 2 `.single()` sans filtre** : `getCachedEtablissement` est parametree (le layout la lit APRES le
profil, donc en sequentiel — prix du cloisonnement) ; `/api/public/etablissement` s'appuie sur l'en-tete
du middleware, seule source possible puisqu'une page de connexion n'a pas de session.

**EMETTEUR TOTP** (`enroll-totp`) : Google Authenticator affichait « localhost:3000: 3000 ». Cause —
l'emetteur est deduit de l'URL du site, or le libelle d'une URI TOTP s'ecrit `emetteur:compte`, le
deux-points etant le SEPARATEUR : un emetteur qui en contient un casse l'analyse. Correctif : `issuer`
**explicite** (nom de l'etablissement, deux-points neutralises), lu **au moment de l'enrolement** et non
via un etat monte au chargement — il finit grave dans le telephone de l'utilisateur. `friendlyName`
passe de l'horodatage a l'email (etiquette interne Supabase, jamais affichee dans l'application).

#### 5 aout 2026 (fin) — En-tetes PDF homogeneises + limites de saisie + attestation partielle

**EN-TETES DES 4 PDF a 12 POINTS** (bulletin, feuille d'appel x2, attestation, temps de presence) :
nom d'etablissement ET titre du document a la meme taille et sur la **meme ligne de base** (`y + 7`) ;
la periode/annee passe de `y + 11` a `y + 12` pour s'aligner sur la ligne d'ADRESSE. Un ecart d'un
millimetre se lit comme une erreur, un ecart franc comme une intention.
- **Ce n'est pas cosmetique** : le nom partage sa ligne avec le titre aligne a droite, donc la LONGUEUR
  DU TITRE commande la place. Pire cas « ATTESTATION DE PAIEMENT ». A 16 pt il ne restait que 81 mm,
  soit 25 caracteres ; a 12 pt il reste 91 mm pour 76 mm consommes par 30 caracteres.
- Le recapitulatif de temps de presence fait exception de FORME (titre SOUS le nom, pas a sa droite) :
  seule la taille est alignee.

**LIMITES DE SAISIE ETABLISSEMENT** (migration `add-etablissement-length-limits.sql`, executee) :
nom **30**, adresse **80**, MESUREES sur l'en-tete des PDF.
- Le nom est un choix EDITORIAL, il se raccourcit (« Al-Firdaws Villeurbanne »). Une adresse postale
  abregee devient FAUSSE : la limite y est large a dessein. **60 avait ete propose puis ecarte —
  l'adresse REELLE en base en fait deja 64.** Mesurer sur des exemples inventes ne suffit pas.
- **Compteurs DANS le champ** (et non dessous) : `maxLength` bloque la frappe en SILENCE, il faut
  annoncer la limite d'avance — mais deux lignes de plus faisaient apparaitre la barre de defilement du
  navigateur, or cet ecran est concu sans. Motif du bouton oeil de la connexion : conteneur `relative`,
  compteur en absolu, `pr-14` sur le champ. `aria-hidden` : un compteur qui change a chaque frappe
  bavarderait au lecteur d'ecran, et `maxLength` est deja expose.
- Contraintes CHECK en base : ce formulaire ecrit **directement depuis le navigateur**, la limite se
  contournerait par un appel a l'API REST.

**ATTESTATION DE PAIEMENT — choix des inscriptions** : un foyer peut cumuler cours ENFANTS et ADULTES,
et l'attestation demandee ne couvre parfois qu'une partie (remboursement par un comite d'entreprise).
Le bouton ouvre desormais une **modale** listant les inscriptions, toutes cochees, avec raccourcis
Tout / Eleves seulement / Adultes seulement et total vivant.
- **La phrase de certification varie sur DEUX axes** : « l'integralite » disparait sur une attestation
  partielle (on ne peut pas attester du tout en n'en listant qu'une partie — le document part a un TIERS
  qui rembourse sur cette base), et le NOMBRE s'accorde (« la cotisation due au titre de l'inscription »).
  « listees ci-dessous » ne varie PAS : l'accord se fait sur « activites », toujours au pluriel.
  NB : « due / dues » ne prend **jamais** d'accent — le circonflexe de « du » ne sert qu'a le distinguer
  de l'article.
- **La reduction est enregistree au niveau du FOYER**, pas par inscription : aucune repartition honnete
  sur une selection partielle. Cochee par defaut quand tout est retenu, decochee sinon, mais **des que
  l'utilisateur y touche son choix prime** (`reductionTouched`) — sinon l'automatisme le contredirait.
- Ce qui rend une attestation partielle defendable : le bouton n'apparait que sur un dossier **solde**,
  donc toutes les lignes sont reellement payees.
- **Trace** : « Attestation de paiement partielle 2026-2027 · Adam · Yacine » — les prenoms des
  beneficiaires, et non « 1/2 inscriptions » qui n'apprend rien six mois plus tard.
- **`ui/TruncatedText.tsx`** extrait de `TempsPresenceClient` a son 2e usage : infobulle **uniquement
  si le texte est reellement coupe** (mesure `scrollWidth`). Une infobulle systematique s'ouvre sur un
  texte lisible et masque ce qui l'entoure.

#### 5 aout 2026 (menage) — Suppression des fichiers perimes

`src/` etait **propre** : aucun fichier mort sur 285 sources (verifie par script). Le menage
portait sur la documentation et les scripts SQL.

**Supprimes** (tout reste dans l'historique git) :
- `supabase/policies.sql` (fige au 3 mars) et `supabase/schema.sql` (7 avril). **C'est le point
  important** : `policies.sql` m'a fait conclure, lors de l'audit du 5 aout, que les tables centrales
  avaient des policies de ROLE sans cloisonnement — la base disait exactement l'inverse. Une
  documentation perimee inspire une confiance qu'elle ne merite pas ; elle est pire qu'absente.
  **La verite est en base** (`pg_policies`, `information_schema`) et l'historique dans
  `supabase/migrations/`.
- 5 rapports racine gelés entre mars et avril : `QWEN.md` (2 lignes), `AUDIT_QWEN.md`,
  `CORRECTIONS.md`, `QA_REPORT.md`, et **`PERMISSIONS.md`** — ce dernier decrivait la matrice des
  droits d'avant la refonte du 5 aout, sur le sujet le plus sensible du projet.
- Scripts de debogage que CLAUDE.md notait deja « a supprimer » : `delete-test-substitutes.sql`,
  `inspect-class-teachers.sql`, `seed-teachers-bulk.sql` (documente comme abandonne).
- Seeds de demonstration de mars, remplaces par les seeds bulk : `test-data.sql`,
  `seed-parents-demo.sql`, `seed-students-demo.sql`, `seed-teachers-demo.sql`.
- `.qwen/` (configuration d'un autre outil), desormais dans `.gitignore` comme `.claude/`.

**Consequence a connaitre** : `README.md`, `ARCHITECTURE.md` et `GUIDE_INSTALLATION.md` demandaient
d'executer `schema.sql` puis `policies.sql` pour installer le projet. Ils renvoient desormais vers
`supabase/migrations/`. **Le depot ne contient donc plus d'artefact de reconstruction depuis zero** :
il faut rejouer les migrations dans l'ordre. Si une reconstruction devient un besoin reel, la bonne
reponse est un dump REGENERE depuis la base, date, et non un fichier reecrit a la main.

**Conserves** : `clean-all-data.sql` (reset d'environnement de test), les seeds bulk et thematiques,
`README.md`, `ARCHITECTURE.md`, `GUIDE_INSTALLATION.md`.

#### 6 aout 2026 (suite) — Acces support de l'editeur (super-admin dans une ecole)

Le `super_admin` ne peut pas depanner un client : aucun ecran ne connait son role, et la RLS ne lui
donne aucune ligne (`etablissement_id` NULL). Il se **RATTACHE** donc temporairement a l'ecole.

- **Migration `add-superadmin-support-access.sql`** (executee, verifiee) : `get_user_role()` repond
  **`admin`** quand l'appelant est super-admin ET rattache. **Une seule fonction change, aucune des
  155 politiques n'est touchee.** Deux autres voies ecartees : changer son ROLE l'enfermerait dans
  l'ecole si la session s'interrompait (plus d'acces a sa console pour se rattraper) ; ajouter
  `super_admin` a toutes les policies, c'est beaucoup de surface sensible pour rien.
  - `fn_audit_log()` gagne un repli sur l'ANCIENNE valeur (UPDATE) : sans lui, vider
    `etablissement_id` echoue en **23502** et **le detachement devient impossible**.
- **L'INTERRUPTEUR est le rattachement, pas le role.** La colonne `profiles.role` ne change JAMAIS :
  c'est ce qui garantit la sortie.
- **Ou se prend le rattachement** : **dans la console uniquement** (server action `enterSchool`).
  C'est une ecriture, elle doit invalider le cache du profil (`updateTag`) — interdit pendant un
  rendu de page. Le layout du tableau de bord ne fait que **verifier** que le rattachement designe
  l'ecole du **sous-domaine**, et renvoie a la console sinon (**adresse absolue** : `/superadmin`
  n'existe pas sur le domaine d'une ecole, le relatif rejouerait l'impasse de connexion).
- **Exclusif** : entrer dans une 2e ecole est refuse tant que la 1re n'est pas quittee. Un profil ne
  porte qu'un etablissement — sinon le 1er onglet travaillerait **silencieusement** sur l'autre.
- **`src/lib/auth/effective-role.ts`** — `effectiveRole()` / `isSupportSession()`, miroir applicatif
  de la fonction SQL. **26 fichiers** lisaient le role en direct : sans cette passe, la base ouvrait
  tout et **chaque enregistrement echouait** — l'editeur aurait pu regarder sans rien reparer.
  Passe appliquee a `requireRoleServer`, `requireRole`, la route de purge et 23 pages/actions.
- **DEUX gardes restent sur la colonne BRUTE, deliberement** : le layout `(protected)` de la console
  et `support-actions.ts` (`requireEditor`). Traduites, elles refuseraient `leaveSchool` **au moment
  precis ou il faut sortir**. Le role en base est l'identite, le role effectif un costume.
- **Trace de FIN d'intervention ecrite AVANT le detachement** : `logAudit` prend l'etablissement dans
  le profil de l'appelant et **abandonne en silence** s'il est nul — le journal aurait montre des
  interventions jamais refermees.
- **Middleware** : la redirection super-admin → console (posee la veille pour lever l'impasse de
  connexion) est **retiree** ; sur le domaine d'une ecole, `/` renvoie toujours `/dashboard` (y
  diriger `/superadmin` refabriquait la boucle). Le compteur d'utilisateurs de la console **exclut**
  le super-admin rattache.

#### 6 aout 2026 (fin) — Le journal d'activite n'enregistrait AUCUNE trace applicative

Signale par l'utilisateur (« je n'ai rien modifie, seulement navigue ») : le journal affichait des
lignes « Modification · Utilisateurs · NOM Prenom » **sans acteur**. C'etaient les entrees/sorties de
support. En creusant, un defaut bien plus large est apparu.

- **`audit_logs.description` N'EXISTAIT PAS.** `logAudit` en fournit une a chaque appel →
  insertion rejetee → erreur **avalee par le `try/catch`** qui rend la trace « non bloquante ».
  Les **32 appels** repartis dans 12 fichiers n'ont **jamais rien ecrit** : relances de paiement,
  attestations, reinitialisations 2FA, purges du journal, envois de lien de mot de passe,
  suppressions de compte, ouverture d'intervention. Seules les lignes des **declencheurs**
  subsistaient. `AuditLogsClient` lisait deja `log.description` en priorite — c'est la base qui
  n'avait jamais suivi ; le `select('*')` de la page masquait l'absence de colonne.
  **Regle** : un `catch {}` silencieux sur une ecriture secondaire peut cacher une panne totale
  pendant des mois. Verifier qu'une trace ARRIVE, pas seulement qu'elle est appelee.
- **Migration `fix-audit-log-description.sql`** (executee, verifiee) — 3 correctifs dans
  `fn_audit_log()` :
  1. **colonne `description`** ajoutee (repare les 32 appels sans toucher au code) ;
  2. **le rattachement de support ne s'audite plus** : un UPDATE de `profiles` sur un compte
     `super_admin` ne changeant que `etablissement_id` produisait une ligne muette et trompeuse
     (ecriture en service-role ⇒ pas d'`auth.uid()`), doublant la ligne lisible ecrite par l'app.
     Condition **stricte** : toute autre modification d'un profil de super-admin reste tracee ;
  3. **`v_etab_id IS NULL` ⇒ on renonce a la TRACE, jamais a l'ECRITURE.** L'insertion echouait en
     **23502** et **faisait echouer l'operation observee**. Consequence reelle : le super-admin
     **hors intervention** ne pouvait ni corriger son nom, ni changer de theme, ni regler son
     compte — `profiles.etablissement_id` etant nul, le journal n'avait ou se ranger. C'est aussi
     le piege documente pour les scripts service-role sur une table sans colonne d'etablissement.
- **Verifie en base** (4 cas) : rattachement 0 ligne, detachement 0 ligne, profil du super-admin
  detache modifiable **sans erreur** (0 ligne, faute d'ecole ou la ranger), profil d'un admin
  d'ecole toujours trace (1 ligne, colonnes listees). Lignes de test effacees.

#### 6 aout 2026 (fin, suite) — ESCALADE INTER-ETABLISSEMENTS : un admin d'ecole pouvait devenir super-admin

Question de l'utilisateur apres la livraison de l'acces support : « en terme de securite c'est safe ? ».
Verification plutot que reassurance — et un trou reel, **exploite pour le prouver**.

- **Demonstration** (psql, identite de l'admin d'une ecole simulee comme PostgREST le fait a partir de
  son jeton : `SET LOCAL ROLE authenticated` + `request.jwt.claims`) :
  `UPDATE profiles SET role = 'super_admin' WHERE id = <admin>` → **UPDATE 1**.
- **Cause** : `fn_guard_profile_sensitive_columns()` autorisait `admin`/`direction` a modifier
  `role`, `is_active` ET `etablissement_id` **sans restriction**. Defendable tant que ces colonnes ne
  servaient qu'a administrer les employes de LEUR ecole.
- **Ce que l'acces support a change** : `super_admin` ouvre la console, et la console permet d'entrer
  dans **n'importe quelle** ecole. L'escalade preexistait ; sa **portee** passe de « voit la liste des
  ecoles » a « lit et ecrit les donnees de tous les clients ». L'interface ne propose pas ce role,
  mais le navigateur detient un jeton valide et peut appeler l'API directement.
- **Migration `harden-profile-role-escalation.sql`** (executee) — deux interdits **absolus** hors
  service-role : (1) `super_admin` ne s'attribue **ni ne se retire** depuis l'application (le retirer
  serait un deni de service contre l'editeur) ; (2) `etablissement_id` ne se modifie pas — deplacer un
  profil, c'est le mettre chez un autre client. **Verifie** : les 2 seules ecritures de cette colonne
  sont l'entree et la sortie de support, deja en service-role.
- **5 cas testes** (sous identite reelle, avec `SAVEPOINT` par cas — la 1re erreur avorte sinon toute
  la transaction et les cas suivants ne prouvent RIEN) : promotion super_admin **refusee**, changement
  de rattachement **refuse**, changement de role d'un employe **accepte**, desactivation **acceptee**,
  enseignant modifiant son propre role **refuse**. Service-role : rattachement/detachement **ok**.
- **2FA** : le super-admin a bien un facteur **verifie** (le perimetre de l'editeur est protege) ;
  les 7 comptes d'ecole n'en ont toujours aucun (deja au plan de mise en production).
- **Durcissement du layout** : le rattachement est desormais lu **en base** (client admin, une ligne)
  et non dans le profil mis en cache. Des que les deux divergent — intervention refermee depuis un
  autre onglet, un autre poste, ou un script — l'application affichait une coquille d'administrateur
  au-dessus d'une base qui n'accordait plus rien, et la 1re requete de la page s'effondrait
  (`dashboard/error.tsx`). C'est exactement ce qui est arrive a l'utilisateur : **mes scripts de test
  ont ferme son intervention en cours**. Regle : ne jamais faire d'essais sur le compte de
  l'utilisateur pendant qu'il utilise le site.

#### 7 aout 2026 — REGRESSION MAJEURE : un declencheur generique cassait TOUTE ecriture

Signale par l'utilisateur (« erreur lors de la maj de la date d'expiration »). Le message etait
visible **grace au correctif du jour meme** — la veille, il aurait ete avale en silence.

- **Cause** : la garde ajoutee la veille dans `fn_audit_log()` (ne pas auditer le rattachement de
  support) etait ecrite `IF TG_TABLE_NAME = 'profiles' AND ... AND OLD.role = 'super_admin' ...`.
  Le raisonnement — « la 1re condition ecarte les autres tables avant qu'on ne touche a `OLD.role` »
  — est **FAUX**. **PL/pgSQL compile l'expression ENTIERE en une seule requete SQL** et lui passe
  `OLD` en parametre : tous les champs cites doivent exister, quelle que soit la table. Le
  court-circuit du `AND` n'intervient qu'a l'execution, bien apres la resolution des noms.
- **Portee** : **37 des 38 tables auditees n'ont pas de colonne `role`** → toute ecriture echouait en
  **42703 « record "old" has no field "role" »**. Eleves, classes, notes, absences, paiements, EDT,
  etablissements. **L'application entiere, pendant une soiree.**
- **Correctif** (`fix-audit-log-old-role-reference.sql`, executee) : lire par
  **`to_jsonb(OLD)->>'role'`**, qui vaut NULL sur une table sans la colonne au lieu de lever. C'est
  deja la forme employee plus bas dans la meme fonction pour `etablissement_id`.
- **REGLE** : dans un declencheur **generique** monte sur des dizaines de tables, **ne jamais citer
  une colonne par son nom** — passer par `to_jsonb`. Et **eprouver la garde sur une table QUI N'A PAS
  la colonne** : je ne l'avais testee que sur `profiles`, la seule ou elle ne pouvait pas echouer.
- **Piege de mesure** : compter les lignes d'audit par fenetre `created_at >= t0` capture la ligne de
  l'operation PRECEDENTE et fait conclure a tort (« garde inoperante »). Compter le **total avant/
  apres** chaque operation.
- **Diagnostic** : les server actions renvoyaient un message generique **sans journaliser la cause**
  — il a fallu rejouer la requete a la main pour voir le 42703. Les 5 actions de la console
  `console.error` desormais l'erreur reelle.

#### 7 aout 2026 — Console super-admin, blocs 1 et 2 de l'audit

- **Bloc 1 (securite)** : **2FA absente de la console** — le controle existait mais restait hors
  d'atteinte pour DEUX raisons cumulees (la branche du sous-domaine rendait la main avant lui, et il
  etait conditionne a `/dashboard`). Il court desormais sur `/superadmin/*`, et les 2 ecrans TOTP
  acceptent une **destination** (`?next=`, gardee contre la redirection ouverte) au lieu du
  `/dashboard` en dur. **Boucle de redirection infinie** fermee (le renvoi depuis `/superadmin/login`
  est reserve a l'editeur ; les autres sont ecartes **sans etre deconnectes** de leur ecole).
  **`requireEditor()`** extrait dans `src/lib/auth/requireEditor.ts` et applique aux 7 actions de la
  console — `requireRoleServer` compare le role EFFECTIF et les bloquait toutes pendant une
  intervention. **`createTenantUser`** pose enfin `app_metadata` (sans quoi le compte passait pour un
  parent, donc **dispense de 2FA**) et valide le role contre une liste excluant `super_admin`/`admin`.
  **`updateTenantUser`** cloisonnee a l'etablissement affiche + « 0 ligne » n'est plus un succes.
  **Tracabilite** : les 7 actions ecrivent au journal de l'ecole, `logAudit` acceptant un
  `etablissementId` explicite (l'editeur n'appartient a aucune ecole hors intervention).
  La mention « acces surveille et journalise » de l'ecran de connexion etait **fausse** et a ete
  remplacee : une connexion a la console ne concerne aucun etablissement, donc aucun journal.
- **Bloc 2 (charte)** : ecran de connexion repris sur celui des ecoles (focus initial, Verr. Maj,
  bouton actif a vide, oeil accessible, `role=alert`) ; **couleurs inventees** (`#0f1923`, `#16232f`,
  `#e85d04`) et degrade fige `#2e4550` remplaces par les **jetons de marque** + orange de la charte ;
  `.list-th`/`.list-td`/`.stat-label`, `card p-0`, icone retiree du bouton ; **lignes cliquables**
  via `ClickableRow` — la page etant un composant SERVEUR, ses cellules ne peuvent pas porter de
  `stopPropagation` : on **inverse** la logique (`data-no-row-nav` + `closest()`) ; **3 confirmations**
  (couper l'acces d'une ecole, retirer l'echeance, retirer la limite) ; **compteurs de saisie** nom/
  adresse, limites partagees avec la fiche etablissement (`src/lib/tenant/limites.ts`) ; role `parent`
  retire des roles creables.
- **Fiche ecole — « certains boutons ne fonctionnent pas »** : ils agissaient **en base**, mais la
  fiche est rendue **cote serveur** (proprietes figees) et aucun ne faisait `router.refresh()` :
  « Desactiver » restait « Desactiver » apres avoir desactive. **Et leur valeur de retour etait
  jetee** — depuis le cloisonnement, un refus ressemblait exactement a un succes. Chemin unique
  `agir()` : erreur lue, succes confirme, ecran rafraichi ; les 2 boutons « Aucune » des modales le
  contournaient encore. Desactiver un COMPTE demande desormais confirmation (comme l'ecole).
  Mise en page : **bandeau d'identite** des fiches (logo en avatar, nom en `h1`), compteurs en
  pastilles, corps en **3 colonnes**, liste des comptes **bornee en hauteur** (sinon la page
  redeborde au 10e compte).

#### 8 aout 2026 — Certificat generique (www) + gabarits d'email Supabase

**PIEGE DU CERTIFICAT GENERIQUE** (signale par l'utilisateur, tombe par hasard sur l'adresse) :
`www.bilal-neuville.bilaleducation.fr` affiche « votre connexion n'est pas privee »
(`ERR_CERT_COMMON_NAME_INVALID`). Cause : **un joker TLS couvre EXACTEMENT UN niveau** —
`*.bilaleducation.fr` vaut pour `ecole.bilaleducation.fr`, jamais pour `www.ecole.…`, qui en fait
deux. Verifie en inspectant le certificat servi (SAN = `*.bilaleducation.fr` seul). Le DNS resout
(les jokers DNS sont plus permissifs), c'est la **poignee de main TLS** qui echoue.
- **L'echec est INRATTRAPABLE cote application** : il survient avant qu'une requete HTTP n'existe,
  donc avant tout middleware. Aucune redirection ne peut le corriger. **Regle** : ne jamais
  declarer, communiquer ni autoriser une forme `www.` sur un sous-domaine d'ecole.
- **Le vrai risque etait la PROPAGATION** : les 3 constructeurs de liens de reinitialisation
  recopiaient l'hote de la requete tel quel (`requestOrigin()` cote serveur ; `window.location.origin`
  dans `auth.ts` et `forgot-password`). Un `www.` entre une fois partait dans le mail, et c'est le
  **DESTINATAIRE** — qui n'a rien tape — qui recevait l'avertissement. Nouveau
  `src/lib/tenant/canonical-host.ts` (`canonicalHost` / `canonicalOrigin`), branche aux 3 endroits.
  Le point du motif `/^www\./i` protege `wwwecole.…` (teste sur 7 cas).
- **Filet** dans `proxy.ts` : redirection **308** vers l'hote sans `www` (la cible a, elle, un
  certificat valide). Ne sert qu'a qui a force le passage. L'apex et `www.` de l'apex ont chacun
  un certificat valide, la normalisation les couvre aussi (canonique, correct pour le referencement).
- **Slug inconnu ≠ abonnement expire** : le middleware envoyait les deux cas sur la meme page, qui
  annonçait « votre abonnement est expire » a qui s'etait trompe d'adresse — faux, et alarmant pour
  un client a jour. Motif `?raison=inconnu` : titre, texte et icone distincts, et **pas de bouton
  « retour a la connexion »** (aucun etablissement n'etant resolu, `/login` renverrait ICI meme —
  `skipTenantCheck` ne couvre pas `/login`). Au passage, le bouton de contact pointait vers
  `support@bilaleducation.fr`, **qui n'existe pas** (boites retenues : `contact@`, `admin@`, `superadmin@`).

**GABARITS D'EMAIL SUPABASE** (`supabase/email-templates/`) — phase 5, volet gabarits.
- **VERIFICATION DECISIVE AVANT D'ECRIRE : 5 des 6 gabarits d'authentification ne se declenchent
  JAMAIS.** Les 7 `createUser` posent `email_confirm: true` (pas de confirmation d'inscription) ;
  `inviteUserByEmail`, `signInWithOtp` et `reauthenticate` sont **absents du code** ;
  `updateUserById({ email })` (API admin) change l'adresse **sans email de confirmation**.
  Seul **Reset Password** est en service (4 points d'appel). Les habiller tous aurait ete cinq
  sixiemes de travail perdu. **Regle** : avant de refondre un gabarit, verifier qu'un appel le declenche.
- **`build.mjs` = SOURCE UNIQUE** qui genere les 3 `.html` a coller. Le tableau de bord Supabase
  n'a pas de notion de fragment partage (chaque gabarit doit etre un document complet) : sans
  generateur, coque, couleurs et boutons seraient recopies 3 fois — le motif exact qui a produit
  le calcul comptable faux dans 2 ecrans sur 3. **Ne jamais editer les `.html` a la main.**
- **DECISION — marque « Bilal Education » seule**, a l'inverse de l'intention de la veille. Raison
  d'architecture : les ecoles vivent sur `*.bilaleducation.fr`, donc l'email et le domaine
  d'atterrissage portent **la meme marque**, sans dissonance. Le nom d'ecole n'etait accessible que
  par **`.Data`** (= `user_metadata`) : a ecrire aux 4 points de creation de compte, a rattraper sur
  les comptes existants, **modifiable par l'utilisateur lui-meme** (donc non fiable), et **ne suivant
  pas un changement de nom**. Reversible pour un `{{ if .Data.etablissement_nom }}` le jour ou une
  ecole prendrait un domaine propre — c'est ce cas qui inverserait l'arbitrage.
- **DECISION — les 2 notifications de securite sont retenues** (« Password changed », « Email address
  changed »). Elles sont **desactivees par defaut au niveau du projet** : un gabarit colle sans
  activation ne part jamais. Le texte de « Email address changed » ne suggere PAS au destinataire
  qu'il pourrait en etre l'auteur — chez nous une adresse ne change que par une action d'administrateur.
- **Variables verifiees dans la doc** (une variable inconnue **s'affiche vide, sans erreur** — ne rien
  inventer) : `.ConfirmationURL` / `.TokenHash` / `.SiteURL` / `.Email` / `.RedirectTo` / `.Data`
  partout ; **`.OldEmail` uniquement dans « Email address changed »** ; `.NewEmail` uniquement dans
  « Change email address » ; `.Token` **absent** de Reset Password.
- **Contraintes du format email** (expliquent le HTML date) : mise en page **en tableaux** (Outlook
  = moteur de Word, ignore flex/grid) ; styles **en ligne** ; **aucune image distante** — Outlook et
  Gmail les bloquent par defaut pour un expediteur inconnu, ce que nous serons au lancement, donc le
  logotype est **dessine en texte et fonds de cellule** (il s'affiche toujours et ne depend d'aucun
  hebergement, ce qui compte : le domaine racine doit devenir une vitrine peut-etre hebergee ailleurs) ;
  **`color-scheme: only light`** sans quoi le theme sombre de Gmail/Apple Mail reecrit les couleurs et
  detruit le bandeau de marque ; bouton **en tableau** (Outlook ignore le remplissage d'un lien seul).
- **Couplage a surveiller** : le gabarit **annonce la duree de validite** au destinataire. La
  constante `VALIDITE` de `build.mjs` **RECOPIE** le reglage Supabase `Email OTP expiration`, elle
  ne le fixe pas — **les deux changent ensemble**. Reglage constate le 8 aout : **10 minutes**
  (et non 1 h comme je l'avais suppose ; la 1re redaction promettait une heure sur un lien de dix
  minutes, exactement le defaut que j'avais signale). La duree apparait a **DEUX** endroits : le
  corps ET la **ligne d'apercu** de la boite de reception — celle-ci ne passait pas par la
  constante et a failli rester perimee.
  - **Reserve a arbitrer** : 10 min convient a qui vient de cliquer « mot de passe oublie » (il est
    devant son ecran), mais c'est tres court pour le cas qui compte commercialement — le **directeur
    d'une ecole nouvelle**, a qui le lien part quand l'editeur cree l'etablissement. L'echec
    tomberait sur la 1re impression d'un client payant. Repli existant (mot de passe oublie + mot de
    passe provisoire affiche une fois), mais au prix d'un aller-retour.
- **Allow-list de redirection** : `https://*.bilaleducation.fr/**`, **sans aucune variante `www.`**
  (voir le piege du certificat ci-dessus).
- **Risque connu, non traite** : les **analyseurs de liens** des messageries d'entreprise ouvrent le
  lien avant l'utilisateur et **consomment le jeton a usage unique** → « lien expire » sur un mail
  qui vient d'arriver. Contournement = route maison `/auth/confirm` portant `.TokenHash`, qui ne
  consomme le jeton qu'au clic. Laissee de cote faute d'occurrence (destinataires sur messageries
  grand public). Symptome reconnaissable, a construire s'il apparait.
- **Epreuve visuelle** produite avant tout collage (rendu reel des 3 emails + bascule
  exemple/variables), **generee depuis les fichiers eux-memes** pour ne pas pouvoir en deriver.

#### 8 aout 2026 (suite) — `authRepository` : 8 methodes sur 10 etaient MORTES

Trouve en verifiant une question de l'utilisateur (« le lien mene-t-il bien a son ecole ? »).
Seules `signIn` et `signOut` sont appelees ; les 4 fichiers qui importent le module n'utilisent
qu'elles. 221 lignes ramenees a 107.
- **La plus genante : `createUser`** — elle appelait **`supabase.auth.signUp` depuis le NAVIGATEUR**
  en passant le **role** dans `options.data`, puis inserait la ligne `profiles` correspondante avec
  ce role. Jamais appelee, mais c'etait un **patron d'escalade pret a etre recable par megarde**.
- **`hasRole` / `isAdmin`** : controles de role **cote navigateur**. Ils ne protegent rien — ils
  decident de ce qui s'AFFICHE, jamais de ce qui est PERMIS. La verite est la RLS.
- **DEUX VERIFICATIONS QUI EN DECOULENT** (ajoutees en phase 6, pas faites — je ne sonde pas la base
  de production pendant que l'utilisateur s'en sert) :
  1. **`Allow new users to sign up` doit etre DESACTIVE** dans Supabase. Si actif, `signUp` reste
     appelable depuis l'API avec la cle publique **quoi que fasse notre code**.
  2. **Policy INSERT de `profiles`** : le garde-fou anti-escalade du 8 juillet est un trigger
     **`BEFORE UPDATE`**, il **ne voit pas un INSERT**. Si la policy d'insertion est permissive, un
     compte authentifie pourrait creer une ligne `profiles` en choisissant son role.
- **Durcissement au passage** (`console-url.ts`) : `schoolUrl`/`consoleUrl` **PREFIXENT** le domaine
  racine d'un sous-domaine. Une `NEXT_PUBLIC_SITE_URL` reglee sur `https://www.…` aurait produit
  `ecole.www.bilaleducation.fr` — trois niveaux, **aucun certificat**, sur des liens **envoyes par
  email** donc decouverts trop tard. Domaine racine extrait une seule fois et normalise.
- **Chaine du lien de reinitialisation VERIFIEE** (les 3 mecanismes menent a l'ecole) : « mot de
  passe oublie » → `window.location.origin` ; fiche utilisateur → `requestOrigin()` (en-tete `host`) ;
  **console → `schoolUrl(slug)`**, seul cas emis depuis un autre domaine, et il reconstruit
  l'adresse depuis le slug au lieu d'utiliser l'hote courant. `/auth/callback` redirige ensuite avec
  l'`origin` de la requete entrante, donc reste sur l'ecole.
  - **Dependance a configurer** : sans `https://*.bilaleducation.fr/**` dans l'allow-list Supabase,
    `redirect_to` est **ignore** et l'utilisateur atterrit sur la **Site URL** (l'apex, la vitrine),
    jeton en main, sans que rien ne se passe. Echec silencieux.

#### 8 aout 2026 (fin) — « Contacter le support » : formulaire de l'ecole vers l'editeur

Dernier point en attente du bloc 3, demande le 7 aout. **Decision utilisateur : un FORMULAIRE**,
contre le `mailto:` que je proposais — et **« toute ecole devra configurer sa messagerie dans
l'app »**, ce qui fait de la messagerie un **prerequis d'ouverture** et non une option.

- **La demande est ECRITE avant d'etre notifiee** (`support_requests`). C'est la raison d'etre de
  la table : « ma messagerie ne fonctionne plus » est un motif de demande **ordinaire** — envoyer
  d'abord ferait de cette demande-la **la seule incapable d'arriver**, et l'ecole croirait avoir ecrit.
- **Taxonomie en 6 natures** (`src/lib/support/categories.ts`, source unique partagee par le select,
  la validation serveur et le CHECK en base) : assistance / incident / information / suggestion /
  facturation / autre. Choisies pour etre **DISTINCTES** — deux categories qui se recouvrent ne se
  partagent pas les demandes, elles finissent toutes deux dans « Autre ».
  - **Champ IMPACT conditionnel** (bloquant / genant / mineur), **uniquement sur un incident** :
    contrainte `support_impact_incident_seulement` en base. Libelles decrivant une **consequence**
    et non une urgence ressentie — « bloquant » se verifie, « urgent » ne se verifie pas et tout
    finit urgent.
- **Le contexte s'attache seul** (ecole, auteur, **page d'origine**, version, navigateur) : c'est
  ce qui distingue un formulaire d'un email, et sur un incident cela economise le 1er aller-retour.
  Il est **MONTRE** a l'utilisateur (replie) — une application qui transmet des informations sur
  son utilisateur les lui affiche.
- **`Reply-To` = l'AUTEUR**, pas l'ecole : la reponse va a qui a le probleme sous les yeux.
- **Statut d'envoi ecrit en SERVICE-ROLE** : la table n'a **ni policy UPDATE ni DELETE** (l'ecole
  depose et relit, elle ne retouche pas une demande partie) ; `email_status` est un champ systeme.
- **Message d'echec HONNETE** : si l'email ne part pas, la modale se ferme quand meme avec
  « votre demande est enregistree, mais la notification n'a pas pu partir ». Annoncer un echec
  ferait tout recommencer a l'utilisateur, **pour rien**.
- **Objet de l'email** : `[Support] BLOQUANT · {ecole} · {objet}`. **Ordre = urgence, qui, quoi.**
  La NATURE n'y est PAS : les libelles complets (« Assistance a l'utilisation »…) consommaient une
  cinquantaine de caracteres **avant** les mots de l'utilisateur, or une liste de messages tronque
  vers 70 — on lisait le prefixe et rien d'autre. Elle reste en tete du corps. **`BLOQUANT`
  n'apparait que la ou il est vrai** (ni « genant », ni « mineur ») : un marqueur d'urgence present
  partout ne signale plus rien. `[Support]` en tete reste stable, pour une regle de filtrage.
- **Bucket `support-attachments`** prive, **1 Mo** (meme plafond que les PJ de communication),
  images + PDF, cloisonne par
  `{etablissement_id}/…` (motif des justificatifs et des PJ de communication). Prive et non public :
  une capture d'ecran de bug montre des donnees reelles d'eleves.
- **Tout est ECHAPPE dans l'email** (`escapeHtml` / `escapeHtmlMultiline`) : objet, message et
  contexte viennent d'une saisie, et cette boite est **la mienne** — une injection y serait une
  injection chez moi. **`escapeHtml` extrait** en `src/lib/security/escape-html.ts` : c'etait sa
  **3e occurrence** (financements + signature de communications, qui omettaient l'apostrophe).
  **Ne pas confondre avec `sanitize()`** : le choix se fait sur la nature de la SOURCE — HTML
  d'editeur riche → `sanitize`, texte brut de champ → `escapeHtml`.
- **Le lien de la sidebar mene a une PAGE d'historique** (`/dashboard/support`), pas directement a
  la modale — decision utilisateur. « Ai-je deja signale ce probleme ? » se pose AVANT « comment le
  signaler » : c'est ce qui evite les demandes en double. Bouton **« Contacter le support »** en
  haut a gauche, qui ouvre la modale de saisie.
  - **Le manque qui l'a motivee** : l'email part par **relais SMTP**, ce qui **ne depose AUCUNE
    copie dans le dossier « Envoyes »** de la boite de l'ecole. Sans cette page, une direction qui
    se demande « ma demande est-elle partie ? » n'avait **rien** a regarder — et la policy SELECT
    de `support_requests` restait un droit que **rien n'exercait**. Signe qu'il manquait un ecran.
  - **`SupportRequestsClient` est CALQUE sur `SentMessagesClient`** (regle « comme X » = lire X et
    le recopier) : `space-y-2`, carte de filtres `card px-3 py-2 flex flex-wrap gap-3`, `SearchField`,
    chips `aria-pressed`, sous-filtre en `FloatSelect compact wrapperClassName="w-fit ml-auto"`,
    tableau `card p-0` + `.list-th/.list-td/.list-name` en `text-xs`, lignes cliquables, filtres
    memorises en `sessionStorage` avec le flag d'hydratation en **state** (pas un ref).
  - **Detail en MODALE de lecture** (et non page `[id]`) : motif du cahier de texte, ou les pages
    de detail ont ete supprimees au profit de modales. Pièce jointe via **URL signee** 60 s, onglet
    ouvert **AVANT** l'attente (sinon bloque comme une fenetre surgissante — lecon de l'attestation).
  - **« Non transmise » en AMBRE, jamais en rouge** : la demande EST enregistree, c'est l'email qui
    manque. Le rouge dirait « perdue » et ferait reecrire pour rien.
  - **Titre de page** ajoute a `DashboardNav` (`/dashboard/support` → « Support technique ») ;
    **garde de role sur la page**, un ecran est atteignable par son adresse meme si le lien est masque.
- **Modale VERROUILLEE** (`FormModal`) : ni clic sur le fond, ni Echap. Une demande de support se
  redige parfois longuement, et dans l'agacement d'un probleme.
- **Visible pour `direction` + `admin` seulement** : un enseignant s'adresse a sa direction. Un
  canal ouvert a tous transformerait la boite du support en 2e niveau d'assistance interne.

#### 9 aout 2026 — PREMIER EMAIL REEL : deux defauts de fond dans le lien de reinitialisation

Le premier test de bout en bout (mot de passe oublie sur une ecole) a echoue trois fois de
suite, et chaque echec a revele un defaut different. Tous sont corriges ; le parcours passe.

**0. Le message d'erreur mentait, et empechait tout diagnostic.** `/auth/callback` renvoyait
`?error=invalid` dans TOUS les cas — refus de Supabase, jeton absent, echange refuse — et
l'ecran affichait « lien invalide ou expire ». Les parametres `error` / `error_code` /
`error_description` que Supabase renvoie **en clair** etaient jetes. Trois causes tres
differentes, un seul message, aucune action possible. **Corrige en premier, avant toute
hypothese** : trois motifs distingues (`consomme` / `echange` / `sans-jeton`), journalises,
et un message par cause qui dit QUOI FAIRE. C'est ce correctif qui a permis les deux suivants.
**Regle** : un ecran d'erreur qui ne distingue pas ses causes rend le defaut indebuggable.

**1. Le flux PKCE ne marche pas pour les liens fabriques cote SERVEUR.** PKCE exige un
verificateur pose en cookie **au moment de la demande** ; il n'existe que si le lien est
demande depuis un navigateur. Or nos liens naissent de **trois** endroits et **deux sont cote
serveur** : la console qui cree une ecole, et la fiche utilisateur. La, Supabase retombe sur le
flux **implicite** et renvoie la session dans le **FRAGMENT** (`#...`) — que le serveur ne
recoit jamais. Symptome : « ni code ni erreur ».
  - Le chemin serveur est precisement celui qui accueille le **directeur d'une ecole nouvelle**.
  - **Correctif** : le gabarit n'envoie plus `{{ .ConfirmationURL }}` mais un lien portant
    **`{{ .TokenHash }}`**, verifie par `verifyOtp`. **`token_hash` ne depend d'aucun cookie
    prealable** : il vaut pour les trois chemins.
  - **`{{ .RedirectTo }}` et non `{{ .SiteURL }}`** (que la doc Supabase emploie) : `.SiteURL`
    designe le domaine racine, c'est-a-dire la vitrine. `.RedirectTo` porte le sous-domaine de
    l'ecole. Consequence heureuse : changer l'adresse demandee par l'app suffit a rediriger
    l'email, **sans recoller le gabarit**.

**2. MICROSOFT SAFE LINKS BRULE LES JETONS A USAGE UNIQUE.** Revele par le lien lui-meme :
`emea01.safelinks.protection.outlook.com/?url=...`. Defender **reecrit chaque URL entrante et
la VISITE avant le destinataire** pour l'inspecter. Le jeton etait consomme au clic, sur un
message recu quelques secondes plus tot. C'est le risque consigne au README des gabarits le
8 aout ; il s'est manifeste au **premier** test reel — donc il n'est pas theorique.
  - **Parade** : un inspecteur **SUIT les liens, il ne soumet pas de formulaire**. La
    verification passe de GET a POST — `/auth/confirm` affiche un bouton et ne verifie qu'au
    vrai clic. Cout : un clic, explique a l'utilisateur. Sans elle, tout destinataire sur
    Microsoft 365 est incapable de definir son mot de passe.
  - **Regle** : ne jamais consommer un jeton a usage unique sur une requete GET.
  - `/auth/callback` conserve pour le flux navigateur (`code`).

**Verifie** : sondage de la route en production (aucun parametre → `sans-jeton` ; `token_hash`
bidon → `consomme` ; `type` invalide → `sans-jeton`) AVANT de faire refaire le test — le code
etait bien deploye, le probleme etait en amont. Puis parcours complet : email → confirmation →
nouveau mot de passe → notification « Mot de passe modifie » recue.

**Divers** : `next` n'est accepte que s'il est un chemin absolu simple (`//ailleurs.example`
en aurait fait un tremplin) ; `useFormStatus` doit vivre dans un composant **enfant** du
`<form>`, sinon il renvoie toujours « inactif ».

**Dette reperee** : tout le parcours d'authentification **sauf `/login`** est fige avant la
refonte du 3 aout — pastille « B », degrade, bouton **ambre** (variante abandonnee fin juillet),
et `forgot-password` porte encore l'illustration et les **points de pagination** que
l'utilisateur avait explicitement refuses. Trois ecrans a aligner : `forgot-password`,
`confirm`, `reset-password`.

#### 9 aout 2026 (suite) — Charte des ecrans auth, alerte de securite, coque d'email unique

**LES 7 ECRANS D'AUTHENTIFICATION** (`AuthShell` + `AuthBrandHeader`). La coque etait recopiee
**sept fois** et avait derive : quatre ecrans gardaient le degrade EN DUR `#507583 → #18aa99`
d'avant la refonte du 3 aout (donc insensible au theme), un n'avait pas de pied de page, et
**six affichaient une pastille « B » generique au lieu du logo de l'ECOLE**. Une seule etait
juste (`totp-challenge`) : elle est devenue le composant.
- **Le logo est celui de l'ECOLE.** Ces pages vivent sur son sous-domaine ; le commentaire du
  pied l'enonçait deja (« le haut appartient a l'etablissement, l'application se signe en bas »)
  — l'intention etait ecrite, l'en-tete ne la respectait pas.
- **Deux pieces et non une**, pour limiter le risque sur les ecrans 2FA en production :
  `AuthBrandHeader` (l'en-tete, ce qui manquait partout) et `AuthShell` (la coque complete, pour
  les 3 ecrans reellement casses). Les 4 ecrans 2FA n'ont reçu que l'en-tete.
- `forgot-password` perd l'illustration et les **points de pagination** que l'utilisateur avait
  explicitement refuses le 3 aout, et qui avaient survecu la. **302 lignes supprimees, 36 ajoutees.**

**CHANGEMENT D'EMAIL — deux defauts** (`updateOwnEmail`, `updateEmail`).
1. **`email_confirm: true` manquait.** Sans lui l'API admin ne change PAS l'adresse : elle ouvre
   un cycle de confirmation et tente d'envoyer le gabarit « Change email address », que nous
   n'avons pas ecrit → « Error updating user » opaque. **Mon affirmation du 8 aout (« l'API admin
   change sans confirmation ») etait fausse** : c'est vrai uniquement AVEC ce drapeau.
2. **L'ancienne adresse n'etait pas prevenue.** C'est LE controle en cas d'usurpation : qui prend
   la main sur une session change l'adresse pour verrouiller le compte, et le titulaire legitime
   ne reçoit plus rien a une adresse qu'il ne connait pas. **L'ancienne boite est le seul canal
   que l'attaquant ne controle pas.** La notification Supabase, pourtant activee, N'EST PAS PARTIE
   (le changement direct court-circuite le cycle) → l'application l'envoie elle-meme
   (`lib/auth/email-change-alert.ts`).
   - **NOTIFIER, NE PAS BLOQUER** : l'alerte part APRES un changement deja effectif et son echec
     ne le defait pas. Exiger une confirmation depuis l'ancienne adresse enfermerait precisement
     celui qui en a perdu l'acces — c'est souvent la raison meme du changement.
   - Echec d'envoi remonte en **ambre** et non en rouge : l'adresse EST modifiee.

**COQUE D'EMAIL UNIQUE** (`src/lib/email/shell.mjs`). Les 8 emails de l'app ecrivaient leur HTML
sur place, dont deux se signaient encore « Bilal Education · Notification automatique ».
- **Ecrit en `.mjs` et non `.ts`** : `build.mjs` est un script Node ordinaire, il ne peut pas
  importer du TypeScript ; le projet ayant `allowJs`, l'application l'importe sans difficulte.
  **Un fichier, deux consommateurs** (gabarits Supabase + code applicatif).
- **DEUX MARQUES, A NE PAS CONFONDRE** — c'est ce qui a decide de la conception :
  **editeur** (auth, alerte securite, support, test messagerie) vs **ECOLE** (relance, annonce,
  message staff, devoir, absence, paiement). Une famille traite avec son ecole ; le message part
  par le SMTP de l'ecole et son corps porte deja sa signature. Appliquer la meme coque partout
  aurait ete plus rapide et **faux**.
- **Regression introduite puis rattrapee** : la plaque blanche derriere le logo ne vaut que pour
  un logo d'ECOLE (souvent transparent). Le logo de l'editeur porte deja la sienne, a coins
  arrondis transparents — un fond blanc les remplissait, et Outlook (qui ignore `border-radius`)
  aurait affiche un carre. Trouvee en verifiant une phrase ecrite trop vite dans un commit.
  **Verifie par empreinte** : les 3 gabarits Supabase sont byte pour byte ceux qui y sont colles.
- **Piege repaye** : des accents graves dans un commentaire A L'INTERIEUR d'un gabarit de chaine
  le referment (deja rencontre sur le CSS de la page de connexion).

#### 9 aout 2026 (fin) — CHANTIER OUVERT : le cycle « Preparer l'annee suivante » est a revoir

Signale par l'utilisateur apres un essai reel. **Rien n'est corrige** : le diagnostic est
pose, la refonte reste entiere. C'est le cycle le plus lourd de l'application (audits,
archivage, purge) — il merite une etude, pas une rustine.

**LES QUATRE DEFAUTS CONSTATES**
1. **Aucune annulation.** `cloture/actions.ts` expose `startClosure`, `runAudit`, `closeStep`,
   `purgeYear`, `setPurgeIntent`, `reopenStep`, `archiveYear` — **rien pour abandonner**.
   `reopenStep` defait UNE etape, jamais le processus. Lance par megarde en cours d'annee,
   on ne peut plus revenir en arriere.
2. **Aucune confirmation au lancement.** `startClosure` cree la ligne `year_closure` et ses
   etapes **des le clic**. Un geste, et le processus existe.
3. **Reprise silencieuse d'une cloture ancienne.** `if (existing) return { closureId: existing.id }` :
   l'essai d'il y a plusieurs semaines vit toujours, et rouvrir le processus replace
   l'utilisateur ou il s'etait arrete — d'ou l'impression qu'il « cree tout de suite l'annee
   suivante ». Remettre les audits a zero ne remet PAS la cloture a zero.
4. **Mauvais emplacement.** Le point d'entree est enfoui dans la fiche Annee scolaire.
   **Decision utilisateur : ce doit etre une page a part, avec son entree de sidebar.**

**CORRECTION DU 9 AOUT — ma premiere piste etait FAUSSE.** J'avais propose de
n'autoriser la cloture que sur « une annee qui n'est plus l'annee en cours ».
C'est CIRCULAIRE, l'utilisateur l'a releve : une annee ne cesse d'etre en cours
QUE parce qu'on l'a cloturee et qu'on a active la suivante. On cloture donc bien
l'annee EN COURS.
  · La bonne distinction n'est pas *en cours / pas en cours* mais **terminee /
    encore en route**. Le garde-fou doit etre une DATE (`end_date` atteinte, ou
    proche) ou une declaration explicite de la direction — jamais un statut.
  · Corollaire : l'ANNULATION devient d'autant plus indispensable. Puisqu'on
    cloture l'annee en cours, on peut la lancer trop tot et devoir revenir en
    arriere — c'est exactement ce qui est arrive.
  · Reste valable : separer « ouvrir N+1 » (au printemps, sans audit) de
    « cloturer N » (l'ete, avec les audits). Ce sont deux moments differents,
    meme si les deux concernent l'annee en cours.

**CONCEPTION ARRETEE LE 9 AOUT — a construire telle quelle.**

**LE CHANGEMENT DE FOND : il n'y a PLUS DE « LANCEMENT ».** Les audits peuvent tourner a tout
moment, meme en septembre, pour connaitre l'etat des donnees saisies (decision utilisateur).
« Preparer l'annee suivante » cesse donc d'etre un processus qu'on demarre — c'etait la le
defaut : un clic creait un objet irreversible. A la place, une **page permanente** ou les six
audits sont relancables a volonte, comme un tableau de sante. Rien a demarrer, donc rien a
annuler. La cloture devient une **action terminale unique**, en bas de cette page.

1. **AUDITS LIBRES.** Ils lisent et affichent, rien d'autre. Relancer un audit remplace son
   resultat precedent : c'est ca, « annuler un audit ». Aucun enregistrement irreversible.
2. **CLOTURE REELLE** — bouton actif seulement si LES DEUX conditions sont reunies :
   (a) la **date de fin** de l'annee est atteinte ; (b) les **six audits** ont ete passes.
   Sinon refus explicite, en disant laquelle manque.
3. **UN SEUL POINT DE NON-RETOUR : LA PURGE.** Les audits ne touchent rien ; l'archivage
   s'annule (`reopenStep` supprime deja les instantanes). Tant que la purge n'a pas eu lieu,
   tout se defait.
4. **TRACE : `closed_at` (+ par qui) sur `school_years`**, et non seulement dans une table
   annexe — l'etat vit sur l'annee elle-meme. **A afficher dans la FICHE annee scolaire et en
   DERNIERE COLONNE de la liste.**
5. **ANNEE CLOSE = LECTURE SEULE**, mais **seulement si elle n'est plus l'annee en cours** :
   une annee peut etre close tout en restant courante jusqu'a l'activation de N+1. Chantier
   large (beaucoup d'ecrans) — a mesurer avant de s'y engager.
6. **EMPLACEMENT** : barre laterale, nouvelle section **« Cloture »** placee **juste au-dessus
   de Parametres**, menu **« Passage d'annee »**. Reserve a **admin et direction**, garde sur
   la PAGE et pas seulement sur le lien.
7. **N+1 SE CREE A LA MAIN** (« Ajouter »). Pas d'automatisation pour l'instant.
8. **`year_closure` a reduire** a ce qu'elle devient : le RESULTAT des audits + la date de
   cloture. Elle n'a plus a porter un « processus en cours ». Migration a prevoir.

#### 9 aout 2026 (fin, suite) — PASSAGE D'ANNEE reconstruit selon la conception ci-dessus

Les 8 points sont construits. **Migration `rework-year-closure-state.sql` A JOUER.**

**LE MODELE : l'etat quitte le processus et rejoint l'ANNEE.**
- **`school_years`** porte `closed_at` / `closed_by`, plus `archived_at`, `purged_at`,
  `purge_intent` qui vivaient dans l'en-tete. « Cette annee est close » est une propriete de
  l'annee : c'est ce qui permet de l'afficher dans sa fiche et dans la liste sans jointure.
- **`year_audits`** (nouvelle) remplace `year_closure_steps` : le DERNIER resultat de chaque
  audit, rattache a l'ANNEE et non a une cloture. **Ni `status`, ni verrouillage sequentiel,
  ni `order_index`** — l'ordre et le caractere bloquant vivent dans `src/lib/closure/steps.ts`,
  ce sont des regles, pas des donnees. Relancer un audit remplace sa ligne (upsert sur
  `(school_year_id, step_key)`) : c'est ca, « annuler un audit ».
- **`year_closure` et `year_closure_steps` SUPPRIMEES.** Videes de leur substance, elles
  n'auraient plus porte qu'une redondance. Drop **sans CASCADE** et **garde de non-vacuite** :
  la migration s'interrompt si une table contient encore des lignes (verifiees vides ici, mais
  un autre environnement pourrait porter une cloture reelle).
- **`purge_school_year` reecrite** : elle lisait `year_closure.archived_at` et y ecrivait
  `purged_at`. Trois passages changent, le corps destructif est repris a l'identique.

**LES RESULTATS D'AUDIT NE SONT PAS LA GARDE.** Ils servent l'ecran (afficher sans tout
recalculer) et prouvent que les six ont ete passes. `closeYear` **RE-AUDITE les six** a
l'instant du clic : un audit bloquant passe il y a un mois ne vaut rien, les donnees ont pu
changer. C'est cette passe fraiche qui decide, et elle reecrit les lignes au passage.

**Les actions** (`src/app/dashboard/passage-annee/actions.ts`, l'ancien dossier `cloture/`
est supprime) : `runAudit` · `closeYear` · **`reopenYear`** · `archiveYear` · `setPurgeIntent`
· `purgeYear`. **`startClosure` et `closeStep` n'existent plus** — il n'y a plus rien a
demarrer ni d'etape a fermer.
- **`closeYear`** — deux conditions, et elles se DISENT toutes les trois a l'ecran, y compris
  remplies (un bouton grise sans motif ne s'explique pas) : (1) `end_date` **depassee**
  (critere = une DATE, pas un statut : on cloture bien l'annee EN COURS, ce qui interdit de se
  fonder sur « n'est plus l'annee en cours », elle ne cesse de l'etre qu'apres) ; (2) les six
  audits passes ; (3) aucune anomalie bloquante.
- **`reopenYear`** — la cloture se defait tant que la PURGE n'a pas eu lieu. Elle **supprime
  les instantanes** (`student_year_history`, `family_year_finance`) : garder un historique fige
  au-dessus de donnees redevenues vivantes le rendrait faux. Refusee apres purge.

**L'ecran** (`/dashboard/passage-annee`, section **« Cloture »** de la sidebar placee
**au-dessus de Parametres**, admin/direction, **garde sur la PAGE** et pas seulement sur le
lien) : bandeau d'etat de l'annee, les six audits en liste (badge Bloquant/Avertissement,
resume, horodatage, detail deroulant avec lien « Corriger »), bouton **« Tout auditer »**,
puis la carte de cloture avec ses trois conditions. Une fois close : archivage, choix
d'epuration, et « Annuler la cloture ».
- **Rappel « Annees closes non archivees »** en bas : sans lui, une annee cloturee **puis**
  remplacee par N+1 n'aurait plus aucun ecran d'ou lancer son archivage — et sans archivage,
  pas de purge. Cloture et bascule sont deux actes independants, le trou etait reel.

**La trace** : colonne **« Cloture »** en avant-derniere position de la liste des annees
(Purgee > Archivee > Close, infobulle datee) et bandeau turquoise en tete de la fiche annee,
avec l'auteur et un lien vers l'ecran de passage.

**ENCHAINEMENT DES BOUTONS : Auditer → Reinitialiser → Auditer** (choix utilisateur). Plus de
« Relancer » qui remplace un resultat sans qu'on l'ait vu partir, et **plus de « Tout auditer »** :
les audits se lancent un par un, pour qu'on lise chacun avant de passer au suivant. Nouvelle
action `resetAudit` (supprime la ligne `year_audits` ; `.select()` apres le DELETE, une
suppression bloquee par la RLS ne leve pas d'erreur, elle supprime 0 ligne). Pas de confirmation :
on n'efface qu'un resultat calcule, reproductible en un clic. **Consequence coherente** :
reinitialiser retire un prerequis de cloture, c'est ainsi qu'on dit « celui-ci est a reverifier ».

**DEPENDANCE ENTRE AUDITS : affichee, JAMAIS imposee** (arbitrage utilisateur, apres hesitation).
La dependance est reelle et part des **affectations** : un eleve sans classe n'a ni evaluation, ni
absence, ni bulletin, ni cotisation facturee. Auditer « Notes » avant d'avoir corrige les
affectations peut donc afficher **zero anomalie** et donner un **FAUX FEU VERT**, jusqu'a ce que
les eleves affectes fassent apparaitre d'un coup leurs notes manquantes.
- Verrouiller la sequence a ete **ecarte** : c'etait le defaut de l'ancien modele, et cela
  retirerait a l'ecran sa raison d'etre (consulter n'importe quel domaine a tout moment).
- Retenu : tant qu'un audit **bloquant** amont remonte des anomalies, les audits qui en dependent
  affichent « Depend de X, qui remonte encore des anomalies » et leur resultat passe en grise avec
  la mention **« a reverifier »** (jamais en vert). L'audit reste lançable.

**POINT 5 (lecture seule) : RIEN A CONSTRUIRE, la garantie tient deja.** Mesure faite avant
d'ecrire quoi que ce soit : **les 30 ecrans operationnels epinglent tous `is_current = true`**
— une annee non courante n'est atteignable depuis aucun module, et la fiche annee est deja en
lecture seule dans ce cas (19 juillet). Une annee close **encore courante** reste modifiable,
conformement a la decision. **Fragilite a connaitre** : la garantie est structurelle, pas
declaree — le jour ou un ecran offrira un selecteur d'annee, elle tombera **en silence**. Une
garde en base serait la seule protection durable ; surface trop large pour aujourd'hui.

## Prochaine etape

> **MISE EN PRODUCTION EN COURS** — le plan de suivi vit dans `MISE_EN_PRODUCTION.md`
> (racine). Document de travail a cocher, a supprimer une fois la production stable.
> Modele retenu : editeur logiciel, abonnement par etablissement, un sous-domaine par
> ecole, deploiement et base uniques.
>
> **MESSAGERIE (phase 5) — LE CIRCUIT D'AUTHENTIFICATION FONCTIONNE** (9 aout).
> Boite `contact@` + alias `superadmin@` chez Infomaniak, MX/SPF/DKIM/DMARC publies dans
> Vercel et **verifies a la source**, SMTP du projet Supabase branche, 3 gabarits colles,
> 2 notifications de securite activees. **Premier email reel envoye et reçu**, parcours
> complet : mot de passe oublie → email → page de confirmation → nouveau mot de passe →
> notification « Mot de passe modifie ».
>
> **AU PROCHAIN DEMARRAGE (decide le 9 aout au soir) : LA MESSAGERIE DE L'ECOLE.**
> C'est le circuit 2, **jamais eprouve** — distinct de l'authentification, qui elle fonctionne.
> L'ecran EXISTE deja (`Parametres → Etablissement → Messagerie`, construit le 15 juillet :
> table `etablissement_smtp` en regime serveur uniquement, secret jamais renvoye au navigateur,
> bouton « Tester la connexion » qui va jusqu'a l'envoi reel). Il n'a simplement jamais servi.
> Renseigner le SMTP de la premiere ecole, tester la connexion, puis **un envoi reel de chaque** :
> devoir, relance, message aux parents, message au staff. C'est aussi le premier test des
> gabarits a la marque de l'ECOLE, **jamais vus a l'ecran** — surtout le rendu d'un logo
> transparent sur le bandeau teal.
>
> **Verifications courtes a glisser dans la foulee :**
> 1. **Utilisateur** — dans l'en-tete d'un email reçu, les 3 lignes `SPF` / `DKIM` / `DMARC`.
>    Toujours pas verifiees. Elles diront si le classement en indesirables tient a la seule
>    reputation d'un domaine neuf (attendu) ou a autre chose. Marquer « non indesirable »
>    dans Outlook au passage.
> 2. **A l'ecran** — les 7 ecrans d'authentification refondus le 9 aout, notamment le repli
>    en INITIALES quand une ecole n'a pas de logo.
>
> **PUIS le circuit 2, jamais eprouve : les COMMUNICATIONS D'ECOLE.**
> 3. **Ensemble** — configurer le SMTP de la PREMIERE ECOLE dans sa fiche (circuit DISTINCT
>    de l'authentification), puis **un envoi reel de chaque** : devoir, relance, message aux
>    parents, message au staff. C'est aussi le premier test des gabarits a la marque de
>    l'ECOLE, **jamais vus a l'ecran** — surtout le rendu d'un logo transparent sur le
>    bandeau teal.
> 4. **Utilisateur** — DMARC de `p=none` vers `quarantine` puis `reject`, **seulement** quand
>    les rapports arrivent sur `contact@` et montrent 100 % du legitime aligne. Infomaniak
>    affichera un avertissement ambre entre-temps : **ne pas le suivre**.
>
> **Restent ensuite** : montee en charge progressive (un domaine neuf qui emet 300 messages
> d'un coup s'installe dans les indesirables), procedure de configuration SMTP a remettre aux
> ecoles, enrolement TOTP des comptes restants, et un compte de CHAQUE ROLE a eprouver depuis
> la passe RLS du 5 aout (une policy trop stricte ne leve pas d'erreur : elle vide l'ecran).
>
> **Idee en attente** : liste des demandes de support dans la console de l'editeur. La table
> `support_requests` existe et se lit ; aujourd'hui elles n'arrivent que par email.
>
> **Phase 4 bis (console super-admin) : TERMINEE le 7 aout** — securite, charte et ajouts.

> **Rappel de l'ancien programme, desormais fait : phase 4 bis, console super-admin.** Audit fait le 6 aout,
> **rien de corrige**. Bloc 1 (securite) en premier — la console **n'exige aucune 2FA**
> (double cause : la branche du sous-domaine sort du middleware avant le controle, et ce
> controle est limite a `/dashboard`) ; boucle de redirection infinie pour tout compte non
> super-admin ; `createTenantUser` n'ecrit pas `app_metadata` (donc 2FA contournee pour les
> comptes crees depuis la console) ; `updateTenantUser` non cloisonnee ; aucune action
> tracee. **Et une regression a moi** : les 8 actions de `superadmin/actions.ts` utilisent
> `requireRoleServer(['super_admin'])`, qui compare le role EFFECTIF — donc `admin` pendant
> une intervention : **plus aucune action de la console ne passe une fois entre dans une
> ecole**. Elles doivent utiliser `requireEditor()` (colonne brute), comme `support-actions.ts`.
> Puis bloc 2 (charte : la console n'a suivi AUCUNE passe de refonte) et bloc 3 (ajouts).

- **Passe theme sombre / ergonomie : TERMINEE** — les 5 sections de la sidebar sont traitees, plus une passe
  globale (toasts, modales sans `role="dialog"`, couverture du pont). Reste la verification A L'ECRAN.
- **Repliquer le controle de doublon** (server action + accents + index unique) sur **apprenants et parents** :
  ils utilisent encore le motif client-only avec `ilike`. `norm_name()` (SQL) et `normalize-name.ts` sont prets.
- **Multi-etablissement : TERMINE le 5 aout** (RLS + middleware + comptes auth + routes de
  notification + les 2 `.single()`). Reste a valider a l'ecran, notamment l'enrolement TOTP qui
  redevient obligatoire pour 7 comptes.
- **Tester un compte de CHAQUE ROLE** apres la passe RLS du 5 aout : une policy trop stricte ne
  leve pas d'erreur, elle renvoie zero ligne et l'ecran se vide en silence.
- **Inscription unique par eleve** : la regle metier (« un eleve, une classe a la fois ») n'est **pas
  imposee en base** — aucun index unique sur `enrollments`. Un index partiel sur `student_id`
  `WHERE status = 'active'` la rendrait impossible plutot qu'improbable. A arbitrer.
- **Choix de police LATINE** : reste a faire (les pages de test arabe/connexion ont ete supprimees).
- Suivi : `DROP COLUMN file_url` sur `bulletin_archives` une fois le nouveau flux confirme.
- **Chantier « passage d'annee »** (a concevoir) : archivage complet des donnees importantes a conserver,
  puis **reset table par table** pour repartir sur une nouvelle annee — objectif : garder la **BDD la plus
  legere possible**. Voir memoire `year-rollover-archiving`.
- **Financements** : 3 sous-menus audites. Reste l'arbitrage `.list-th-compact`.
- **Verifier visuellement** la passe de lisibilite module par module (surtout les etats inactifs
  et les modales).
- **Communications** : configurer la messagerie + **tester un envoi reel** (parents ET staff, les 3 canaux).
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
- [x] **Duree de validite des liens auth** verifiee le 8 aout (Supabase → Auth → *Email OTP
  expiration*) : **10 minutes**, et non 1 h. Les liens de reinitialisation sont a **usage unique**.
  Le gabarit annonce desormais la bonne duree (constante `VALIDITE`). **Reserve** : 10 min est
  tres court pour le directeur d'une ecole nouvelle, qui ouvre sa boite quand il peut — arbitrage
  securite / friction a trancher, voir `supabase/email-templates/README.md`.

## Actions SQL en attente
- [ ] **A JOUER** — `supabase/migrations/rework-year-closure-state.sql` (passage d'annee :
  `closed_at`/`closed_by`/`archived_at`/`purged_at`/`purge_intent` sur `school_years`, nouvelle
  table `year_audits`, `purge_school_year` reecrite, suppression gardee de `year_closure` et
  `year_closure_steps`). **Sans elle, l'ecran « Passage d'annee » affiche zero audit et la
  cloture echoue.**
- [ ] **A JOUER** — `supabase/migrations/create-support-requests.sql` (table `support_requests` +
  RLS « depot et relecture par la direction, ni modification ni suppression » + bucket prive
  `support-attachments` 1 Mo cloisonne). **Sans elle, l'ecran « Contacter le support » echoue.**
- [x] Executer `supabase/migrations/add-etablissements-sante-rpc.sql` (sante des ecoles en UN
  appel au lieu de 3 requetes par ecole ; derniere connexion et messagerie configuree ;
  execution retiree aux roles de l API).
- [x] Executer `supabase/migrations/create-support-interventions.sql` (journal des interventions
  cote EDITEUR + expiration 4 h ; regime serveur uniquement). **Verifie sur 5 cas.**
- [x] Executer `supabase/migrations/move-etablissement-notes-to-editor-table.sql` (les notes
  internes de l'editeur quittent `etablissements`, dont la ligne est lisible par TOUS les comptes
  de l'ecole ; table `etablissement_notes` en regime serveur uniquement). **Verifie** : lecture
  refusee 42501, colonne absente 42703.
- [x] Executer `supabase/migrations/fix-audit-log-old-role-reference.sql` (**URGENT** : la garde
  ajoutee la veille citait `OLD.role`, or PL/pgSQL compile l'expression ENTIERE — 37 des 38 tables
  auditees n'ont pas cette colonne, **toute ecriture echouait en 42703**). **Verifie sur 6 cas.**
- [x] Executer `supabase/migrations/add-superadmin-support-access.sql` (`get_user_role()` repond
  `admin` quand le super-admin est rattache ; repli OLD dans `fn_audit_log` sans quoi le detachement
  est impossible). **Verifie** : cycle rattachement/detachement complet.
- [x] Executer `supabase/migrations/harden-profile-role-escalation.sql` (**escalade demontree** : un
  admin d'ecole pouvait se promouvoir `super_admin` et atteindre tous les clients ; `super_admin` et
  `etablissement_id` deviennent service-role uniquement). **Verifie sur 5 cas.**
- [x] Executer `supabase/migrations/fix-audit-log-description.sql` (colonne `description` manquante
  → les 32 `logAudit` de l'app n'ecrivaient RIEN ; rattachement de support non audite ; trace
  abandonnee au lieu de faire echouer l'ecriture quand aucun etablissement n'est identifiable).
  **Verifie en base** sur 4 cas.
- [x] Executer `supabase/migrations/add-etablissement-length-limits.sql` (nom 30 / adresse 80,
  longueurs mesurees sur l'en-tete des PDF ; double la validation du formulaire, qui ecrit directement
  depuis le navigateur).
- [x] Executer `supabase/migrations/harden-security-definer-functions.sql` (`get_user_role()` STABLE
  + `search_path` fixe ; definitions des 2 fonctions de RLS versees dans le depot).
- [x] Executer `supabase/migrations/add-role-checks-to-core-rls.sql` (controle de ROLE ajoute aux
  8 tables centrales + fonctions de perimetre enseignant). **Verifie** : 16 policies, 2 par table.
- [x] Executer `supabase/migrations/drop-dead-tables-payments-schedules.sql` (tables vides et sans
  chemin d'ecriture).
- [x] Executer `supabase/migrations/fix-teacher-delete-and-referentiel-rls.sql` (DELETE enseignant
  reserve admin/direction ; referentiel cloisonne par etablissement et ouvert en lecture au staff).
  **Verifie** : teachers = 4 policies (1 par commande), referentiel = 2 par table.

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
- [x] Executer `supabase/migrations/rework-communications-security.sql` (type d'annonce controle en RLS,
  bucket PJ prive 1 Mo cloisonne par etablissement, `file_url` → `file_path` NOT NULL, statut `skipped`).
- [x] Executer `supabase/migrations/add-etablissement-smtp.sql` (table `etablissement_smtp` : config SMTP par
  etablissement, RLS sans policy + privileges revoques = serveur uniquement).
- [x] Executer `supabase/migrations/create-financement-communications.sql` (historique relance/attestation).
- [x] Executer `supabase/migrations/add-teacher-document-category-cv.sql` (categorie « CV » ; le CHECK etait ferme).
- [x] Executer `supabase/migrations/add-teachers-unique-name.sql` (`norm_name()` IMMUTABLE + index unique
  nom+prenom par etablissement ; 0 doublon existant verifie avant).
- [x] Executer `supabase/migrations/guard-presence-type-delete.sql` (trigger refusant la suppression d'un
  type de presence utilise dans les saisies de temps de son annee).
- [x] Executer `supabase/migrations/add-financement-communications-delete.sql` (policy `fin_comm_delete` :
  suppression du journal comptable ouverte aux roles finance ; verifiee en base par `pg_policies`).
- [x] Executer `supabase/migrations/secure-financements-situation.sql` (RLS finance sur `expenses`/
  `other_revenues`, bucket `documents-expenses` prive 2 Mo cloisonne, `document_url` → `document_path`).
  **Verifie en base** : bucket `public: false` / 2 Mo / 4 types, `document_path` presente, `document_url` absente,
  0 orphelin. NB : le menage des objets Storage s'est fait par l'**API** (DELETE SQL interdit, 42501).
