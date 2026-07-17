-- ============================================================================
-- Securisation du sous-menu Financements → Situation financiere.
--
-- Deux trous constates a l'audit du 17/07/2026 :
--
--  1. RLS SANS ROLE : `expenses` / `other_revenues` n'etaient filtrees que par
--     tenant → n'importe quel compte de l'etablissement (un ENSEIGNANT) pouvait
--     lire ET ecrire le chiffre d'affaires, le cout des salaires et les
--     depenses. Decision utilisateur : acces = admin / direction / comptable
--     (le trio finance, deja applique a `financement_communications`).
--
--  2. BUCKET PUBLIC : `documents-expenses` etait `public = true`, sans limite de
--     taille ni de type → les factures et justificatifs etaient lisibles par
--     quiconque connait l'URL, sans authentification. Regle projet (10/07) :
--     document sensible = bucket prive + URL signee, jamais getPublicUrl.
--     De plus le chemin (`expenses/<timestamp>.<ext>`) n'etait pas cloisonne
--     par etablissement.
--
-- Tables VIDES au moment de la migration (0 depense / 0 revenu, verifie en base
-- le 17/07/2026) → on durcit sans clause d'heritage et on REMPLACE
-- `document_url` par `document_path` plutot que de laisser cohabiter deux
-- notions concurrentes.
--
-- Idempotent.
-- ============================================================================

-- ─── 1. RLS : reserver les finances au trio finance ────────────────────────
-- `coalesce(get_user_role(), '')` : un role NULL (anonyme) rendrait la garde
-- NULL, donc non bloquante — regle projet.

DROP POLICY IF EXISTS "expenses_select" ON expenses;
DROP POLICY IF EXISTS "expenses_insert" ON expenses;
DROP POLICY IF EXISTS "expenses_update" ON expenses;
DROP POLICY IF EXISTS "expenses_delete" ON expenses;

CREATE POLICY expenses_finance_all ON expenses
  FOR ALL
  USING (
    etablissement_id = current_etablissement_id()
    AND coalesce(get_user_role(), '') IN ('admin', 'direction', 'comptable')
  )
  WITH CHECK (
    etablissement_id = current_etablissement_id()
    AND coalesce(get_user_role(), '') IN ('admin', 'direction', 'comptable')
  );

DROP POLICY IF EXISTS "other_revenues_select" ON other_revenues;
DROP POLICY IF EXISTS "other_revenues_insert" ON other_revenues;
DROP POLICY IF EXISTS "other_revenues_update" ON other_revenues;
DROP POLICY IF EXISTS "other_revenues_delete" ON other_revenues;

CREATE POLICY other_revenues_finance_all ON other_revenues
  FOR ALL
  USING (
    etablissement_id = current_etablissement_id()
    AND coalesce(get_user_role(), '') IN ('admin', 'direction', 'comptable')
  )
  WITH CHECK (
    etablissement_id = current_etablissement_id()
    AND coalesce(get_user_role(), '') IN ('admin', 'direction', 'comptable')
  );

-- ─── 2. Bucket prive, borne, cloisonne ─────────────────────────────────────

INSERT INTO storage.buckets (id, name, public)
VALUES ('documents-expenses', 'documents-expenses', false)
ON CONFLICT (id) DO NOTHING;

UPDATE storage.buckets
SET public             = false,
    file_size_limit    = 2097152,   -- 2 Mo par justificatif (facture PDF ou photo)
    allowed_mime_types = ARRAY[
      'application/pdf',
      'image/jpeg', 'image/png', 'image/webp'
    ]
WHERE id = 'documents-expenses';

-- Chemin impose : {etablissement_id}/<fichier> → un etablissement ne peut ni
-- lire ni ecrire dans le dossier d'un autre.

DROP POLICY IF EXISTS "expenses_docs_select" ON storage.objects;
CREATE POLICY expenses_docs_select ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'documents-expenses'
    AND coalesce(get_user_role(), '') IN ('admin', 'direction', 'comptable')
    AND (storage.foldername(name))[1] = current_etablissement_id()::text
  );

DROP POLICY IF EXISTS "expenses_docs_insert" ON storage.objects;
CREATE POLICY expenses_docs_insert ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'documents-expenses'
    AND coalesce(get_user_role(), '') IN ('admin', 'direction', 'comptable')
    AND (storage.foldername(name))[1] = current_etablissement_id()::text
  );

DROP POLICY IF EXISTS "expenses_docs_delete" ON storage.objects;
CREATE POLICY expenses_docs_delete ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'documents-expenses'
    AND coalesce(get_user_role(), '') IN ('admin', 'direction', 'comptable')
    AND (storage.foldername(name))[1] = current_etablissement_id()::text
  );

-- ─── 3. document_url → document_path ───────────────────────────────────────
-- Le bucket devenant prive, une URL publique ne resout plus rien : on stocke le
-- CHEMIN et on signe a la consultation.

ALTER TABLE expenses ADD COLUMN IF NOT EXISTS document_path TEXT;
ALTER TABLE expenses DROP COLUMN IF EXISTS document_url;

COMMENT ON COLUMN expenses.document_path IS
  'Chemin dans le bucket prive documents-expenses ({etablissement_id}/...). URL signee generee a la consultation.';

-- ─── 4. Menage des fichiers de l'ancien chemin non cloisonne ───────────────
-- PAS ICI : Supabase interdit le DELETE direct sur `storage.objects`
-- (`storage.protect_delete()` → 42501), pour eviter les objets orphelins.
-- Le ménage se fait par l'API Storage (script service-role jetable) :
--   supabase.storage.from('documents-expenses').remove([...])
-- Concerne les fichiers sous `expenses/...`, qui ne correspondent a aucun
-- etablissement et qu'aucune policy ne rend plus lisibles.

SELECT 'Financements : expenses/other_revenues reservees au trio finance, bucket prive (2 Mo) cloisonne, document_url → document_path.' AS status;
