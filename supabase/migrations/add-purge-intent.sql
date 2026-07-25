-- ============================================================================
-- BILAL EDUCATION — Choix « épurer la base ou non » en fin de clôture
-- ----------------------------------------------------------------------------
-- Mémorise, à la dernière étape de l'assistant de clôture (année ENCORE
-- courante, juste après l'archivage), l'intention de l'utilisateur :
--   'purge' = épurer les données transactionnelles après la bascule N+1
--   'keep'  = tout conserver
--   NULL    = pas encore choisi (ou clôture d'avant cette fonctionnalité)
--
-- L'intention est seulement un DRAPEAU : elle pré-arme / met en avant la carte
-- de purge sur la fiche de l'ancienne année. La purge reste DESTRUCTIVE et
-- passe TOUJOURS par la confirmation manuelle (saisie du libellé). Rien ne
-- s'exécute automatiquement.
--
-- Idempotent. À RELIRE puis exécuter dans Supabase SQL Editor.
-- ============================================================================

ALTER TABLE year_closure
  ADD COLUMN IF NOT EXISTS purge_intent text
  CHECK (purge_intent IN ('purge', 'keep'));

SELECT 'Colonne year_closure.purge_intent ajoutée (choix épurer/conserver en fin de clôture).' AS status;
