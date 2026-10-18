-- ============================================================================
-- STORAGE : SUPPRESSION DES ANCIENNES POLICIES OUVERTES (18 octobre 2026)
--
-- Les policies s'ADDITIONNENT. Des policies d'origine (tableau de bord
-- Supabase) etaient restees a cote des policies strictes posees depuis, et
-- rouvraient tout :
--   - bulletins : « Bulletins publics en lecture » (SELECT pour TOUT LE MONDE,
--     anonyme compris, toutes ecoles) ; Upload / Update / Delete sans role.
--     `secure-bulletins-bucket.sql` (25/07) a pose `bulletins_pdf_*` sans
--     retirer celles-ci. Les `bulletins_pdf_*` restent seules.
--   - documents-expenses : `expenses_read` (SELECT pour tout le monde),
--     `expenses_upload`, `expenses_delete` (tout compte connecte, toutes
--     ecoles). Les `expenses_docs_*` restent seules.
--   - etablissement-logos : depot, remplacement, suppression par tout compte
--     connecte, toutes ecoles. Remplaces par admin / direction dans le dossier
--     de leur ecole ; la lecture publique reste (le logo s'affiche par URL
--     publique). Doublon de lecture « Delete logo etablissement wj1e8h_1 »
--     retire.
--   - student-photos : depot, lecture, suppression par tout compte connecte.
--     Aucun code n'utilise ce bucket : plus aucune policy.
-- Les buckets `bulletins`, `documents-expenses` et `student-photos` etaient
-- VIDES a la correction : aucune donnee n'a pu fuiter.
--
-- rooms / materials : memes droits, mais `get_user_role()` et
-- `current_etablissement_id()` au lieu de `profiles.role` (l'editeur en
-- intervention n'y etait pas admin).
--
-- Le SQL ne touche pas `storage.objects` (seulement ses policies).
-- Controle : supabase/controles/14-storage-cloisonnement.sql.
-- ============================================================================

-- ── Bulletins ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Bulletins publics en lecture" ON storage.objects;
DROP POLICY IF EXISTS "Upload bulletins" ON storage.objects;
DROP POLICY IF EXISTS "Update bulletins" ON storage.objects;
DROP POLICY IF EXISTS "Delete bulletins" ON storage.objects;

-- ── Justificatifs de depenses ──────────────────────────────────────────────
DROP POLICY IF EXISTS expenses_read ON storage.objects;
DROP POLICY IF EXISTS expenses_upload ON storage.objects;
DROP POLICY IF EXISTS expenses_delete ON storage.objects;

-- ── Photos d'eleves (bucket inutilise) ─────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated users can upload vhb7mb_0" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete vhb7mb_0" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete vhb7mb_1" ON storage.objects;

-- ── Logos ──────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Upload logo etablissement wj1e8h_0" ON storage.objects;
DROP POLICY IF EXISTS "Update logo etablissement wj1e8h_0" ON storage.objects;
DROP POLICY IF EXISTS "Delete logo etablissement wj1e8h_0" ON storage.objects;
DROP POLICY IF EXISTS "Delete logo etablissement wj1e8h_1" ON storage.objects;
DROP POLICY IF EXISTS logos_insert ON storage.objects;
DROP POLICY IF EXISTS logos_update ON storage.objects;
DROP POLICY IF EXISTS logos_delete ON storage.objects;

CREATE POLICY logos_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'etablissement-logos'
    AND coalesce(get_user_role(), '') IN ('admin', 'direction')
    AND (storage.foldername(name))[1] = current_etablissement_id()::text
  );

CREATE POLICY logos_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'etablissement-logos'
    AND coalesce(get_user_role(), '') IN ('admin', 'direction')
    AND (storage.foldername(name))[1] = current_etablissement_id()::text
  )
  WITH CHECK (
    bucket_id = 'etablissement-logos'
    AND coalesce(get_user_role(), '') IN ('admin', 'direction')
    AND (storage.foldername(name))[1] = current_etablissement_id()::text
  );

CREATE POLICY logos_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'etablissement-logos'
    AND coalesce(get_user_role(), '') IN ('admin', 'direction')
    AND (storage.foldername(name))[1] = current_etablissement_id()::text
  );

-- ── Salles et ressources ───────────────────────────────────────────────────
DROP POLICY IF EXISTS rooms_select ON public.rooms;
DROP POLICY IF EXISTS rooms_insert ON public.rooms;
DROP POLICY IF EXISTS rooms_update ON public.rooms;
DROP POLICY IF EXISTS rooms_delete ON public.rooms;
DROP POLICY IF EXISTS materials_select ON public.materials;
DROP POLICY IF EXISTS materials_insert ON public.materials;
DROP POLICY IF EXISTS materials_update ON public.materials;
DROP POLICY IF EXISTS materials_delete ON public.materials;

CREATE POLICY rooms_select ON public.rooms
  FOR SELECT TO authenticated
  USING (etablissement_id = current_etablissement_id());
CREATE POLICY rooms_insert ON public.rooms
  FOR INSERT TO authenticated
  WITH CHECK (etablissement_id = current_etablissement_id()
              AND coalesce(get_user_role(), '') IN ('admin', 'direction', 'secretaire'));
CREATE POLICY rooms_update ON public.rooms
  FOR UPDATE TO authenticated
  USING (etablissement_id = current_etablissement_id()
         AND coalesce(get_user_role(), '') IN ('admin', 'direction', 'secretaire'))
  WITH CHECK (etablissement_id = current_etablissement_id()
              AND coalesce(get_user_role(), '') IN ('admin', 'direction', 'secretaire'));
CREATE POLICY rooms_delete ON public.rooms
  FOR DELETE TO authenticated
  USING (etablissement_id = current_etablissement_id()
         AND coalesce(get_user_role(), '') IN ('admin', 'direction', 'secretaire'));

CREATE POLICY materials_select ON public.materials
  FOR SELECT TO authenticated
  USING (etablissement_id = current_etablissement_id());
CREATE POLICY materials_insert ON public.materials
  FOR INSERT TO authenticated
  WITH CHECK (etablissement_id = current_etablissement_id()
              AND coalesce(get_user_role(), '') IN ('admin', 'direction', 'secretaire'));
CREATE POLICY materials_update ON public.materials
  FOR UPDATE TO authenticated
  USING (etablissement_id = current_etablissement_id()
         AND coalesce(get_user_role(), '') IN ('admin', 'direction', 'secretaire'))
  WITH CHECK (etablissement_id = current_etablissement_id()
              AND coalesce(get_user_role(), '') IN ('admin', 'direction', 'secretaire'));
CREATE POLICY materials_delete ON public.materials
  FOR DELETE TO authenticated
  USING (etablissement_id = current_etablissement_id()
         AND coalesce(get_user_role(), '') IN ('admin', 'direction', 'secretaire'));

-- Registre des migrations (voir supabase/migrations/README.md).
SELECT enregistrer_migration('secure-storage-anciennes-policies.sql', '2bc6bf7c3d2565ac516efa09748322ba5b70e402c78fce3a4e73eec70a18c1a8');
