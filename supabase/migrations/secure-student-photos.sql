-- ============================================================================
-- PHOTOS D'ELEVES : BUCKET PRIVE ET REGLES D'ACCES (27 octobre 2026)
--
-- Le bucket `student-photos` etait PUBLIC (adresse permanente, lisible par
-- quiconque la connait : photos d'enfants) et n'avait AUCUNE policy sur
-- `storage.objects` : l'envoi depuis la fiche eleve etait refuse, d'ou 0 photo
-- au 27/10. Rien n'a donc ete expose ; la fonction est reparee en meme temps.
--
--   1. Bucket prive, 500 Ko au plus (decision utilisateur ; le recadrage rend un
--      JPEG 300 x 400 de 30 a 60 Ko), JPEG seulement.
--   2. Chemin `{etablissement_id}/{identifiant}.jpg` ; `students.photo_url` porte
--      desormais ce CHEMIN, l'application signe l'adresse (1 h) au chargement.
--   3. Droits calques sur la table `students` :
--      - lecture : admin, direction, comptable, responsable pedagogique,
--        secretaire ; enseignant pour SES eleves seulement. L'identifiant du
--        fichier n'est pas toujours l'eleve (photo prise avant la creation de la
--        fiche) : l'enseignant lit le fichier qu'une fiche VISIBLE pour lui
--        reference (la RLS de `students` le borne a `teaches_student`) ;
--      - envoi, remplacement, suppression : admin, direction, responsable
--        pedagogique, secretaire (`students_write`).
--      Toujours dans le dossier de l'ecole courante.
--
-- Additif pour l'application (aucune photo existante, aucun lecteur public).
-- Controle : supabase/controles/27-photos-eleves.sql.
-- ============================================================================

UPDATE storage.buckets
SET public             = false,
    file_size_limit    = 512000,
    allowed_mime_types = ARRAY['image/jpeg']
WHERE id = 'student-photos';

DROP POLICY IF EXISTS photos_eleves_select ON storage.objects;
CREATE POLICY photos_eleves_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'student-photos'
    AND (storage.foldername(name))[1] = current_etablissement_id()::text
    AND (
      coalesce(get_user_role(), '') IN ('admin', 'direction', 'comptable', 'responsable_pedagogique', 'secretaire')
      OR (get_user_role() = 'enseignant'
          AND EXISTS (SELECT 1 FROM public.students s WHERE s.photo_url = storage.objects.name))
    )
  );

DROP POLICY IF EXISTS photos_eleves_insert ON storage.objects;
CREATE POLICY photos_eleves_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'student-photos'
    AND (storage.foldername(name))[1] = current_etablissement_id()::text
    AND coalesce(get_user_role(), '') IN ('admin', 'direction', 'responsable_pedagogique', 'secretaire')
  );

DROP POLICY IF EXISTS photos_eleves_update ON storage.objects;
CREATE POLICY photos_eleves_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'student-photos'
    AND (storage.foldername(name))[1] = current_etablissement_id()::text
    AND coalesce(get_user_role(), '') IN ('admin', 'direction', 'responsable_pedagogique', 'secretaire')
  )
  WITH CHECK (
    bucket_id = 'student-photos'
    AND (storage.foldername(name))[1] = current_etablissement_id()::text
    AND coalesce(get_user_role(), '') IN ('admin', 'direction', 'responsable_pedagogique', 'secretaire')
  );

DROP POLICY IF EXISTS photos_eleves_delete ON storage.objects;
CREATE POLICY photos_eleves_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'student-photos'
    AND (storage.foldername(name))[1] = current_etablissement_id()::text
    AND coalesce(get_user_role(), '') IN ('admin', 'direction', 'responsable_pedagogique', 'secretaire')
  );

SELECT enregistrer_migration('secure-student-photos.sql', 'bf362d910a2d74103287a9aa06639582f03e8215d1fb72b06a29eca7451014f3');
