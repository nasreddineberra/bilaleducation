-- Ajout colonne logo
ALTER TABLE etablissements ADD COLUMN IF NOT EXISTS logo_url text;

-- Bucket Storage (public pour lecture via getPublicUrl)
INSERT INTO storage.buckets (id, name, public)
VALUES ('etablissement-logos', 'etablissement-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Lecture publique (logos accessibles sans auth)
CREATE POLICY "Logos publics en lecture"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'etablissement-logos');

-- Upload/update : utilisateur authentifie dont l'etablissement_id correspond au dossier
CREATE POLICY "Upload logo etablissement"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'etablissement-logos'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = (
      SELECT etablissement_id::text FROM profiles WHERE id = auth.uid()
    )
  );

-- Mise a jour (upsert)
CREATE POLICY "Update logo etablissement"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'etablissement-logos'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = (
      SELECT etablissement_id::text FROM profiles WHERE id = auth.uid()
    )
  );

-- Suppression
CREATE POLICY "Delete logo etablissement"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'etablissement-logos'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = (
      SELECT etablissement_id::text FROM profiles WHERE id = auth.uid()
    )
  );
