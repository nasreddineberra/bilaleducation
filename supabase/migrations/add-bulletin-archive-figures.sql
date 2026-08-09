-- ============================================================================
-- BILAL EDUCATION — Les chiffres du bulletin vivent AVEC le bulletin
-- ----------------------------------------------------------------------------
-- Les tables d'archives ne stockaient que le FICHIER (`file_path`). La moyenne
-- et l'assiduite imprimees sur le document n'etaient nulle part : la fiche
-- Scolarite les RECALCULAIT depuis `evaluations` + `grades` + `absences`.
--
-- Deux consequences, l'une genante et l'autre couteuse :
--   · le chiffre affiche pouvait DIVERGER de celui que la famille a reçu (une
--     note corrigee apres l'archivage changeait l'ecran, pas le PDF) ;
--   · il fallait rassembler quatre tables pour reconstituer ce qu'un document
--     deja produit affirmait noir sur blanc.
--
-- Un bulletin archive est un document PUBLIE : ses chiffres sont des faits, ils
-- ne se recalculent pas. On les range donc avec lui, renseignes par le bouton
-- « Archiver ».
--
-- `moyenne_generale` est NULLABLE : une periode sans aucune evaluation notee n'a
-- pas de moyenne, et « pas de moyenne » n'est pas « zero ».
--
-- Idempotent. A RELIRE puis executer dans Supabase SQL Editor.
-- ============================================================================

ALTER TABLE bulletin_archives
  ADD COLUMN IF NOT EXISTS moyenne_generale     NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS absences_count       INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS absences_unjustified INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS retards_count        INTEGER NOT NULL DEFAULT 0;

ALTER TABLE adult_bulletin_archives
  ADD COLUMN IF NOT EXISTS moyenne_generale     NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS absences_count       INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS absences_unjustified INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS retards_count        INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN bulletin_archives.moyenne_generale IS
  'Moyenne generale telle qu''IMPRIMEE sur le bulletin. NULL = aucune evaluation notee sur la periode. Ne se recalcule jamais : c''est le contenu d''un document publie.';
COMMENT ON COLUMN adult_bulletin_archives.moyenne_generale IS
  'Moyenne generale telle qu''IMPRIMEE sur le bulletin. NULL = aucune evaluation notee sur la periode.';

SELECT 'Colonnes de chiffres ajoutees aux 2 tables d''archives de bulletins.' AS status;
