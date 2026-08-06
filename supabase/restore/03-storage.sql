-- ── Compartiments ──────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('absence-justificatifs', 'absence-justificatifs', 'f', NULL, NULL) ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('bulletins', 'bulletins', 'f', 1048576, '{application/pdf}'::text[]) ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('communication-attachments', 'communication-attachments', 'f', 1048576, '{application/pdf,image/jpeg,image/png,image/webp,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet}'::text[]) ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('documents-expenses', 'documents-expenses', 'f', 2097152, '{application/pdf,image/jpeg,image/png,image/webp}'::text[]) ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('etablissement-logos', 'etablissement-logos', 't', NULL, NULL) ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('student-documents', 'student-documents', 'f', NULL, NULL) ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('student-photos', 'student-photos', 't', NULL, NULL) ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('teacher-documents', 'teacher-documents', 'f', 1048576, NULL) ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('warning-attachments', 'warning-attachments', 'f', NULL, NULL) ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ── Politiques sur storage.objects ─────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated users can delete vhb7mb_0" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete vhb7mb_1" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload vhb7mb_0" ON storage.objects;
DROP POLICY IF EXISTS "Bulletins publics en lecture" ON storage.objects;
DROP POLICY IF EXISTS "Delete bulletins" ON storage.objects;
DROP POLICY IF EXISTS "Delete logo etablissement wj1e8h_0" ON storage.objects;
DROP POLICY IF EXISTS "Delete logo etablissement wj1e8h_1" ON storage.objects;
DROP POLICY IF EXISTS "Justificatifs lisibles par etablissement" ON storage.objects;
DROP POLICY IF EXISTS "Justificatifs supprimables par etablissement" ON storage.objects;
DROP POLICY IF EXISTS "Justificatifs uploadables par etablissement" ON storage.objects;
DROP POLICY IF EXISTS "Logos publics en lecture wj1e8h_0" ON storage.objects;
DROP POLICY IF EXISTS "Student documents lisibles par etablissement" ON storage.objects;
DROP POLICY IF EXISTS "Student documents supprimables par etablissement" ON storage.objects;
DROP POLICY IF EXISTS "Student documents uploadables par etablissement" ON storage.objects;
DROP POLICY IF EXISTS "Teacher documents lisibles par etablissement" ON storage.objects;
DROP POLICY IF EXISTS "Teacher documents supprimables par etablissement" ON storage.objects;
DROP POLICY IF EXISTS "Teacher documents uploadables par etablissement" ON storage.objects;
DROP POLICY IF EXISTS "Update bulletins" ON storage.objects;
DROP POLICY IF EXISTS "Update logo etablissement wj1e8h_0" ON storage.objects;
DROP POLICY IF EXISTS "Upload bulletins" ON storage.objects;
DROP POLICY IF EXISTS "Upload logo etablissement wj1e8h_0" ON storage.objects;
DROP POLICY IF EXISTS "Warning attachments lisibles par etablissement" ON storage.objects;
DROP POLICY IF EXISTS "Warning attachments supprimables par etablissement" ON storage.objects;
DROP POLICY IF EXISTS "Warning attachments uploadables par etablissement" ON storage.objects;
DROP POLICY IF EXISTS bulletins_pdf_delete ON storage.objects;
DROP POLICY IF EXISTS bulletins_pdf_insert ON storage.objects;
DROP POLICY IF EXISTS bulletins_pdf_select ON storage.objects;
DROP POLICY IF EXISTS bulletins_pdf_update ON storage.objects;
DROP POLICY IF EXISTS comm_pj_delete ON storage.objects;
DROP POLICY IF EXISTS comm_pj_insert ON storage.objects;
DROP POLICY IF EXISTS comm_pj_select ON storage.objects;
DROP POLICY IF EXISTS expenses_delete ON storage.objects;
DROP POLICY IF EXISTS expenses_docs_delete ON storage.objects;
DROP POLICY IF EXISTS expenses_docs_insert ON storage.objects;
DROP POLICY IF EXISTS expenses_docs_select ON storage.objects;
DROP POLICY IF EXISTS expenses_read ON storage.objects;
DROP POLICY IF EXISTS expenses_upload ON storage.objects;

