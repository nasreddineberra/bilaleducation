-- ============================================================================
-- STORAGE : DOCUMENTS ET JUSTIFICATIFS, DROITS DES TABLES (18 octobre 2026)
--
-- Les buckets `student-documents`, `warning-attachments`, `teacher-documents`
-- et `absence-justificatifs` n'etaient cloisonnes que par ECOLE (dossier
-- racine) : tout compte de l'ecole, comptable et parent compris, lisait les
-- notes medicales, les pieces des avertissements, les documents des
-- enseignants et les justificatifs d'absence.
--
-- Regle (decision utilisateur) : chaque bucket reprend les droits de la table
-- qui reference ses fichiers. Qui voit la ligne voit le fichier.
--   student-documents   (ecole/eleve/...)        = student_documents
--   warning-attachments (ecole/eleve/avert./...) = student_warnings
--     lecture : admin, direction, resp. pedago, secretaire ; enseignant pour
--               ses eleves (`teaches_student` sur l'eleve du chemin) ;
--     ecriture : admin, direction, resp. pedago, secretaire.
--   teacher-documents   = teacher_documents : admin, direction, secretaire.
--   absence-justificatifs (ecole/absence.ext) = absences + adult_absences :
--     admin, direction, resp. pedago, secretaire ; enseignant si l'absence du
--     chemin lui est VISIBLE (la RLS de ces tables le borne a ses classes).
--
-- Le segment du chemin n'est converti en uuid que s'il en a la forme (CASE) :
-- un nom inattendu ne doit pas faire echouer toute la requete.
--
-- `student_warning_attachments` (table) : meme trou, cloisonnee par ecole sans
-- role. Lecture = l'avertissement est visible (RLS de `student_warnings`) ;
-- ecriture = admin, direction, resp. pedago, secretaire.
--
-- Les policies UPDATE manquaient : l'envoi d'un justificatif en `upsert`
-- (remplacement) ne pouvait pas ecraser le fichier existant.
--
-- Le SQL ne touche pas `storage.objects` (seulement ses policies).
-- Controle : supabase/controles/15-documents-roles.sql.
-- ============================================================================

-- ── Anciennes policies (ecole seulement) ───────────────────────────────────
DROP POLICY IF EXISTS "Student documents lisibles par etablissement" ON storage.objects;
DROP POLICY IF EXISTS "Student documents uploadables par etablissement" ON storage.objects;
DROP POLICY IF EXISTS "Student documents supprimables par etablissement" ON storage.objects;
DROP POLICY IF EXISTS "Warning attachments lisibles par etablissement" ON storage.objects;
DROP POLICY IF EXISTS "Warning attachments uploadables par etablissement" ON storage.objects;
DROP POLICY IF EXISTS "Warning attachments supprimables par etablissement" ON storage.objects;
DROP POLICY IF EXISTS "Teacher documents lisibles par etablissement" ON storage.objects;
DROP POLICY IF EXISTS "Teacher documents uploadables par etablissement" ON storage.objects;
DROP POLICY IF EXISTS "Teacher documents supprimables par etablissement" ON storage.objects;
DROP POLICY IF EXISTS "Justificatifs lisibles par etablissement" ON storage.objects;
DROP POLICY IF EXISTS "Justificatifs uploadables par etablissement" ON storage.objects;
DROP POLICY IF EXISTS "Justificatifs supprimables par etablissement" ON storage.objects;

-- ── Documents d'eleve et pieces d'avertissement ────────────────────────────
DROP POLICY IF EXISTS eleve_docs_select ON storage.objects;
DROP POLICY IF EXISTS eleve_docs_insert ON storage.objects;
DROP POLICY IF EXISTS eleve_docs_update ON storage.objects;
DROP POLICY IF EXISTS eleve_docs_delete ON storage.objects;

CREATE POLICY eleve_docs_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id IN ('student-documents', 'warning-attachments')
    AND (storage.foldername(name))[1] = current_etablissement_id()::text
    AND (
      coalesce(get_user_role(), '') IN ('admin', 'direction', 'responsable_pedagogique', 'secretaire')
      OR (
        get_user_role() = 'enseignant'
        AND CASE
              WHEN (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
              THEN teaches_student(((storage.foldername(name))[2])::uuid)
              ELSE false
            END
      )
    )
  );

CREATE POLICY eleve_docs_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id IN ('student-documents', 'warning-attachments')
    AND (storage.foldername(name))[1] = current_etablissement_id()::text
    AND coalesce(get_user_role(), '') IN ('admin', 'direction', 'responsable_pedagogique', 'secretaire')
  );

