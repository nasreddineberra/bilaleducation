-- ============================================================================
-- BILAL EDUCATION — Bucket `bulletins` PUBLIC → PRIVÉ + URL signées
-- ----------------------------------------------------------------------------
-- Les PDF de bulletins (relevés de notes NOMINATIFS) étaient servis par un
-- bucket PUBLIC (`getPublicUrl`) → lisibles sans authentification par quiconque
-- a/devine l'URL. On passe le bucket en PRIVÉ, borné et cloisonné par
-- établissement ; la consultation se fait par URL SIGNÉE générée à la demande
-- (même schéma que justificatifs d'absence, documents élève/enseignant, PJ
-- communications, dépenses).
--
-- Le chemin est DÉJÀ cloisonné : {etablissement_id}/[adultes/]{annee}/{periode}/
-- {participant}.pdf → aucun fichier à déplacer, aucun ménage d'objets.
--
-- Lecteurs autorisés : admin / direction / secretaire / responsable_pedagogique
-- / enseignant (comptable EXCLU). Écriture (archivage/désarchivage) : admin /
-- direction (upsert → policies INSERT + UPDATE + DELETE).
--
-- `file_url` (URL publique persistée) n'a plus de sens : on cesse de l'écrire et
-- de la lire (tout passe par `file_path` → URL signée). La colonne est rendue
-- NULLABLE (le DROP COLUMN physique est un suivi trivial une fois vérifié en
-- prod). NE PAS toucher `storage.objects` (DELETE interdit → 42501).
--
-- Idempotent. À RELIRE puis exécuter dans Supabase SQL Editor.
-- ============================================================================

-- ─── 1. Bucket privé, borné ─────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('bulletins', 'bulletins', false)
ON CONFLICT (id) DO NOTHING;

UPDATE storage.buckets
SET public             = false,
    file_size_limit    = 1048576,   -- 1 Mo (un bulletin PDF texte + logo pèse ~100-300 Ko)
    allowed_mime_types = ARRAY['application/pdf']
WHERE id = 'bulletins';

-- ─── 2. Policies storage cloisonnées par établissement ──────────────────────
-- Chemin imposé : {etablissement_id}/... → un établissement ne lit ni n'écrit
-- dans le dossier d'un autre. La génération d'URL signée exige le droit SELECT
-- (elle gouverne donc « qui peut produire un lien »).

DROP POLICY IF EXISTS "bulletins_pdf_select" ON storage.objects;
CREATE POLICY bulletins_pdf_select ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'bulletins'
    AND coalesce(get_user_role(), '') IN ('admin', 'direction', 'secretaire', 'responsable_pedagogique', 'enseignant')
    AND (storage.foldername(name))[1] = current_etablissement_id()::text
  );

DROP POLICY IF EXISTS "bulletins_pdf_insert" ON storage.objects;
CREATE POLICY bulletins_pdf_insert ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'bulletins'
    AND coalesce(get_user_role(), '') IN ('admin', 'direction')
    AND (storage.foldername(name))[1] = current_etablissement_id()::text
  );

-- UPDATE nécessaire car l'archivage upload en `upsert: true` (ré-archivage).
DROP POLICY IF EXISTS "bulletins_pdf_update" ON storage.objects;
CREATE POLICY bulletins_pdf_update ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'bulletins'
    AND coalesce(get_user_role(), '') IN ('admin', 'direction')
    AND (storage.foldername(name))[1] = current_etablissement_id()::text
  );

DROP POLICY IF EXISTS "bulletins_pdf_delete" ON storage.objects;
CREATE POLICY bulletins_pdf_delete ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'bulletins'
    AND coalesce(get_user_role(), '') IN ('admin', 'direction')
    AND (storage.foldername(name))[1] = current_etablissement_id()::text
  );

-- ─── 3. `file_url` : on cesse de l'écrire → rendue nullable ─────────────────
-- (DROP COLUMN physique = suivi trivial une fois le code déployé et vérifié.)
ALTER TABLE bulletin_archives       ALTER COLUMN file_url DROP NOT NULL;
ALTER TABLE adult_bulletin_archives ALTER COLUMN file_url DROP NOT NULL;

SELECT 'Bucket bulletins privé (1 Mo, application/pdf), policies cloisonnées (lecture 5 rôles, écriture admin/direction) ; file_url nullable.' AS status;
