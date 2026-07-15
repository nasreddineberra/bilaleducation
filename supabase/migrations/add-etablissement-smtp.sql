-- ============================================================================
-- Messagerie par etablissement : configuration SMTP.
--
-- Pourquoi en base et pas en variable d'environnement : l'application est
-- multi-etablissement (le super_admin gere les licences). Chaque ecole a sa
-- propre messagerie ; une variable d'env est globale par nature.
--
-- Constat du 15/07/2026 : aucun SMTP n'etait configure nulle part → AUCUN email
-- applicatif n'est jamais parti (devoirs, absences, recus, annonces). Seuls les
-- mails d'Auth fonctionnent, car Supabase les envoie lui-meme.
--
-- REGIME D'ACCES — table SERVEUR UNIQUEMENT :
--   RLS activee et **aucune policy** → anon et authenticated ne voient RIEN,
--   meme un admin depuis la console du navigateur. Seul le service-role
--   (qui contourne la RLS) y accede, c'est-a-dire le serveur.
--   C'est le seul moyen de garantir que le mot de passe SMTP n'atteint jamais
--   le navigateur : une policy « admin peut lire » suffirait a l'exposer.
--   Consequence assumee : toute lecture/ecriture passe par une server action.
--
-- Pas de trigger d'audit ici : `fn_audit_log()` copie `to_jsonb(NEW)` dans
-- `audit_logs.new_data` → le mot de passe atterrirait en clair dans le journal.
-- La tracabilite est assuree par un `logAudit` explicite, sans le secret.
--
-- Le Reply-To ne figure PAS ici : il vaut `etablissements.contact` (decision du
-- 15/07). Deux notions concurrentes seraient une source de bugs.
--
-- Idempotent.
-- ============================================================================

CREATE TABLE IF NOT EXISTS etablissement_smtp (
  etablissement_id UUID PRIMARY KEY REFERENCES etablissements(id) ON DELETE CASCADE,

  -- Serveur
  host             TEXT NOT NULL,
  port             INTEGER NOT NULL DEFAULT 587,
  secure           BOOLEAN NOT NULL DEFAULT false,   -- true = SMTPS (465), false = STARTTLS (587)

  -- Compte (chez Gmail : mot de passe d'application, 2FA requise)
  username         TEXT NOT NULL,
  password         TEXT NOT NULL,

  -- Expediteur. `from_email` DOIT etre l'adresse du compte SMTP : c'est la seule
  -- alignee SPF/DKIM. Mettre une adresse d'un autre domaine = indesirable/rejet.
  -- `from_name` est le nom affiche (defaut applicatif : le nom de l'etablissement).
  from_name        TEXT,
  from_email       TEXT NOT NULL,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT etablissement_smtp_port_check CHECK (port > 0 AND port <= 65535)
);

COMMENT ON TABLE etablissement_smtp IS
  'Configuration SMTP par etablissement. Table SERVEUR UNIQUEMENT : RLS sans aucune policy, seul le service-role y accede. Ne jamais ajouter de policy de lecture (exposerait le mot de passe au navigateur).';
COMMENT ON COLUMN etablissement_smtp.password IS
  'Secret. Ne doit JAMAIS etre renvoye au client : les server actions le retirent avant de repondre.';
COMMENT ON COLUMN etablissement_smtp.from_email IS
  'Doit etre l''adresse du compte SMTP (alignement SPF/DKIM), sinon les messages partent en indesirable.';

-- RLS active, AUCUNE policy : verrouillage total cote client. Voir l'en-tete.
ALTER TABLE etablissement_smtp ENABLE ROW LEVEL SECURITY;

-- Ceinture et bretelles : meme si une policy etait ajoutee par erreur un jour,
-- les roles API n'ont aucun privilege sur la table.
REVOKE ALL ON etablissement_smtp FROM anon, authenticated;

-- updated_at
CREATE OR REPLACE FUNCTION fn_touch_etablissement_smtp()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_touch_etablissement_smtp ON etablissement_smtp;
CREATE TRIGGER trg_touch_etablissement_smtp
  BEFORE UPDATE ON etablissement_smtp
  FOR EACH ROW EXECUTE FUNCTION fn_touch_etablissement_smtp();

SELECT 'Table etablissement_smtp creee (serveur uniquement : RLS sans policy, privileges revoques).' AS status;
