-- ============================================================================
-- Historique des actions de l'EDITEUR (console super-admin), par etablissement
--
-- Les actions de la console (creation de l'etablissement, informations, acces,
-- limite d'inscrits, abonnement, comptes, liens de mot de passe, facturation)
-- etaient tracees UNIQUEMENT dans le journal d'activite de l'ecole. Or ce journal
-- appartient a l'ecole : sa direction peut le purger, et la trace de l'editeur
-- disparaissait avec. Cette table est le pendant de `support_interventions` :
-- l'historique PROPRE a l'editeur, que l'ecole ne voit pas et ne peut pas purger.
-- Le journal de l'ecole continue d'etre alimente : elle reste informee.
--
-- REGIME « SERVEUR UNIQUEMENT » (comme etablissement_smtp, etablissement_notes,
-- support_interventions) : RLS activee, AUCUNE policy, privileges retires aux
-- roles de l'API. Seul le service-role y lit et y ecrit.
--
-- PURGE : manuelle depuis la console (plus d'1, 6 ou 12 mois). Une purge ecrit sa
-- propre ligne (`est_purge = true`), que les purges suivantes ne suppriment
-- JAMAIS : sinon une seconde purge effacerait la preuve de la premiere.
--
-- Additif. Idempotent.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.actions_editeur (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  etablissement_id  UUID NOT NULL REFERENCES public.etablissements(id) ON DELETE CASCADE,
  super_admin_id    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  super_admin_email TEXT,
  description       TEXT NOT NULL,
  est_purge         BOOLEAN NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_actions_editeur_etab_date
  ON public.actions_editeur (etablissement_id, created_at DESC);

ALTER TABLE public.actions_editeur ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.actions_editeur FROM anon, authenticated;

DO $verif$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'actions_editeur') THEN
    RAISE EXCEPTION 'actions_editeur ne doit porter AUCUNE policy (regime serveur uniquement)';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.role_table_grants
             WHERE table_name = 'actions_editeur' AND grantee IN ('anon', 'authenticated')) THEN
    RAISE EXCEPTION 'actions_editeur encore accessible aux roles de l''API';
  END IF;
END
$verif$;
SELECT enregistrer_migration('create-actions-editeur.sql', '5340e3c7ff58aa8f57eaef29445266a26d905aefea7ed6532df2c0216a730c55');