CREATE POLICY "Authenticated users can delete vhb7mb_0" ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated USING ((bucket_id = 'student-photos'::text));
CREATE POLICY "Authenticated users can delete vhb7mb_1" ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated USING ((bucket_id = 'student-photos'::text));
CREATE POLICY "Authenticated users can upload vhb7mb_0" ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((bucket_id = 'student-photos'::text));
CREATE POLICY "Bulletins publics en lecture" ON storage.objects AS PERMISSIVE FOR SELECT TO public USING ((bucket_id = 'bulletins'::text));
CREATE POLICY "Delete bulletins" ON storage.objects AS PERMISSIVE FOR DELETE TO public USING (((bucket_id = 'bulletins'::text) AND (auth.role() = 'authenticated'::text) AND ((storage.foldername(name))[1] = ( SELECT (profiles.etablissement_id)::text AS etablissement_id
   FROM profiles
  WHERE (profiles.id = auth.uid())))));
CREATE POLICY "Delete logo etablissement wj1e8h_0" ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated USING ((bucket_id = 'etablissement-logos'::text));
CREATE POLICY "Delete logo etablissement wj1e8h_1" ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated USING ((bucket_id = 'etablissement-logos'::text));
CREATE POLICY "Justificatifs lisibles par etablissement" ON storage.objects AS PERMISSIVE FOR SELECT TO public USING (((bucket_id = 'absence-justificatifs'::text) AND (auth.role() = 'authenticated'::text) AND ((storage.foldername(name))[1] IN ( SELECT (profiles.etablissement_id)::text AS etablissement_id
   FROM profiles
  WHERE (profiles.id = auth.uid())))));
CREATE POLICY "Justificatifs supprimables par etablissement" ON storage.objects AS PERMISSIVE FOR DELETE TO public USING (((bucket_id = 'absence-justificatifs'::text) AND (auth.role() = 'authenticated'::text) AND ((storage.foldername(name))[1] IN ( SELECT (profiles.etablissement_id)::text AS etablissement_id
   FROM profiles
  WHERE (profiles.id = auth.uid())))));
CREATE POLICY "Justificatifs uploadables par etablissement" ON storage.objects AS PERMISSIVE FOR INSERT TO public WITH CHECK (((bucket_id = 'absence-justificatifs'::text) AND (auth.role() = 'authenticated'::text) AND ((storage.foldername(name))[1] IN ( SELECT (profiles.etablissement_id)::text AS etablissement_id
   FROM profiles
  WHERE (profiles.id = auth.uid())))));
CREATE POLICY "Logos publics en lecture wj1e8h_0" ON storage.objects AS PERMISSIVE FOR SELECT TO public USING ((bucket_id = 'etablissement-logos'::text));
CREATE POLICY "Student documents lisibles par etablissement" ON storage.objects AS PERMISSIVE FOR SELECT TO public USING (((bucket_id = 'student-documents'::text) AND (auth.role() = 'authenticated'::text) AND ((storage.foldername(name))[1] IN ( SELECT (profiles.etablissement_id)::text AS etablissement_id
   FROM profiles
  WHERE (profiles.id = auth.uid())))));
CREATE POLICY "Student documents supprimables par etablissement" ON storage.objects AS PERMISSIVE FOR DELETE TO public USING (((bucket_id = 'student-documents'::text) AND (auth.role() = 'authenticated'::text) AND ((storage.foldername(name))[1] IN ( SELECT (profiles.etablissement_id)::text AS etablissement_id
   FROM profiles
  WHERE (profiles.id = auth.uid())))));
CREATE POLICY "Student documents uploadables par etablissement" ON storage.objects AS PERMISSIVE FOR INSERT TO public WITH CHECK (((bucket_id = 'student-documents'::text) AND (auth.role() = 'authenticated'::text) AND ((storage.foldername(name))[1] IN ( SELECT (profiles.etablissement_id)::text AS etablissement_id
   FROM profiles
  WHERE (profiles.id = auth.uid())))));
