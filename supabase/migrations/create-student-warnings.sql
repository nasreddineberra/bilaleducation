-- Table des avertissements disciplinaires
CREATE TABLE IF NOT EXISTS student_warnings (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  etablissement_id UUID NOT NULL REFERENCES etablissements(id) ON DELETE CASCADE,
  student_id       UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  class_id         UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  period_id        UUID NOT NULL REFERENCES periods(id) ON DELETE CASCADE,
  warning_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  severity         TEXT NOT NULL CHECK (severity IN ('punition', 'prevention', 'conservatoire', 'sanction')),
  motif            TEXT NOT NULL DEFAULT '',
  issued_by        UUID REFERENCES profiles(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_student_warnings_student ON student_warnings(student_id);
CREATE INDEX idx_student_warnings_class_period ON student_warnings(class_id, period_id);
CREATE INDEX idx_student_warnings_etab ON student_warnings(etablissement_id);

-- Pièces jointes des avertissements
CREATE TABLE IF NOT EXISTS student_warning_attachments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warning_id  UUID NOT NULL REFERENCES student_warnings(id) ON DELETE CASCADE,
  file_url    TEXT NOT NULL,
  file_name   TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_warning_attachments_warning ON student_warning_attachments(warning_id);

-- RLS student_warnings
ALTER TABLE student_warnings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "student_warnings_select"
  ON student_warnings FOR SELECT
  USING (etablissement_id = (SELECT etablissement_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "student_warnings_insert"
  ON student_warnings FOR INSERT
  WITH CHECK (etablissement_id = (SELECT etablissement_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "student_warnings_update"
  ON student_warnings FOR UPDATE
  USING (etablissement_id = (SELECT etablissement_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "student_warnings_delete"
  ON student_warnings FOR DELETE
  USING (etablissement_id = (SELECT etablissement_id FROM profiles WHERE id = auth.uid()));

-- RLS student_warning_attachments
ALTER TABLE student_warning_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "warning_attachments_select"
  ON student_warning_attachments FOR SELECT
  USING (warning_id IN (
    SELECT id FROM student_warnings WHERE etablissement_id = (SELECT etablissement_id FROM profiles WHERE id = auth.uid())
  ));

CREATE POLICY "warning_attachments_insert"
  ON student_warning_attachments FOR INSERT
  WITH CHECK (warning_id IN (
    SELECT id FROM student_warnings WHERE etablissement_id = (SELECT etablissement_id FROM profiles WHERE id = auth.uid())
  ));

CREATE POLICY "warning_attachments_delete"
  ON student_warning_attachments FOR DELETE
  USING (warning_id IN (
    SELECT id FROM student_warnings WHERE etablissement_id = (SELECT etablissement_id FROM profiles WHERE id = auth.uid())
  ));

-- Bucket Storage pour les pièces jointes d'avertissements
INSERT INTO storage.buckets (id, name, public)
VALUES ('warning-attachments', 'warning-attachments', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Warning attachments lisibles par etablissement"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'warning-attachments'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] IN (
      SELECT etablissement_id::text FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Warning attachments uploadables par etablissement"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'warning-attachments'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] IN (
      SELECT etablissement_id::text FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Warning attachments supprimables par etablissement"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'warning-attachments'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] IN (
      SELECT etablissement_id::text FROM profiles WHERE id = auth.uid()
    )
  );
