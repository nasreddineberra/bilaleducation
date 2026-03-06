-- Mise a jour de la table absences pour la gestion par classe et periode
-- Suppression de l'ancienne table si elle existe (pas encore utilisee en prod)
DROP TABLE IF EXISTS absences;

CREATE TABLE absences (
  id                          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  etablissement_id            uuid NOT NULL REFERENCES etablissements(id) ON DELETE CASCADE,
  student_id                  uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  class_id                    uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  period_id                   uuid NOT NULL REFERENCES periods(id) ON DELETE CASCADE,
  absence_date                date NOT NULL,
  absence_type                text NOT NULL CHECK (absence_type IN ('absence', 'retard')),
  comment                     text,
  is_justified                boolean NOT NULL DEFAULT false,
  justification_date          date,
  justification_comment       text,
  justification_document_url  text,
  recorded_by                 uuid REFERENCES profiles(id),
  created_at                  timestamptz DEFAULT now(),
  updated_at                  timestamptz DEFAULT now(),
  UNIQUE (student_id, class_id, period_id, absence_date, absence_type)
);

-- Index pour les requetes frequentes
CREATE INDEX idx_absences_class_period ON absences(class_id, period_id);
CREATE INDEX idx_absences_student      ON absences(student_id);
CREATE INDEX idx_absences_etab         ON absences(etablissement_id);

-- RLS
ALTER TABLE absences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Absences visibles par etablissement"
  ON absences FOR SELECT
  USING (etablissement_id IN (
    SELECT etablissement_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Absences inserables par etablissement"
  ON absences FOR INSERT
  WITH CHECK (etablissement_id IN (
    SELECT etablissement_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Absences modifiables par etablissement"
  ON absences FOR UPDATE
  USING (etablissement_id IN (
    SELECT etablissement_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Absences supprimables par etablissement"
  ON absences FOR DELETE
  USING (etablissement_id IN (
    SELECT etablissement_id FROM profiles WHERE id = auth.uid()
  ));

-- Bucket Storage pour les justificatifs
INSERT INTO storage.buckets (id, name, public)
VALUES ('absence-justificatifs', 'absence-justificatifs', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Justificatifs lisibles par etablissement"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'absence-justificatifs'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] IN (
      SELECT etablissement_id::text FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Justificatifs uploadables par etablissement"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'absence-justificatifs'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] IN (
      SELECT etablissement_id::text FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Justificatifs supprimables par etablissement"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'absence-justificatifs'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] IN (
      SELECT etablissement_id::text FROM profiles WHERE id = auth.uid()
    )
  );