CREATE POLICY "Teacher documents lisibles par etablissement" ON storage.objects AS PERMISSIVE FOR SELECT TO public USING (((bucket_id = 'teacher-documents'::text) AND (auth.role() = 'authenticated'::text) AND ((storage.foldername(name))[1] IN ( SELECT (profiles.etablissement_id)::text AS etablissement_id
   FROM profiles
  WHERE (profiles.id = auth.uid())))));
CREATE POLICY "Teacher documents supprimables par etablissement" ON storage.objects AS PERMISSIVE FOR DELETE TO public USING (((bucket_id = 'teacher-documents'::text) AND (auth.role() = 'authenticated'::text) AND ((storage.foldername(name))[1] IN ( SELECT (profiles.etablissement_id)::text AS etablissement_id
   FROM profiles
  WHERE (profiles.id = auth.uid())))));
CREATE POLICY "Teacher documents uploadables par etablissement" ON storage.objects AS PERMISSIVE FOR INSERT TO public WITH CHECK (((bucket_id = 'teacher-documents'::text) AND (auth.role() = 'authenticated'::text) AND ((storage.foldername(name))[1] IN ( SELECT (profiles.etablissement_id)::text AS etablissement_id
   FROM profiles
  WHERE (profiles.id = auth.uid())))));
CREATE POLICY "Update bulletins" ON storage.objects AS PERMISSIVE FOR UPDATE TO public USING (((bucket_id = 'bulletins'::text) AND (auth.role() = 'authenticated'::text) AND ((storage.foldername(name))[1] = ( SELECT (profiles.etablissement_id)::text AS etablissement_id
   FROM profiles
  WHERE (profiles.id = auth.uid())))));
CREATE POLICY "Update logo etablissement wj1e8h_0" ON storage.objects AS PERMISSIVE FOR UPDATE TO authenticated USING ((bucket_id = 'etablissement-logos'::text));
CREATE POLICY "Upload bulletins" ON storage.objects AS PERMISSIVE FOR INSERT TO public WITH CHECK (((bucket_id = 'bulletins'::text) AND (auth.role() = 'authenticated'::text) AND ((storage.foldername(name))[1] = ( SELECT (profiles.etablissement_id)::text AS etablissement_id
   FROM profiles
  WHERE (profiles.id = auth.uid())))));
CREATE POLICY "Upload logo etablissement wj1e8h_0" ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((bucket_id = 'etablissement-logos'::text));
CREATE POLICY "Warning attachments lisibles par etablissement" ON storage.objects AS PERMISSIVE FOR SELECT TO public USING (((bucket_id = 'warning-attachments'::text) AND (auth.role() = 'authenticated'::text) AND ((storage.foldername(name))[1] IN ( SELECT (profiles.etablissement_id)::text AS etablissement_id
   FROM profiles
  WHERE (profiles.id = auth.uid())))));
CREATE POLICY "Warning attachments supprimables par etablissement" ON storage.objects AS PERMISSIVE FOR DELETE TO public USING (((bucket_id = 'warning-attachments'::text) AND (auth.role() = 'authenticated'::text) AND ((storage.foldername(name))[1] IN ( SELECT (profiles.etablissement_id)::text AS etablissement_id
   FROM profiles
  WHERE (profiles.id = auth.uid())))));
CREATE POLICY "Warning attachments uploadables par etablissement" ON storage.objects AS PERMISSIVE FOR INSERT TO public WITH CHECK (((bucket_id = 'warning-attachments'::text) AND (auth.role() = 'authenticated'::text) AND ((storage.foldername(name))[1] IN ( SELECT (profiles.etablissement_id)::text AS etablissement_id
   FROM profiles
  WHERE (profiles.id = auth.uid())))));
