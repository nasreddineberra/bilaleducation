-- ============================================================================
-- BILAL EDUCATION — Préférence de thème par utilisateur
-- ----------------------------------------------------------------------------
-- Mémorise le choix clair/sombre sur le PROFIL (et non plus seulement dans le
-- localStorage du navigateur) → la préférence suit l'utilisateur d'un poste à
-- l'autre et survit à la déconnexion.
--
-- NULL = clair (défaut actuel) → aucune régression sur les comptes existants.
-- Écriture par l'utilisateur lui-même via la policy RLS « update own profile »
-- (le trigger anti-escalade ne protège que role / is_active / etablissement_id).
--
-- NB : le trigger `audit_profiles` journalise chaque UPDATE de profiles ; un
-- basculement de thème laissera donc une ligne dans le journal d'activité.
--
-- Idempotent. À RELIRE puis exécuter dans Supabase SQL Editor.
-- ============================================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS theme text
  CHECK (theme IN ('light', 'dark'));

COMMENT ON COLUMN profiles.theme IS
  'Préférence d''interface : light | dark. NULL = clair (défaut). Choisie via la bascule du header.';

SELECT 'Colonne profiles.theme ajoutée (préférence clair/sombre par utilisateur).' AS status;
