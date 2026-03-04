-- Mise à jour de la table evaluations pour le nouveau système d'élaboration

-- 1. Rendre module_id nullable (champ de l'ancien système)
ALTER TABLE evaluations ALTER COLUMN module_id DROP NOT NULL;

-- 2. Rendre max_score nullable (diagnostic et étoilée n'ont pas de barème)
ALTER TABLE evaluations ALTER COLUMN max_score DROP NOT NULL;

-- 3. Rendre evaluation_date optionnelle à l'élaboration
ALTER TABLE evaluations ALTER COLUMN evaluation_date DROP NOT NULL;

-- 4. Lier au nouveau référentiel des cours
ALTER TABLE evaluations
  ADD COLUMN IF NOT EXISTS cours_id UUID REFERENCES cours(id) ON DELETE SET NULL;

-- 5. Lier à une période scolaire
ALTER TABLE evaluations
  ADD COLUMN IF NOT EXISTS period_id UUID REFERENCES periods(id) ON DELETE SET NULL;

-- 6. Type d'évaluation du nouveau système
ALTER TABLE evaluations
  ADD COLUMN IF NOT EXISTS eval_kind TEXT
  CHECK (eval_kind IN ('diagnostic', 'scored', 'stars'));