CREATE POLICY bulletins_pdf_delete ON storage.objects AS PERMISSIVE FOR DELETE TO public USING (((bucket_id = 'bulletins'::text) AND (COALESCE(get_user_role(), ''::text) = ANY (ARRAY['admin'::text, 'direction'::text])) AND ((storage.foldername(name))[1] = (current_etablissement_id())::text)));
CREATE POLICY bulletins_pdf_insert ON storage.objects AS PERMISSIVE FOR INSERT TO public WITH CHECK (((bucket_id = 'bulletins'::text) AND (COALESCE(get_user_role(), ''::text) = ANY (ARRAY['admin'::text, 'direction'::text])) AND ((storage.foldername(name))[1] = (current_etablissement_id())::text)));
CREATE POLICY bulletins_pdf_select ON storage.objects AS PERMISSIVE FOR SELECT TO public USING (((bucket_id = 'bulletins'::text) AND (COALESCE(get_user_role(), ''::text) = ANY (ARRAY['admin'::text, 'direction'::text, 'secretaire'::text, 'responsable_pedagogique'::text, 'enseignant'::text])) AND ((storage.foldername(name))[1] = (current_etablissement_id())::text)));
CREATE POLICY bulletins_pdf_update ON storage.objects AS PERMISSIVE FOR UPDATE TO public USING (((bucket_id = 'bulletins'::text) AND (COALESCE(get_user_role(), ''::text) = ANY (ARRAY['admin'::text, 'direction'::text])) AND ((storage.foldername(name))[1] = (current_etablissement_id())::text)));
CREATE POLICY comm_pj_delete ON storage.objects AS PERMISSIVE FOR DELETE TO public USING (((bucket_id = 'communication-attachments'::text) AND (COALESCE(get_user_role(), ''::text) = ANY (ARRAY['admin'::text, 'direction'::text, 'secretaire'::text, 'responsable_pedagogique'::text, 'comptable'::text, 'enseignant'::text])) AND ((storage.foldername(name))[1] = (current_etablissement_id())::text)));
CREATE POLICY comm_pj_insert ON storage.objects AS PERMISSIVE FOR INSERT TO public WITH CHECK (((bucket_id = 'communication-attachments'::text) AND (COALESCE(get_user_role(), ''::text) = ANY (ARRAY['admin'::text, 'direction'::text, 'secretaire'::text, 'responsable_pedagogique'::text, 'comptable'::text, 'enseignant'::text])) AND ((storage.foldername(name))[1] = (current_etablissement_id())::text)));
CREATE POLICY comm_pj_select ON storage.objects AS PERMISSIVE FOR SELECT TO public USING (((bucket_id = 'communication-attachments'::text) AND (COALESCE(get_user_role(), ''::text) = ANY (ARRAY['admin'::text, 'direction'::text, 'secretaire'::text, 'responsable_pedagogique'::text, 'comptable'::text, 'enseignant'::text])) AND ((storage.foldername(name))[1] = (current_etablissement_id())::text)));
CREATE POLICY expenses_delete ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated USING ((bucket_id = 'documents-expenses'::text));
CREATE POLICY expenses_docs_delete ON storage.objects AS PERMISSIVE FOR DELETE TO public USING (((bucket_id = 'documents-expenses'::text) AND (COALESCE(get_user_role(), ''::text) = ANY (ARRAY['admin'::text, 'direction'::text, 'comptable'::text])) AND ((storage.foldername(name))[1] = (current_etablissement_id())::text)));
CREATE POLICY expenses_docs_insert ON storage.objects AS PERMISSIVE FOR INSERT TO public WITH CHECK (((bucket_id = 'documents-expenses'::text) AND (COALESCE(get_user_role(), ''::text) = ANY (ARRAY['admin'::text, 'direction'::text, 'comptable'::text])) AND ((storage.foldername(name))[1] = (current_etablissement_id())::text)));
CREATE POLICY expenses_docs_select ON storage.objects AS PERMISSIVE FOR SELECT TO public USING (((bucket_id = 'documents-expenses'::text) AND (COALESCE(get_user_role(), ''::text) = ANY (ARRAY['admin'::text, 'direction'::text, 'comptable'::text])) AND ((storage.foldername(name))[1] = (current_etablissement_id())::text)));
CREATE POLICY expenses_read ON storage.objects AS PERMISSIVE FOR SELECT TO public USING ((bucket_id = 'documents-expenses'::text));
CREATE POLICY expenses_upload ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((bucket_id = 'documents-expenses'::text));
