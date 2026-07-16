-- ============================================================================
-- Historique des communications comptables (Financements → familles).
--
-- Table PROPRE au module Financements (decision 15/07 : la relance/le recu du
-- comptable ne vivent pas dans `announcements`, qui reste la voix de
-- l'etablissement). Sert la RELANCE d'impayes et, ensuite, l'ATTESTATION.
--
-- Append-only (pas d'UPDATE/DELETE) : c'est un journal d'envois.
-- Ecriture via le client SESSION du comptable → `sent_by`/audit captent l'acteur.
--
-- Idempotent.
-- ============================================================================

CREATE TABLE IF NOT EXISTS financement_communications (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  etablissement_id UUID NOT NULL REFERENCES etablissements(id) ON DELETE CASCADE,
  parent_id        UUID NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  school_year_id   UUID REFERENCES school_years(id) ON DELETE SET NULL,

  type             TEXT NOT NULL CHECK (type IN ('relance', 'attestation')),
  subject          TEXT NOT NULL,
  body_html        TEXT,
  recipients       TEXT,          -- adresses servies (affichage/tracabilite)

  sent_by          UUID REFERENCES profiles(id) ON DELETE SET NULL,
  sent_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status           TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'skipped')),

  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fin_comm_parent_year
  ON financement_communications (parent_id, school_year_id);

COMMENT ON TABLE financement_communications IS
  'Journal des communications comptables (relance / attestation) envoyees aux familles. Append-only.';

-- ─── RLS : tenant + roles finance (admin / direction / comptable) ──────────
ALTER TABLE financement_communications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fin_comm_select ON financement_communications;
CREATE POLICY fin_comm_select ON financement_communications
  FOR SELECT
  USING (
    etablissement_id = current_etablissement_id()
    AND coalesce(get_user_role(), '') IN ('admin', 'direction', 'comptable')
  );

DROP POLICY IF EXISTS fin_comm_insert ON financement_communications;
CREATE POLICY fin_comm_insert ON financement_communications
  FOR INSERT
  WITH CHECK (
    etablissement_id = current_etablissement_id()
    AND coalesce(get_user_role(), '') IN ('admin', 'direction', 'comptable')
  );

-- Pas d'UPDATE/DELETE : journal append-only.

SELECT 'Table financement_communications creee (historique relance/attestation, append-only, RLS finance).' AS status;
