# Reconstruction d'un projet Supabase

Ce dossier permet de créer un projet Supabase **vide** portant le schéma complet
de l'application : tables, contraintes, index, fonctions, déclencheurs, politiques
RLS, privilèges, compartiments de stockage et leurs politiques.

## ⚠️ Le fichier de schéma est un INSTANTANÉ daté

`02-schema-2026-08-06.sql` décrit la base **telle qu'elle était le 6 août 2026**.
Il vieillira à chaque migration.

**Avant toute utilisation future, régénère-le** — ne lui fais pas confiance sur
son âge. C'est exactement l'erreur qui a coûté cher le 5 août : `policies.sql`,
figé depuis mars, décrivait des politiques que la base avait quittées depuis
longtemps, et a conduit à un diagnostic faux lors d'un audit de sécurité.

**La vérité est toujours dans la base**, jamais dans ce dossier.

## Pourquoi ce dossier existe

Les 92 fichiers de `supabase/migrations/` ne suffisent pas : ils sont
**incrémentaux**. Les tables centrales — élèves, parents, enseignants, classes,
inscriptions, notes, profils, établissements — étaient créées par `schema.sql`,
supprimé le 5 août. Les rejouer sur une base vide échoue dès le premier
`ALTER TABLE`.

## Ordre d'exécution

Dans l'éditeur SQL du **nouveau** projet Supabase, un fichier après l'autre :

| Ordre | Fichier | Contenu |
|---|---|---|
| 1 | `01-extensions.sql` | `btree_gist`, que `pg_dump` n'exporte jamais |
| 2 | `02-schema-2026-08-06.sql` | 64 tables, 155 politiques, 31 fonctions, 92 déclencheurs, 120 index, 287 privilèges |
| 3 | `03-storage.sql` | 9 compartiments et 37 politiques de fichiers |

L'ordre n'est pas indifférent : le schéma échoue sans l'extension, et les
politiques de stockage supposent les compartiments créés.

## Régénérer

Depuis la racine du projet, avec `SUPABASE_DB_URL` renseignée dans `.env.local`
(chaîne de connexion PostgreSQL du projet source) :

```bash
export PATH="$PATH:/c/Program Files/PostgreSQL/17/bin"
export PGURL="$(grep '^SUPABASE_DB_URL=' .env.local | cut -d= -f2-)"

pg_dump "$PGURL" --schema-only --schema=public --no-owner --no-comments \
  -f supabase/restore/02-schema-$(date +%F).sql
```

**Ne remets pas `--no-privileges`.** Cette option paraît anodine et retire les
`GRANT` et `REVOKE` : la base restaurée reprendrait alors les droits par défaut
de Supabase au lieu de ceux qu'on a définis. `etablissement_smtp`, notamment,
n'est accessible qu'au `service_role` — c'est ce qui garantit qu'un mot de passe
SMTP ne sorte jamais vers le navigateur.

Le fichier `03-storage.sql` est produit par une requête qui lit l'état réel des
compartiments et des politiques ; sa régénération est décrite dans l'historique
du dépôt (commit d'origine de ce dossier).

## Ce que ce dossier NE contient PAS

**Aucune donnée.** Ni écoles, ni élèves, ni comptes. Une base restaurée est
structurellement complète mais vide — il faut ensuite créer l'établissement et
son compte administrateur.

**Aucun compte d'authentification.** Le schéma `auth` appartient à Supabase et
se recrée tout seul. Les utilisateurs sont à recréer.

**Aucun fichier.** Les compartiments de stockage sont recréés vides ; les logos
et documents ne sont pas transférés.
