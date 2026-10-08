-- ============================================================================
-- RELEVE MENSUEL DE LA BASE FACTURABLE (console de l'editeur)
--
-- Le chiffre « Inscrits » est VIVANT : il change a chaque activation. Pour
-- facturer, il faut un chiffre FIGE a une date, opposable si une ecole conteste.
--
-- * Table `releves_facturation` : un releve par ecole et par mois (le 1er du mois
--   en heure de Paris). Un releve pris n'est JAMAIS reecrit (ON CONFLICT DO NOTHING).
-- * Regime « serveur uniquement » : RLS sans policy + privileges revoques. Seule
--   la console (service-role) lit et ecrit. Ces chiffres sont commerciaux, ils
--   n'ont pas a etre lisibles d'une ecole.
-- * `fn_releve_facturation()` releve TOUTES les ecoles pour le mois courant.
-- * pg_cron la lance CHAQUE JOUR a 23 h 05 UTC (= 0 h 05 ou 1 h 05 a Paris) :
--   cron ne connait que l'UTC, et « le 1er a 0 h 05 heure de Paris » n'y a pas
--   d'expression fixe. Le passage quotidien est sans effet tant que le releve du
--   mois existe ; le premier passage du mois le prend.
--
-- Idempotent.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.releves_facturation (
  etablissement_id uuid NOT NULL REFERENCES public.etablissements(id) ON DELETE CASCADE,
  mois             date NOT NULL,                -- 1er jour du mois
  eleves_actifs    integer NOT NULL,
  adultes_inscrits integer NOT NULL,
  limite           integer,                      -- max_students au moment du releve
  releve_le        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (etablissement_id, mois),
  CONSTRAINT releves_facturation_mois_premier CHECK (extract(day FROM mois) = 1)
);

ALTER TABLE public.releves_facturation ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.releves_facturation FROM anon, authenticated;

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
  INSERT INTO releves_facturation (etablissement_id, mois, eleves_actifs, adultes_inscrits, limite)
  SELECT e.id, v_mois, b.eleves_actifs, b.adultes_inscrits, e.max_students
    FROM etablissements e
    CROSS JOIN LATERAL fn_base_facturable(e.id) b
  ON CONFLICT (etablissement_id, mois) DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$fn$;

REVOKE ALL ON FUNCTION public.fn_releve_facturation() FROM public, anon, authenticated;

-- ── Planification ────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $planif$
BEGIN
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'releve-facturation';
  PERFORM cron.schedule('releve-facturation', '5 23 * * *', 'SELECT public.fn_releve_facturation()');
END;
$planif$;

-- Premier releve, pour ne pas attendre le mois prochain.
SELECT public.fn_releve_facturation();

-- ── Verification ─────────────────────────────────────────────────────────────
DO $verif$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'releve-facturation') THEN
    RAISE EXCEPTION 'tache pg_cron absente';
  END IF;
  IF has_function_privilege('anon', 'public.fn_releve_facturation()', 'EXECUTE')
  OR has_table_privilege('authenticated', 'public.releves_facturation', 'SELECT') THEN
    RAISE EXCEPTION 'fonction ou table accessible depuis l API';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM releves_facturation) THEN
    RAISE EXCEPTION 'premier releve absent';
  END IF;
  RAISE NOTICE 'OK';
END;
$verif$;

-- Registre des migrations (voir supabase/migrations/README.md).
SELECT enregistrer_migration('add-releves-facturation.sql', '7fc869d599800569cf1b2548bacb0ee9183308029dfa61e6babcd42fae61b05f');
