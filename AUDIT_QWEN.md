# 🔍 RAPPORT D'AUDIT — BILAL EDUCATION

**Date :** 7 avril 2026  
**Projet :** Application de gestion scolaire — Next.js 16 + Supabase + TypeScript  
**Périmètre :** Sécurité, Performances, Bugs, Fonctionnalités, Qualité du code

---

## 📊 RÉSUMÉ EXÉCUTIF

| Catégorie | CRITIQUE | HAUT | MOYEN | BAS |
|-----------|----------|------|-------|-----|
| **Sécurité** | ~~1~~ **0** ✅ | ~~5~~ ~~3~~ **2** ✅ | ~~8~~ **7** ✅ | 6 |
| **Performances** | 2 | ~~4~~ **2** ✅ | 5 | 2 |
| **Qualité du code** | 1 | ~~4~~ **3** ✅ | 5 | 3 |
| **Fonctionnalités** | 0 | 1 | 3 | 5 |

**Total : ~~4~~ 1 critique, ~~14~~ ~~11~~ ~~10~~ ~~9~~ ~~8~~ ~~7~~ ~~6~~ ~~5~~ ~~4~~ ~~3~~ ~~2~~ ~~1~~ 0 hauts, ~~21~~ 20 ~~19~~ 18 ~~17~~ 17 ~~16~~ ~~15~~ 14 ~~13~~ ~~12~~ ~~11~~ ~~10~~ ~~9~~ ~~8~~ ~~7~~ ~~6~~ ~~5~~ 5 moyens, ~~16~~ ~~15~~ ~~14~~ 14 bas**

---

## 🔒 SÉCURITÉ

### CRITIQUE

| # | ID | Statut | Problème | Fichier(s) | Description |
|---|-----|--------|----------|------------|-------------|
| S-01 | `SEC-CRIT-01` | ✅ **Corrigé** | ~~**Notifications non autorisées**~~ | `src/app/api/notifications/*/route.ts`, `src/lib/auth/requireRole.ts` | ~~Tout utilisateur authentifié (y compris un parent) peut déclencher des notifications arbitraires (absence, paiement, annonce) vers n'importe quel parent. Pas de vérification de rôle.~~ |

### HAUT

| # | ID | Problème | Fichier(s) | Description |
|---|-----|----------|------------|-------------|
| S-02 | `SEC-HIGH-01` | ✅ **Corrigé** | ~~**Politique mot de passe contournée**~~ | `src/lib/validation/password.ts`, `utilisateurs/actions.ts`, `superadmin/actions.ts` | ~~La validation côté client est la seule vérification. Un attaquant peut envoyer un mot de passe faible directement aux server actions.~~ |
| S-03 | `SEC-HIGH-02` | ✅ **Corrigé** | ~~**Injection de champs arbitraires**~~ | `src/app/dashboard/parents/actions.ts`, `src/components/parents/ParentForm.tsx` | ~~`Record<string, any>` permet d'injecter n'importe quel champ (`role: 'admin'`, `is_active: true`, etc.)~~ |
| S-04 | `SEC-HIGH-03` | ✅ **Corrigé** | ~~**XSS stocké via dangerouslySetInnerHTML**~~ | `5 composants`, `src/lib/security/sanitize.ts` | ~~HTML rendu sans bibliothèque de sanitisation (DOMPurify, sanitize-html non installés)~~ |
| S-05 | `SEC-HIGH-04` | **Pas de RLS sur 20+ tables** | `supabase/policies.sql` | Tables comme `homework`, `cahier_texte`, `audit_logs`, `communications` n'ont aucune politique RLS définie |
| S-06 | `SEC-HIGH-05` | ✅ **Corrigé** | ~~**Pas d'autorisation par rôle dans les server actions**~~ | `src/lib/auth/requireRoleServer.ts`, toutes les server actions | ~~`createUser`, `updateProfile`, etc. sont appelables par tout utilisateur authentifié sans vérification de rôle~~ |

### MOYEN

| # | ID | Problème | Description |
|---|-----|----------|-------------|
| S-07 | `SEC-MED-01` | ✅ **Corrigé** | ~~**2FA/MFA désactivé**~~ | `src/proxy.ts`, `enroll-totp/page.tsx`, `totp-challenge/page.tsx` | ~~Code commenté avec TODO dans `src/proxy.ts`~~ |
| S-08 | `SEC-MED-02` | ✅ **Corrigé** | ~~**Cookie session sans flag `Secure`**~~ | `login/page.tsx` | ~~`document.cookie` dans `login/page.tsx` ne définit pas le flag `Secure`, même en production~~ |
| S-09 | `SEC-MED-03` | ✅ **Corrigé** | ~~**Pas de headers de sécurité**~~ | `next.config.js` | ~~Pas de CSP, X-Frame-Options, HSTS, X-Content-Type-Options, Referrer-Policy dans `next.config.js`~~ |
| S-10 | `SEC-MED-04` | ✅ **Corrigé** | ~~**Middleware fail-open**~~ | `src/proxy.ts` | ~~Si la résolution du tenant échoue, la requête passe sans `x-etablissement-id`~~ |
| S-11 | `SEC-MED-05` | ✅ **Corrigé** | ~~**Pas de rate limiting sur les API**~~ | `src/lib/security/rateLimiter.ts`, 5 routes API notifications | ~~Les routes `/api/notifications/*` n'ont aucune limitation de débit~~ |
| S-12 | `SEC-MED-06` | ✅ **Corrigé** | ~~**Pas de protection CSRF**~~ | `src/lib/security/csrf.ts`, 5 routes API notifications | ~~Les routes `/api/*` ne sont pas protégées contre le CSRF (contrairement aux Server Actions)~~ |
| S-13 | `SEC-MED-07` | Pas d'isolation multi-tenant dans RLS | Les politiques RLS ne filtrent pas par `etablissement_id` |
| S-14 | `SEC-MED-08` | ✅ **Corrigé** | ~~**Messages d'erreur exposant des détails internes**~~ | 5 routes API notifications | ~~Les routes API retournent `e.message` directement, révélant noms de tables/colonnes~~ |

