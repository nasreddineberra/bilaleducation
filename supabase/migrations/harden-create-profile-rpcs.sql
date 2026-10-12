-- ============================================================================
-- Durcissement des fonctions de creation de compte (enseignant, parent)
--
-- Alignees sur `create_profile_only` (fix-create-profile-only-definer.sql, 11/10).
-- Ces fonctions sont SECURITY DEFINER : elles contournent la RLS de `profiles`
-- (qui n'a aucune policy d'insertion, a dessein). Leurs gardes sont donc LA seule
-- protection.
--
-- create_profile_and_teacher — elle ne verifiait QUE l'appelant :
--   · role cree force a `enseignant` : la fonction acceptait n'importe quel
--     `p_role`, donc pouvait creer un profil `admin` adosse a une fiche enseignant ;
--   · etablissement = celui de l'appelant : on ne cree pas chez un autre client ;
--   · `secretaire` ajoutee aux appelants : l'ecran et la server action lui
--     ouvrent la creation d'un enseignant (decision du 5 aout, ecriture de
--     `teachers` = admin + direction + secretaire), mais la fonction la refusait —
--     « Acces refuse » des la premiere creation.
--
-- create_parent_login_profile — role deja verrouille a `parent` :
--   · etablissement = celui de l'appelant.
--
-- Pour les deux : execution retiree a `public` et `anon` (Supabase l'accorde
-- nommement a `anon`), search_path fixe.
--
-- Idempotent.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_profile_and_teacher(
  p_profile_id uuid, p_email text, p_role text, p_first_name text, p_last_name text,
  p_civilite text, p_phone text, p_is_active boolean, p_etablissement_id uuid,
  p_employee_number text, p_specialization text, p_hire_date date
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_teacher_id uuid;
BEGIN
  IF coalesce(get_user_role(), '') NOT IN ('admin', 'direction', 'secretaire') THEN
    RAISE EXCEPTION 'Acces refuse';
  END IF;
  IF coalesce(p_role, '') <> 'enseignant' THEN
    RAISE EXCEPTION 'Role non autorise : %', p_role;
  END IF;
  IF p_etablissement_id IS DISTINCT FROM current_etablissement_id() THEN
    RAISE EXCEPTION 'Etablissement non autorise';
  END IF;

  INSERT INTO public.profiles (
    id, email, role, first_name, last_name, civilite, phone, is_active, etablissement_id
  ) VALUES (
    p_profile_id, p_email, 'enseignant', p_first_name, p_last_name,
    p_civilite, p_phone, p_is_active, p_etablissement_id
  );

  INSERT INTO public.teachers (
    employee_number, civilite, last_name, first_name, email,
    phone, hire_date, specialization, is_active, user_id, etablissement_id
  ) VALUES (
    p_employee_number, p_civilite, p_last_name, p_first_name, p_email,
    p_phone, p_hire_date, p_specialization, p_is_active, p_profile_id, p_etablissement_id
  ) RETURNING id INTO v_teacher_id;

  RETURN v_teacher_id;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.create_parent_login_profile(
  p_profile_id uuid, p_email text, p_first_name text, p_last_name text,
  p_phone text, p_etablissement_id uuid
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
AS $fn$
BEGIN
  IF coalesce(get_user_role(), '') NOT IN ('admin', 'direction', 'secretaire') THEN
    RAISE EXCEPTION 'Acces refuse';
  END IF;
  IF p_etablissement_id IS DISTINCT FROM current_etablissement_id() THEN
    RAISE EXCEPTION 'Etablissement non autorise';
  END IF;

  INSERT INTO public.profiles (
    id, email, role, first_name, last_name, phone, is_active, etablissement_id
  ) VALUES (
    p_profile_id, p_email, 'parent', p_first_name, p_last_name,
    p_phone, true, p_etablissement_id
  );

  RETURN p_profile_id;
END;
$fn$;

REVOKE ALL ON FUNCTION public.create_profile_and_teacher(uuid, text, text, text, text, text, text, boolean, uuid, text, text, date) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_profile_and_teacher(uuid, text, text, text, text, text, text, boolean, uuid, text, text, date) TO authenticated;
REVOKE ALL ON FUNCTION public.create_parent_login_profile(uuid, text, text, text, text, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_parent_login_profile(uuid, text, text, text, text, uuid) TO authenticated;

-- Verification : `anon` et `public` ne peuvent plus executer aucune des deux.
DO $verif$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.routine_privileges
             WHERE routine_name IN ('create_profile_and_teacher', 'create_parent_login_profile')
               AND grantee IN ('anon', 'PUBLIC')) THEN
    RAISE EXCEPTION 'fonction de creation de compte encore executable par anon ou public';
  END IF;
END
$verif$;
SELECT enregistrer_migration('harden-create-profile-rpcs.sql', '54559a6399695a71a7624a3721788bf4de9b0dce6b3319cf677c975214b2517d');
