-- Types de documents configurables par établissement
CREATE TABLE IF NOT EXISTS document_type_configs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  etablissement_id UUID NOT NULL REFERENCES etablissements(id) ON DELETE CASCADE,
  category         TEXT NOT NULL CHECK (category IN ('identite', 'medical', 'assurance', 'autres')),
  doc_key          TEXT NOT NULL,
  label            TEXT NOT NULL,
  is_required      BOOLEAN NOT NULL DEFAULT false,
  order_index      INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (etablissement_id, doc_key)
);

CREATE INDEX idx_doc_type_configs_etab ON document_type_configs(etablissement_id);

-- RLS
ALTER TABLE document_type_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "doc_type_configs_select"
  ON document_type_configs FOR SELECT
  USING (etablissement_id = (SELECT etablissement_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "doc_type_configs_insert"
  ON document_type_configs FOR INSERT
  WITH CHECK (etablissement_id = (SELECT etablissement_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "doc_type_configs_update"
  ON document_type_configs FOR UPDATE
  USING (etablissement_id = (SELECT etablissement_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "doc_type_configs_delete"
  ON document_type_configs FOR DELETE
  USING (etablissement_id = (SELECT etablissement_id FROM profiles WHERE id = auth.uid()));

-- Documents uploadés par élève
CREATE TABLE IF NOT EXISTS student_documents (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  etablissement_id UUID NOT NULL REFERENCES etablissements(id) ON DELETE CASCADE,
  student_id       UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  doc_type_key     TEXT NOT NULL,
  category         TEXT NOT NULL CHECK (category IN ('identite', 'medical', 'assurance', 'autres')),
  file_url         TEXT NOT NULL,
  file_name        TEXT NOT NULL,
  expires_at       DATE,
  uploaded_by      UUID REFERENCES profiles(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_student_documents_student ON student_documents(student_id);
CREATE INDEX idx_student_documents_etab ON student_documents(etablissement_id);

-- RLS
ALTER TABLE student_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "student_documents_select"
  ON student_documents FOR SELECT
  USING (etablissement_id = (SELECT etablissement_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "student_documents_insert"
  ON student_documents FOR INSERT
  WITH CHECK (etablissement_id = (SELECT etablissement_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "student_documents_update"
  ON student_documents FOR UPDATE
  USING (etablissement_id = (SELECT etablissement_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "student_documents_delete"
  ON student_documents FOR DELETE
  USING (etablissement_id = (SELECT etablissement_id FROM profiles WHERE id = auth.uid()));

-- Bucket Storage
INSERT INTO storage.buckets (id, name, public)
VALUES ('student-documents', 'student-documents', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Student documents lisibles par etablissement"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'student-documents'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] IN (
      SELECT etablissement_id::text FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Student documents uploadables par etablissement"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'student-documents'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] IN (
      SELECT etablissement_id::text FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Student documents supprimables par etablissement"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'student-documents'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] IN (
      SELECT etablissement_id::text FROM profiles WHERE id = auth.uid()
    )
  );
