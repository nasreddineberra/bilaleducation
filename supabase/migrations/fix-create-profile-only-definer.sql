-- ============================================================================
-- `create_profile_only` en SECURITY DEFINER, avec gardes
--
-- SYMPTOME (11 octobre, creation du 1er compte direction) : « new row violates
-- row-level security policy for table profiles ». La creation d'un utilisateur
-- (direction, comptable, secretaire, responsable pedagogique) depuis l'ecran
-- Utilisateurs etait CASSEE.
--
-- CAUSE : la fonction etait SECURITY INVOKER et inserait dans `profiles` avec les
-- droits de l'appelant. Or `profiles` n'a AUCUNE policy d'insertion — c'est voulu,
-- un compte connecte ne doit pas pouvoir creer sa propre ligne (verifie le
-- 16 septembre). Ses deux jumelles (`create_profile_and_teacher`,
-- `create_parent_login_profile`) ont ete passees en SECURITY DEFINER le 7 juillet
-- (`fix-audit-user-tracking.sql`) ; celle-ci a ete oubliee.
--
-- CORRECTIF : SECURITY DEFINER + search_path fixe, et trois gardes, puisque la
-- fonction contourne desormais la RLS :
--   1. appelant admin ou direction (coalesce : un role NULL ne doit pas passer) ;
--   2. role cree parmi ceux que l'ecran Utilisateurs propose — jamais admin,
--      super_admin, enseignant ni parent (qui ont leur propre chemin) ;
--   3. etablissement = celui de l'appelant : on ne cree pas un compte chez un
--      autre client.
-- Execution retiree a `public` et `anon` (Supabase l'accorde nommement a `anon`).
--
-- Idempotent.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_profile_only(
  p_profile_id uuid, p_email text, p_role text, p_first_name text, p_last_name text,
  p_civilite text, p_phone text, p_is_active boolean, p_etablissement_id uuid
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
AS $fn$
BEGIN
  IF coalesce(get_user_role(), '') NOT IN ('admin', 'direction') THEN
    RAISE EXCEPTION 'Acces refuse';
  END IF;
  IF coalesce(p_role, '') NOT IN ('direction', 'comptable', 'secretaire', 'responsable_pedagogique') THEN
    RAISE EXCEPTION 'Role non autorise : %', p_role;
  END IF;
  IF p_etablissement_id IS DISTINCT FROM current_etablissement_id() THEN
    RAISE EXCEPTION 'Etablissement non autorise';
  END IF;

  INSERT INTO public.profiles (
    id, email, role, civilite, first_name, last_name, phone, is_active, etablissement_id
  ) VALUES (
    p_profile_id, p_email, p_role, p_civilite, p_first_name, p_last_name,
    p_phone, p_is_active, p_etablissement_id
  );
  RETURN p_profile_id;
END;
$fn$;

REVOKE ALL ON FUNCTION public.create_profile_only(uuid, text, text, text, text, text, text, boolean, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_profile_only(uuid, text, text, text, text, text, text, boolean, uuid) TO authenticated;

-- Verification : DEFINER, et `anon` ne peut plus l'executer.
DO $verif$
BEGIN
  IF NOT (SELECT prosecdef FROM pg_proc WHERE proname = 'create_profile_only' AND pronamespace = 'public'::regnamespace) THEN
    RAISE EXCEPTION 'create_profile_only n''est pas SECURITY DEFINER';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.routine_privileges
             WHERE routine_name = 'create_profile_only' AND grantee IN ('anon', 'PUBLIC')) THEN
    RAISE EXCEPTION 'create_profile_only encore executable par anon ou public';
  END IF;
END
$verif$;
SELECT enregistrer_migration('fix-create-profile-only-definer.sql', '28394c77781a56a893d0f8e6df7fd47f1dfc49de5914c48cd346b2cb496bd8fd');
