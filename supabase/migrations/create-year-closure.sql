-- ============================================================================
-- BILAL EDUCATION — Cloture d'annee : socle de donnees (Phase 1)
-- ----------------------------------------------------------------------------
-- Assistant de cloture d'annee : audits sequentiels module par module, puis
-- archivage des donnees eleves/foyers pour un historique annee apres annee.
--
-- 4 tables :
--   year_closure          : en-tete de cloture (1 par annee) + jalons de cycle de vie
--   year_closure_steps     : etat de chaque etape d'audit (verrouillage sequentiel)
--   student_year_history   : snapshot par PARTICIPANT x annee (eleve ou adulte)
--   family_year_finance    : snapshot financier par FOYER x annee (detail des reglements)
--
-- Les deux tables de snapshot sont concues pour SURVIVRE A LA PURGE (Phase 5) :
-- identite et libelles FIGES, pas de dependance aux tables transactionnelles.
--
-- Tracabilite : PAS de trigger d'audit ici (l'archivage insere des centaines de
-- lignes → spam du journal). Les evenements (ouverture/cloture/archivage/purge)
-- seront traces par un logAudit UNIQUE cote server action, + colonnes *_by/*_at.
--
-- Idempotent. A executer dans Supabase SQL Editor.
-- ============================================================================

-- ─── A. year_closure : en-tete de cloture (1 par annee) ─────────────────────
CREATE TABLE IF NOT EXISTS year_closure (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  etablissement_id UUID NOT NULL REFERENCES etablissements(id) ON DELETE CASCADE,
  school_year_id   UUID NOT NULL UNIQUE REFERENCES school_years(id) ON DELETE CASCADE,

  status           TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'closed')),

  started_by       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  started_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_by        UUID REFERENCES profiles(id) ON DELETE SET NULL,
  closed_at        TIMESTAMPTZ,

  archived_at      TIMESTAMPTZ,   -- snapshot genere (Phase 3) ; prerequis a la purge
  purged_at        TIMESTAMPTZ,   -- purge effectuee (Phase 5)

  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE year_closure IS
  'En-tete de cloture d''annee (1 par annee scolaire). La purge (Phase 5) est interdite tant que archived_at est NULL.';

-- ─── B. year_closure_steps : etat par etape d'audit ─────────────────────────
CREATE TABLE IF NOT EXISTS year_closure_steps (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  etablissement_id UUID NOT NULL REFERENCES etablissements(id) ON DELETE CASCADE,
  closure_id       UUID NOT NULL REFERENCES year_closure(id) ON DELETE CASCADE,

  step_key         TEXT NOT NULL,   -- affectations | notes | bulletins | absences | temps_presence | financements | documents
  order_index      INT  NOT NULL,
  status           TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'warnings', 'closed')),
  anomalies_count  INT  NOT NULL DEFAULT 0,
  recap_json       JSONB NOT NULL DEFAULT '{}'::jsonb,  -- recap FIGE au moment de la cloture de l'etape

  closed_by        UUID REFERENCES profiles(id) ON DELETE SET NULL,
  closed_at        TIMESTAMPTZ,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (closure_id, step_key)
);

COMMENT ON TABLE year_closure_steps IS
  'Etat de chaque etape d''audit de cloture. L''etape order_index=n+1 reste verrouillee tant que l''etape n n''est pas closed.';

-- ─── C. student_year_history : snapshot participant x annee ─────────────────
CREATE TABLE IF NOT EXISTS student_year_history (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  etablissement_id UUID NOT NULL REFERENCES etablissements(id) ON DELETE CASCADE,
  school_year_id   UUID REFERENCES school_years(id) ON DELETE SET NULL,
  year_label       TEXT NOT NULL,   -- fige (survit a une suppression d'annee)

  participant_type TEXT NOT NULL CHECK (participant_type IN ('student', 'adult')),
  student_id       UUID REFERENCES students(id) ON DELETE SET NULL,  -- lien vif tant que l'eleve existe
  parent_id        UUID REFERENCES parents(id)  ON DELETE SET NULL,  -- adultes
  tutor_number     INT,                                              -- adultes

  -- Identite FIGEE (survit a la purge / suppression)
  last_name        TEXT NOT NULL,
  first_name       TEXT NOT NULL,
  student_number   TEXT,

  -- Scolarite de l'annee (figee)
  class_name       TEXT,
  level            TEXT,
  cotisation_label TEXT,

  -- Chiffres figes
  moyenne_generale     NUMERIC(5,2),
  absences_justified   INT NOT NULL DEFAULT 0,
  absences_unjustified INT NOT NULL DEFAULT 0,

  -- Photo financiere (synthese ; le detail vit dans family_year_finance)
  financial_status TEXT,   -- pending | partial | paid | overpaid
  total_due        NUMERIC(10,2),
  total_paid       NUMERIC(10,2),

  bulletin_refs    JSONB NOT NULL DEFAULT '[]'::jsonb,  -- [{period_label, archive_id, file_path}]

  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE student_year_history IS
  'Snapshot par participant (eleve ou adulte) x annee. Identite/libelles figes → survit a la purge. Alimente les onglets Historique.';

CREATE INDEX IF NOT EXISTS idx_syh_etab_year ON student_year_history (etablissement_id, school_year_id);
CREATE INDEX IF NOT EXISTS idx_syh_student   ON student_year_history (student_id);
CREATE INDEX IF NOT EXISTS idx_syh_parent    ON student_year_history (parent_id);
-- Unicite par participant x annee (partielle selon le type)
CREATE UNIQUE INDEX IF NOT EXISTS uq_syh_student
  ON student_year_history (school_year_id, student_id) WHERE participant_type = 'student';
CREATE UNIQUE INDEX IF NOT EXISTS uq_syh_adult
  ON student_year_history (school_year_id, parent_id, tutor_number) WHERE participant_type = 'adult';

-- ─── D. family_year_finance : snapshot financier foyer x annee ──────────────
CREATE TABLE IF NOT EXISTS family_year_finance (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  etablissement_id UUID NOT NULL REFERENCES etablissements(id) ON DELETE CASCADE,
  school_year_id   UUID REFERENCES school_years(id) ON DELETE SET NULL,
  year_label       TEXT NOT NULL,

  parent_id        UUID REFERENCES parents(id) ON DELETE SET NULL,
  -- Identite foyer FIGEE
  tutor1_last_name  TEXT,
  tutor1_first_name TEXT,
  tutor2_last_name  TEXT,
  tutor2_first_name TEXT,

  total_due        NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_paid       NUMERIC(10,2) NOT NULL DEFAULT 0,
  remaining        NUMERIC(10,2) NOT NULL DEFAULT 0,
  status           TEXT,   -- pending | partial | paid | overpaid

  installments_json JSONB NOT NULL DEFAULT '[]'::jsonb,  -- [{date, montant, moyen, reference, banque}]
  adjustments_json  JSONB NOT NULL DEFAULT '[]'::jsonb,  -- reductions / avoirs / remboursements
  cotisations_json  JSONB NOT NULL DEFAULT '[]'::jsonb,  -- lignes facturees (eleves + adultes du foyer)

  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (school_year_id, parent_id)
);

COMMENT ON TABLE family_year_finance IS
  'Snapshot financier par foyer x annee, avec le DETAIL des reglements. Survit a la purge. Alimente l''historique des paiements. On ne paie JAMAIS dedans (les impayes restent vifs dans family_fees).';

CREATE INDEX IF NOT EXISTS idx_fyf_etab_year ON family_year_finance (etablissement_id, school_year_id);
CREATE INDEX IF NOT EXISTS idx_fyf_parent    ON family_year_finance (parent_id);

-- ════════════════════════════════════════════════════════════════════════════
--  RLS : tenant + roles. Ecriture reservee a admin/direction (le processus de
--  cloture/archivage/purge). Lecture des snapshots elargie pour la consultation.
-- ════════════════════════════════════════════════════════════════════════════

-- year_closure : gere par admin/direction
ALTER TABLE year_closure ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS year_closure_all ON year_closure;
CREATE POLICY year_closure_all ON year_closure
  FOR ALL
  USING (etablissement_id = current_etablissement_id() AND coalesce(get_user_role(), '') IN ('admin', 'direction'))
  WITH CHECK (etablissement_id = current_etablissement_id() AND coalesce(get_user_role(), '') IN ('admin', 'direction'));

-- year_closure_steps : gere par admin/direction
ALTER TABLE year_closure_steps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS year_closure_steps_all ON year_closure_steps;
CREATE POLICY year_closure_steps_all ON year_closure_steps
  FOR ALL
  USING (etablissement_id = current_etablissement_id() AND coalesce(get_user_role(), '') IN ('admin', 'direction'))
  WITH CHECK (etablissement_id = current_etablissement_id() AND coalesce(get_user_role(), '') IN ('admin', 'direction'));

-- student_year_history : lecture staff pedagogique/administratif, ecriture admin/direction
ALTER TABLE student_year_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS syh_select ON student_year_history;
CREATE POLICY syh_select ON student_year_history
  FOR SELECT
  USING (
    etablissement_id = current_etablissement_id()
    AND coalesce(get_user_role(), '') IN ('admin', 'direction', 'secretaire', 'responsable_pedagogique', 'comptable')
  );
DROP POLICY IF EXISTS syh_write ON student_year_history;
CREATE POLICY syh_write ON student_year_history
  FOR ALL
  USING (etablissement_id = current_etablissement_id() AND coalesce(get_user_role(), '') IN ('admin', 'direction'))
  WITH CHECK (etablissement_id = current_etablissement_id() AND coalesce(get_user_role(), '') IN ('admin', 'direction'));

-- family_year_finance : lecture finance, ecriture admin/direction
ALTER TABLE family_year_finance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fyf_select ON family_year_finance;
CREATE POLICY fyf_select ON family_year_finance
  FOR SELECT
  USING (
    etablissement_id = current_etablissement_id()
    AND coalesce(get_user_role(), '') IN ('admin', 'direction', 'comptable')
  );
DROP POLICY IF EXISTS fyf_write ON family_year_finance;
CREATE POLICY fyf_write ON family_year_finance
  FOR ALL
  USING (etablissement_id = current_etablissement_id() AND coalesce(get_user_role(), '') IN ('admin', 'direction'))
  WITH CHECK (etablissement_id = current_etablissement_id() AND coalesce(get_user_role(), '') IN ('admin', 'direction'));

SELECT 'Phase 1 OK : year_closure, year_closure_steps, student_year_history, family_year_finance crees (RLS posee).' AS status;
