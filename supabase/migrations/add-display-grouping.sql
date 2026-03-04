-- Permettre au professeur de réorganiser ses évaluations dans le panneau d'élaboration
-- display_ue_id    : UE d'affichage (override du regroupement naturel)
-- display_module_id: Module d'affichage (override du regroupement naturel)

ALTER TABLE evaluations
  ADD COLUMN IF NOT EXISTS display_ue_id     UUID REFERENCES unites_enseignement(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS display_module_id UUID REFERENCES cours_modules(id)       ON DELETE SET NULL;