CREATE POLICY eleve_docs_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id IN ('student-documents', 'warning-attachments')
    AND (storage.foldername(name))[1] = current_etablissement_id()::text
    AND coalesce(get_user_role(), '') IN ('admin', 'direction', 'responsable_pedagogique', 'secretaire')
  )
  WITH CHECK (
    bucket_id IN ('student-documents', 'warning-attachments')
    AND (storage.foldername(name))[1] = current_etablissement_id()::text
    AND coalesce(get_user_role(), '') IN ('admin', 'direction', 'responsable_pedagogique', 'secretaire')
  );

CREATE POLICY eleve_docs_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id IN ('student-documents', 'warning-attachments')
    AND (storage.foldername(name))[1] = current_etablissement_id()::text
    AND coalesce(get_user_role(), '') IN ('admin', 'direction', 'responsable_pedagogique', 'secretaire')
  );

-- ── Documents d'enseignant ─────────────────────────────────────────────────
DROP POLICY IF EXISTS enseignant_docs_select ON storage.objects;
DROP POLICY IF EXISTS enseignant_docs_insert ON storage.objects;
DROP POLICY IF EXISTS enseignant_docs_update ON storage.objects;
DROP POLICY IF EXISTS enseignant_docs_delete ON storage.objects;

CREATE POLICY enseignant_docs_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'teacher-documents'
    AND (storage.foldername(name))[1] = current_etablissement_id()::text
    AND coalesce(get_user_role(), '') IN ('admin', 'direction', 'secretaire')
  );

CREATE POLICY enseignant_docs_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'teacher-documents'
    AND (storage.foldername(name))[1] = current_etablissement_id()::text
    AND coalesce(get_user_role(), '') IN ('admin', 'direction', 'secretaire')
  );

CREATE POLICY enseignant_docs_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'teacher-documents'
    AND (storage.foldername(name))[1] = current_etablissement_id()::text
    AND coalesce(get_user_role(), '') IN ('admin', 'direction', 'secretaire')
  )
  WITH CHECK (
    bucket_id = 'teacher-documents'
    AND (storage.foldername(name))[1] = current_etablissement_id()::text
    AND coalesce(get_user_role(), '') IN ('admin', 'direction', 'secretaire')
  );

CREATE POLICY enseignant_docs_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'teacher-documents'
    AND (storage.foldername(name))[1] = current_etablissement_id()::text
    AND coalesce(get_user_role(), '') IN ('admin', 'direction', 'secretaire')
  );

-- ── Justificatifs d'absence (eleves et adultes) ────────────────────────────
-- L'absence est lue SOUS la RLS de l'appelant : pour l'enseignant, seules
-- celles de ses classes existent.
DROP POLICY IF EXISTS justificatifs_select ON storage.objects;
DROP POLICY IF EXISTS justificatifs_insert ON storage.objects;
DROP POLICY IF EXISTS justificatifs_update ON storage.objects;
DROP POLICY IF EXISTS justificatifs_delete ON storage.objects;

CREATE POLICY justificatifs_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'absence-justificatifs'
    AND (storage.foldername(name))[1] = current_etablissement_id()::text
    AND (
      coalesce(get_user_role(), '') IN ('admin', 'direction', 'responsable_pedagogique', 'secretaire')
      OR (
        get_user_role() = 'enseignant'
        AND (
          EXISTS (SELECT 1 FROM public.absences a
                   WHERE a.id::text = split_part(storage.filename(name), '.', 1))
          OR EXISTS (SELECT 1 FROM public.adult_absences a
                      WHERE a.id::text = split_part(storage.filename(name), '.', 1))
        )
      )
    )
  );

