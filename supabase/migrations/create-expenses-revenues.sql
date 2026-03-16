-- ============================================================================
-- Tables pour la page Synthese financiere
-- A executer dans Supabase SQL Editor
-- ============================================================================

-- ─── Fonction utilitaire updated_at (si pas encore creee) ────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ─── Table des depenses ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS expenses (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  etablissement_id UUID NOT NULL REFERENCES etablissements(id),
  school_year_id  UUID NOT NULL REFERENCES school_years(id),
  expense_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  label           TEXT NOT NULL,
  amount          NUMERIC(10,2) NOT NULL DEFAULT 0,
  category        TEXT,
  document_url    TEXT,
  notes           TEXT,
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_expenses_etab_year ON expenses(etablissement_id, school_year_id);

-- RLS
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "expenses_select" ON expenses FOR SELECT
  USING (etablissement_id = current_etablissement_id());

CREATE POLICY "expenses_insert" ON expenses FOR INSERT
  WITH CHECK (etablissement_id = current_etablissement_id());

CREATE POLICY "expenses_update" ON expenses FOR UPDATE
  USING (etablissement_id = current_etablissement_id());

CREATE POLICY "expenses_delete" ON expenses FOR DELETE
  USING (etablissement_id = current_etablissement_id());

-- Auto-fill etablissement_id
CREATE TRIGGER expenses_auto_etablissement
  BEFORE INSERT ON expenses FOR EACH ROW EXECUTE FUNCTION set_etablissement_id();

-- Trigger updated_at
CREATE TRIGGER set_expenses_updated_at
  BEFORE UPDATE ON expenses
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── Table des revenus autres ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS other_revenues (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  etablissement_id UUID NOT NULL REFERENCES etablissements(id),
  school_year_id  UUID NOT NULL REFERENCES school_years(id),
  revenue_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  label           TEXT NOT NULL,
  amount          NUMERIC(10,2) NOT NULL DEFAULT 0,
  source_type     TEXT,
  notes           TEXT,
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_other_revenues_etab_year ON other_revenues(etablissement_id, school_year_id);

-- RLS
ALTER TABLE other_revenues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "other_revenues_select" ON other_revenues FOR SELECT
  USING (etablissement_id = current_etablissement_id());

CREATE POLICY "other_revenues_insert" ON other_revenues FOR INSERT
  WITH CHECK (etablissement_id = current_etablissement_id());

CREATE POLICY "other_revenues_update" ON other_revenues FOR UPDATE
  USING (etablissement_id = current_etablissement_id());

CREATE POLICY "other_revenues_delete" ON other_revenues FOR DELETE
  USING (etablissement_id = current_etablissement_id());

-- Auto-fill etablissement_id
CREATE TRIGGER other_revenues_auto_etablissement
  BEFORE INSERT ON other_revenues FOR EACH ROW EXECUTE FUNCTION set_etablissement_id();

-- Trigger updated_at
CREATE TRIGGER set_other_revenues_updated_at
  BEFORE UPDATE ON other_revenues
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
