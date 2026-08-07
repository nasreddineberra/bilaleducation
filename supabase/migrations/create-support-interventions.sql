-- ============================================================================
-- Journal des interventions de support de l'éditeur
--
-- POURQUOI UNE TABLE DE PLUS. L'ouverture et la fermeture sont déjà tracées dans
-- `audit_logs` — mais dans celui de CHAQUE ÉCOLE, ce qui est juste de son point
-- de vue : elle doit pouvoir constater qui est entré chez elle. L'éditeur, lui,
-- n'a aucune vue d'ensemble : pour savoir si une intervention traîne ouverte, il
-- lui faudrait parcourir le journal de tous ses clients. Cette table est le
-- pendant côté éditeur, et elle répond à une question que l'autre ne sait pas
-- poser : « qu'est-ce qui est ouvert en ce moment ? »
--
-- CE N'EST PAS UN DOUBLON. Les deux journaux ne s'adressent pas au même lecteur
-- et ne survivent pas aux mêmes purges : celui d'une école se purge depuis son
-- propre écran (« Purger > 1 mois »), et emporterait l'historique de l'éditeur
-- avec lui.
--
-- RÉGIME SERVEUR UNIQUEMENT, comme `etablissement_smtp` et `etablissement_notes` :
-- RLS activée, AUCUNE politique, privilèges retirés aux rôles de l'API. Une
-- école n'a pas à consulter l'historique des interventions menées chez ses
-- concurrentes — or la table les contient toutes.
--
-- PAS DE DÉCLENCHEUR D'AUDIT ici : il recopierait chaque ligne dans le journal
-- d'une école, avec les identifiants d'autres établissements.
--
-- Idempotent.
-- ============================================================================

CREATE TABLE IF NOT EXISTS support_interventions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  etablissement_id UUID NOT NULL REFERENCES etablissements(id) ON DELETE CASCADE,

  -- L'éditeur qui intervient. `SET NULL` et non `CASCADE` : si le compte
  -- disparaît un jour, l'historique de ce qui a été fait chez les clients doit
  -- survivre — c'est précisément ce qu'on veut pouvoir montrer.
  super_admin_id   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  super_admin_email TEXT,

  opened_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at        TIMESTAMPTZ,

  -- `manuelle` = quittée par l'éditeur ; `expiration` = refermée d'office au
  -- bout du délai. Distinguer les deux dit si le mécanisme de secours sert
  -- souvent — et donc si le délai est bien réglé.
  closed_reason    TEXT CHECK (closed_reason IN ('manuelle', 'expiration')),

  CONSTRAINT support_interventions_closure_check
    CHECK ((closed_at IS NULL AND closed_reason IS NULL)
        OR (closed_at IS NOT NULL AND closed_reason IS NOT NULL))
);

COMMENT ON TABLE support_interventions IS
  'Historique des interventions de support de l''editeur dans les ecoles clientes. Table SERVEUR UNIQUEMENT : RLS sans aucune policy, seul le service-role y accede. Ne jamais y ajouter de policy ni de declencheur d''audit : elle contient les identifiants de TOUS les etablissements.';

-- Retrouver l'intervention ouverte d'un éditeur : c'est la requête faite à
-- chaque affichage du tableau de bord pendant une intervention.
CREATE INDEX IF NOT EXISTS idx_support_interventions_ouvertes
  ON support_interventions (super_admin_id) WHERE closed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_support_interventions_historique
  ON support_interventions (opened_at DESC);

ALTER TABLE support_interventions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON support_interventions FROM anon, authenticated;

-- ── Vérification ────────────────────────────────────────────────────────────
--   SELECT count(*) FROM pg_policy WHERE polrelid = 'support_interventions'::regclass;  -- 0
--   SELECT grantee FROM information_schema.role_table_grants
--     WHERE table_name = 'support_interventions';   -- ni anon ni authenticated