CREATE POLICY justificatifs_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'absence-justificatifs'
    AND (storage.foldername(name))[1] = current_etablissement_id()::text
    AND (
      coalesce(get_user_role(), '') IN ('admin', 'direction', 'responsable_pedagogique', 'secretaire')
      OR (
        get_user_role() = 'enseignant'
        AND (
          EXISTS (SELECT 1 FROM public.absences a
                   WHERE a.id::text = split_part(storage.filename(name), '.', 1))
          OR EXISTS (SELECT 1 FROM public.adult_absences a
                      WHERE a.id::text = split_part(storage.filename(name), '.', 1))
        )
      )
    )
  );

CREATE POLICY justificatifs_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'absence-justificatifs'
    AND (storage.foldername(name))[1] = current_etablissement_id()::text
    AND (
      coalesce(get_user_role(), '') IN ('admin', 'direction', 'responsable_pedagogique', 'secretaire')
      OR (
        get_user_role() = 'enseignant'
        AND (
          EXISTS (SELECT 1 FROM public.absences a
                   WHERE a.id::text = split_part(storage.filename(name), '.', 1))
          OR EXISTS (SELECT 1 FROM public.adult_absences a
                      WHERE a.id::text = split_part(storage.filename(name), '.', 1))
        )
      )
    )
  )
  WITH CHECK (
    bucket_id = 'absence-justificatifs'
    AND (storage.foldername(name))[1] = current_etablissement_id()::text
    AND (
      coalesce(get_user_role(), '') IN ('admin', 'direction', 'responsable_pedagogique', 'secretaire')
      OR (
        get_user_role() = 'enseignant'
        AND (
          EXISTS (SELECT 1 FROM public.absences a
                   WHERE a.id::text = split_part(storage.filename(name), '.', 1))
          OR EXISTS (SELECT 1 FROM public.adult_absences a
                      WHERE a.id::text = split_part(storage.filename(name), '.', 1))
        )
      )
    )
  );

CREATE POLICY justificatifs_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'absence-justificatifs'
    AND (storage.foldername(name))[1] = current_etablissement_id()::text
    AND (
      coalesce(get_user_role(), '') IN ('admin', 'direction', 'responsable_pedagogique', 'secretaire')
      OR (
        get_user_role() = 'enseignant'
        AND (
          EXISTS (SELECT 1 FROM public.absences a
                   WHERE a.id::text = split_part(storage.filename(name), '.', 1))
          OR EXISTS (SELECT 1 FROM public.adult_absences a
                      WHERE a.id::text = split_part(storage.filename(name), '.', 1))
        )
      )
    )
  );

-- ── Table des pieces jointes d'avertissement ───────────────────────────────
DROP POLICY IF EXISTS warning_attachments_select ON public.student_warning_attachments;
DROP POLICY IF EXISTS warning_attachments_insert ON public.student_warning_attachments;
DROP POLICY IF EXISTS warning_attachments_delete ON public.student_warning_attachments;
DROP POLICY IF EXISTS warning_attachments_write ON public.student_warning_attachments;

-- Lecture : l'avertissement est visible sous la RLS de `student_warnings`
-- (ecole + role, enseignant pour ses eleves).
CREATE POLICY warning_attachments_select ON public.student_warning_attachments
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.student_warnings w
             WHERE w.id = student_warning_attachments.warning_id)
  );

CREATE POLICY warning_attachments_write ON public.student_warning_attachments
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.student_warnings w
             WHERE w.id = student_warning_attachments.warning_id
               AND w.etablissement_id = current_etablissement_id())
    AND coalesce(get_user_role(), '') IN ('admin', 'direction', 'responsable_pedagogique', 'secretaire')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.student_warnings w
             WHERE w.id = student_warning_attachments.warning_id
               AND w.etablissement_id = current_etablissement_id())
    AND coalesce(get_user_role(), '') IN ('admin', 'direction', 'responsable_pedagogique', 'secretaire')
  );

-- Registre des migrations (voir supabase/migrations/README.md).
SELECT enregistrer_migration('secure-storage-documents-roles.sql', '75061a97164b3c0399c6c7705ed7b22a94c91bb1c06cb805ff262fb53741685d');
