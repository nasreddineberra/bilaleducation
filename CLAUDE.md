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

## Stack technique

- **Framework** : Next.js 15 (App Router, Server + Client Components)
- **Base de donnees** : Supabase (PostgreSQL + Row Level Security)
- **Styles** : Tailwind CSS (palette turquoise #18aa99 / orange #f97316)
- **Editeur riche** : TipTap
- **PDF** : jsPDF
- **Drag & Drop** : dnd-kit
- **Notifications push** : web-push + nodemailer (emails)
- **Dates** : date-fns

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
- [ ] **Executer `supabase/migrations/add-school-year-to-presence-types.sql`** (colonne `school_year_id`
  + backfill + unicite `(etablissement, annee, code)` + NOT NULL). **Prerequis** : sans elle, les pages
  Types de presence / Cotisations / Temps de presence / Financements plantent.
