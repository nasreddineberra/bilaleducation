# Migrations — procédure de mise en production

Ce document répond à trois questions, et à elles seules :

1. **Dans quel ordre** joue-t-on une migration et le code qui en dépend ?
2. **Comment sait-on** ce qui est déjà appliqué à la base ?
3. **Que fait-on** quand une migration tourne mal ?

Pour l'**état réel** de la base — quelles politiques, quelles fonctions, quels
droits — ce document ne sert à rien : voir `supabase/controles/`. Un fichier qui
prétend décrire la base finit toujours par mentir ; le 5 août, `policies.sql`
affirmait l'inverse de ce que `pg_policies` contenait et a produit un diagnostic
de sécurité faux.

---

## 1. L'ordre : code d'abord, ou migration d'abord ?

**C'est la seule question qui peut casser la production, et elle n'a pas une
réponse unique.** Elle dépend du sens du changement.

### Changement ADDITIF → la migration d'abord

Nouvelle colonne, nouvelle table, nouvelle fonction, policy **plus** permissive,
index. Le code en place ignore l'ajout : il continue de tourner pendant que la
base a déjà la nouveauté.

> Jouer le SQL → vérifier → `git push` → attendre Vercel → `Ctrl+F5`.

**Le piège de ce sens** : croire que la migration suffit. Le 24 septembre,
l'écran du comptable n'avait toujours pas son menu après une migration jouée —
le code n'était pas poussé. *La base et l'application se déploient séparément.*

### Changement RESTRICTIF → le code d'abord

RLS durcie, contrainte ajoutée, colonne ou table supprimée, `CHECK` resserré.
L'ancien code suppose un droit qu'il n'a plus : il **échoue**, et souvent
**en silence**.

> `git push` → attendre Vercel → jouer le SQL → vérifier.

**Le piège de ce sens, payé le 29 septembre** : la migration RLS du lot 3 aurait
rendu les boutons d'ajout et de suppression des onglets Documents et Discipline
inopérants **sans un message** — une écriture écartée par la RLS touche zéro
ligne et ne lève rien. Le code a été aligné d'abord.

> **Toute migration restrictive se double d'une revue des boutons qu'elle va
> rendre inopérants.** Si un écran écrit encore ce que la base refusera, il
> faut le fermer AVANT, pas après.

### En cas de doute

Demandez-vous : *« si je joue le SQL maintenant et que le code reste celui
d'hier, qu'est-ce qui casse ? »* Si la réponse est « rien », c'est additif. Si
c'est « une écriture va échouer », c'est restrictif.

---

## 2. Avant de jouer : la sauvegarde

Supabase conserve des sauvegardes quotidiennes **sur les projets payants**, et le
projet dispose de `npm run sauvegarde` (`scripts/sauvegarder.mjs`) pour une copie locale
complète — base, fichiers de Storage et configuration du tableau de bord.

> ⚠️ **Réserve à connaître, et elle est sérieuse : la RESTAURATION n'a jamais
> été éprouvée.** Une sauvegarde dont on n'a jamais testé le retour arrière est
> une intention, pas un filet. C'est le point du plan de mise en production qui
> traîne depuis le début — tant qu'il n'est pas levé, le vrai garde-fou reste
> **de ne jouer qu'une migration qu'on a relue**, et de préférer un changement
> réversible à un changement optimal.

Ce que la discipline du projet apporte en attendant, et ce n'est pas rien :

- **Aucune des migrations du dépôt ne détruit de données au rejeu** (mesuré le
  4 octobre sur les 131 : toutes les écritures sont bornées par un `WHERE` ou
  protégées par `ON CONFLICT DO NOTHING`). Le pire cas est un **échec franc**
  (« existe déjà »), jamais un dégât silencieux.
- L'éditeur SQL de Supabase est **transactionnel** : une migration qui lève
  n'applique rien. C'est ce qui a sauvé la mise du 17 juillet, quand un
  `DELETE FROM storage.objects` interdit a annulé toute la migration.

---

## 3. Le registre : savoir ce qui est appliqué

131 migrations, et jusqu'au 4 octobre **rien en base** ne disait lesquelles
étaient en place — la seule trace était une liste de cases à cocher dans
`CLAUDE.md`, tenue à la main. Le 2 octobre elle avait décroché deux fois : une
migration jouée restait « en attente », une autre cochée n'avait pas été
rejouée après correction. **Un suivi manuel décroche, et il décroche en
silence.**

### Voir l'écart

```bash
node scripts/migrations-etat.mjs            # produit un bloc SQL à coller
```

Le bloc est en **lecture seule** et s'annule lui-même (exception volontaire,
bandeau rouge attendu — motif de `supabase/controles/`). Il affiche trois sortes
d'écart, qui ne se corrigent pas de la même façon :

| Écart | Sens | Quoi faire |
|---|---|---|
| **MANQUANTE** | au dépôt, pas au registre | la jouer, puis l'enregistrer |
| **MODIFIÉE** | enregistrée, mais le fichier a changé depuis | **lire le diff d'abord** : la rejouer peut lever |
| **INCONNUE** | au registre, plus au dépôt | fichier supprimé — la base porte peut-être des objets sans source |

### Enregistrer une migration

Chaque migration **nouvelle** se termine par sa ligne d'enregistrement :

```bash
node scripts/migrations-etat.mjs --ligne ma-migration.sql
```

```sql
SELECT enregistrer_migration('ma-migration.sql', '<empreinte>');
```

**Pourquoi dans le fichier** : la ligne part avec lui, et personne ne peut
oublier de cocher une case. C'est la discipline qui remplace le suivi manuel.

