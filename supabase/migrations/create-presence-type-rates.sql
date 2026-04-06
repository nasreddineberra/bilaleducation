-- ============================================
-- BILAL EDUCATION - Taux horaires par type de présence
-- Remplace les colonnes fixes rate_cours/rate_activite/rate_menage
-- ============================================

CREATE TABLE IF NOT EXISTS presence_type_rates (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  etablissement_id   uuid NOT NULL REFERENCES etablissements(id) ON DELETE CASCADE,
  school_year_id     uuid NOT NULL REFERENCES school_years(id) ON DELETE CASCADE,
  presence_type_id   uuid NOT NULL REFERENCES presence_types(id) ON DELETE CASCADE,
  rate               numeric(10,2) NOT NULL DEFAULT 0,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (etablissement_id, school_year_id, presence_type_id)
);

CREATE INDEX idx_presence_type_rates_year ON presence_type_rates(school_year_id);

CREATE TRIGGER update_presence_type_rates_updated_at
  BEFORE UPDATE ON presence_type_rates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER presence_type_rates_auto_etablissement
  BEFORE INSERT ON presence_type_rates FOR EACH ROW EXECUTE FUNCTION set_etablissement_id();

ALTER TABLE presence_type_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "presence_type_rates_tenant" ON presence_type_rates
  USING (etablissement_id = current_etablissement_id());
CREATE POLICY "presence_type_rates_insert" ON presence_type_rates
  FOR INSERT WITH CHECK (etablissement_id = current_etablissement_id());
CREATE POLICY "presence_type_rates_update" ON presence_type_rates
  FOR UPDATE USING (etablissement_id = current_etablissement_id());
CREATE POLICY "presence_type_rates_delete" ON presence_type_rates
  FOR DELETE USING (etablissement_id = current_etablissement_id());

SELECT 'Table presence_type_rates créée avec succès.' AS status;
