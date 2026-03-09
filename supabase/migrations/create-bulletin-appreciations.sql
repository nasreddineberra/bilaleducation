-- Table pour stocker les appréciations élèves par période
CREATE TABLE IF NOT EXISTS bulletin_appreciations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  etablissement_id UUID NOT NULL REFERENCES etablissements(id) ON DELETE CASCADE,
  student_id       UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  class_id         UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  period_id        UUID NOT NULL REFERENCES periods(id) ON DELETE CASCADE,
  appreciation     TEXT NOT NULL DEFAULT '',
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by       UUID REFERENCES profiles(id),
  UNIQUE (student_id, class_id, period_id)
);

CREATE INDEX idx_bulletin_appreciations_class_period ON bulletin_appreciations(class_id, period_id);
CREATE INDEX idx_bulletin_appreciations_student ON bulletin_appreciations(student_id);

-- RLS
ALTER TABLE bulletin_appreciations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bulletin_appreciations_select"
  ON bulletin_appreciations FOR SELECT
  USING (etablissement_id = (SELECT etablissement_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "bulletin_appreciations_insert"
  ON bulletin_appreciations FOR INSERT
  WITH CHECK (etablissement_id = (SELECT etablissement_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "bulletin_appreciations_update"
  ON bulletin_appreciations FOR UPDATE
  USING (etablissement_id = (SELECT etablissement_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "bulletin_appreciations_delete"
  ON bulletin_appreciations FOR DELETE
  USING (etablissement_id = (SELECT etablissement_id FROM profiles WHERE id = auth.uid()));
