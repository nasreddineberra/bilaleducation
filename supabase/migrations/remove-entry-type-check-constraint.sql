-- ============================================
-- Migration : suppression de la contrainte CHECK hardcodée sur entry_type
-- Permet d'utiliser n'importe quel code depuis presence_types
-- ============================================

ALTER TABLE staff_time_entries
  DROP CONSTRAINT IF EXISTS staff_time_entries_entry_type_check;

SELECT 'Contrainte staff_time_entries_entry_type_check supprimée.' AS status;
