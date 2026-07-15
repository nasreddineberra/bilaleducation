-- ============================================================================
-- Refonte Communications — LOT 1 : securite de l'envoi aux parents.
--
-- Contexte : le module laissait croire que les messages partaient alors que
-- les permissions n'existaient que dans le client, que les pieces jointes
-- etaient publiques, et que n'importe quel role staff pouvait inserer
-- n'importe quel type d'annonce.
--
-- Decisions utilisateur (15/07/2026) :
--   - Communication aux parents = admin / direction / secretaire / resp. pedagogique.
--     Les enseignants ne communiquent que les devoirs (cahier de texte).
--     Le comptable communique par la page Financements (transactionnel), pas ici.
--   - « Tous les parents enregistres » (toute la base, non-inscrits compris)
--     = admin / direction / secretaire uniquement. C'est le seul mode qui atteint
--     les non-inscrits : « Parents choisis » pioche parmi les inscrits.
--   - Pieces jointes : 1 Mo maximum.
--
-- Idempotent.
-- ============================================================================

-- ─── 1. Type d'annonce controle en base (et non plus seulement dans l'UI) ────
-- L'ancienne policy autorisait TOUS les roles staff a inserer TOUS les types :
-- un enseignant pouvait cibler `all_registered`. Le garde-fou client
-- (TARGET_PERMISSIONS) n'etait qu'un decor.

DROP POLICY IF EXISTS "Staff can create announcements" ON announcements;

CREATE POLICY "announcements_insert_scoped" ON announcements
  FOR INSERT
  WITH CHECK (
    etablissement_id = current_etablissement_id()
    AND (
      -- Communication aux parents
      (announcement_type IN ('all_active', 'class', 'selected')
        AND coalesce(get_user_role(), '') IN ('admin', 'direction', 'secretaire', 'responsable_pedagogique'))
      OR
      -- Toute la base (non-inscrits compris) : plus restreint
      (announcement_type = 'all_registered'
        AND coalesce(get_user_role(), '') IN ('admin', 'direction', 'secretaire'))
      OR
      -- Messagerie interne : tout le staff (module traite a son tour)
      (announcement_type = 'staff'
        AND coalesce(get_user_role(), '') IN ('admin', 'direction', 'secretaire',
                                              'responsable_pedagogique', 'comptable', 'enseignant'))
    )
  );

-- NB : la policy « Admin and direction can manage all announcements » (FOR ALL)
-- reste en place et donne tous les droits a admin/direction — voulu.

-- ─── 2. Bucket des pieces jointes : public → prive ──────────────────────────
-- Un bucket public expose les circulaires a quiconque connait l'URL, et rend
-- l'URL indexable. Regle projet (10/07) : documents = bucket prive + URL signee.

UPDATE storage.buckets
SET public             = false,
    file_size_limit    = 1048576,   -- 1 Mo par fichier (le total est garde cote action)
    allowed_mime_types = ARRAY[
      'application/pdf',
      'image/jpeg', 'image/png', 'image/webp',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ]
WHERE id = 'communication-attachments';

-- ─── 3. Policies storage : cloisonnement par etablissement ─────────────────
-- Les fichiers sont ranges sous `{etablissement_id}/...` → cloisonnement possible.
-- L'ancien chemin `communications/...` ne l'etait pas ; verifie le 15/07/2026 :
-- 0 fichier et 0 ligne dans announcement_attachments → aucune clause d'heritage
-- a prevoir, la policy peut rester stricte.

DROP POLICY IF EXISTS "Communication PJ publiques en lecture"   ON storage.objects;
DROP POLICY IF EXISTS "Communication PJ upload authentifie"     ON storage.objects;
DROP POLICY IF EXISTS "Communication PJ suppression authentifie" ON storage.objects;

DROP POLICY IF EXISTS "comm_pj_select" ON storage.objects;
CREATE POLICY "comm_pj_select" ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'communication-attachments'
    AND coalesce(get_user_role(), '') IN ('admin', 'direction', 'secretaire',
                                          'responsable_pedagogique', 'comptable', 'enseignant')
    AND (storage.foldername(name))[1] = current_etablissement_id()::text
  );

DROP POLICY IF EXISTS "comm_pj_insert" ON storage.objects;
CREATE POLICY "comm_pj_insert" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'communication-attachments'
    AND coalesce(get_user_role(), '') IN ('admin', 'direction', 'secretaire',
                                          'responsable_pedagogique', 'comptable', 'enseignant')
    AND (storage.foldername(name))[1] = current_etablissement_id()::text
  );

DROP POLICY IF EXISTS "comm_pj_delete" ON storage.objects;
CREATE POLICY "comm_pj_delete" ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'communication-attachments'
    AND coalesce(get_user_role(), '') IN ('admin', 'direction', 'secretaire',
                                          'responsable_pedagogique', 'comptable', 'enseignant')
    AND (storage.foldername(name))[1] = current_etablissement_id()::text
  );

-- ─── 4. Statut « skipped » : foyer sans adresse email connue ───────────────
-- Sans lui, il faudrait marquer `failed` un foyer qu'on n'a jamais tente de
-- joindre — la donnee mentirait sur ce qui s'est passe.

ALTER TABLE announcement_recipients DROP CONSTRAINT IF EXISTS announcement_recipients_email_status_check;
ALTER TABLE announcement_recipients ADD CONSTRAINT announcement_recipients_email_status_check
  CHECK (email_status IN ('pending', 'sent', 'delivered', 'failed', 'skipped'));

ALTER TABLE announcement_staff_recipients DROP CONSTRAINT IF EXISTS announcement_staff_recipients_email_status_check;
ALTER TABLE announcement_staff_recipients ADD CONSTRAINT announcement_staff_recipients_email_status_check
  CHECK (email_status IN ('pending', 'sent', 'delivered', 'failed', 'skipped'));

-- ─── 5. Pieces jointes : stocker le CHEMIN, plus l'URL publique ────────────
-- Le bucket devenant prive, `file_url` (getPublicUrl) ne resout plus rien : on
-- stocke le chemin et on signe a la consultation (meme correctif que les
-- justificatifs d'absence, 10/07).
-- La table est vide (verifie le 15/07/2026) → on REMPLACE la colonne plutot que
-- de laisser cohabiter deux notions concurrentes. `file_url` etait NOT NULL :
-- la garder imposerait de l'alimenter avec une URL qui ne fonctionne plus.

ALTER TABLE announcement_attachments ADD COLUMN IF NOT EXISTS file_path TEXT;
ALTER TABLE announcement_attachments DROP COLUMN IF EXISTS file_url;
ALTER TABLE announcement_attachments ALTER COLUMN file_path SET NOT NULL;

COMMENT ON COLUMN announcement_attachments.file_path IS
  'Chemin dans le bucket prive communication-attachments. URL signee generee a la consultation.';

SELECT 'Communications : type d''annonce controle en base, bucket prive (1 Mo), PJ cloisonnees par etablissement.' AS status;
