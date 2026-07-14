-- ============================================================================
-- Demi-journees d'absence (module Temps de presence).
-- Une absence peut couvrir la journee entiere ('full'), le matin ('am') ou
-- l'apres-midi ('pm'). Retro-compatible : les lignes existantes valent 'full'.
-- Idempotent.
-- ============================================================================

ALTER TABLE staff_time_entries
  ADD COLUMN IF NOT EXISTS absence_period text NOT NULL DEFAULT 'full';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'staff_time_entries_absence_period_check'
  ) THEN
    ALTER TABLE staff_time_entries
      ADD CONSTRAINT staff_time_entries_absence_period_check
      CHECK (absence_period IN ('full', 'am', 'pm'));
  END IF;
END $$;
