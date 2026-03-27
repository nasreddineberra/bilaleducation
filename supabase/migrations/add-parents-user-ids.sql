-- ============================================
-- Ajout user_id pour chaque tuteur (parents)
-- Permet de lier un compte utilisateur a chaque tuteur
-- ============================================

ALTER TABLE parents
  ADD COLUMN IF NOT EXISTS tutor1_user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tutor2_user_id uuid REFERENCES profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_parents_tutor1_user ON parents(tutor1_user_id);
CREATE INDEX IF NOT EXISTS idx_parents_tutor2_user ON parents(tutor2_user_id);
