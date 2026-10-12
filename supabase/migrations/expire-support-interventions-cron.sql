-- ============================================================================
-- Expiration AUTOMATIQUE des interventions de support (tache planifiee)
--
-- DEFAUT (constate le 12/10) : une intervention ouverte le 14/08 a 21 h 18 n'a
-- ete refermee que le 13/09, a la main — 712 h, pour une duree maximale d'UNE
-- heure. L'expiration n'etait verifiee qu'au rendu d'une page de l'ecole
-- (layout du tableau de bord) : un editeur qui quittait l'ecole sans cliquer sur
-- « Quitter » (onglet ferme, retour a la console) restait RATTACHE, donc
-- administrateur de l'ecole pour la RLS, jusqu'a sa sortie suivante.
--
-- CORRECTIF : une fonction que pg_cron execute toutes les 5 minutes, qui ne
-- depend d'aucune page ouverte :
--   1. referme les interventions ouvertes depuis plus de la duree maximale
--      (motif `expiration`) ;
--   2. DETACHE l'editeur de l'ecole — c'est ce qui retire reellement l'acces.
--
-- DUREE : 1 heure, recopie de `INTERVENTION_MAX_HEURES` (src/lib/support/duree.ts).
-- Les deux changent ENSEMBLE ; `src/lib/support/duree.test.ts` le verifie.
--
-- La garde `fn_guard_profile_sensitive_columns` n'autorise le changement de
-- rattachement qu'au backend (`service_role`). La fonction s'en reclame donc, le
-- temps de SA transaction (`set_config(..., true)`) : elle est la seule a le
-- faire, et elle ne detache qu'un super_admin rattache a l'ecole de l'intervention.
--
-- SECURITY DEFINER, execution retiree a public / anon / authenticated : seul
-- pg_cron (role postgres) l'appelle.
--
-- Idempotent.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_expirer_interventions_support()
  RETURNS integer
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_i      record;
  v_nombre integer := 0;
BEGIN
  -- Backend de confiance pour la garde des colonnes sensibles de `profiles`.
  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true);

  FOR v_i IN
    SELECT id, super_admin_id, etablissement_id
      FROM support_interventions
     WHERE closed_at IS NULL
       AND opened_at < now() - interval '1 hour'
  LOOP
    UPDATE support_interventions
       SET closed_at = now(), closed_reason = 'expiration'
     WHERE id = v_i.id;

    UPDATE profiles
       SET etablissement_id = NULL
     WHERE id = v_i.super_admin_id
       AND role = 'super_admin'
       AND etablissement_id = v_i.etablissement_id;

    v_nombre := v_nombre + 1;
  END LOOP;

  RETURN v_nombre;
END;
$fn$;

REVOKE ALL ON FUNCTION public.fn_expirer_interventions_support() FROM public, anon, authenticated;

-- Toutes les 5 minutes. `cron.schedule` remplace un job de meme nom : rejouable.
SELECT cron.schedule('expiration-interventions-support', '*/5 * * * *',
                     'SELECT public.fn_expirer_interventions_support()');

-- Rattrapage immediat (l'intervention eventuellement restee ouverte).
SELECT public.fn_expirer_interventions_support();

DO $verif$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'expiration-interventions-support') THEN
    RAISE EXCEPTION 'tache planifiee non posee';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.routine_privileges
             WHERE routine_name = 'fn_expirer_interventions_support'
               AND grantee IN ('anon', 'authenticated', 'PUBLIC')) THEN
    RAISE EXCEPTION 'fonction d''expiration encore executable par les roles de l''API';
  END IF;
END
$verif$;
SELECT enregistrer_migration('expire-support-interventions-cron.sql', 'a152174c2a08111391f0d394dd8ced8d4872b6f8291ca2118c50dbc0dab88d36');
