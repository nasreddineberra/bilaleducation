# QA Report — BILAL EDUCATION
Date : 2026-03-29

---

## 1. Audit TypeScript

### Erreur trouvée et corrigée

| Fichier | Ligne | Erreur | Correction |
|---|---|---|---|
| `src/components/layout/DashboardNav.tsx` | 53 | `Type 'string[]' is not assignable to type '[string, string]'` — `AVATAR_COLORS` était inféré comme `string[][]` alors que `getAvatarColor` retourne `[string, string]` | Ajout de l'annotation `[string, string][]` sur `AVATAR_COLORS` |

**Résultat après correction** : `npx tsc --noEmit` — aucune erreur.

---

## 2. Audit validations formulaires

### TeacherForm.tsx

| Champ | Règle | Statut |
|---|---|---|
| N° employé | Requis (longueur > 0) | OK |
| Civilité | Requis (select non vide) | OK |
| Nom | Minimum 2 caractères | OK |
| Prénom | Minimum 2 caractères | OK |
| Email | Regex `[^\s@]+@[^\s@]+\.[^\s@]+` | OK |
| Date d'embauche | Requis | OK |
| Téléphone | Optionnel, pas de validation format | Acceptable — champ optionnel |
| Doublon nom+prénom | `ilike` côté DB + `normalizeNom` NFD côté client | OK |

Messages d'erreur en français : OK (« Minimum 2 caractères », « Email invalide », « Champ requis », « Requis »).

**Remarque** : Le champ Téléphone est optionnel et n'a pas de validation de format. Acceptable pour l'usage actuel. Si une validation était souhaitée, un pattern `/^(\+\d{1,3}[\s.-]?)?\d[\d\s.-]{6,14}\d$/` serait approprié.

### ParentForm.tsx

| Champ | Règle | Statut |
|---|---|---|
| Tuteur 1 — Nom | Minimum 2 caractères | OK |
| Tuteur 1 — Prénom | Minimum 2 caractères | OK |
| Tuteur 1 — Email | Regex + champ obligatoire | OK |
| Tuteur 2 — Nom/Prénom/Email | Validé seulement si `showTutor2 === true` | OK |
| Téléphone | Indicatif pays + chiffres uniquement (`digitsOnly`) | OK |
| Doublon tuteur 1 et tuteur 2 | `ilike` + `normalizeNom` NFD | OK |

Messages d'erreur en français : OK.

**Remarque mineure** : `v.t1Email` requiert un email non vide et valide. Si l'email tuteur est voulu optionnel à l'avenir, la règle devra être ajustée (actuellement `!form.tutor1_email || !isValidEmail(...)`).

---

## 3. Audit sécurité API

### `POST /api/notifications/absence`

- try/catch : présent
- Auth : **non vérifiée** — utilise `createAdminClient` directement. La route est appelée depuis un Server Action interne, ce qui est acceptable si le caller est authentifié. Cependant, la route elle-même n'effectue aucune vérification d'identité.
- Validation entrée : `absences?.length && etablissement_id` vérifié
- Code HTTP : 400 / 500 / 200 corrects

**Recommandation** : Ajouter une vérification d'auth ou restreindre cette route à l'appel interne uniquement (via un secret header ou en la déplaçant dans une Server Action).

### `POST /api/notifications/payment`

- try/catch : présent
- Auth : **non vérifiée** — même cas que ci-dessus
- Validation entrée : `parent_id && amount` vérifié
- Code HTTP : corrects

**Recommandation** : Même que ci-dessus.

### `POST /api/notifications/announcement`

- try/catch : présent
- Auth : **non vérifiée** — utilise `createAdminClient`
- Validation entrée : `announcement_id && etablissement_id` vérifié
- Code HTTP : corrects

### `POST /api/notifications/homework`

- try/catch : présent
- Auth : **non vérifiée**
- Validation entrée : `homework_id && etablissement_id` vérifié
- Code HTTP : corrects

### `POST /api/notifications/subscribe`

- try/catch : présent
- Auth : vérifiée via `supabase.auth.getUser()` — retourne 401 si non authentifié
- Validation : `endpoint`, `keys.p256dh`, `keys.auth` vérifiés
- Code HTTP : 400 / 401 / 500 corrects

### `POST /api/notifications/unsubscribe`

- try/catch : présent
- Auth : vérifiée via `supabase.auth.getUser()` — retourne 401 si non authentifié
- Validation : `endpoint` vérifié
- Code HTTP : corrects

### `DELETE /api/audit-logs/purge`

- try/catch : présent
- Auth : vérifiée + vérification rôle (`admin` ou `direction`)
- Validation : correcte
- Code HTTP : 401 / 403 / 500 / 200 corrects

### `GET /api/public/etablissement`

- Route publique explicitement documentée (page de connexion)
- Pas d'auth nécessaire — intentionnel
- try/catch : présent, retourne fallback silencieux
- Code HTTP : 200 dans tous les cas (même erreur) — acceptable pour une route publique de configuration

---

## 4. Recommandations

### Critique

- **Routes notifications sans auth** (`/absence`, `/payment`, `/announcement`, `/homework`) : Ces routes utilisent `createAdminClient` et ne vérifient pas l'identité de l'appelant. Si elles sont accessibles publiquement, elles pourraient être appelées par n'importe qui avec un `etablissement_id` valide. Envisager soit :
  - De les transformer en Server Actions (pas de route HTTP exposée)
  - D'ajouter une vérification d'auth (`createClient` + `getUser`)
  - D'utiliser un secret partagé côté header (`x-internal-secret`)

### Mineur

- `e: any` et `err: any` dans les catch des routes API : acceptable fonctionnellement, mais `unknown` + vérification `instanceof Error` serait plus typé.
- Le champ téléphone dans `TeacherForm` est optionnel sans validation de format. Peut rester ainsi si l'usage ne l'exige pas.

### Aucun problème

- Validations formulaires : solides, messages en français, détection doublons fonctionnelle.
- Routes avec auth (`subscribe`, `unsubscribe`, `audit-logs/purge`) : correctement protégées.
- TypeScript : propre après correction.
