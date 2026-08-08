-- ============================================================================
-- DEMANDES DE SUPPORT — de l'école vers l'éditeur
-- ============================================================================
--
-- POURQUOI UNE TABLE, ET PAS UN SIMPLE EMAIL.
-- La demande est ÉCRITE d'abord, l'email n'est qu'une notification. Sans cela,
-- « ma messagerie ne fonctionne plus » — un motif de demande parfaitement
-- ordinaire — serait la seule demande incapable de vous parvenir : l'école
-- croirait avoir écrit, et personne ne saurait qu'elle a essayé.
--
-- L'école dépose et relit ; elle ne peut ni modifier ni supprimer (aucune
-- policy UPDATE ni DELETE). Une demande envoyée est un fait, pas un brouillon.
-- L'éditeur lit depuis sa console, en service-role, donc hors RLS.
--
-- PAS DE TRIGGER D'AUDIT. `fn_audit_log()` recopie `to_jsonb(NEW)` dans
-- `audit_logs.new_data` : le message y serait dupliqué intégralement, pour une
-- écriture qui ne modifie aucune donnée de l'école. La table EST la trace.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.support_requests (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  etablissement_id uuid NOT NULL REFERENCES public.etablissements(id) ON DELETE CASCADE,

  -- Identité figée à l'envoi, EN PLUS de la référence au profil : un compte
  -- supprimé ne doit pas effacer l'auteur d'une demande passée. `created_by`
  -- passe alors à NULL, le nom et l'adresse restent lisibles.
  created_by       uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  author_name      text NOT NULL,
  author_email     text NOT NULL,
  author_role      text NOT NULL,

  category         text NOT NULL,
  impact           text,
  subject          text NOT NULL,
  message          text NOT NULL,

  -- Chemin dans le bucket PRIVÉ, jamais une URL : une URL signée expirerait
  -- avant qu'on ouvre la demande. On signe à la consultation.
  attachment_path  text,

  -- Page d'origine, version, navigateur. Fourni par le client, donc à traiter
  -- comme du texte d'affichage : jamais interprété, toujours échappé.
  context          jsonb NOT NULL DEFAULT '{}'::jsonb,

  email_status     text NOT NULL DEFAULT 'pending',
  email_error      text,
  created_at       timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT support_category_valide CHECK (
    category IN ('assistance', 'incident', 'information', 'suggestion', 'facturation', 'autre')
  ),
  CONSTRAINT support_impact_valide CHECK (
    impact IS NULL OR impact IN ('bloquant', 'genant', 'mineur')
  ),
  -- L'impact ne veut rien dire hors d'un incident : la base le refuse, plutôt
  -- que de laisser une donnée qui ne s'interprète pas.
  CONSTRAINT support_impact_incident_seulement CHECK (
    impact IS NULL OR category = 'incident'
  ),
  CONSTRAINT support_subject_longueur CHECK (char_length(subject) BETWEEN 1 AND 150),
  CONSTRAINT support_message_longueur CHECK (char_length(message) BETWEEN 1 AND 5000),
  CONSTRAINT support_email_status_valide CHECK (
    email_status IN ('pending', 'sent', 'failed')
  )
);

COMMENT ON TABLE public.support_requests IS
  'Demandes de support déposées par une école. Écrites AVANT la notification par email, pour qu''une messagerie en panne ne fasse pas disparaître la demande.';

CREATE INDEX IF NOT EXISTS idx_support_requests_etab_date
  ON public.support_requests (etablissement_id, created_at DESC);

-- ── RLS ─────────────────────────────────────────────────────────────────────
-- Règle du projet : `coalesce(get_user_role(), '')`, sans quoi un rôle NULL
-- (anonyme) rend la comparaison NULL et la garde ne mord pas.

ALTER TABLE public.support_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS support_requests_insert ON public.support_requests;
CREATE POLICY support_requests_insert ON public.support_requests
  FOR INSERT
  WITH CHECK (
    etablissement_id = current_etablissement_id()
    AND coalesce(get_user_role(), '') IN ('admin', 'direction')
  );

DROP POLICY IF EXISTS support_requests_select ON public.support_requests;
CREATE POLICY support_requests_select ON public.support_requests
  FOR SELECT
  USING (
    etablissement_id = current_etablissement_id()
    AND coalesce(get_user_role(), '') IN ('admin', 'direction')
  );

-- Ni UPDATE ni DELETE : volontaire. Le statut d'envoi est posé par le serveur
-- en service-role — c'est un champ système, pas une donnée de l'école.

-- ── Bucket des pièces jointes ───────────────────────────────────────────────
-- PRIVÉ : une capture d'écran de bug montre des données réelles d'élèves.
-- 1 Mo, images et PDF seulement — même plafond que les pièces jointes de
-- communication.
--
-- C'est LA garde qui compte : le formulaire et la server action limitent aussi,
-- mais elles se contournent, pas celle-ci. Elle doit rester d'accord avec
-- `SUPPORT_ATTACHMENT_MAX_BYTES` (src/lib/support/categories.ts), que le SQL ne
-- peut pas importer.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'support-attachments', 'support-attachments', false, 1048576,
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public             = false,
  file_size_limit    = 1048576,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Cloisonnement par le PREMIER SEGMENT du chemin, qui doit être
-- l'établissement : `{etablissement_id}/{uuid}.{ext}`. Même motif que les
-- pièces jointes de communication et les justificatifs d'absence.

DROP POLICY IF EXISTS support_attachments_insert ON storage.objects;
CREATE POLICY support_attachments_insert ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'support-attachments'
    AND coalesce(get_user_role(), '') IN ('admin', 'direction')
    AND (storage.foldername(name))[1] = current_etablissement_id()::text
  );

DROP POLICY IF EXISTS support_attachments_select ON storage.objects;
CREATE POLICY support_attachments_select ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'support-attachments'
    AND coalesce(get_user_role(), '') IN ('admin', 'direction')
    AND (storage.foldername(name))[1] = current_etablissement_id()::text
  );

SELECT 'Demandes de support : table + RLS (depot et relecture par la direction, ni modification ni suppression) + bucket prive 1 Mo cloisonne.' AS status;
