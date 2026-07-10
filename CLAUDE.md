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

## Prochaine etape
- Poursuite des **fonctionnalites utilisateurs**.

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
