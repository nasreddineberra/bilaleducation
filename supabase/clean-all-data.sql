-- ============================================
-- BILAL EDUCATION - Nettoyage complet des donnees
-- Supprime TOUTES les donnees sauf :
--   - la table etablissements
--   - les profils admin et superadmin
-- Approche dynamique : detecte automatiquement les tables existantes
-- A executer dans Supabase SQL Editor
-- ============================================

BEGIN;

SET session_replication_role = 'replica';

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename NOT IN ('etablissements', 'profiles')
    ORDER BY tablename
  LOOP
    EXECUTE 'TRUNCATE TABLE public.' || quote_ident(r.tablename) || ' CASCADE';
    RAISE NOTICE 'Table videe : %', r.tablename;
  END LOOP;
END $$;

-- Supprimer uniquement les profils qui ne sont pas admin/superadmin
DELETE FROM profiles
WHERE id NOT IN (
  '2c5e91ee-9fc6-421d-bcc9-703306f63620',
  'f32d0e90-73d3-45a0-9c30-cedd1bd94e36'
);

SET session_replication_role = 'origin';

COMMIT;

SELECT 'Toutes les donnees ont ete supprimees (sauf etablissements et profils admin/superadmin).' AS status;
