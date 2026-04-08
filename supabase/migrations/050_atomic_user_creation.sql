-- ============================================================
-- Migration 050 : Création atomique de profils + entités
-- ============================================================
-- Ces fonctions RPC regroupent l'insertion du profile et de
-- l'entité métier (teacher / parent / user) dans une seule
-- transaction PostgreSQL. Si l'une des deux insertions échoue,
-- tout est annulé automatiquement.
-- ============================================================

-- ── 1. Profile + Teacher ────────────────────────────────────
-- Retourne le teacher_id créé, ou lève une exception en cas d'erreur.

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
  -- teacher fields
  p_employee_number     text,
  p_specialization      text,
  p_hire_date           date
) RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_teacher_id uuid;
BEGIN
  -- 1. Insérer le profil
  INSERT INTO public.profiles (
    id, email, role, first_name, last_name, civilite, phone, is_active, etablissement_id
  ) VALUES (
    p_profile_id, p_email, p_role, p_first_name, p_last_name,
    p_civilite, p_phone, p_is_active, p_etablissement_id
  );

  -- 2. Insérer la fiche enseignant
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

-- ── 2. Profile + Parent ─────────────────────────────────────
-- Retourne le parent_id créé.

CREATE OR REPLACE FUNCTION create_profile_and_parent(
  p_profile_id          uuid,
  p_email               text,
  p_role                text,
  p_first_name          text,
  p_last_name           text,
  p_phone               text,
  p_is_active           boolean,
  p_etablissement_id    uuid,
  -- parent fields
  p_tutor1_first_name   text,
  p_tutor1_last_name    text,
  p_tutor1_email        text,
  p_tutor1_phone        text,
  p_tutor1_relationship text,
  p_tutor1_address      text,
  p_tutor1_city         text,
  p_tutor1_postal_code  text,
  p_tutor1_profession   text,
  p_tutor1_adult_courses boolean,
  p_tutor2_first_name   text,
  p_tutor2_last_name    text,
  p_tutor2_email        text,
  p_tutor2_phone        text,
  p_tutor2_relationship text,
  p_tutor2_address      text,
  p_tutor2_city         text,
  p_tutor2_postal_code  text,
  p_tutor2_profession   text,
  p_tutor2_adult_courses boolean,
  p_situation_familiale text,
  p_type_garde          text,
  p_notes               text
) RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_parent_id uuid;
BEGIN
  -- 1. Insérer le profil
  INSERT INTO public.profiles (
    id, email, role, first_name, last_name, phone, is_active, etablissement_id
  ) VALUES (
    p_profile_id, p_email, p_role, p_first_name, p_last_name,
    p_phone, p_is_active, p_etablissement_id
  );

  -- 2. Insérer la fiche parent
  INSERT INTO public.parents (
    etablissement_id,
    tutor1_first_name, tutor1_last_name, tutor1_email, tutor1_phone,
    tutor1_relationship, tutor1_address, tutor1_city, tutor1_postal_code,
    tutor1_profession, tutor1_adult_courses,
    tutor2_first_name, tutor2_last_name, tutor2_email, tutor2_phone,
    tutor2_relationship, tutor2_address, tutor2_city, tutor2_postal_code,
    tutor2_profession, tutor2_adult_courses,
    situation_familiale, type_garde, notes
  ) VALUES (
    p_etablissement_id,
    p_tutor1_first_name, p_tutor1_last_name, p_tutor1_email, p_tutor1_phone,
    p_tutor1_relationship, p_tutor1_address, p_tutor1_city, p_tutor1_postal_code,
    p_tutor1_profession, p_tutor1_adult_courses,
    p_tutor2_first_name, p_tutor2_last_name, p_tutor2_email, p_tutor2_phone,
    p_tutor2_relationship, p_tutor2_address, p_tutor2_city, p_tutor2_postal_code,
    p_tutor2_profession, p_tutor2_adult_courses,
    p_situation_familiale, p_type_garde, p_notes
  ) RETURNING id INTO v_parent_id;

  RETURN v_parent_id;
END;
$$;

-- ── 3. Profile seul (utilisateur générique) ─────────────────
-- Retourne le profile_id (identique au p_profile_id).

CREATE OR REPLACE FUNCTION create_profile_only(
  p_profile_id          uuid,
  p_email               text,
  p_role                text,
  p_first_name          text,
  p_last_name           text,
  p_civilite            text,
  p_phone               text,
  p_is_active           boolean,
  p_etablissement_id    uuid
) RETURNS uuid
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.profiles (
    id, email, role, civilite, first_name, last_name, phone, is_active, etablissement_id
  ) VALUES (
    p_profile_id, p_email, p_role, p_civilite, p_first_name, p_last_name,
    p_phone, p_is_active, p_etablissement_id
  );
  RETURN p_profile_id;
END;
$$;

-- ── 4. Cleanup en cas d'échec côté app ──────────────────────
-- Supprime profile + entity dans une transaction.
-- À appeler après un échec du RPC pour nettoyer le compte auth.

CREATE OR REPLACE FUNCTION cleanup_user_and_teacher(
  p_profile_id uuid
) RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Supprimer d'abord le teacher (FK vers profiles)
  DELETE FROM public.teachers WHERE user_id = p_profile_id;
  -- Puis le profile
  DELETE FROM public.profiles WHERE id = p_profile_id;
END;
$$;

CREATE OR REPLACE FUNCTION cleanup_user_and_parent(
  p_profile_id uuid
) RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Supprimer d'abord le parent (pas de FK directe, mais logique)
  DELETE FROM public.parents WHERE tutor1_user_id = p_profile_id OR tutor2_user_id = p_profile_id;
  -- Puis le profile
  DELETE FROM public.profiles WHERE id = p_profile_id;
END;
$$;

CREATE OR REPLACE FUNCTION cleanup_profile_only(
  p_profile_id uuid
) RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM public.profiles WHERE id = p_profile_id;
END;
$$;
