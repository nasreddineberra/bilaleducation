-- ============================================================================
-- BILAL EDUCATION — Durcissement des gardes de rôle des RPC SECURITY DEFINER
-- ----------------------------------------------------------------------------
-- Problème : `IF get_user_role() NOT IN (...)` ne se déclenche PAS quand le rôle
-- est NULL (appelant anonyme / sans profil), car `NULL NOT IN (...)` vaut NULL.
-- Un appelant anonyme pouvait donc contourner la garde de ces RPC.
--
-- Correctif : `coalesce(get_user_role(), '')` → un rôle NULL est refusé.
-- Recrée les fonctions à l'identique (seule la garde change). Idempotent.
-- À exécuter dans Supabase SQL Editor.
-- ============================================================================

-- ── 1. create_profile_and_teacher ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION create_profile_and_teacher(
  p_profile_id          uuid,
  p_email               text,
  p_role                text,
  p_first_name          text,
  p_last_name           text,
  p_civilite            text,
  p_phone               text,
  p_is_active           boolean,
  p_etablissement_id    uuid,
  p_employee_number     text,
  p_specialization      text,
  p_hire_date           date
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_teacher_id uuid;
BEGIN
  -- Garde : seuls admin/direction peuvent créer une fiche enseignant
  IF coalesce(get_user_role(), '') NOT IN ('admin', 'direction') THEN
    RAISE EXCEPTION 'Acces refuse';
  END IF;

  INSERT INTO public.profiles (
    id, email, role, first_name, last_name, civilite, phone, is_active, etablissement_id
  ) VALUES (
    p_profile_id, p_email, p_role, p_first_name, p_last_name,
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
$$;

-- ── 2. create_parent_login_profile ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION create_parent_login_profile(
  p_profile_id          uuid,
  p_email               text,
  p_first_name          text,
  p_last_name           text,
  p_phone               text,
  p_etablissement_id    uuid
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Garde : admin/direction/secretaire uniquement ; role verrouillé à 'parent'
  IF coalesce(get_user_role(), '') NOT IN ('admin', 'direction', 'secretaire') THEN
    RAISE EXCEPTION 'Acces refuse';
  END IF;

  INSERT INTO public.profiles (
    id, email, role, first_name, last_name, phone, is_active, etablissement_id
  ) VALUES (
    p_profile_id, p_email, 'parent', p_first_name, p_last_name,
    p_phone, true, p_etablissement_id
  );

  RETURN p_profile_id;
END;
$$;

NOTIFY pgrst, 'reload schema';

SELECT 'Gardes de role durcies (coalesce) sur create_profile_and_teacher + create_parent_login_profile.' AS status;
