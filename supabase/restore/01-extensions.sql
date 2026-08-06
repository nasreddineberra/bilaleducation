-- ============================================================================
-- Extensions requises, à jouer AVANT le schéma
--
-- `pg_dump --schema=public` n'émet JAMAIS les extensions, même celles installées
-- dans ce schéma. Sans ce fichier, la restauration s'arrête sur la contrainte
-- anti-chevauchement de `schedule_slots` :
--
--   EXCLUDE USING gist (class_id WITH =, ..., daterange(...) WITH &&)
--
-- qui exige `btree_gist` pour comparer des colonnes scalaires avec `=` dans un
-- index GiST. Voir `fix-schedule-overlap-effective-dates.sql`.
--
-- Les autres extensions de la base (`pgcrypto`, `uuid-ossp`, `pg_stat_statements`,
-- `supabase_vault`) sont préinstallées par Supabase sur tout nouveau projet : il
-- n'y a rien à faire pour elles.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA public;
