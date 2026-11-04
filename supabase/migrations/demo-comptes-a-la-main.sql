-- ============================================================================
-- Ecole de demonstration : les comptes crees a la main ne sont plus « reembauches » (04/11)
--
-- `fn_demo_peupler` creait une fiche enseignant pour CHAQUE compte enseignant de
-- l'ecole : un compte de test cree a la main pendant une demonstration recevait
-- a chaque remise a zero une fiche, une classe et des evaluations fictives (et ne
-- pouvait plus etre supprime). Seuls les comptes de la demonstration
-- (`@demonstration.invalid`, cf. `lib/tenant/demo-comptes.ts`) ont desormais une
-- fiche. Les acces prospects sont retablis sur leur adresse d'origine AVANT le
-- peuplement (`reinitialiserEcoleDemo`) : ils restent couverts.
--
-- Les comptes crees a la main sont ensuite supprimes par la console, apres le
-- vidage (API d'authentification, que le SQL ne peut pas appeler).
--
-- Additif pour le code en place (il ne lit pas ces fiches) : migration d'abord.
-- ============================================================================

DO $patch$
DECLARE
  v_def text := pg_get_functiondef('public.fn_demo_peupler(uuid)'::regprocedure);
  v_ancre text := $a$FROM profiles WHERE etablissement_id = p_id AND role = 'enseignant' ORDER BY last_name LOOP$a$;
  v_remplacement text := $a$FROM profiles WHERE etablissement_id = p_id AND role = 'enseignant'
                     AND email LIKE '%@demonstration.invalid' ORDER BY last_name LOOP$a$;
BEGIN
  v_def := replace(v_def, E'\r\n', E'\n');
  IF position(v_remplacement IN v_def) > 0 THEN
    RETURN;   -- deja rapiecee (rejeu)
  END IF;
  IF position(v_ancre IN v_def) = 0 THEN
    RAISE EXCEPTION 'fn_demo_peupler : ancrage introuvable, la fonction a change.';
  END IF;
  EXECUTE replace(v_def, v_ancre, v_remplacement);
END
$patch$;
SELECT enregistrer_migration('demo-comptes-a-la-main.sql', '9c3e41d621ccf56e15c3b8a1ffaf6d69da7e1237d1b18bcb64200511bf4b49a9');