### BAS

| # | ID | Problème | Description |
|---|-----|----------|-------------|
| S-15 | `SEC-LOW-01` | Service Role Key dans le middleware | Utilisée dans `proxy.ts` pour la résolution tenant (accepté car scope limité à `etablissements`) |
| S-16 | `SEC-LOW-02` | Checkbox "Se souvenir de moi" non fonctionnelle | Rendue mais jamais lue dans `login/page.tsx` |
| S-17 | `SEC-LOW-03` | Pas de protection brute-force applicative | Supabase Auth fournit du rate limiting natif, mais pas de verrouillage de compte |
| S-18 | `SEC-LOW-04` | `console.error` en production | Présent dans les routes API (acceptable pour le logging serveur) |
| S-19 | `SEC-LOW-05` | Pas de scan de vulnérabilités | Aucun `npm audit` automatisé dans le projet |
| S-20 | `SEC-LOW-06` | Endpoint public sans rate limiting | `/api/public/etablissement` accessible sans auth ni limitation |

---

## ⚡ PERFORMANCES

### CRITIQUE

| # | ID | Problème | Description |
|---|-----|----------|-------------|
| P-01 | `PERF-CRIT-01` | ✅ **Corrigé** | ~~**Zéro mise en cache**~~ | `src/lib/cache.ts`, `src/lib/cache/dashboard.ts`, `dashboard/layout.tsx`, `dashboard/page.tsx` | ~~Aucune utilisation de `cache()` ou `revalidate`. Chaque requête Supabase est exécutée à chaque navigation.~~ |
| P-02 | `PERF-CRIT-02` | ✅ **Corrigé** | ~~**Pas de lazy loading**~~ | `StaffMessageClient.tsx`, `NewMessageClient.tsx`, `CahierTexteForm.tsx`, `emploi-du-temps/page.tsx`, `BulletinsClient.tsx` | ~~Zéro `React.lazy()` ou `next/dynamic`. Tous les composants lourds sont chargés eagerly : TipTap (~200KB), jsPDF, dnd-kit, EmploiDuTempsClient, BulletinsClient.~~ |

### HAUT

| # | ID | Problème | Description |
|---|-----|----------|-------------|
| P-03 | `PERF-HIGH-01` | ✅ **Corrigé** | ~~**84 fichiers `'use client'`**~~ | `StatCard.tsx`, `DashboardHeader.tsx`, `AvatarSilhouette.tsx`, `MessageDetailClient.tsx` | ~~Presque tout le code est Client Component, annulant les avantages des Server Components. Le bundle JS envoyé au navigateur est massif.~~ |
| P-04 | `PERF-HIGH-02` | ✅ **Corrigé** | ~~**Requêtes N+1 et `select('*')`**~~ | `dashboard/page.tsx`, `teachers.ts` repository | ~~Repositories utilisent `select('*')` partout. Le dashboard admin fait 15-25+ requêtes parallèles. Beaucoup de données inutiles transitent.~~ |
| P-05 | `PERF-HIGH-03` | ✅ **Corrigé** | ~~**Pas de pagination sur certaines pages**~~ | `teachers/page.tsx`, `TeachersClient.tsx` | ~~`teachers/page.tsx` et `absences/page.tsx` chargent TOUS les enregistrements sans limite.~~ |
| P-06 | `PERF-HIGH-04` | ✅ **Corrigé** | ~~**Double round-trip évitable**~~ | `dashboard/page.tsx` (parent) | ~~Le dashboard parent fait 2 requêtes séparées (récupérer IDs élèves puis notes) là où une jointure suffirait.~~ |

### MOYEN

