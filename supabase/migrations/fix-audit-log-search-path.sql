-- ============================================================================
-- `fn_audit_log()` : search_path FIXE
--
-- SYMPTOME. Supprimer un enseignant laissait son COMPTE DE CONNEXION en place
-- (profil `enseignant` sans fiche, bloque en « modifier » dans Utilisateurs). Le
-- compte est supprime par l'API d'authentification, qui repondait « Database error
-- deleting user » — et l'application avalait cette erreur.
--
-- CAUSE (mesuree). La suppression de `auth.users` emporte `profiles` en CASCADE, ce
-- qui declenche `audit_profiles` → `fn_audit_log()`. Cette fonction cite `profiles` et
-- `audit_logs` SANS schema, et n'avait pas de `search_path` propre. Or l'API
-- d'authentification s'execute sous le role `supabase_auth_admin`, dont le
-- search_path est `auth` seul : « relation profiles does not exist ». La meme
-- suppression passe en SQL direct (role postgres, search_path public), d'ou la
-- difficulte du diagnostic.
--
-- CORRECTIF. Fixer le search_path de la fonction (comme pour `get_user_role()` et
-- `current_etablissement_id()` le 5 aout). Aucun changement de comportement
-- autrement : meme corps, meme SECURITY DEFINER.
--
-- Idempotent. Additif : a jouer AVANT le deploiement n'a aucun effet sur le code.
-- ============================================================================

ALTER FUNCTION public.fn_audit_log() SET search_path = public, pg_temp;

-- Verification : la configuration est bien posee.
DO $verif$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'fn_audit_log' AND pronamespace = 'public'::regnamespace
      AND proconfig @> ARRAY['search_path=public, pg_temp']
  ) THEN
    RAISE EXCEPTION 'search_path de fn_audit_log non pose';
  END IF;
END
$verif$;
SELECT enregistrer_migration('fix-audit-log-search-path.sql', '8af8ac3c1ccd6f0070a1b903ff98f4633b3a55c4829d03c71b22aa276c1a705f');
