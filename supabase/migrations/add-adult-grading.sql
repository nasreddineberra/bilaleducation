-- ============================================================================
-- Notation des adultes (cours adultes) — flux parallèle au flux élève.
--
-- Un « participant adulte » = un tuteur précis d'une fiche parents,
-- identifié par (parent_id, tutor_number). Les gabarits (table `evaluations`)
-- restent partagés (ils sont rattachés à `class_id`, pas à l'élève).
-- Ces tables miroir stockent les notes / bulletins des adultes sans toucher
-- au flux élève (`grades`, `bulletin_archives`, `bulletin_appreciations`).
--
-- Idempotent : réexécutable sans erreur.
-- ============================================================================

-- ─── 1. Notes adultes (miroir de `grades`) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS adult_grades (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  etablissement_id UUID NOT NULL REFERENCES etablissements(id) ON DELETE CASCADE,
  parent_id        UUID NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  tutor_number     SMALLINT NOT NULL CHECK (tutor_number IN (1, 2)),
  evaluation_id    UUID NOT NULL REFERENCES evaluations(id) ON DELETE CASCADE,
  score            NUMERIC CHECK (score IS NULL OR score >= 0),
  comment          TEXT,
  is_absent        BOOLEAN NOT NULL DEFAULT FALSE,
  graded_by        UUID REFERENCES teachers(id),
  graded_at        TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (parent_id, tutor_number, evaluation_id)
);

CREATE INDEX IF NOT EXISTS idx_adult_grades_evaluation ON adult_grades(evaluation_id);
CREATE INDEX IF NOT EXISTS idx_adult_grades_participant ON adult_grades(parent_id, tutor_number);

ALTER TABLE adult_grades ENABLE ROW LEVEL SECURITY;

-- Admin / Direction / Resp. pédagogique : tout (USING sert aussi de WITH CHECK
-- pour INSERT quand WITH CHECK est omis — même modèle que la table `grades`).
DROP POLICY IF EXISTS "adult_grades_admin_all" ON adult_grades;
CREATE POLICY "adult_grades_admin_all"
  ON adult_grades FOR ALL
  USING (get_user_role() IN ('admin', 'direction', 'responsable_pedagogique'));

-- Enseignants : lecture de toutes les notes
DROP POLICY IF EXISTS "adult_grades_teacher_select" ON adult_grades;
CREATE POLICY "adult_grades_teacher_select"
  ON adult_grades FOR SELECT
  USING (get_user_role() = 'enseignant');

-- Enseignants : gérer les notes des classes qu'ils encadrent
DROP POLICY IF EXISTS "adult_grades_teacher_insert" ON adult_grades;
CREATE POLICY "adult_grades_teacher_insert"
  ON adult_grades FOR INSERT
  WITH CHECK (
    get_user_role() = 'enseignant' AND
    evaluation_id IN (
      SELECT e.id FROM evaluations e
      JOIN class_teachers ct ON e.class_id = ct.class_id
      JOIN teachers t ON ct.teacher_id = t.id
      WHERE t.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "adult_grades_teacher_update" ON adult_grades;
CREATE POLICY "adult_grades_teacher_update"
  ON adult_grades FOR UPDATE
  USING (
    get_user_role() = 'enseignant' AND
    evaluation_id IN (
      SELECT e.id FROM evaluations e
      JOIN class_teachers ct ON e.class_id = ct.class_id
      JOIN teachers t ON ct.teacher_id = t.id
      WHERE t.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "adult_grades_teacher_delete" ON adult_grades;
CREATE POLICY "adult_grades_teacher_delete"
  ON adult_grades FOR DELETE
  USING (
    get_user_role() = 'enseignant' AND
    evaluation_id IN (
      SELECT e.id FROM evaluations e
      JOIN class_teachers ct ON e.class_id = ct.class_id
      JOIN teachers t ON ct.teacher_id = t.id
      WHERE t.user_id = auth.uid()
    )
  );

-- ─── 2. Appréciations bulletins adultes (miroir de `bulletin_appreciations`) ─
CREATE TABLE IF NOT EXISTS adult_bulletin_appreciations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  etablissement_id UUID NOT NULL REFERENCES etablissements(id) ON DELETE CASCADE,
  parent_id        UUID NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  tutor_number     SMALLINT NOT NULL CHECK (tutor_number IN (1, 2)),
  class_id         UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  period_id        UUID NOT NULL REFERENCES periods(id) ON DELETE CASCADE,
  appreciation     TEXT NOT NULL DEFAULT '',
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by       UUID REFERENCES profiles(id),
  UNIQUE (parent_id, tutor_number, class_id, period_id)
);

CREATE INDEX IF NOT EXISTS idx_adult_bull_appr_class_period ON adult_bulletin_appreciations(class_id, period_id);
CREATE INDEX IF NOT EXISTS idx_adult_bull_appr_participant ON adult_bulletin_appreciations(parent_id, tutor_number);

ALTER TABLE adult_bulletin_appreciations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "adult_bull_appr_select" ON adult_bulletin_appreciations;
CREATE POLICY "adult_bull_appr_select"
  ON adult_bulletin_appreciations FOR SELECT
  USING (etablissement_id = (SELECT etablissement_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "adult_bull_appr_insert" ON adult_bulletin_appreciations;
CREATE POLICY "adult_bull_appr_insert"
  ON adult_bulletin_appreciations FOR INSERT
  WITH CHECK (etablissement_id = (SELECT etablissement_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "adult_bull_appr_update" ON adult_bulletin_appreciations;
CREATE POLICY "adult_bull_appr_update"
  ON adult_bulletin_appreciations FOR UPDATE
  USING (etablissement_id = (SELECT etablissement_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "adult_bull_appr_delete" ON adult_bulletin_appreciations;
CREATE POLICY "adult_bull_appr_delete"
  ON adult_bulletin_appreciations FOR DELETE
  USING (etablissement_id = (SELECT etablissement_id FROM profiles WHERE id = auth.uid()));

-- ─── 3. Archives bulletins adultes (miroir de `bulletin_archives`) ───────────
-- Réutilise le bucket Storage `bulletins` existant (chemin préfixé « adultes/ »).
CREATE TABLE IF NOT EXISTS adult_bulletin_archives (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  etablissement_id UUID NOT NULL REFERENCES etablissements(id) ON DELETE CASCADE,
  parent_id        UUID NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  tutor_number     SMALLINT NOT NULL CHECK (tutor_number IN (1, 2)),
  class_id         UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  period_id        UUID NOT NULL REFERENCES periods(id) ON DELETE CASCADE,
  file_path        TEXT NOT NULL,
  file_url         TEXT NOT NULL,
  archived_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_by      UUID REFERENCES profiles(id),
  UNIQUE (parent_id, tutor_number, class_id, period_id)
);

CREATE INDEX IF NOT EXISTS idx_adult_bull_arch_class_period ON adult_bulletin_archives(class_id, period_id);
CREATE INDEX IF NOT EXISTS idx_adult_bull_arch_participant ON adult_bulletin_archives(parent_id, tutor_number);

ALTER TABLE adult_bulletin_archives ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "adult_bull_arch_select" ON adult_bulletin_archives;
CREATE POLICY "adult_bull_arch_select"
  ON adult_bulletin_archives FOR SELECT
  USING (etablissement_id = (SELECT etablissement_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "adult_bull_arch_insert" ON adult_bulletin_archives;
CREATE POLICY "adult_bull_arch_insert"
  ON adult_bulletin_archives FOR INSERT
  WITH CHECK (etablissement_id = (SELECT etablissement_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "adult_bull_arch_delete" ON adult_bulletin_archives;
CREATE POLICY "adult_bull_arch_delete"
  ON adult_bulletin_archives FOR DELETE
  USING (etablissement_id = (SELECT etablissement_id FROM profiles WHERE id = auth.uid()));

-- ─── 4. Traçabilité (journal d'activité) ────────────────────────────────────
DROP TRIGGER IF EXISTS audit_adult_grades ON adult_grades;
CREATE TRIGGER audit_adult_grades
  AFTER INSERT OR UPDATE OR DELETE ON adult_grades
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

DROP TRIGGER IF EXISTS audit_adult_bulletin_appreciations ON adult_bulletin_appreciations;
CREATE TRIGGER audit_adult_bulletin_appreciations
  AFTER INSERT OR UPDATE OR DELETE ON adult_bulletin_appreciations
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

DROP TRIGGER IF EXISTS audit_adult_bulletin_archives ON adult_bulletin_archives;
CREATE TRIGGER audit_adult_bulletin_archives
  AFTER INSERT OR UPDATE OR DELETE ON adult_bulletin_archives
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();
