-- Table pour stocker les métadonnées des bulletins archivés
CREATE TABLE IF NOT EXISTS bulletin_archives (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  etablissement_id UUID NOT NULL REFERENCES etablissements(id) ON DELETE CASCADE,
  student_id       UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  class_id         UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  period_id        UUID NOT NULL REFERENCES periods(id) ON DELETE CASCADE,
  file_path        TEXT NOT NULL,
  file_url         TEXT NOT NULL,
  archived_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_by      UUID REFERENCES profiles(id),
  UNIQUE (student_id, class_id, period_id)
);

CREATE INDEX idx_bulletin_archives_class_period ON bulletin_archives(class_id, period_id);
CREATE INDEX idx_bulletin_archives_student ON bulletin_archives(student_id);

-- RLS
ALTER TABLE bulletin_archives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bulletin_archives_select"
  ON bulletin_archives FOR SELECT
  USING (etablissement_id = (SELECT etablissement_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "bulletin_archives_insert"
  ON bulletin_archives FOR INSERT
  WITH CHECK (etablissement_id = (SELECT etablissement_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "bulletin_archives_delete"
  ON bulletin_archives FOR DELETE
  USING (etablissement_id = (SELECT etablissement_id FROM profiles WHERE id = auth.uid()));

-- ─── Bucket Storage ──────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public)
VALUES ('bulletins', 'bulletins', true)
ON CONFLICT (id) DO NOTHING;

-- Lecture publique (bulletins accessibles via getPublicUrl)
CREATE POLICY "Bulletins publics en lecture"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'bulletins');

-- Upload : utilisateur authentifié dont l'etablissement_id correspond au dossier racine
CREATE POLICY "Upload bulletins"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'bulletins'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = (
      SELECT etablissement_id::text FROM profiles WHERE id = auth.uid()
    )
  );

-- Mise à jour (upsert)
CREATE POLICY "Update bulletins"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'bulletins'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = (
      SELECT etablissement_id::text FROM profiles WHERE id = auth.uid()
    )
  );

-- Suppression
CREATE POLICY "Delete bulletins"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'bulletins'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = (
      SELECT etablissement_id::text FROM profiles WHERE id = auth.uid()
    )
  );
