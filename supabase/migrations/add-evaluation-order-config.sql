-- Sauvegarde de l'ordre d'affichage des UEs et modules dans l'élaboration des évaluations,
-- propre à chaque couple classe × période (n'affecte pas le référentiel global).

CREATE TABLE IF NOT EXISTS evaluation_order_config (
  class_id     uuid NOT NULL,
  period_id    uuid NOT NULL,
  ue_order     text[] DEFAULT '{}',
  module_order jsonb  DEFAULT '{}',   -- { "ue_id": ["mod_id1", "mod_id2", ...] }
  PRIMARY KEY (class_id, period_id)
);

ALTER TABLE evaluation_order_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gestion evaluation_order_config" ON evaluation_order_config FOR ALL
  USING (get_user_role() IN ('admin', 'direction', 'responsable_pedagogique', 'enseignant'));
