-- ============================================================================
-- BILAL EDUCATION — Remarques internes sur les enseignants
-- Ajoute une colonne `notes` (texte libre) a la table teachers.
-- Idempotent. A executer dans Supabase SQL Editor.
-- ============================================================================

ALTER TABLE teachers ADD COLUMN IF NOT EXISTS notes text;
