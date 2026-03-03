-- ============================================
-- BILAL EDUCATION — Années scolaires & Évaluations
-- ============================================

-- ─── Tables ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS school_years (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  etablissement_id UUID REFERENCES etablissements(id) ON DELETE CASCADE NOT NULL,
  label            TEXT NOT NULL,                          -- ex. "2025-2026"
  is_current       BOOLEAN DEFAULT false NOT NULL,
  period_type      TEXT CHECK (period_type IN ('trimestrial', 'semestrial'))
                   NOT NULL DEFAULT 'trimestrial',
  created_at       TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE (etablissement_id, label)
);

CREATE TABLE IF NOT EXISTS periods (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_year_id UUID REFERENCES school_years(id) ON DELETE CASCADE NOT NULL,
  label          TEXT NOT NULL,     -- "T1", "T2", "T3" / "S1", "S2"
  order_index    INTEGER NOT NULL,
  created_at     TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS eval_type_configs (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_year_id UUID REFERENCES school_years(id) ON DELETE CASCADE NOT NULL,
  eval_type      TEXT CHECK (eval_type IN ('diagnostic', 'scored', 'stars')) NOT NULL,
  is_active      BOOLEAN DEFAULT true NOT NULL,
  max_score      INTEGER,           -- 10 ou 20 pour 'scored', NULL sinon
  created_at     TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE (school_year_id, eval_type)
);

-- ─── RLS ──────────────────────────────────────────────────────────────────────
-- Même pattern que policies.sql : basé sur get_user_role() via la table profiles

ALTER TABLE school_years      ENABLE ROW LEVEL SECURITY;
ALTER TABLE periods            ENABLE ROW LEVEL SECURITY;
ALTER TABLE eval_type_configs  ENABLE ROW LEVEL SECURITY;

-- get_user_role() est défini dans policies.sql : SELECT role FROM profiles WHERE id = auth.uid()

CREATE POLICY "Admin and direction can manage school years"
  ON school_years FOR ALL
  USING (get_user_role() IN ('admin', 'direction'));

CREATE POLICY "Admin and direction can manage periods"
  ON periods FOR ALL
  USING (get_user_role() IN ('admin', 'direction'));

CREATE POLICY "Admin and direction can manage eval type configs"
  ON eval_type_configs FOR ALL
  USING (get_user_role() IN ('admin', 'direction'));

-- ─── Suppression annee_courante de etablissements ─────────────────────────────
-- À exécuter une fois que les données d'années scolaires ont été migrées
ALTER TABLE etablissements DROP COLUMN IF EXISTS annee_courante;
