-- ============================================================================
-- BILAL EDUCATION — Documents lies a la fiche enseignant
-- Miroir de create-student-documents.sql (sans document_type_configs).
-- Categories en dur : contrat / diplome / identite / autre.
-- A executer dans Supabase SQL Editor.
-- ============================================================================

CREATE TABLE IF NOT EXISTS teacher_documents (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  etablissement_id UUID NOT NULL REFERENCES etablissements(id) ON DELETE CASCADE,
  teacher_id       UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  category         TEXT NOT NULL CHECK (category IN ('contrat', 'diplome', 'identite', 'autre')),
  label            TEXT, -- libelle libre quand category = 'autre'
  file_url         TEXT NOT NULL,
  file_name        TEXT NOT NULL,
  expires_at       DATE,
  uploaded_by      UUID REFERENCES profiles(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Idempotent : ajoute la colonne si la table existait deja sans
ALTER TABLE teacher_documents ADD COLUMN IF NOT EXISTS label TEXT;

CREATE INDEX IF NOT EXISTS idx_teacher_documents_teacher ON teacher_documents(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_documents_etab    ON teacher_documents(etablissement_id);

-- RLS (memes regles que student_documents : tenant de l'utilisateur connecte)
ALTER TABLE teacher_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teacher_documents_select" ON teacher_documents FOR SELECT
  USING (etablissement_id = (SELECT etablissement_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "teacher_documents_insert" ON teacher_documents FOR INSERT
  WITH CHECK (etablissement_id = (SELECT etablissement_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "teacher_documents_update" ON teacher_documents FOR UPDATE
  USING (etablissement_id = (SELECT etablissement_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "teacher_documents_delete" ON teacher_documents FOR DELETE
  USING (etablissement_id = (SELECT etablissement_id FROM profiles WHERE id = auth.uid()));

-- Bucket Storage prive
INSERT INTO storage.buckets (id, name, public)
VALUES ('teacher-documents', 'teacher-documents', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Teacher documents lisibles par etablissement"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'teacher-documents'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] IN (
      SELECT etablissement_id::text FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Teacher documents uploadables par etablissement"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'teacher-documents'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] IN (
      SELECT etablissement_id::text FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Teacher documents supprimables par etablissement"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'teacher-documents'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] IN (
      SELECT etablissement_id::text FROM profiles WHERE id = auth.uid()
    )
  );
