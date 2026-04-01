-- Migration : ajouter effective_from / effective_until sur class_teachers
-- Permet de gerer l'historique des affectations en cours d'annee

ALTER TABLE class_teachers
  ADD COLUMN IF NOT EXISTS effective_from  DATE,
  ADD COLUMN IF NOT EXISTS effective_until DATE;

-- Index pour requetes filtrees par date
CREATE INDEX IF NOT EXISTS idx_class_teachers_effective
  ON class_teachers (class_id, effective_from, effective_until);

COMMENT ON COLUMN class_teachers.effective_from  IS 'Date de debut d''effet (NULL = depuis le debut de l''annee)';
COMMENT ON COLUMN class_teachers.effective_until IS 'Date de fin d''effet (NULL = jusqu''a fin d''annee, renseignee = cloturee)';
