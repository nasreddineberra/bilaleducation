-- ============================================
-- BILAL EDUCATION - Types de présence
-- ============================================

CREATE TABLE IF NOT EXISTS presence_types (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  etablissement_id UUID NOT NULL REFERENCES etablissements(id) ON DELETE CASCADE,
  label            TEXT NOT NULL,
  code             TEXT NOT NULL,
  color            TEXT NOT NULL DEFAULT '#6366f1',
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  order_index      INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(etablissement_id, code)
);

CREATE INDEX idx_presence_types_etablissement ON presence_types(etablissement_id);
CREATE INDEX idx_presence_types_order         ON presence_types(order_index);

CREATE TRIGGER update_presence_types_updated_at
  BEFORE UPDATE ON presence_types
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER presence_types_auto_etablissement
  BEFORE INSERT ON presence_types
  FOR EACH ROW EXECUTE FUNCTION set_etablissement_id();

ALTER TABLE presence_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "presence_types_tenant" ON presence_types
  USING (etablissement_id = current_etablissement_id());

CREATE POLICY "presence_types_insert" ON presence_types
  FOR INSERT WITH CHECK (etablissement_id = current_etablissement_id());

CREATE POLICY "presence_types_update" ON presence_types
  FOR UPDATE USING (etablissement_id = current_etablissement_id());

CREATE POLICY "presence_types_delete" ON presence_types
  FOR DELETE USING (etablissement_id = current_etablissement_id());

SELECT 'Table presence_types créée avec succès.' AS status;
