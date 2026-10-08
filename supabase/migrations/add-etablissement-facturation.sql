-- ============================================================================
-- FACTURATION D'UNE ECOLE (console de l'editeur)
--
-- * `etablissement_facturation` : le PAYEUR (structure, SIRET/RNA, adresse,
--   responsable, email) et le TARIF (prix par inscrit, forfait mensuel). Regime
--   « serveur uniquement » : RLS sans policy + privileges revoques. Un tarif
--   negocie n'a pas a etre lisible d'un compte de l'ecole.
-- * Le releve mensuel FIGE AUSSI LE TARIF du moment (`prix_inscrit`, `forfait`) :
--   un changement de tarif ne doit pas reecrire le montant des mois passes.
--   Le releve du mois EN COURS suit le tarif tant que le mois n'est pas clos
--   (voir l'action `enregistrerFacturation`).
--
-- Idempotent.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.etablissement_facturation (
  etablissement_id uuid PRIMARY KEY REFERENCES public.etablissements(id) ON DELETE CASCADE,
  structure        text,
  identifiant      text,          -- SIRET ou numero RNA
  adresse          text,
  responsable      text,
  email            text,
  prix_inscrit     numeric(10,2) CHECK (prix_inscrit IS NULL OR prix_inscrit >= 0),
  forfait          numeric(10,2) CHECK (forfait IS NULL OR forfait >= 0),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.etablissement_facturation ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.etablissement_facturation FROM anon, authenticated;

ALTER TABLE public.releves_facturation
  ADD COLUMN IF NOT EXISTS prix_inscrit numeric(10,2),
  ADD COLUMN IF NOT EXISTS forfait      numeric(10,2);

CREATE OR REPLACE FUNCTION public.fn_releve_facturation()
  RETURNS integer
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_mois date := date_trunc('month', now() AT TIME ZONE 'Europe/Paris')::date;
  v_n    integer;
BEGIN
  INSERT INTO releves_facturation
    (etablissement_id, mois, eleves_actifs, adultes_inscrits, limite, prix_inscrit, forfait)
  SELECT e.id, v_mois, b.eleves_actifs, b.adultes_inscrits, e.max_students, f.prix_inscrit, f.forfait
    FROM etablissements e
    CROSS JOIN LATERAL fn_base_facturable(e.id) b
    LEFT JOIN etablissement_facturation f ON f.etablissement_id = e.id
  ON CONFLICT (etablissement_id, mois) DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$fn$;

REVOKE ALL ON FUNCTION public.fn_releve_facturation() FROM public, anon, authenticated;

DO $verif$
BEGIN
  IF has_table_privilege('authenticated', 'public.etablissement_facturation', 'SELECT') THEN
    RAISE EXCEPTION 'etablissement_facturation lisible depuis l API';
  END IF;
  RAISE NOTICE 'OK';
END;
$verif$;

-- Registre des migrations (voir supabase/migrations/README.md).
SELECT enregistrer_migration('add-etablissement-facturation.sql', '2799923c698491abc3aaf0e1bb71330a549f8128994022eeddcb0796d3dbcb0b');