**Pourquoi une empreinte et pas seulement un nom** : plusieurs migrations de ce
projet ont été **rejouées après correction** (`guard-student-parent-delete`,
`guard-class-delete-with-participants`). Un registre qui ne porterait que le nom
dirait « appliqué » pour les deux versions alors que la base n'en porte qu'une.

**Le cercle, et comment il est rompu** : une migration ne peut pas contenir sa
propre empreinte — l'écrire change le fichier, donc l'empreinte. Convention :
les lignes qui **appellent** `enregistrer_migration` sont exclues du calcul (les
appels seuls, jamais la ligne qui *définit* la fonction, sinon l'empreinte de la
migration du registre deviendrait aveugle à sa propre signature).

**Les fins de ligne sont normalisées en LF** avant le calcul : ce dépôt
convertit en CRLF à la sortie de git, et sans cette normalisation la même
migration donnerait deux empreintes selon la machine.

### Attesté / présumé

Au remplissage initial (`--remplir`), les 60 migrations que `CLAUDE.md`
documente comme jouées entrent en **`atteste`** ; les 72 autres en **`presume`**
— personne ne peut aujourd'hui affirmer qu'elles ont été appliquées. Le registre
le dit au lieu de l'effacer : un « présumé » faux se découvre un jour, et il
faut alors savoir qu'on ne l'avait jamais vérifié.

---

## 4. Reconstruire une base

**Ne rejouez pas les migrations dans l'ordre : cela ne marche pas.** Elles sont
**incrémentales**, et les tables centrales (élèves, parents, enseignants,
classes, inscriptions, notes, profils, établissements) étaient créées par
`schema.sql`, supprimé le 5 août. Le premier `ALTER TABLE` échoue.

Le chemin est :

1. `supabase/restore/` — un **instantané daté** du schéma (voir son README) ;
2. puis **les migrations postérieures à cette date** uniquement.

```bash
# la date est celle du nom de fichier de supabase/restore/02-schema-AAAA-MM-JJ.sql
node scripts/migrations-etat.mjs --depuis 2026-08-06
```

C'est l'usage le plus concret du registre : il répond à *« qu'est-ce qui a été
joué depuis l'instantané ? »* par une requête, là où il faut aujourd'hui lire
l'historique git.

> L'instantané de `restore/` **vieillit à chaque migration**. Son README dit de
> le régénérer avant tout usage, et il a raison : celui du 6 août ignore tout le
> chantier RLS d'août-septembre. La commande `pg_dump` est dans son README.

---

## 5. Écrire une migration : les règles du projet

Chacune a été payée une fois. Elles ne sont pas des préférences.

- **Délimiteurs NOMMÉS** (`$fn$`, `$maj$`), jamais `$$` nu : certains éditeurs
  SQL voient dans `$$` une fin d'instruction et la création **échoue en
  silence** (1er octobre, fonction absente en base après une migration « jouée »).
- **Gardes de rôle en `coalesce`** : `NULL NOT IN (...)` vaut NULL et ne bloque
  donc **pas** un appelant anonyme (7 juillet).
- **`REVOKE ... FROM public` ne suffit pas** sur une fonction sensible :
  Supabase accorde `EXECUTE` **nommément** à `anon` par
  `ALTER DEFAULT PRIVILEGES`. Ajouter `REVOKE EXECUTE ... FROM anon`, puis
  relire `information_schema.routine_privileges` (3 octobre).
- **Commencer par vérifier le chemin de cloisonnement RÉEL** de chaque table
  (colonne `etablissement_id` propre, ou jointure) : `pg_policies` affiche la
  même chose dans les deux cas. Payé deux fois (29 septembre, 1er octobre).
- **Pas de trigger d'audit sur une table sans `etablissement_id`** :
  `fn_audit_log()` range sa ligne dans l'établissement du profil de `auth.uid()`
  et **échoue en 23502** quand il n'y en a pas (6 août).
- **Dans un déclencheur générique**, ne jamais citer une colonne par son nom :
  PL/pgSQL compile l'expression entière, `OLD.role` casse sur les 37 tables qui
  n'ont pas cette colonne. Passer par `to_jsonb(OLD)->>'role'` (7 août).
- **Rapiécer plutôt que réécrire** une fonction longue : recopier 120 lignes
  écraserait **sans rien dire** une dérive entre la base et le dépôt. Travailler
  sur `pg_get_functiondef`, et **lever si l'ancrage a bougé**.
- **En SQL on touche `storage.buckets` et les policies, jamais les objets** :
  `DELETE FROM storage.objects` est interdit (42501) et, l'éditeur étant
  transactionnel, **annule toute la migration** (17 juillet).
- **Terminer par une vérification** qui lève si le résultat n'est pas celui
  attendu — y compris sur les gardes **préexistantes** qu'on ne voulait pas
  perdre.

---

## 6. Quand ça tourne mal

1. **Lire le message, en entier.** L'éditeur SQL donne le `SQLSTATE` ; il
   distingue « existe déjà » (42710, bénin) d'un refus de droits (42501) ou
   d'une colonne absente (42703).
2. **Rien n'a été appliqué** si la migration a levé : l'éditeur est
   transactionnel. Ne pas « rejouer la deuxième moitié ».
3. **Si la migration est passée mais le code casse** : regarder d'abord le sens
   du changement (§ 1). Un restrictif joué avant le déploiement du code produit
   exactement ce symptôme.
4. **Un contrôle doit dire POURQUOI il échoue.** Ne pas avaler l'erreur dans un
   `EXCEPTION WHEN OTHERS` muet : `GET STACKED DIAGNOSTICS` et afficher le code.
   Sans cela, une panne franche devient un mystère (1er octobre).