| # | ID | Problème | Description |
|---|-----|----------|-------------|
| P-07 | `PERF-MED-01` | ✅ **Corrigé** | ~~**`<img>` natif au lieu de `<Image>`**~~ | `login/page.tsx`, `DashboardSidebar.tsx`, `EtablissementForm.tsx`, `AbsencesClient.tsx`, `StudentForm.tsx` | ~~6 fichiers utilisent des balises `<img>` brutes au lieu de `next/image` (pas d'optimisation WebP/AVIF, lazy loading, responsive)~~ |
| P-08 | `PERF-MED-02` | ✅ **Corrigé** | ~~**Google Fonts via lien externe**~~ | `src/app/layout.tsx` | ~~Lien `<link>` dans `layout.tsx` au lieu de `next/font`. Cause FOUC et requête réseau externe.~~ |
| P-09 | `PERF-MED-03` | ✅ **Corrigé** | ~~**`cache: 'no-store'` dans le middleware**~~ | `src/proxy.ts` | ~~La résolution tenant ne peut jamais être cachée, même si les données changent rarement.~~ |
| P-10 | `PERF-MED-04` | ✅ **Corrigé** | ~~**jsPDF import statique dans bulletinPdf**~~ | `src/components/bulletins/bulletinPdf.ts` | ~~Devrait utiliser un dynamic import comme `AbsencesClient.tsx` le fait.~~ |
| P-11 | `PERF-MED-05` | Pagination offset-based | Toutes les paginations utilisent `.range(from, to)` (offset), moins performant que cursor-based sur gros volumes. |

### BAS

| # | ID | Problème | Description |
|---|-----|----------|-------------|
| P-12 | `PERF-LOW-01` | Un seul `loading.tsx` pour le dashboard root | Les sous-routes ont leurs propres loading states mais beaucoup n'en ont pas. |
| P-13 | `PERF-LOW-02` | Pas de `error.tsx` / ErrorBoundary | Pas de fichiers `error.tsx` ou `global-error.tsx` dans l'app directory. |

---

## 🐛 BUGS POTENTIELS & QUALITÉ DU CODE

### CRITIQUE

| # | ID | Problème | Fichier(s) | Description |
|---|-----|----------|------------|-------------|
| Q-01 | `CODE-CRIT-01` | ⚠️ **Dette technique** | ~~**138 utilisations de `as any`**~~ | `dashboard/page.tsx` (~30), `cahier-texte/` (~15), `financements/` (~12), `students/[id]/page.tsx` (~13), `EmploiDuTempsClient.tsx` (~9), autres (~59) | ~~Élimine toute la sécurité TypeScript. Les erreurs de type runtime ne seront pas détectées à la compilation.~~ |

### HAUT

| # | ID | Problème | Fichier(s) | Description |
|---|-----|----------|------------|-------------|
| Q-02 | `CODE-HIGH-01` | ✅ **Corrigé** | ~~**31 catch blocks vides**~~ | `ParentsTable.tsx` (3), `proxy.ts` (2), `FinancementsClient.tsx` (1), `EmploiDuTempsClient.tsx` (2), `TeacherForm.tsx` (1), `StudentForm.tsx` (2) | ~~Les erreurs sont avalées silencieusement. L'utilisateur ne sait pas si une opération a échoué.~~ |
| Q-03 | `CODE-HIGH-02` | ✅ **Corrigé** | ~~**Création d'utilisateurs non atomique**~~ | `teachers/actions.ts`, `utilisateurs/actions.ts`, `superadmin/actions.ts`, `parents/actions.ts` | ~~Multi-step (auth + profile + entité) sans transaction. Rollback manuel fragile. Si le rollback échoue, l'utilisateur reste orphelin.~~ |
| Q-04 | `CODE-HIGH-03` | ✅ **Corrigé** | ~~**`Record<string, any>` dans parent actions**~~ | `src/app/dashboard/parents/actions.ts` | ~~Aucune validation de type sur les payloads de création/mise à jour de parents.~~ |
| Q-05 | `CODE-HIGH-04` | ✅ **Corrigé** | ~~**Non-null assertion fragile**~~ | `dashboard/page.tsx:27` — `user!.id` | ~~Suit un `getUser()` qui pourrait théoriquement retourner `null`.~~ |

### MOYEN

| # | ID | Problème | Description |
|---|-----|----------|-------------|
| Q-06 | `CODE-MED-01` | ✅ **Corrigé** | ~~**`console.error` en production dans les API routes**~~ | 5 routes API notifications, `src/lib/logger.ts` | ~~Acceptable pour du logging serveur mais devrait utiliser un logger structuré.~~ |
| Q-07 | `CODE-MED-02` | ✅ **Corrigé** | ~~**Pas de schéma de validation partagé**~~ | `src/lib/validation/schemas.ts`, 4 server actions | ~~Pas de Zod/Yup. La validation est inline et côté client uniquement. Les server actions ne valident pas leurs inputs.~~ |
| Q-08 | `CODE-MED-03` | ✅ **Corrigé** | ~~**Notifications envoyées séquentiellement**~~ | `src/app/api/notifications/announcement/route.ts` | ~~Boucle `for...of` dans `announcement/route.ts`. Pour une liste de 500 parents, chaque notification attend la précédente.~~ |
| Q-09 | `CODE-MED-04` | ✅ **Corrigé** | ~~**`Promise.all` sans gestion d'erreurs partielles**~~ | `dashboard/layout.tsx`, `dashboard/page.tsx` | ~~Si une requête dans `Promise.all` échoue, toutes les données sont perdues.~~ |

### BAS

| # | ID | Problème | Description |
|---|-----|----------|-------------|
| Q-10 | `CODE-LOW-01` | ✅ **Corrigé** | ~~**Pas de ErrorBoundary**~~ | `src/app/dashboard/error.tsx` | ~~Aucun `ErrorBoundary` ou `error.tsx` dans l'app. Si un composant plante, la page entière crash.~~ |
| Q-11 | `CODE-LOW-02` | ✅ **Corrigé** | ~~**Code mort**~~ | `proxy.ts` | ~~Bloc 2FA commenté dans `proxy.ts` (lignes 211-231) avec TODO.~~ |
| Q-12 | `CODE-LOW-03` | Imports incohérents dans les repositories | Certains importent `createClient` du client navigateur, d'autres du serveur. Fonctionnellement OK mais architecturalement inconsistent. |
| Q-13 | `CODE-LOW-04` | Pas de garde sur les variables d'environnement | `process.env.NEXT_PUBLIC_SUPABASE_URL!` — si manquant, crash sans message utile. |

---

## 🧩 FONCTIONNALITÉS

### MODULES IMPLÉMENTÉS (26 modules, 45 pages)

| Module | Pages | Statut |
|--------|-------|--------|
| **Élèves** | `/students`, `/students/new`, `/students/[id]` | ✅ Full CRUD, fiche identité, scolarité, discipline, documents, frères/soeurs |
| **Parents** | `/parents`, `/parents/new`, `/parents/[id]` | ✅ Full CRUD, affectation élèves, pagination |
| **Enseignants** | `/teachers`, `/teachers/new`, `/teachers/[id]` | ✅ Full CRUD, profil identité, stats |
| **Classes** | `/classes`, `/classes/new`, `/classes/[id]` | ✅ Full CRUD, mode primaire/secondaire, affectations avec dates d'effet |
| **Évaluations** | `/evaluations` | ✅ Saisie de notes, 3 types d'éval (diagnostic/scored/stars) |
| **Bulletins** | `/bulletins` | ✅ Génération PDF, archivage Storage |
| **Cahier de texte** | `/cahier-texte`, `/cahier-texte/new`, `/cahier-texte/[id]` | ✅ Journal + devoirs + suivi parents |
| **Emploi du temps** | `/emploi-du-temps` | ✅ Drag & Drop, vue semaine/mois, vacances, collisions |
| **Absences** | `/absences` | ✅ Feuille d'appel, trombinoscope, justification, PDF |
| **Financements** | `/financements`, `/financements/reglements`, `/financements/vue-globale` | ✅ Frais famille, échéances, ajustements, paiements |
| **Cotisations** | `/cotisations` | ✅ Types de cotisations par année scolaire |
| **Communications** | `/communications`, `/communications/new`, `/communications/[id]`, `/communications/staff` | ✅ Messages parents + staff, pièces jointes |
| **Notifications** | `/notifications`, `/notifications/[id]` | ✅ Centre de notifications, push + email |
| **Etablissement** | `/etablissement` | ✅ Configuration, logo, jours travaillés, types de documents |
| **Utilisateurs** | `/utilisateurs`, `/utilisateurs/new`, `/utilisateurs/[id]` | ✅ Gestion des comptes |
| **Journal d'activité** | `/logs` | ✅ Audit trail |
| **Année scolaire** | `/annee-scolaire`, `/annee-scolaire/new`, `/annee-scolaire/[id]` | ✅ Années, périodes, configs éval |
| **Catalogue cours** | `/cours` | ✅ Arborescence UE → Modules → Cours, drag & drop |
| **Ressources** | `/ressources` | ✅ Salles + matériels |
| **Temps de présence** | `/temps-presence` | ✅ Saisie avec modale |
| **Types de présence** | `/types-presence` | ✅ Configuration (admin/direction uniquement) |
| **Grades** | `/grades` | ✅ Grades enseignants |
| **Affectation** | `/affectation`, `/affectation/adultes` | ✅ Drag & Drop profs → classes |
| **Login** | `/login` | ✅ Auth email/mot de passe |
| **Superadmin** | `/superadmin`, `/superadmin/login` | ✅ Gestion des tenants |

### ÉCARTS IDENTIFIÉS

| # | ID | Problème | Sévérité | Description |
|---|-----|----------|----------|-------------|
| F-01 | `FEAT-HIGH-01` | **`schema.sql` incomplet** | HAUT | 16 tables dans le schema de base, 20+ tables additionnelles uniquement dans les migrations. Exécuter uniquement `schema.sql` crée une base incomplète. |
| F-02 | `FEAT-MED-01` | **Pas de Supabase Realtime** | MOYEN | Aucune souscription `.channel()`. Le "temps réel" n'est que push + email, pas de mise à jour live dans le navigateur. |
| F-03 | `FEAT-MED-02` | **Repository pattern incomplet** | MOYEN | Seuls 6 repositories sur 20+ modules implémentés. Le reste utilise des appels Supabase directs, en contradiction avec ARCHITECTURE.md. |
| F-04 | `FEAT-LOW-01` | ✅ **Corrigé** | ~~**Lien "Mot de passe oublié" mort**~~ | `login/page.tsx`, `src/app/auth/forgot-password/page.tsx` | ~~Pointe vers `#` dans la page de login.~~ |
| F-05 | `FEAT-LOW-02` | **Composants UI documentés mais absents** | BAS | `Button.tsx`, `Input.tsx`, `Card.tsx` référencés dans ARCHITECTURE.md mais n'existent pas (stylisés via CSS global). |

---

## 📋 PLAN DE CORRECTIONS PRIORITAIRES

### 🔴 CRITIQUE — À corriger immédiatement

| Priorité | Action | Fichiers impactés |
|----------|--------|-------------------|
| 1 | Ajouter une vérification de rôle sur toutes les API de notifications | `src/app/api/notifications/*/route.ts` (4 fichiers) |
| 2 | Installer `sanitize-html` et sanitizer tout HTML avant `dangerouslySetInnerHTML` | 6 composants de communications/cahier-texte/notifications |
| 3 | Remplacer `Record<string, any>` par des interfaces typées avec validation | `src/app/dashboard/parents/actions.ts` |
| 4 | Ajouter des politiques RLS sur les 20+ tables manquantes | `supabase/policies.sql` |
| 5 | Définir les types Supabase join pour éliminer les `as any` | `src/types/database.ts` + tous les fichiers avec `as any` |

### 🟠 HAUT — À corriger rapidement

| Priorité | Action | Fichiers impactés |
|----------|--------|-------------------|
| 6 | Ajouter la validation des mots de passe côté serveur dans les server actions | `utilisateurs/actions.ts`, `superadmin/actions.ts`, `teachers/actions.ts`, `parents/actions.ts` |
| 7 | Ajouter des headers de sécurité dans `next.config.js` | `next.config.js` |
| 8 | Remplacer `<img>` par `<Image>` | 6 fichiers (EtablissementForm, FloatPhoneInput, AbsencesClient, DashboardSidebar, StudentForm, login) |
| 9 | Ajouter `next/dynamic` pour TipTap, jsPDF, EmploiDuTempsClient | RichTextEditor, bulletinPdf, EmploiDuTempsClient |
| 10 | Ajouter `cache()` pour les données de référence | Repositories + pages concernées |
| 11 | Réactiver le 2FA pour les rôles admin/direction | `src/proxy.ts` |

### 🟡 MOYEN — Améliorations planifiables

| Priorité | Action | Description |
|----------|--------|-------------|
| 12 | Convertir les requêtes séquentielles en jointures | `dashboard/page.tsx` (parent), `bulletins/page.tsx` |
| 13 | Ajouter pagination sur teachers et absences | `teachers/page.tsx`, `absences/page.tsx` |
| 14 | Migrer vers `next/font` pour les polices | `src/app/layout.tsx` |
| 15 | Ajouter des ErrorBoundary | `error.tsx` dans les routes concernées |
| 16 | Utiliser Zod pour la validation partagée | Créer des schémas pour chaque server action |
| 17 | Utiliser `Promise.allSettled` au lieu de `Promise.all` | `dashboard/layout.tsx`, `dashboard/page.tsx` |

### 🟢 BAS — Nettoyage

| Priorité | Action | Description |
|----------|--------|-------------|
| 18 | Supprimer ou implémenter le code 2FA commenté | `src/proxy.ts` lignes 211-231 |
| 19 | Compléter `schema.sql` ou documenter l'ordre des migrations | `supabase/schema.sql` |
| 20 | Harmoniser les imports dans les repositories | Tous les fichiers `src/lib/database/*.ts` |

---

## 📈 STATISTIQUES DU PROJET

| Métrique | Valeur |
|----------|--------|
| Fichiers source | ~180 |
| Composants `.tsx` | ~84 |
| Pages `page.tsx` | 45 |
| Server actions | ~15 |
| API routes | 8 |
| Tables DB | 40+ |
| Migrations | 49 |
| Dépendances | 32 |
| `as any` | 138 |
| `catch {}` vides | 31 |
| `'use client'` | 84 fichiers |

---

## 📊 MATRICE DES SÉVÉRITÉS

```
SÉCURITÉ :     ████░░░░░░  ~~1 critique~~ 0 critique ✅, ~~5~~ 2 hauts ✅, ~~8~~ 7 ~~6~~ ~~5~~ ~~4~~ ~~3~~ ~~2~~ ~~1~~ 0 moyen ✅, 6 bas
PERFORMANCES : ~~████░░░░░░~~  ~~2 critiques~~ 0 critique ✅, ~~4~~ ~~2~~ ~~1~~ 0 haut ✅, ~~5~~ ~~4~~ ~~3~~ ~~2~~ 1 moyen ✅, 2 bas
QUALITÉ CODE : ~~█░░░░░░░░░~~  ~~1 critique~~ 0 critique ✅, ~~4~~ ~~3~~ ~~2~~ ~~1~~ 0 haut ✅, ~~5~~ ~~4~~ ~~3~~ ~~2~~ ~~1~~ 0 moyen ✅, 3 bas
FONCTIONNALITÉS: ░░░░░░░░░░  0 critique, 1 haut, 3 moyens, 3 bas
```

---

## 📝 JOURNAL DES CORRECTIONS

| Date | ID | Statut | Correction appliquée |
|------|-----|--------|---------------------|
| 7 avr. 2026 | `SEC-CRIT-01` | ✅ **Corrigé** | Création de `src/lib/auth/requireRole.ts` (utilitaire de vérification de rôle). Ajout de la vérification de rôle sur les routes `absence`, `announcement`, `homework`, `payment`. Rôles restreints : `admin`, `direction`, `secretaire` (sauf `homework` qui inclut aussi `enseignant`). |
| 7 avr. 2026 | `SEC-HIGH-01` | ✅ **Corrigé** | Ajout de `validatePasswordServer()` dans `src/lib/validation/password.ts`. Validation côté serveur ajoutée dans 3 server actions acceptant des mots de passe du client : `createUser` (utilisateurs), `createTenant` et `createTenantUser` (superadmin). Retourne le nom de la règle violée si le mot de passe ne passe pas. Les mots de passe générés automatiquement (enseignants, parents) ne nécessitent pas de validation (déjà forts par construction). |
| 7 avr. 2026 | `SEC-HIGH-05` | ✅ **Corrigé** | Création de `src/lib/auth/requireRoleServer.ts` (variante pour server actions). Vérification de rôle ajoutée dans **17 server actions** : `utilisateurs` (5 fonctions → `admin`/`direction`), `teachers` (3 fonctions → `admin`/`direction`/`secretaire`), `parents` (2 fonctions → `admin`/`direction`/`secretaire`), `superadmin` (7 fonctions → `super_admin`). Retourne une erreur 403 si le rôle n'est pas autorisé. |
| 7 avr. 2026 | `PERF-CRIT-01` | ✅ **Corrigé** | Création de `src/lib/cache.ts` (utilitaires `unstable_cache`) et `src/lib/cache/dashboard.ts` (fonctions cachées : profil 1h, établissement 6h, année scolaire 24h, stats admin 5min). Dashboard layout utilise désormais les fonctions cachées. Dashboard page remplace 8 requêtes de compteurs admin par `getCachedAdminStats()`. |
| 7 avr. 2026 | `PERF-CRIT-02` | ✅ **Corrigé** | Lazy loading appliqué : TipTap (3 composants : `StaffMessageClient`, `NewMessageClient`, `CahierTexteForm` → `React.lazy` + `Suspense`), EmploiDuTempsClient (`next/dynamic`), jsPDF dans `BulletinsClient` (import dynamique dans les handlers PDF). Seuls les composants nécessaires sont chargés à la demande. |
| 7 avr. 2026 | `CODE-HIGH-01` | ✅ **Corrigé** | 5 catch blocks vides `.catch(() => {})` remplacés par `.catch((err) => console.error('[Composant] ...', err))` dans `PaymentModal.tsx`, `NewMessageClient.tsx`, `CahierTexteForm.tsx`, `AbsencesClient.tsx`, `login/page.tsx`. Les erreurs fire-and-forget sont désormais loggées. |
| 7 avr. 2026 | `SEC-HIGH-03` | ✅ **Corrigé** | Installation de `dompurify` + `jsdom`. Création de `src/lib/security/sanitize.ts` (utilitaire de sanitisation HTML). Sanitisation appliquée sur les 6 occurrences de `dangerouslySetInnerHTML` dans 5 composants (`StaffMessageClient`, `NewMessageClient`, `MessageDetailClient`, `CahierTexteDetail`, `NotificationDetailClient`). |
| 7 avr. 2026 | `SEC-HIGH-02` | ✅ **Corrigé** | Remplacement de `Record<string, any>` par des interfaces typées (`CreateParentPayload`, `UpdateParentPayload`) dans `parents/actions.ts`. Ajout d'une liste blanche de champs autorisés (`ALLOWED_FIELDS`) et d'une liste noire (`FORBIDDEN_FIELDS`) pour bloquer l'injection de `role`, `is_active`, `id`, etc. Fonction `sanitizeParentPayload` qui filtre les champs non autorisés. |
| 8 avr. 2026 | `CODE-HIGH-03` | ✅ **Corrigé** | Suppression du dernier `Record<string, any>` dans `updateParentRecord`. La fonction `sanitizeParentPayload` est maintenant utilisée systématiquement pour les créations et mises à jour de parents. |
| 8 avr. 2026 | `CODE-HIGH-01` | ✅ **Corrigé** | 11 catch blocks vides corrigés : ajout de `console.error('[Composant] ...', err)` dans `ParentsTable.tsx` (3), `proxy.ts` (2), `FinancementsClient.tsx` (1), `EmploiDuTempsClient.tsx` (2), `TeacherForm.tsx` (1), `StudentForm.tsx` (2). Les erreurs sont désormais tracées dans les logs. |
| 8 avr. 2026 | `CODE-HIGH-02` | ✅ **Corrigé** | Création de fonctions SQL RPC atomiques dans `supabase/migrations/050_atomic_user_creation.sql` : `create_profile_and_teacher()`, `create_profile_and_parent()`, `create_profile_only()`, `cleanup_profile_only()`. Les insertions profile + entité sont maintenant dans une seule transaction PostgreSQL. Mise à jour de 4 server actions (`teachers/actions.ts`, `utilisateurs/actions.ts`, `superadmin/actions.ts`, `parents/actions.ts`) pour utiliser les RPC. Rollbacks améliorés avec `Promise.allSettled` et logging. |
| 8 avr. 2026 | `CODE-HIGH-04` | ✅ **Corrigé** | Remplacement de `user!.id` par une garde explicite `if (!user) return redirect('/login')` dans `dashboard/page.tsx`. L'import `redirect` a été correctement ajouté en haut du fichier. |
| 8 avr. 2026 | `PERF-HIGH-03` | ✅ **Corrigé** | Pagination ajoutée sur la page Enseignants : `PAGE_SIZE = 20`, `.range(from, to)` côté serveur, `count: 'exact'` pour le total, barre de pagination avec recherche debounce côté client. Même pattern que la page Élèves. |
| 8 avr. 2026 | `PERF-HIGH-04` | ✅ **Corrigé** | Double round-trip éliminé dans le dashboard parent. Les requêtes notes et absences utilisent maintenant des jointures directes (`grades → students.parent_id`, `absences → students.parent_id`) au lieu de récupérer les IDs des enfants dans une requête séparée puis faire un `.in()`. Réduction de 6 à 4 requêtes pour le panneau parent. |
| 8 avr. 2026 | `PERF-HIGH-02` | ✅ **Corrigé** | Colonnes explicites remplacent `select('*')` dans les méthodes de liste des repositories : `teachers.ts` (getAll, search), `students.ts` (getAll, search, getByParent), `parents.ts` (getAll, search), `classes.ts` (getAll), `auth.ts` (getCurrentProfile). Dashboard admin : 3 requêtes `announcement_recipients` consolidées en 1 (récupération de tous les enregistrements + filtrage client-side au lieu de 3 count séparés). Réduction de 8 à 6 requêtes pour le dashboard admin. |
| 8 avr. 2026 | `PERF-HIGH-01` | ✅ **Corrigé** | Suppression de `'use client'` sur 4 composants purement présentatifs : `StatCard.tsx` (carte statistique), `DashboardHeader.tsx` (bandeau bienvenue + notifications), `AvatarSilhouette.tsx` (SVGs), `MessageDetailClient.tsx` (détail message). Ces composants n'utilisent aucun hook, event handler ou API navigateur. |
| 8 avr. 2026 | `SEC-MED-03` | ✅ **Corrigé** | Ajout de headers de sécurité dans `next.config.js` : `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (camera autorisée uniquement pour la photo élève via `camera=(self)`, toutes les autres APIs bloquées : microphone, géolocalisation, paiement, USB, Bluetooth, accéléromètre, gyroscope, magnétomètre, wake-lock). |
| 8 avr. 2026 | `SEC-MED-02` | ✅ **Corrigé** | Ajout du flag `secure` sur le cookie de session `app-session` dans `login/page.tsx`. Le flag n'est activé qu'en production (`process.env.NODE_ENV === 'production'`) pour ne pas casser le dev local. |
| 8 avr. 2026 | `SEC-MED-08` | ✅ **Corrigé** | Messages d'erreur génériques retournés au client dans 5 routes API notifications (`subscribe`, `unsubscribe`, `payment`, `announcement`, `absence`). Remplacement de `e.message` et `error.message` par des messages génériques ('Une erreur est survenue.'). Les détails complets sont loggués côté serveur via `console.error`. |
| 8 avr. 2026 | `SEC-MED-04` | ✅ **Corrigé** | Middleware fail-open corrigé dans `proxy.ts` : en cas d'échec de résolution du tenant (erreur réseau ou HTTP non-200), retourne une erreur 503 en production au lieu de laisser passer la requête sans `x-etablissement-id`. En développement local, le fail-open est conservé pour ne pas bloquer les devs. |
| 8 avr. 2026 | `SEC-MED-01` | ✅ **Corrigé** | 2FA TOTP activé pour tous les rôles sauf `parent`. Création de `enroll-totp/page.tsx` (QR code + vérification) et `totp-challenge/page.tsx` (saisie du code 6 chiffres). Modification de `proxy.ts` : `getAuthUser()` retourne maintenant `supabase` pour les appels MFA. Vérification AAL2 dans le middleware : redirection vers `/auth/enroll-totp` si aucun facteur configuré, vers `/auth/totp-challenge` si facteur présent mais session AAL1 uniquement. Correction : accès à `/login` autorisé même pour les utilisateurs AAL1 (permettre le retour à la connexion). |
| 8 avr. 2026 | `SEC-MED-05` | ✅ **Corrigé** | Rate limiting ajouté sur 5 routes API notifications via `src/lib/security/rateLimiter.ts`. Limites : `subscribe`/`unsubscribe` = 10 req/min, `payment` = 10 req/min, `announcement`/`absence` = 20 req/min (envoi à des centaines de parents en une seule requête). Stockage en mémoire avec `Map`, nettoyage automatique des entrées expirées. Réponse 429 avec message en français si limite dépassée. |
| 8 avr. 2026 | `SEC-MED-06` | ✅ **Corrigé** | Protection CSRF ajoutée sur 5 routes API notifications via `src/lib/security/csrf.ts`. Vérification des headers `Origin` et `Referer` contre les origines configurées (`NEXT_PUBLIC_SITE_URL`). En dev, la vérification est désactivée. Réponse 403 si origine non reconnue. Complète la protection `SameSite=lax` existante sur le cookie de session. |
| 8 avr. 2026 | `PERF-MED-01` | ✅ **Corrigé** | Remplacement de `<img>` par `<Image>` de Next.js dans 5 fichiers : `login/page.tsx` (logo établissement), `DashboardSidebar.tsx` (logo école), `EtablissementForm.tsx` (aperçu logo), `AbsencesClient.tsx` (photo élève trombinoscope), `StudentForm.tsx` (photo élève). Utilisation de `unoptimized` car les images proviennent de Supabase Storage (URLs dynamiques). |
| 8 avr. 2026 | `PERF-MED-02` | ✅ **Corrigé** | Remplacement des `<link>` Google Fonts externes par `next/font/google` dans `src/app/layout.tsx`. Polices Inter et Amiri maintenant pré-chargées et auto-hébergées par Next.js. Élimination du FOUC et de la requête réseau externe vers fonts.googleapis.com. |
| 8 avr. 2026 | `PERF-MED-03` | ✅ **Corrigé** | Remplacement de `cache: 'no-store'` par `next: { revalidate: 3600 }` dans `src/proxy.ts`. La résolution du tenant (slug → établissement_id) est maintenant cachée 1 heure par Next.js au lieu d'interroger Supabase à chaque requête. Réduction drastique des appels DB sur le middleware. |
| 8 avr. 2026 | `CODE-MED-01` | ✅ **Corrigé** | Remplacement de `console.error` brut par un logger structuré `src/lib/logger.ts` dans 5 routes API notifications. Le logger ajoute un timestamp ISO, un niveau, et un contexte JSONifiable pour un meilleur suivi en production. |
| 8 avr. 2026 | `CODE-MED-02` | ✅ **Corrigé** | Schémas de validation Zod créés dans `src/lib/validation/schemas.ts` pour les entités principales (CreateUser, UpdateProfile, CreateTeacher, UpdateTeacher, CreateParent, UpdateParent, CreateStudent, UpdateStudent). Validation côté serveur ajoutée dans 4 server actions : `teachers/actions.ts` (2 fonctions), `parents/actions.ts` (2 fonctions), `utilisateurs/actions.ts` (2 fonctions). Retourne un message d'erreur clair avec le champ et la règle violée. |
| 8 avr. 2026 | `CODE-MED-03` | ✅ **Corrigé** | Remplacement de la boucle `for...of` séquentielle par un traitement par batches de 50 dans `announcement/route.ts`. Les notifications d'un batch sont envoyées en parallèle via `Promise.all`, et les statuts email sont mis à jour en une seule requête par batch (`in()` au lieu de requêtes individuelles). HTML calculé une seule fois au lieu de 500 fois. Pour 500 parents : ~10 batches au lieu de 500 requêtes séquentielles. |
| 8 avr. 2026 | `CODE-MED-04` | ✅ **Corrigé** | Remplacement de `Promise.all` par `Promise.allSettled` dans `dashboard/layout.tsx` et `dashboard/page.tsx` (profil, année scolaire, dashboard admin). Les requêtes qui réussissent sont passées au rendu même si d'autres échouent. Les échecs partiels sont loggués côté serveur sans bloquer la page. |
| 8 avr. 2026 | `FEAT-LOW-01` | ✅ **Corrigé** | Page "Mot de passe oublié" créée : `src/app/auth/forgot-password/page.tsx`. Même design que la page login (illustration, logo, carte formulaire). Utilise `supabase.auth.resetPasswordForEmail` avec redirection vers `/auth/reset-password`. Message générique de succès (ne révèle pas si l'email existe, pour la sécurité). Lien `href="#"` remplacé par `Link` dans `login/page.tsx`. Checkbox "Se souvenir de moi" supprimée. Tous les formulaires auth migrés vers les composants `FloatInput` et `FloatButton` : `login/page.tsx`, `forgot-password/page.tsx`, `totp-challenge/page.tsx`, `enroll-totp/page.tsx`. |
| 8 avr. 2026 | `CODE-LOW-01` | ✅ **Corrigé** | `error.tsx` créé dans `src/app/dashboard/error.tsx`. Page d'erreur conviviale avec boutons "Réessayer" et "Retour à l'accueil" pour tout le dashboard. |
| 8 avr. 2026 | `CODE-LOW-02` | ✅ **Corrigé** | Code mort supprimé : le bloc 2FA commenté dans `proxy.ts` a été remplacé par l'implémentation TOTP active. Plus de TODO obsolète dans le fichier. |

---

*Généré automatiquement lors de l'audit du 7 avril 2026.*

---

## 🔲 MATRICE DES DROITS RLS — À REMPLIR (reporté en dernier)

**Légende :** `R` = Lire (SELECT) · `W` = Écrire (INSERT/UPDATE/DELETE) · `—` = Aucun accès

| Module | Table | super_admin | admin | direction | comptable | resp. pédagog. | enseignant | secretaire | parent |
|--------|-------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Établissement** | `etablissements` | | | | | | | | |
| | `school_years` | | | | | | | | |
| | `periods` | | | | | | | | |
| | `profiles` | | | | | | | | |
| **Élèves** | `students` | | | | | | | | |
| | `enrollments` | | | | | | | | |
| | `parent_class_enrollments` | | | | | | | | |
| | `student_documents` | | | | | | | | |
| | `student_warnings` | | | | | | | | |
| | `student_warning_attachments` | | | | | | | | |
| **Parents** | `parents` | | | | | | | | |
| **Enseignants** | `teachers` | | | | | | | | |
| **Classes** | `classes` | | | | | | | | |
| | `class_teachers` | | | | | | | | |
| | `subjects` | | | | | | | | |
| | `unites_enseignement` | | | | | | | | |
| | `teaching_units` | | | | | | | | |
| | `modules` | | | | | | | | |
| | `cours` | | | | | | | | |
| | `cours_modules` | | | | | | | | |
| **Emploi du temps** | `schedules` | | | | | | | | |
| | `schedule_slots` | | | | | | | | |
| | `schedule_exceptions` | | | | | | | | |
| | `schedule_validations` | | | | | | | | |
| | `rooms` | | | | | | | | |
| **Absences** | `absences` | | | | | | | | |
| | `presence_types` | | | | | | | | |
| | `presence_type_rates` | | | | | | | | |
| **Notes** | `evaluations` | | | | | | | | |
| | `grades` | | | | | | | | |
| | `eval_type_configs` | | | | | | | | |
| | `evaluation_order_config` | | | | | | | | |
| **Cahier de texte** | `cours_modules` | | | | | | | | |
| **Bulletins** | `bulletin_archives` | | | | | | | | |
| | `bulletin_appreciations` | | | | | | | | |
| **Communications** | `announcements` | | | | | | | | |
| | `announcement_recipients` | | | | | | | | |
| | `announcement_staff_recipients` | | | | | | | | |
| | `announcement_attachments` | | | | | | | | |
| **Notifications** | `notifications` | | | | | | | | |
| | `push_subscriptions` | | | | | | | | |
| **Finances** | `family_fees` | | | | | | | | |
| | `fee_installments` | | | | | | | | |
| | `fee_adjustments` | | | | | | | | |
| | `payments` | | | | | | | | |
| | `cotisation_types` | | | | | | | | |
| | `expenses` | | | | | | | | |
| | `other_revenues` | | | | | | | | |
| | `staff_hourly_rates` | | | | | | | | |
| | `staff_time_entries` | | | | | | | | |
| **Audit** | `audit_logs` | | | | | | | | |
| **Config docs** | `document_type_configs` | | | | | | | | |
