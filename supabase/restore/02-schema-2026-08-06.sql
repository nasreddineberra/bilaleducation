--
-- PostgreSQL database dump
--

\restrict T0Zn2JeZPjqoRaZqFD1PIpBHocyIDdt5eBj0bvw18kBdpHgybaxaiUCjtocuIsn

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.10

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: cleanup_profile_only(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_profile_only(p_profile_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  DELETE FROM public.profiles WHERE id = p_profile_id;
END;
$$;


--
-- Name: cleanup_user_and_parent(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_user_and_parent(p_profile_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Supprimer d'abord le parent (pas de FK directe, mais logique)
  DELETE FROM public.parents WHERE tutor1_user_id = p_profile_id OR tutor2_user_id = p_profile_id;
  -- Puis le profile
  DELETE FROM public.profiles WHERE id = p_profile_id;
END;
$$;


--
-- Name: cleanup_user_and_teacher(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_user_and_teacher(p_profile_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Supprimer d'abord le teacher (FK vers profiles)
  DELETE FROM public.teachers WHERE user_id = p_profile_id;
  -- Puis le profile
  DELETE FROM public.profiles WHERE id = p_profile_id;
END;
$$;


--
-- Name: create_parent_login_profile(uuid, text, text, text, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_parent_login_profile(p_profile_id uuid, p_email text, p_first_name text, p_last_name text, p_phone text, p_etablissement_id uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: create_profile_and_parent(uuid, text, text, text, text, text, boolean, uuid, text, text, text, text, text, text, text, text, text, boolean, text, text, text, text, text, text, text, text, text, boolean, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_profile_and_parent(p_profile_id uuid, p_email text, p_role text, p_first_name text, p_last_name text, p_phone text, p_is_active boolean, p_etablissement_id uuid, p_tutor1_first_name text, p_tutor1_last_name text, p_tutor1_email text, p_tutor1_phone text, p_tutor1_relationship text, p_tutor1_address text, p_tutor1_city text, p_tutor1_postal_code text, p_tutor1_profession text, p_tutor1_adult_courses boolean, p_tutor2_first_name text, p_tutor2_last_name text, p_tutor2_email text, p_tutor2_phone text, p_tutor2_relationship text, p_tutor2_address text, p_tutor2_city text, p_tutor2_postal_code text, p_tutor2_profession text, p_tutor2_adult_courses boolean, p_situation_familiale text, p_type_garde text, p_notes text) RETURNS uuid
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


--
-- Name: create_profile_and_teacher(uuid, text, text, text, text, text, text, boolean, uuid, text, text, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_profile_and_teacher(p_profile_id uuid, p_email text, p_role text, p_first_name text, p_last_name text, p_civilite text, p_phone text, p_is_active boolean, p_etablissement_id uuid, p_employee_number text, p_specialization text, p_hire_date date) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: create_profile_only(uuid, text, text, text, text, text, text, boolean, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_profile_only(p_profile_id uuid, p_email text, p_role text, p_first_name text, p_last_name text, p_civilite text, p_phone text, p_is_active boolean, p_etablissement_id uuid) RETURNS uuid
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


--
-- Name: current_etablissement_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.current_etablissement_id() RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT etablissement_id FROM profiles WHERE id = auth.uid()
$$;


--
-- Name: fn_audit_log(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_audit_log() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_action    text;
  v_entity_id uuid;
  v_old       jsonb;
  v_new       jsonb;
  v_user_id   uuid;
  v_email     text;
  v_name      text;
  v_etab_id   uuid;
BEGIN
  v_user_id := auth.uid();

  -- Snapshot infos utilisateur
  SELECT email, last_name || ' ' || first_name, etablissement_id
    INTO v_email, v_name, v_etab_id
    FROM profiles WHERE id = v_user_id;

  IF TG_OP = 'INSERT' THEN
    v_action    := 'INSERT';
    v_entity_id := NEW.id;
    v_old       := NULL;
    v_new       := to_jsonb(NEW);
    v_etab_id   := COALESCE(v_etab_id, (to_jsonb(NEW)->>'etablissement_id')::uuid);
  ELSIF TG_OP = 'UPDATE' THEN
    v_action    := 'UPDATE';
    v_entity_id := NEW.id;
    v_old       := to_jsonb(OLD);
    v_new       := to_jsonb(NEW);
    v_etab_id   := COALESCE(v_etab_id, (to_jsonb(NEW)->>'etablissement_id')::uuid);
  ELSIF TG_OP = 'DELETE' THEN
    v_action    := 'DELETE';
    v_entity_id := OLD.id;
    v_old       := to_jsonb(OLD);
    v_new       := NULL;
    v_etab_id   := COALESCE(v_etab_id, (to_jsonb(OLD)->>'etablissement_id')::uuid);
  END IF;

  INSERT INTO audit_logs (etablissement_id, user_id, user_email, user_name, entity_type, entity_id, action, old_data, new_data)
  VALUES (v_etab_id, v_user_id, v_email, v_name, TG_TABLE_NAME, v_entity_id, v_action, v_old, v_new);

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;


--
-- Name: fn_block_adult_unenroll(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_block_adult_unenroll() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM parents WHERE id = OLD.parent_id) THEN
    RETURN OLD;
  END IF;

  IF EXISTS (SELECT 1 FROM adult_grades g JOIN evaluations e ON g.evaluation_id = e.id
             WHERE e.class_id = OLD.class_id
               AND g.parent_id = OLD.parent_id AND g.tutor_number = OLD.tutor_number)
     OR EXISTS (SELECT 1 FROM adult_bulletin_appreciations
                WHERE class_id = OLD.class_id
                  AND parent_id = OLD.parent_id AND tutor_number = OLD.tutor_number)
     OR EXISTS (SELECT 1 FROM adult_bulletin_archives
                WHERE class_id = OLD.class_id
                  AND parent_id = OLD.parent_id AND tutor_number = OLD.tutor_number)
  THEN
    RAISE EXCEPTION 'ENROLLMENT_HAS_DATA'
      USING HINT = 'Des notes ou bulletins existent pour ce participant dans cette classe.';
  END IF;

  RETURN OLD;
END;
$$;


--
-- Name: fn_block_student_unenroll(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_block_student_unenroll() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Cascade depuis la suppression de l'eleve : il n'existe plus → ne pas bloquer.
  IF NOT EXISTS (SELECT 1 FROM students WHERE id = OLD.student_id) THEN
    RETURN OLD;
  END IF;

  IF EXISTS (SELECT 1 FROM grades g JOIN evaluations e ON g.evaluation_id = e.id
             WHERE e.class_id = OLD.class_id AND g.student_id = OLD.student_id)
     OR EXISTS (SELECT 1 FROM absences
                WHERE class_id = OLD.class_id AND student_id = OLD.student_id)
     OR EXISTS (SELECT 1 FROM bulletin_appreciations
                WHERE class_id = OLD.class_id AND student_id = OLD.student_id)
     OR EXISTS (SELECT 1 FROM bulletin_archives
                WHERE class_id = OLD.class_id AND student_id = OLD.student_id)
  THEN
    RAISE EXCEPTION 'ENROLLMENT_HAS_DATA'
      USING HINT = 'Des notes, absences ou bulletins existent pour cet eleve dans cette classe.';
  END IF;

  RETURN OLD;
END;
$$;


--
-- Name: fn_ensure_reserved_presence_types(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_ensure_reserved_presence_types(p_etab uuid, p_year uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
  k    record;
  prev record;
BEGIN
  FOR k IN
    SELECT * FROM (VALUES
      ('absence',  'ABSENCE',  'AB.', '#ef4444', true,  0),
      ('cours',    'COURS',    'CRS', '#3b82f6', false, 1),
      ('activite', 'ACTIVITÉ', 'ACT', '#f97316', false, 2)
    ) AS t(kind, def_label, def_code, def_color, is_abs, ord)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM presence_types
      WHERE etablissement_id = p_etab AND school_year_id = p_year AND reserved_kind = k.kind
    ) THEN
      -- Dernier type reserve equivalent d'une autre annee du meme etablissement
      SELECT p.label, p.code, p.color, p.order_index
        INTO prev
      FROM presence_types p
      JOIN school_years sy ON sy.id = p.school_year_id
      WHERE p.etablissement_id = p_etab
        AND p.reserved_kind = k.kind
        AND p.school_year_id <> p_year
      ORDER BY sy.start_date DESC NULLS LAST
      LIMIT 1;

      INSERT INTO presence_types
        (etablissement_id, school_year_id, label, code, color, is_active, is_absence, order_index, reserved_kind)
      VALUES (
        p_etab, p_year,
        COALESCE(prev.label, k.def_label),
        COALESCE(prev.code,  k.def_code),
        COALESCE(prev.color, k.def_color),
        true, k.is_abs,
        COALESCE(prev.order_index, k.ord),
        k.kind
      );
    END IF;
  END LOOP;
END $$;


--
-- Name: fn_guard_presence_type_delete(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_guard_presence_type_delete() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_start date;
  v_end   date;
  v_count integer;
BEGIN
  -- Bornes de l'annee du type. Si l'annee n'existe plus, c'est une CASCADE
  -- (suppression de l'annee ou de l'etablissement) : on laisse passer, sinon
  -- la garde bloquerait un menage legitime.
  SELECT start_date, end_date INTO v_start, v_end
  FROM school_years
  WHERE id = OLD.school_year_id;

  IF NOT FOUND THEN
    RETURN OLD;
  END IF;

  SELECT count(*) INTO v_count
  FROM staff_time_entries
  WHERE etablissement_id = OLD.etablissement_id
    AND entry_type       = OLD.code
    AND entry_date BETWEEN v_start AND v_end;

  IF v_count > 0 THEN
    RAISE EXCEPTION
      'Ce type de présence est utilisé dans % saisie(s) de temps de l''année : il ne peut pas être supprimé.',
      v_count
      USING ERRCODE = 'restrict_violation';
  END IF;

  RETURN OLD;
END;
$$;


--
-- Name: fn_guard_profile_sensitive_columns(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_guard_profile_sensitive_columns() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Backend de confiance (service-role) ou admin/direction : autorisé
  IF coalesce(auth.jwt() ->> 'role', '') = 'service_role'
     OR coalesce(get_user_role(), '') IN ('admin', 'direction') THEN
    RETURN NEW;
  END IF;

  -- Sinon : les colonnes sensibles ne doivent pas changer
  IF NEW.role             IS DISTINCT FROM OLD.role
     OR NEW.is_active         IS DISTINCT FROM OLD.is_active
     OR NEW.etablissement_id  IS DISTINCT FROM OLD.etablissement_id THEN
    RAISE EXCEPTION 'Modification non autorisee des colonnes protegees du profil (role / is_active / etablissement).';
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: fn_protect_reserved_presence_types(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_protect_reserved_presence_types() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.reserved_kind IS NOT NULL
       AND EXISTS (SELECT 1 FROM school_years WHERE id = OLD.school_year_id) THEN
      RAISE EXCEPTION 'Type de presence reserve (%) : suppression interdite.', OLD.reserved_kind
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN OLD;
  END IF;

  -- UPDATE
  IF OLD.reserved_kind IS NOT NULL THEN
    IF NEW.code IS DISTINCT FROM OLD.code THEN
      RAISE EXCEPTION 'Type de presence reserve (%) : le code ne peut pas etre modifie (l''historique des saisies y est rattache).', OLD.reserved_kind
        USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.reserved_kind IS DISTINCT FROM OLD.reserved_kind THEN
      RAISE EXCEPTION 'Type de presence reserve (%) : le role reserve ne peut pas etre modifie.', OLD.reserved_kind
        USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.is_absence IS DISTINCT FROM OLD.is_absence THEN
      RAISE EXCEPTION 'Type de presence reserve (%) : is_absence ne peut pas etre modifie.', OLD.reserved_kind
        USING ERRCODE = 'check_violation';
    END IF;
    -- Desactiver un type reserve le retirerait du recap Temps de presence
    -- (filtre is_active) → les heures validees depuis l'EDT deviendraient orphelines.
    IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
      RAISE EXCEPTION 'Type de presence reserve (%) : ne peut pas etre desactive.', OLD.reserved_kind
        USING ERRCODE = 'check_violation';
    END IF;
    -- Seuls le libelle et la couleur restent modifiables.
  END IF;
  RETURN NEW;
END $$;


--
-- Name: fn_school_year_reserved_types(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_school_year_reserved_types() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  PERFORM fn_ensure_reserved_presence_types(NEW.etablissement_id, NEW.id);
  RETURN NEW;
END $$;


--
-- Name: fn_sync_identity_profile_to_teacher(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_sync_identity_profile_to_teacher() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  UPDATE teachers t
  SET civilite   = NEW.civilite,
      first_name = NEW.first_name,
      last_name  = NEW.last_name
  WHERE t.user_id = NEW.id
    AND (t.civilite   IS DISTINCT FROM NEW.civilite
      OR t.first_name IS DISTINCT FROM NEW.first_name
      OR t.last_name  IS DISTINCT FROM NEW.last_name);
  RETURN NEW;
END $$;


--
-- Name: fn_sync_identity_teacher_to_profile(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_sync_identity_teacher_to_profile() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    RETURN NEW;   -- fiche enseignant sans compte lie : rien a synchroniser
  END IF;

  UPDATE profiles p
  SET civilite   = NEW.civilite,
      first_name = NEW.first_name,
      last_name  = NEW.last_name
  WHERE p.id = NEW.user_id
    AND (p.civilite   IS DISTINCT FROM NEW.civilite
      OR p.first_name IS DISTINCT FROM NEW.first_name
      OR p.last_name  IS DISTINCT FROM NEW.last_name);
  RETURN NEW;
END $$;


--
-- Name: fn_touch_etablissement_smtp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_touch_etablissement_smtp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END $$;


--
-- Name: get_user_role(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_role() RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT role FROM profiles WHERE id = auth.uid()
$$;


--
-- Name: get_verified_totp_user_ids(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_verified_totp_user_ids() RETURNS TABLE(user_id uuid)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF coalesce(get_user_role(), '') NOT IN ('admin', 'direction') THEN
    RAISE EXCEPTION 'Acces refuse';
  END IF;

  RETURN QUERY
    SELECT f.user_id
    FROM auth.mfa_factors f
    WHERE f.factor_type = 'totp'
      AND f.status = 'verified';
END;
$$;


--
-- Name: is_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_admin() RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  RETURN get_user_role() = 'admin';
END;
$$;


--
-- Name: norm_name(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.norm_name(txt text) RETURNS text
    LANGUAGE sql IMMUTABLE PARALLEL SAFE
    AS $$
  SELECT lower(
    translate(
      btrim(regexp_replace(coalesce(txt, ''), '\s+', ' ', 'g')),
      'àáâãäåçèéêëìíîïñòóôõöùúûüýÿÀÁÂÃÄÅÇÈÉÊËÌÍÎÏÑÒÓÔÕÖÙÚÛÜÝ',
      'aaaaaaceeeeiiiinooooouuuuyyAAAAAACEEEEIIIINOOOOOUUUUY'
    )
  )
$$;


--
-- Name: purge_school_year(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.purge_school_year(p_year_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_role     text := coalesce(get_user_role(), '');
  v_etab     uuid;
  v_label    text;
  v_start    date;
  v_end      date;
  v_archived timestamptz;
  v_purged   timestamptz;
  v_periods  uuid[];
  v_classes  uuid[];
  v_paidfees uuid[];
  n_notes    int := 0;
  n_absences int := 0;
  n_fees     int := 0;
  c          int;
BEGIN
  -- Garde de rôle
  IF v_role NOT IN ('admin', 'direction') THEN
    RAISE EXCEPTION 'Accès refusé : purge réservée à admin/direction.' USING ERRCODE = '42501';
  END IF;

  SELECT etablissement_id, label, start_date, end_date
    INTO v_etab, v_label, v_start, v_end
  FROM school_years WHERE id = p_year_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Année introuvable.';
  END IF;

  -- Cloisonnement multi-établissement (la RPC est SECURITY DEFINER → pas de RLS) :
  -- interdit de purger l'année d'un autre établissement, même via appel RPC direct.
  -- IS DISTINCT FROM couvre le cas NULL (ex. super_admin sans établissement → refusé).
  IF v_etab IS DISTINCT FROM current_etablissement_id() THEN
    RAISE EXCEPTION 'Accès refusé : année d''un autre établissement.' USING ERRCODE = '42501';
  END IF;

  -- Prérequis ABSOLU : année archivée
  SELECT archived_at, purged_at INTO v_archived, v_purged
  FROM year_closure WHERE school_year_id = p_year_id;
  IF v_archived IS NULL THEN
    RAISE EXCEPTION 'Année % non archivée : purge interdite.', v_label;
  END IF;

  SELECT coalesce(array_agg(id), '{}') INTO v_periods FROM periods WHERE school_year_id = p_year_id;
  SELECT coalesce(array_agg(id), '{}') INTO v_classes FROM classes WHERE academic_year = v_label AND etablissement_id = v_etab;

  -- Désactivation des triggers d'audit des tables purgées (rollback si erreur : DDL transactionnel).
  ALTER TABLE family_fees          DISABLE TRIGGER audit_family_fees;
  ALTER TABLE fee_installments     DISABLE TRIGGER audit_fee_installments;
  ALTER TABLE fee_adjustments      DISABLE TRIGGER audit_fee_adjustments;
  ALTER TABLE staff_time_entries   DISABLE TRIGGER audit_staff_time_entries;
  ALTER TABLE schedule_validations DISABLE TRIGGER audit_schedule_validations;

  -- ── Notes ──
  DELETE FROM grades WHERE evaluation_id IN (SELECT id FROM evaluations WHERE period_id = ANY(v_periods));
  GET DIAGNOSTICS c = ROW_COUNT; n_notes := n_notes + c;
  DELETE FROM adult_grades WHERE evaluation_id IN (SELECT id FROM evaluations WHERE period_id = ANY(v_periods));
  GET DIAGNOSTICS c = ROW_COUNT; n_notes := n_notes + c;

  -- ── Appréciations de bulletin ──
  DELETE FROM bulletin_appreciations       WHERE period_id = ANY(v_periods);
  DELETE FROM adult_bulletin_appreciations WHERE period_id = ANY(v_periods);

  -- ── Absences ──
  DELETE FROM absences WHERE period_id = ANY(v_periods);
  GET DIAGNOSTICS n_absences = ROW_COUNT;

  -- ── Évaluations ──
  DELETE FROM evaluations WHERE period_id = ANY(v_periods);

  -- ── EDT : validations + exceptions + créneaux (scopé aux créneaux de l'année) ──
  DELETE FROM schedule_validations WHERE schedule_slot_id IN (SELECT id FROM schedule_slots WHERE school_year_id = p_year_id);
  DELETE FROM schedule_exceptions  WHERE schedule_slot_id IN (SELECT id FROM schedule_slots WHERE school_year_id = p_year_id);
  DELETE FROM schedule_slots       WHERE school_year_id = p_year_id;

  -- ── Temps de présence (établissement + plage de dates de l'année) ──
  IF v_start IS NOT NULL AND v_end IS NOT NULL THEN
    DELETE FROM staff_time_entries WHERE etablissement_id = v_etab AND entry_date BETWEEN v_start AND v_end;
  END IF;

  -- ── Cahier de texte (homework cascade homework_status + adult_homework_status) ──
  DELETE FROM homework      WHERE class_id = ANY(v_classes);
  DELETE FROM class_journal WHERE class_id = ANY(v_classes);

  -- ── Finance : foyers SOLDÉS uniquement (impayés conservés, vifs) ──
  -- Critère = RESTE RECALCULÉ (dû - perçu) <= 0, et NON le libellé `status`
  -- (dénormalisé, risque de désync → une dette marquée 'paid' à tort serait
  -- effacée). Tolérance centimes (0.005) : dans le doute, on NE supprime pas.
  SELECT coalesce(array_agg(ff.id), '{}')
    INTO v_paidfees
  FROM family_fees ff
  WHERE ff.school_year_id = p_year_id
    AND ff.total_due - coalesce(
          (SELECT sum(fi.amount_paid) FROM fee_installments fi WHERE fi.family_fee_id = ff.id), 0
        ) <= 0.005;

  DELETE FROM fee_installments WHERE family_fee_id = ANY(v_paidfees);
  DELETE FROM fee_adjustments  WHERE family_fee_id = ANY(v_paidfees);
  DELETE FROM family_fees      WHERE id = ANY(v_paidfees);
  GET DIAGNOSTICS n_fees = ROW_COUNT;

  -- Réactivation des triggers d'audit
  ALTER TABLE family_fees          ENABLE TRIGGER audit_family_fees;
  ALTER TABLE fee_installments     ENABLE TRIGGER audit_fee_installments;
  ALTER TABLE fee_adjustments      ENABLE TRIGGER audit_fee_adjustments;
  ALTER TABLE staff_time_entries   ENABLE TRIGGER audit_staff_time_entries;
  ALTER TABLE schedule_validations ENABLE TRIGGER audit_schedule_validations;

  UPDATE year_closure SET purged_at = now() WHERE school_year_id = p_year_id;

  RETURN jsonb_build_object(
    'label', v_label,
    'notes', n_notes,
    'absences', n_absences,
    'fees_paid', n_fees,
    'already_purged', (v_purged IS NOT NULL)
  );
END;
$$;


--
-- Name: set_etablissement_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_etablissement_id() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  IF NEW.etablissement_id IS NULL THEN
    NEW.etablissement_id := current_etablissement_id();
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: set_teacher_profile_active(uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_teacher_profile_active(p_teacher_id uuid, p_active boolean) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- coalesce : un rôle NULL (appelant anonyme / sans profil) doit être refusé.
  -- Sans cela, `NULL NOT IN (...)` vaut NULL → la garde ne se déclencherait pas.
  IF coalesce(get_user_role(), '') NOT IN ('admin', 'direction') THEN
    RAISE EXCEPTION 'Permission refusée : rôle insuffisant.';
  END IF;

  UPDATE public.profiles p
  SET is_active = p_active,
      updated_at = now()
  FROM public.teachers t
  WHERE t.id = p_teacher_id
    AND p.id = t.user_id;
END;
$$;


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: teaches_class(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.teaches_class(p_class_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM class_teachers ct
    JOIN teachers t ON t.id = ct.teacher_id
    WHERE ct.class_id = p_class_id
      AND t.user_id = auth.uid()
      AND (ct.effective_from  IS NULL OR ct.effective_from  <= CURRENT_DATE)
      AND (ct.effective_until IS NULL OR ct.effective_until >= CURRENT_DATE)
  )
$$;


--
-- Name: teaches_parent(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.teaches_parent(p_parent_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM students s
    WHERE s.parent_id = p_parent_id
      AND teaches_student(s.id)
  )
$$;


--
-- Name: teaches_student(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.teaches_student(p_student_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM enrollments e
    WHERE e.student_id = p_student_id
      AND e.status = 'active'
      AND teaches_class(e.class_id)
  )
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: absences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.absences (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    etablissement_id uuid NOT NULL,
    student_id uuid NOT NULL,
    class_id uuid NOT NULL,
    period_id uuid NOT NULL,
    absence_date date NOT NULL,
    absence_type text NOT NULL,
    comment text,
    is_justified boolean DEFAULT false NOT NULL,
    justification_date date,
    justification_comment text,
    justification_document_url text,
    recorded_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT absences_absence_type_check CHECK ((absence_type = ANY (ARRAY['absence'::text, 'retard'::text])))
);


--
-- Name: adult_bulletin_appreciations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.adult_bulletin_appreciations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    etablissement_id uuid NOT NULL,
    parent_id uuid NOT NULL,
    tutor_number smallint NOT NULL,
    class_id uuid NOT NULL,
    period_id uuid NOT NULL,
    appreciation text DEFAULT ''::text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    CONSTRAINT adult_bulletin_appreciations_tutor_number_check CHECK ((tutor_number = ANY (ARRAY[1, 2])))
);


--
-- Name: adult_bulletin_archives; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.adult_bulletin_archives (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    etablissement_id uuid NOT NULL,
    parent_id uuid NOT NULL,
    tutor_number smallint NOT NULL,
    class_id uuid NOT NULL,
    period_id uuid NOT NULL,
    file_path text NOT NULL,
    file_url text,
    archived_at timestamp with time zone DEFAULT now() NOT NULL,
    archived_by uuid,
    CONSTRAINT adult_bulletin_archives_tutor_number_check CHECK ((tutor_number = ANY (ARRAY[1, 2])))
);


--
-- Name: adult_grades; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.adult_grades (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    etablissement_id uuid NOT NULL,
    parent_id uuid NOT NULL,
    tutor_number smallint NOT NULL,
    evaluation_id uuid NOT NULL,
    score numeric,
    comment text,
    is_absent boolean DEFAULT false NOT NULL,
    graded_by uuid,
    graded_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT adult_grades_score_check CHECK (((score IS NULL) OR (score >= (0)::numeric))),
    CONSTRAINT adult_grades_tutor_number_check CHECK ((tutor_number = ANY (ARRAY[1, 2])))
);


--
-- Name: adult_homework_status; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.adult_homework_status (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    homework_id uuid NOT NULL,
    parent_id uuid NOT NULL,
    tutor_number smallint NOT NULL,
    is_seen boolean DEFAULT false NOT NULL,
    seen_at timestamp with time zone,
    is_done boolean DEFAULT false NOT NULL,
    done_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT adult_homework_status_tutor_number_check CHECK ((tutor_number = ANY (ARRAY[1, 2])))
);


--
-- Name: announcement_attachments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.announcement_attachments (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    announcement_id uuid NOT NULL,
    file_name text NOT NULL,
    file_size integer,
    created_at timestamp with time zone DEFAULT now(),
    file_path text NOT NULL
);


--
-- Name: announcement_recipients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.announcement_recipients (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    announcement_id uuid NOT NULL,
    parent_id uuid NOT NULL,
    is_read boolean DEFAULT false,
    read_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    email text,
    email_status text DEFAULT 'pending'::text,
    sent_at timestamp with time zone,
    CONSTRAINT announcement_recipients_email_status_check CHECK ((email_status = ANY (ARRAY['pending'::text, 'sent'::text, 'delivered'::text, 'failed'::text, 'skipped'::text])))
);


--
-- Name: announcement_staff_recipients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.announcement_staff_recipients (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    announcement_id uuid NOT NULL,
    profile_id uuid NOT NULL,
    is_read boolean DEFAULT false,
    read_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    email text,
    email_status text DEFAULT 'pending'::text,
    sent_at timestamp with time zone,
    CONSTRAINT announcement_staff_recipients_email_status_check CHECK ((email_status = ANY (ARRAY['pending'::text, 'sent'::text, 'delivered'::text, 'failed'::text, 'skipped'::text])))
);


--
-- Name: announcements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.announcements (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    etablissement_id uuid NOT NULL,
    title text NOT NULL,
    content text NOT NULL,
    announcement_type text,
    target_class_id uuid,
    priority text DEFAULT 'normal'::text,
    published_by uuid,
    is_published boolean DEFAULT false,
    published_at timestamp with time zone,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    body_html text,
    channel text DEFAULT 'email'::text,
    sender_email text,
    recipient_count integer DEFAULT 0,
    sent_at timestamp with time zone,
    CONSTRAINT announcements_announcement_type_check CHECK ((announcement_type = ANY (ARRAY['all_active'::text, 'all_registered'::text, 'class'::text, 'selected'::text, 'staff'::text]))),
    CONSTRAINT announcements_channel_check CHECK ((channel = ANY (ARRAY['email'::text, 'notification'::text, 'both'::text]))),
    CONSTRAINT announcements_priority_check CHECK ((priority = ANY (ARRAY['low'::text, 'normal'::text, 'high'::text, 'urgent'::text])))
);


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    etablissement_id uuid NOT NULL,
    user_id uuid,
    user_email text,
    user_name text,
    entity_type text NOT NULL,
    entity_id uuid,
    action text NOT NULL,
    old_data jsonb,
    new_data jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT audit_logs_action_check CHECK ((action = ANY (ARRAY['INSERT'::text, 'UPDATE'::text, 'DELETE'::text, 'LOGIN'::text, 'LOGOUT'::text])))
);


--
-- Name: bulletin_appreciations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bulletin_appreciations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    etablissement_id uuid NOT NULL,
    student_id uuid NOT NULL,
    class_id uuid NOT NULL,
    period_id uuid NOT NULL,
    appreciation text DEFAULT ''::text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid
);


--
-- Name: bulletin_archives; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bulletin_archives (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    etablissement_id uuid NOT NULL,
    student_id uuid NOT NULL,
    class_id uuid NOT NULL,
    period_id uuid NOT NULL,
    file_path text NOT NULL,
    file_url text,
    archived_at timestamp with time zone DEFAULT now() NOT NULL,
    archived_by uuid
);


--
-- Name: class_journal; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.class_journal (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    etablissement_id uuid NOT NULL,
    class_id uuid NOT NULL,
    teacher_id uuid NOT NULL,
    subject text,
    session_date date NOT NULL,
    title text NOT NULL,
    content_html text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: class_teachers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.class_teachers (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    class_id uuid NOT NULL,
    teacher_id uuid NOT NULL,
    is_main_teacher boolean DEFAULT false,
    subject text,
    created_at timestamp with time zone DEFAULT now(),
    effective_from date,
    effective_until date
);


--
-- Name: classes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.classes (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    etablissement_id uuid NOT NULL,
    name text NOT NULL,
    level text NOT NULL,
    academic_year text NOT NULL,
    description text,
    max_students integer DEFAULT 25,
    room_number text,
    schedule_notes text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    day_of_week text,
    start_time time without time zone,
    end_time time without time zone,
    cotisation_type_id uuid,
    room_id uuid,
    teaching_mode text DEFAULT 'single'::text NOT NULL,
    CONSTRAINT classes_teaching_mode_check CHECK ((teaching_mode = ANY (ARRAY['single'::text, 'multi'::text])))
);


--
-- Name: cotisation_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cotisation_types (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    etablissement_id uuid NOT NULL,
    school_year_id uuid NOT NULL,
    label text NOT NULL,
    amount numeric(10,2) DEFAULT 0 NOT NULL,
    registration_fee numeric(10,2) DEFAULT 0 NOT NULL,
    sibling_discount numeric(10,2) DEFAULT 0 NOT NULL,
    max_installments integer DEFAULT 1 NOT NULL,
    order_index integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    sibling_discount_same_type boolean DEFAULT false NOT NULL,
    is_adult boolean DEFAULT false NOT NULL
);


--
-- Name: cours; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cours (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    unite_enseignement_id uuid NOT NULL,
    module_id uuid,
    nom_fr text NOT NULL,
    nom_ar text,
    duree_minutes integer,
    order_index integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    code text
);


--
-- Name: cours_modules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cours_modules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    unite_enseignement_id uuid NOT NULL,
    nom_fr text NOT NULL,
    nom_ar text,
    order_index integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    code text
);


--
-- Name: document_type_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_type_configs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    etablissement_id uuid NOT NULL,
    category text NOT NULL,
    doc_key text NOT NULL,
    label text NOT NULL,
    is_required boolean DEFAULT false NOT NULL,
    order_index integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT document_type_configs_category_check CHECK ((category = ANY (ARRAY['identite'::text, 'medical'::text, 'assurance'::text, 'autres'::text])))
);


--
-- Name: enrollments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.enrollments (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    student_id uuid NOT NULL,
    class_id uuid NOT NULL,
    enrollment_date date DEFAULT CURRENT_DATE,
    status text DEFAULT 'active'::text,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT enrollments_status_check CHECK ((status = ANY (ARRAY['active'::text, 'withdrawn'::text, 'completed'::text])))
);


--
-- Name: etablissement_smtp; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.etablissement_smtp (
    etablissement_id uuid NOT NULL,
    host text NOT NULL,
    port integer DEFAULT 587 NOT NULL,
    secure boolean DEFAULT false NOT NULL,
    username text NOT NULL,
    password text NOT NULL,
    from_name text,
    from_email text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT etablissement_smtp_port_check CHECK (((port > 0) AND (port <= 65535)))
);


--
-- Name: etablissements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.etablissements (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    slug text NOT NULL,
    nom text NOT NULL,
    adresse text,
    telephone text,
    contact text,
    is_active boolean DEFAULT true NOT NULL,
    subscription_expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    max_students integer,
    notes text,
    logo_url text,
    week_start_day smallint DEFAULT 1,
    working_days integer DEFAULT 5 NOT NULL,
    CONSTRAINT etablissements_adresse_longueur CHECK (((adresse IS NULL) OR (char_length(btrim(adresse)) <= 80))),
    CONSTRAINT etablissements_nom_longueur CHECK (((char_length(btrim(nom)) >= 2) AND (char_length(btrim(nom)) <= 30))),
    CONSTRAINT etablissements_week_start_day_check CHECK ((week_start_day = ANY (ARRAY[0, 1, 6]))),
    CONSTRAINT etablissements_working_days_check CHECK ((working_days = ANY (ARRAY[5, 7])))
);


--
-- Name: eval_type_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.eval_type_configs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    school_year_id uuid NOT NULL,
    eval_type text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    max_score integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    diagnostic_options jsonb,
    CONSTRAINT eval_type_configs_eval_type_check CHECK ((eval_type = ANY (ARRAY['diagnostic'::text, 'scored'::text, 'stars'::text])))
);


--
-- Name: evaluation_order_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.evaluation_order_config (
    class_id uuid NOT NULL,
    period_id uuid NOT NULL,
    ue_order text[] DEFAULT '{}'::text[],
    module_order jsonb DEFAULT '{}'::jsonb
);


--
-- Name: evaluations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.evaluations (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    etablissement_id uuid NOT NULL,
    class_id uuid NOT NULL,
    module_id uuid,
    teacher_id uuid,
    title text NOT NULL,
    description text,
    evaluation_type text,
    max_score numeric(5,2) DEFAULT 20.00,
    coefficient numeric(3,2) DEFAULT 1.00,
    evaluation_date date,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    cours_id uuid,
    period_id uuid,
    eval_kind text,
    display_ue_id uuid,
    display_module_id uuid,
    sort_order integer DEFAULT 0,
    CONSTRAINT evaluations_eval_kind_check CHECK ((eval_kind = ANY (ARRAY['diagnostic'::text, 'scored'::text, 'stars'::text]))),
    CONSTRAINT evaluations_evaluation_type_check CHECK ((evaluation_type = ANY (ARRAY['test'::text, 'exam'::text, 'oral'::text, 'homework'::text, 'participation'::text])))
);


--
-- Name: expenses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.expenses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    etablissement_id uuid NOT NULL,
    school_year_id uuid NOT NULL,
    expense_date date DEFAULT CURRENT_DATE NOT NULL,
    label text NOT NULL,
    amount numeric(10,2) DEFAULT 0 NOT NULL,
    category text,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    document_path text
);


--
-- Name: family_fees; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.family_fees (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    etablissement_id uuid NOT NULL,
    parent_id uuid NOT NULL,
    school_year_id uuid NOT NULL,
    subtotal numeric(10,2) DEFAULT 0 NOT NULL,
    adjustments_total numeric(10,2) DEFAULT 0 NOT NULL,
    total_due numeric(10,2) DEFAULT 0 NOT NULL,
    num_installments integer DEFAULT 1 NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT family_fees_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'partial'::text, 'paid'::text, 'overpaid'::text])))
);


--
-- Name: family_year_finance; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.family_year_finance (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    etablissement_id uuid NOT NULL,
    school_year_id uuid,
    year_label text NOT NULL,
    parent_id uuid,
    tutor1_last_name text,
    tutor1_first_name text,
    tutor2_last_name text,
    tutor2_first_name text,
    total_due numeric(10,2) DEFAULT 0 NOT NULL,
    total_paid numeric(10,2) DEFAULT 0 NOT NULL,
    remaining numeric(10,2) DEFAULT 0 NOT NULL,
    status text,
    installments_json jsonb DEFAULT '[]'::jsonb NOT NULL,
    adjustments_json jsonb DEFAULT '[]'::jsonb NOT NULL,
    cotisations_json jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: fee_adjustments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fee_adjustments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    etablissement_id uuid NOT NULL,
    family_fee_id uuid NOT NULL,
    adjustment_date date DEFAULT CURRENT_DATE NOT NULL,
    adjustment_type text NOT NULL,
    label text NOT NULL,
    amount numeric(10,2) NOT NULL,
    recorded_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT fee_adjustments_adjustment_type_check CHECK ((adjustment_type = ANY (ARRAY['reduction'::text, 'avoir'::text, 'remboursement'::text])))
);


--
-- Name: fee_installments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fee_installments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    etablissement_id uuid NOT NULL,
    family_fee_id uuid NOT NULL,
    installment_number integer NOT NULL,
    due_date date NOT NULL,
    amount_due numeric(10,2) NOT NULL,
    amount_paid numeric(10,2) DEFAULT 0 NOT NULL,
    paid_date date,
    payment_method text,
    payment_reference jsonb,
    receipt_number text,
    status text DEFAULT 'pending'::text NOT NULL,
    notes text,
    recorded_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT fee_installments_payment_method_check CHECK ((payment_method = ANY (ARRAY['cash'::text, 'check'::text, 'card'::text, 'transfer'::text, 'online'::text]))),
    CONSTRAINT fee_installments_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'partial'::text, 'paid'::text, 'overpaid'::text])))
);


--
-- Name: financement_communications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.financement_communications (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    etablissement_id uuid NOT NULL,
    parent_id uuid NOT NULL,
    school_year_id uuid,
    type text NOT NULL,
    subject text NOT NULL,
    body_html text,
    recipients text,
    sent_by uuid,
    sent_at timestamp with time zone DEFAULT now() NOT NULL,
    status text DEFAULT 'sent'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT financement_communications_status_check CHECK ((status = ANY (ARRAY['sent'::text, 'failed'::text, 'skipped'::text]))),
    CONSTRAINT financement_communications_type_check CHECK ((type = ANY (ARRAY['relance'::text, 'attestation'::text])))
);


--
-- Name: grades; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.grades (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    student_id uuid NOT NULL,
    evaluation_id uuid NOT NULL,
    score numeric(5,2),
    comment text,
    is_absent boolean DEFAULT false,
    graded_by uuid,
    graded_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT grades_score_check CHECK (((score IS NULL) OR (score >= (0)::numeric)))
);


--
-- Name: homework; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.homework (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    etablissement_id uuid NOT NULL,
    class_id uuid NOT NULL,
    teacher_id uuid NOT NULL,
    subject text NOT NULL,
    journal_entry_id uuid,
    title text NOT NULL,
    description_html text DEFAULT ''::text NOT NULL,
    homework_type text NOT NULL,
    due_date date NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT homework_homework_type_check CHECK ((homework_type = ANY (ARRAY['exercice'::text, 'lecon'::text, 'expose'::text, 'autre'::text])))
);


--
-- Name: homework_status; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.homework_status (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    homework_id uuid NOT NULL,
    student_id uuid NOT NULL,
    parent_id uuid NOT NULL,
    is_seen boolean DEFAULT false NOT NULL,
    seen_at timestamp with time zone,
    is_done boolean DEFAULT false NOT NULL,
    done_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: materials; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.materials (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    etablissement_id uuid NOT NULL,
    name text NOT NULL,
    category text DEFAULT 'autre'::text NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    room_id uuid,
    condition text DEFAULT 'bon'::text NOT NULL,
    serial_number text,
    purchase_date date,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT materials_category_check CHECK ((category = ANY (ARRAY['informatique'::text, 'audiovisuel'::text, 'mobilier'::text, 'sport'::text, 'fournitures'::text, 'autre'::text]))),
    CONSTRAINT materials_condition_check CHECK ((condition = ANY (ARRAY['neuf'::text, 'bon'::text, 'use'::text, 'hors_service'::text])))
);


--
-- Name: modules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.modules (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    etablissement_id uuid NOT NULL,
    teaching_unit_id uuid NOT NULL,
    name text NOT NULL,
    code text NOT NULL,
    description text,
    order_index integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    etablissement_id uuid NOT NULL,
    type text NOT NULL,
    parent_id uuid NOT NULL,
    student_id uuid,
    title text NOT NULL,
    body text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    email_status text DEFAULT 'pending'::text,
    push_status text DEFAULT 'pending'::text,
    is_read boolean DEFAULT false,
    read_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT notifications_email_status_check CHECK ((email_status = ANY (ARRAY['pending'::text, 'sent'::text, 'failed'::text, 'skipped'::text]))),
    CONSTRAINT notifications_push_status_check CHECK ((push_status = ANY (ARRAY['pending'::text, 'sent'::text, 'failed'::text, 'no_sub'::text]))),
    CONSTRAINT notifications_type_check CHECK ((type = ANY (ARRAY['absence'::text, 'retard'::text, 'payment'::text, 'announcement'::text, 'homework'::text])))
);


--
-- Name: other_revenues; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.other_revenues (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    etablissement_id uuid NOT NULL,
    school_year_id uuid NOT NULL,
    revenue_date date DEFAULT CURRENT_DATE NOT NULL,
    label text NOT NULL,
    amount numeric(10,2) DEFAULT 0 NOT NULL,
    source_type text,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: parent_class_enrollments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.parent_class_enrollments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    etablissement_id uuid NOT NULL,
    parent_id uuid NOT NULL,
    class_id uuid NOT NULL,
    tutor_number smallint NOT NULL,
    enrollment_date date DEFAULT CURRENT_DATE NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT parent_class_enrollments_status_check CHECK ((status = ANY (ARRAY['active'::text, 'withdrawn'::text]))),
    CONSTRAINT parent_class_enrollments_tutor_number_check CHECK ((tutor_number = ANY (ARRAY[1, 2])))
);


--
-- Name: parents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.parents (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    etablissement_id uuid NOT NULL,
    tutor1_last_name text NOT NULL,
    tutor1_first_name text NOT NULL,
    tutor1_relationship text DEFAULT 'père'::text,
    tutor1_phone text,
    tutor1_email text,
    tutor1_address text,
    tutor1_city text,
    tutor1_postal_code text,
    tutor1_profession text,
    tutor2_last_name text,
    tutor2_first_name text,
    tutor2_relationship text,
    tutor2_phone text,
    tutor2_email text,
    tutor2_address text,
    tutor2_city text,
    tutor2_postal_code text,
    tutor2_profession text,
    tutor1_adult_courses boolean DEFAULT false NOT NULL,
    tutor2_adult_courses boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    situation_familiale text,
    type_garde text,
    notes text,
    user_id uuid,
    tutor1_user_id uuid,
    tutor2_user_id uuid,
    CONSTRAINT parents_situation_familiale_check CHECK ((situation_familiale = ANY (ARRAY['mariés'::text, 'pacsés'::text, 'union_libre'::text, 'séparés'::text, 'divorcés'::text, 'veuf_veuve'::text, 'monoparental'::text]))),
    CONSTRAINT parents_tutor1_relationship_check CHECK ((tutor1_relationship = ANY (ARRAY['père'::text, 'mère'::text, 'tuteur'::text, 'autre'::text]))),
    CONSTRAINT parents_tutor2_relationship_check CHECK ((tutor2_relationship = ANY (ARRAY['père'::text, 'mère'::text, 'tuteur'::text, 'autre'::text]))),
    CONSTRAINT parents_type_garde_check CHECK ((type_garde = ANY (ARRAY['alternée'::text, 'exclusive_t1'::text, 'exclusive_t2'::text])))
);


--
-- Name: periods; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.periods (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    school_year_id uuid NOT NULL,
    label text NOT NULL,
    order_index integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    is_current boolean DEFAULT false NOT NULL
);


--
-- Name: presence_type_rates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.presence_type_rates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    etablissement_id uuid NOT NULL,
    school_year_id uuid NOT NULL,
    presence_type_id uuid NOT NULL,
    rate numeric(10,2) DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: presence_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.presence_types (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    etablissement_id uuid NOT NULL,
    label text NOT NULL,
    code text NOT NULL,
    color text DEFAULT '#6366f1'::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    order_index integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    is_absence boolean DEFAULT false NOT NULL,
    school_year_id uuid NOT NULL,
    reserved_kind text,
    CONSTRAINT presence_types_code_len_check CHECK ((char_length(code) = 3)),
    CONSTRAINT presence_types_reserved_kind_check CHECK (((reserved_kind IS NULL) OR (reserved_kind = ANY (ARRAY['absence'::text, 'cours'::text, 'activite'::text]))))
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    etablissement_id uuid,
    email text NOT NULL,
    role text NOT NULL,
    first_name text NOT NULL,
    last_name text NOT NULL,
    phone text,
    avatar_url text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    civilite text,
    notes text,
    theme text,
    CONSTRAINT profiles_role_check CHECK ((role = ANY (ARRAY['super_admin'::text, 'admin'::text, 'direction'::text, 'comptable'::text, 'responsable_pedagogique'::text, 'enseignant'::text, 'secretaire'::text, 'parent'::text]))),
    CONSTRAINT profiles_theme_check CHECK ((theme = ANY (ARRAY['light'::text, 'dark'::text])))
);


--
-- Name: push_subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.push_subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    etablissement_id uuid NOT NULL,
    endpoint text NOT NULL,
    p256dh text NOT NULL,
    auth_key text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: rooms; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rooms (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    etablissement_id uuid NOT NULL,
    name text NOT NULL,
    room_type text DEFAULT 'salle_cours'::text NOT NULL,
    capacity integer,
    floor text,
    description text,
    is_available boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT rooms_room_type_check CHECK ((room_type = ANY (ARRAY['salle_cours'::text, 'salle_informatique'::text, 'bibliotheque'::text, 'salle_reunion'::text, 'salle_sport'::text, 'administration'::text, 'autre'::text])))
);


--
-- Name: schedule_exceptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schedule_exceptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    etablissement_id uuid NOT NULL,
    schedule_slot_id uuid NOT NULL,
    exception_date date NOT NULL,
    exception_type text NOT NULL,
    override_start_time time without time zone,
    override_end_time time without time zone,
    override_teacher_id uuid,
    override_room_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT schedule_exceptions_exception_type_check CHECK ((exception_type = ANY (ARRAY['cancelled'::text, 'modified'::text])))
);


--
-- Name: schedule_slots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schedule_slots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    etablissement_id uuid NOT NULL,
    school_year_id uuid NOT NULL,
    class_id uuid NOT NULL,
    teacher_id uuid NOT NULL,
    cours_id uuid,
    room_id uuid,
    is_recurring boolean DEFAULT true NOT NULL,
    day_of_week smallint,
    slot_date date,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    slot_type text DEFAULT 'cours'::text NOT NULL,
    color text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    effective_from date,
    effective_until date,
    CONSTRAINT schedule_slots_check CHECK ((((is_recurring = true) AND (day_of_week IS NOT NULL) AND (slot_date IS NULL)) OR ((is_recurring = false) AND (slot_date IS NOT NULL) AND (day_of_week IS NULL)))),
    CONSTRAINT schedule_slots_check1 CHECK ((end_time > start_time)),
    CONSTRAINT schedule_slots_day_of_week_check CHECK (((day_of_week >= 0) AND (day_of_week <= 6))),
    CONSTRAINT schedule_slots_slot_type_check CHECK ((slot_type = ANY (ARRAY['cours'::text, 'activite'::text])))
);


--
-- Name: schedule_validations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schedule_validations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    etablissement_id uuid NOT NULL,
    schedule_slot_id uuid NOT NULL,
    profile_id uuid NOT NULL,
    validation_date date NOT NULL,
    time_entry_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: school_years; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.school_years (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    etablissement_id uuid NOT NULL,
    label text NOT NULL,
    is_current boolean DEFAULT false NOT NULL,
    period_type text DEFAULT 'trimestrial'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    start_date date,
    end_date date,
    vacations jsonb DEFAULT '[]'::jsonb,
    CONSTRAINT school_years_period_type_check CHECK ((period_type = ANY (ARRAY['trimestrial'::text, 'semestrial'::text])))
);


--
-- Name: staff_hourly_rates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.staff_hourly_rates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    etablissement_id uuid NOT NULL,
    school_year_id uuid NOT NULL,
    rate_cours numeric(10,2) DEFAULT 0 NOT NULL,
    rate_activite numeric(10,2) DEFAULT 0 NOT NULL,
    rate_menage numeric(10,2) DEFAULT 0 NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: staff_time_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.staff_time_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    etablissement_id uuid NOT NULL,
    profile_id uuid NOT NULL,
    entry_date date NOT NULL,
    entry_type text NOT NULL,
    start_time time without time zone,
    end_time time without time zone,
    duration_minutes integer DEFAULT 0 NOT NULL,
    is_replacement boolean DEFAULT false NOT NULL,
    replaced_profile_id uuid,
    absence_reason text,
    notes text,
    recorded_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    absence_period text DEFAULT 'full'::text NOT NULL,
    CONSTRAINT staff_time_entries_absence_period_check CHECK ((absence_period = ANY (ARRAY['full'::text, 'am'::text, 'pm'::text])))
);


--
-- Name: student_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.student_documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    etablissement_id uuid NOT NULL,
    student_id uuid NOT NULL,
    doc_type_key text NOT NULL,
    category text NOT NULL,
    file_url text NOT NULL,
    file_name text NOT NULL,
    expires_at date,
    uploaded_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT student_documents_category_check CHECK ((category = ANY (ARRAY['identite'::text, 'medical'::text, 'assurance'::text, 'autres'::text])))
);


--
-- Name: student_warning_attachments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.student_warning_attachments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    warning_id uuid NOT NULL,
    file_url text NOT NULL,
    file_name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: student_warnings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.student_warnings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    etablissement_id uuid NOT NULL,
    student_id uuid NOT NULL,
    class_id uuid NOT NULL,
    period_id uuid NOT NULL,
    warning_date date DEFAULT CURRENT_DATE NOT NULL,
    severity text NOT NULL,
    motif text DEFAULT ''::text NOT NULL,
    issued_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT student_warnings_severity_check CHECK ((severity = ANY (ARRAY['punition'::text, 'prevention'::text, 'conservatoire'::text, 'sanction'::text])))
);


--
-- Name: student_year_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.student_year_history (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    etablissement_id uuid NOT NULL,
    school_year_id uuid,
    year_label text NOT NULL,
    participant_type text NOT NULL,
    student_id uuid,
    parent_id uuid,
    tutor_number integer,
    last_name text NOT NULL,
    first_name text NOT NULL,
    student_number text,
    class_name text,
    level text,
    cotisation_label text,
    moyenne_generale numeric(5,2),
    absences_justified integer DEFAULT 0 NOT NULL,
    absences_unjustified integer DEFAULT 0 NOT NULL,
    financial_status text,
    total_due numeric(10,2),
    total_paid numeric(10,2),
    bulletin_refs jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT student_year_history_participant_type_check CHECK ((participant_type = ANY (ARRAY['student'::text, 'adult'::text])))
);


--
-- Name: students; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.students (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    etablissement_id uuid NOT NULL,
    user_id uuid,
    parent_id uuid,
    student_number text NOT NULL,
    first_name text NOT NULL,
    last_name text NOT NULL,
    date_of_birth date NOT NULL,
    gender text,
    address text,
    city text,
    postal_code text,
    emergency_contact_name text,
    emergency_contact_phone text,
    medical_notes text,
    enrollment_date date DEFAULT CURRENT_DATE,
    is_active boolean DEFAULT true,
    exit_authorization boolean DEFAULT false NOT NULL,
    media_authorization boolean DEFAULT false NOT NULL,
    has_pai boolean DEFAULT false NOT NULL,
    pai_notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    photo_url text,
    CONSTRAINT students_gender_check CHECK ((gender = ANY (ARRAY['male'::text, 'female'::text, 'non_specified'::text])))
);


--
-- Name: subjects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subjects (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    etablissement_id uuid NOT NULL,
    name text NOT NULL,
    code text NOT NULL,
    description text,
    order_index integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: teacher_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.teacher_documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    etablissement_id uuid NOT NULL,
    teacher_id uuid NOT NULL,
    category text NOT NULL,
    file_url text NOT NULL,
    file_name text NOT NULL,
    expires_at date,
    uploaded_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    label text,
    CONSTRAINT teacher_documents_category_check CHECK ((category = ANY (ARRAY['contrat'::text, 'cv'::text, 'diplome'::text, 'identite'::text, 'autre'::text])))
);


--
-- Name: teachers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.teachers (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    etablissement_id uuid NOT NULL,
    user_id uuid,
    first_name text NOT NULL,
    last_name text NOT NULL,
    employee_number text NOT NULL,
    phone text,
    email text NOT NULL,
    specialization text,
    hire_date date DEFAULT CURRENT_DATE,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    civilite text,
    notes text
);


--
-- Name: teaching_units; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.teaching_units (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    etablissement_id uuid NOT NULL,
    subject_id uuid NOT NULL,
    name text NOT NULL,
    code text NOT NULL,
    description text,
    order_index integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: unites_enseignement; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.unites_enseignement (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    etablissement_id uuid NOT NULL,
    nom_fr text NOT NULL,
    nom_ar text,
    code text,
    order_index integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    color text
);


--
-- Name: year_closure; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.year_closure (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    etablissement_id uuid NOT NULL,
    school_year_id uuid NOT NULL,
    status text DEFAULT 'in_progress'::text NOT NULL,
    started_by uuid,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    closed_by uuid,
    closed_at timestamp with time zone,
    archived_at timestamp with time zone,
    purged_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    purge_intent text,
    CONSTRAINT year_closure_purge_intent_check CHECK ((purge_intent = ANY (ARRAY['purge'::text, 'keep'::text]))),
    CONSTRAINT year_closure_status_check CHECK ((status = ANY (ARRAY['in_progress'::text, 'closed'::text])))
);


--
-- Name: year_closure_steps; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.year_closure_steps (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    etablissement_id uuid NOT NULL,
    closure_id uuid NOT NULL,
    step_key text NOT NULL,
    order_index integer NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    anomalies_count integer DEFAULT 0 NOT NULL,
    recap_json jsonb DEFAULT '{}'::jsonb NOT NULL,
    closed_by uuid,
    closed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT year_closure_steps_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'warnings'::text, 'closed'::text])))
);


--
-- Name: absences absences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.absences
    ADD CONSTRAINT absences_pkey PRIMARY KEY (id);


--
-- Name: absences absences_student_id_class_id_period_id_absence_date_absence_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.absences
    ADD CONSTRAINT absences_student_id_class_id_period_id_absence_date_absence_key UNIQUE (student_id, class_id, period_id, absence_date, absence_type);


--
-- Name: adult_bulletin_appreciations adult_bulletin_appreciations_parent_id_tutor_number_class_i_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.adult_bulletin_appreciations
    ADD CONSTRAINT adult_bulletin_appreciations_parent_id_tutor_number_class_i_key UNIQUE (parent_id, tutor_number, class_id, period_id);


--
-- Name: adult_bulletin_appreciations adult_bulletin_appreciations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.adult_bulletin_appreciations
    ADD CONSTRAINT adult_bulletin_appreciations_pkey PRIMARY KEY (id);


--
-- Name: adult_bulletin_archives adult_bulletin_archives_parent_id_tutor_number_class_id_per_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.adult_bulletin_archives
    ADD CONSTRAINT adult_bulletin_archives_parent_id_tutor_number_class_id_per_key UNIQUE (parent_id, tutor_number, class_id, period_id);


--
-- Name: adult_bulletin_archives adult_bulletin_archives_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.adult_bulletin_archives
    ADD CONSTRAINT adult_bulletin_archives_pkey PRIMARY KEY (id);


--
-- Name: adult_grades adult_grades_parent_id_tutor_number_evaluation_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.adult_grades
    ADD CONSTRAINT adult_grades_parent_id_tutor_number_evaluation_id_key UNIQUE (parent_id, tutor_number, evaluation_id);


--
-- Name: adult_grades adult_grades_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.adult_grades
    ADD CONSTRAINT adult_grades_pkey PRIMARY KEY (id);


--
-- Name: adult_homework_status adult_homework_status_homework_id_parent_id_tutor_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.adult_homework_status
    ADD CONSTRAINT adult_homework_status_homework_id_parent_id_tutor_number_key UNIQUE (homework_id, parent_id, tutor_number);


--
-- Name: adult_homework_status adult_homework_status_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.adult_homework_status
    ADD CONSTRAINT adult_homework_status_pkey PRIMARY KEY (id);


--
-- Name: announcement_attachments announcement_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcement_attachments
    ADD CONSTRAINT announcement_attachments_pkey PRIMARY KEY (id);


--
-- Name: announcement_recipients announcement_recipients_announcement_id_parent_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcement_recipients
    ADD CONSTRAINT announcement_recipients_announcement_id_parent_id_key UNIQUE (announcement_id, parent_id);


--
-- Name: announcement_recipients announcement_recipients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcement_recipients
    ADD CONSTRAINT announcement_recipients_pkey PRIMARY KEY (id);


--
-- Name: announcement_staff_recipients announcement_staff_recipients_announcement_id_profile_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcement_staff_recipients
    ADD CONSTRAINT announcement_staff_recipients_announcement_id_profile_id_key UNIQUE (announcement_id, profile_id);


--
-- Name: announcement_staff_recipients announcement_staff_recipients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcement_staff_recipients
    ADD CONSTRAINT announcement_staff_recipients_pkey PRIMARY KEY (id);


--
-- Name: announcements announcements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcements
    ADD CONSTRAINT announcements_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: bulletin_appreciations bulletin_appreciations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bulletin_appreciations
    ADD CONSTRAINT bulletin_appreciations_pkey PRIMARY KEY (id);


--
-- Name: bulletin_appreciations bulletin_appreciations_student_id_class_id_period_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bulletin_appreciations
    ADD CONSTRAINT bulletin_appreciations_student_id_class_id_period_id_key UNIQUE (student_id, class_id, period_id);


--
-- Name: bulletin_archives bulletin_archives_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bulletin_archives
    ADD CONSTRAINT bulletin_archives_pkey PRIMARY KEY (id);


--
-- Name: bulletin_archives bulletin_archives_student_id_class_id_period_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bulletin_archives
    ADD CONSTRAINT bulletin_archives_student_id_class_id_period_id_key UNIQUE (student_id, class_id, period_id);


--
-- Name: class_journal class_journal_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.class_journal
    ADD CONSTRAINT class_journal_pkey PRIMARY KEY (id);


--
-- Name: class_teachers class_teachers_class_id_teacher_id_subject_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.class_teachers
    ADD CONSTRAINT class_teachers_class_id_teacher_id_subject_key UNIQUE (class_id, teacher_id, subject);


--
-- Name: class_teachers class_teachers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.class_teachers
    ADD CONSTRAINT class_teachers_pkey PRIMARY KEY (id);


--
-- Name: classes classes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.classes
    ADD CONSTRAINT classes_pkey PRIMARY KEY (id);


--
-- Name: cotisation_types cotisation_types_etablissement_id_school_year_id_label_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cotisation_types
    ADD CONSTRAINT cotisation_types_etablissement_id_school_year_id_label_key UNIQUE (etablissement_id, school_year_id, label);


--
-- Name: cotisation_types cotisation_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cotisation_types
    ADD CONSTRAINT cotisation_types_pkey PRIMARY KEY (id);


--
-- Name: cours_modules cours_modules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cours_modules
    ADD CONSTRAINT cours_modules_pkey PRIMARY KEY (id);


--
-- Name: cours cours_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cours
    ADD CONSTRAINT cours_pkey PRIMARY KEY (id);


--
-- Name: document_type_configs document_type_configs_etablissement_id_doc_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_type_configs
    ADD CONSTRAINT document_type_configs_etablissement_id_doc_key_key UNIQUE (etablissement_id, doc_key);


--
-- Name: document_type_configs document_type_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_type_configs
    ADD CONSTRAINT document_type_configs_pkey PRIMARY KEY (id);


--
-- Name: enrollments enrollments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enrollments
    ADD CONSTRAINT enrollments_pkey PRIMARY KEY (id);


--
-- Name: enrollments enrollments_student_id_class_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enrollments
    ADD CONSTRAINT enrollments_student_id_class_id_key UNIQUE (student_id, class_id);


--
-- Name: etablissement_smtp etablissement_smtp_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.etablissement_smtp
    ADD CONSTRAINT etablissement_smtp_pkey PRIMARY KEY (etablissement_id);


--
-- Name: etablissements etablissements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.etablissements
    ADD CONSTRAINT etablissements_pkey PRIMARY KEY (id);


--
-- Name: etablissements etablissements_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.etablissements
    ADD CONSTRAINT etablissements_slug_key UNIQUE (slug);


--
-- Name: eval_type_configs eval_type_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eval_type_configs
    ADD CONSTRAINT eval_type_configs_pkey PRIMARY KEY (id);


--
-- Name: eval_type_configs eval_type_configs_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eval_type_configs
    ADD CONSTRAINT eval_type_configs_unique UNIQUE (school_year_id, eval_type, max_score);


--
-- Name: evaluation_order_config evaluation_order_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evaluation_order_config
    ADD CONSTRAINT evaluation_order_config_pkey PRIMARY KEY (class_id, period_id);


--
-- Name: evaluations evaluations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evaluations
    ADD CONSTRAINT evaluations_pkey PRIMARY KEY (id);


--
-- Name: expenses expenses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_pkey PRIMARY KEY (id);


--
-- Name: family_fees family_fees_parent_id_school_year_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.family_fees
    ADD CONSTRAINT family_fees_parent_id_school_year_id_key UNIQUE (parent_id, school_year_id);


--
-- Name: family_fees family_fees_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.family_fees
    ADD CONSTRAINT family_fees_pkey PRIMARY KEY (id);


--
-- Name: family_year_finance family_year_finance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.family_year_finance
    ADD CONSTRAINT family_year_finance_pkey PRIMARY KEY (id);


--
-- Name: family_year_finance family_year_finance_school_year_id_parent_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.family_year_finance
    ADD CONSTRAINT family_year_finance_school_year_id_parent_id_key UNIQUE (school_year_id, parent_id);


--
-- Name: fee_adjustments fee_adjustments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fee_adjustments
    ADD CONSTRAINT fee_adjustments_pkey PRIMARY KEY (id);


--
-- Name: fee_installments fee_installments_family_fee_id_installment_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fee_installments
    ADD CONSTRAINT fee_installments_family_fee_id_installment_number_key UNIQUE (family_fee_id, installment_number);


--
-- Name: fee_installments fee_installments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fee_installments
    ADD CONSTRAINT fee_installments_pkey PRIMARY KEY (id);


--
-- Name: financement_communications financement_communications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financement_communications
    ADD CONSTRAINT financement_communications_pkey PRIMARY KEY (id);


--
-- Name: grades grades_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grades
    ADD CONSTRAINT grades_pkey PRIMARY KEY (id);


--
-- Name: grades grades_student_id_evaluation_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grades
    ADD CONSTRAINT grades_student_id_evaluation_id_key UNIQUE (student_id, evaluation_id);


--
-- Name: homework homework_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.homework
    ADD CONSTRAINT homework_pkey PRIMARY KEY (id);


--
-- Name: homework_status homework_status_homework_id_student_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.homework_status
    ADD CONSTRAINT homework_status_homework_id_student_id_key UNIQUE (homework_id, student_id);


--
-- Name: homework_status homework_status_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.homework_status
    ADD CONSTRAINT homework_status_pkey PRIMARY KEY (id);


--
-- Name: materials materials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.materials
    ADD CONSTRAINT materials_pkey PRIMARY KEY (id);


--
-- Name: modules modules_etablissement_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.modules
    ADD CONSTRAINT modules_etablissement_id_code_key UNIQUE (etablissement_id, code);


--
-- Name: modules modules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.modules
    ADD CONSTRAINT modules_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: other_revenues other_revenues_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.other_revenues
    ADD CONSTRAINT other_revenues_pkey PRIMARY KEY (id);


--
-- Name: parent_class_enrollments parent_class_enrollments_parent_id_class_id_tutor_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parent_class_enrollments
    ADD CONSTRAINT parent_class_enrollments_parent_id_class_id_tutor_number_key UNIQUE (parent_id, class_id, tutor_number);


--
-- Name: parent_class_enrollments parent_class_enrollments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parent_class_enrollments
    ADD CONSTRAINT parent_class_enrollments_pkey PRIMARY KEY (id);


--
-- Name: parents parents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parents
    ADD CONSTRAINT parents_pkey PRIMARY KEY (id);


--
-- Name: periods periods_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.periods
    ADD CONSTRAINT periods_pkey PRIMARY KEY (id);


--
-- Name: presence_type_rates presence_type_rates_etablissement_id_school_year_id_presenc_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.presence_type_rates
    ADD CONSTRAINT presence_type_rates_etablissement_id_school_year_id_presenc_key UNIQUE (etablissement_id, school_year_id, presence_type_id);


--
-- Name: presence_type_rates presence_type_rates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.presence_type_rates
    ADD CONSTRAINT presence_type_rates_pkey PRIMARY KEY (id);


--
-- Name: presence_types presence_types_etab_year_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.presence_types
    ADD CONSTRAINT presence_types_etab_year_code_key UNIQUE (etablissement_id, school_year_id, code);


--
-- Name: presence_types presence_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.presence_types
    ADD CONSTRAINT presence_types_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: push_subscriptions push_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_pkey PRIMARY KEY (id);


--
-- Name: push_subscriptions push_subscriptions_user_id_endpoint_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_user_id_endpoint_key UNIQUE (user_id, endpoint);


--
-- Name: rooms rooms_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rooms
    ADD CONSTRAINT rooms_pkey PRIMARY KEY (id);


--
-- Name: schedule_exceptions schedule_exceptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_exceptions
    ADD CONSTRAINT schedule_exceptions_pkey PRIMARY KEY (id);


--
-- Name: schedule_exceptions schedule_exceptions_schedule_slot_id_exception_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_exceptions
    ADD CONSTRAINT schedule_exceptions_schedule_slot_id_exception_date_key UNIQUE (schedule_slot_id, exception_date);


--
-- Name: schedule_slots schedule_no_class_overlap_recurring; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_slots
    ADD CONSTRAINT schedule_no_class_overlap_recurring EXCLUDE USING gist (class_id WITH =, day_of_week WITH =, start_time WITH =, end_time WITH =, (
CASE
    WHEN ((effective_from IS NOT NULL) AND (effective_until IS NOT NULL) AND (effective_from > effective_until)) THEN 'empty'::daterange
    ELSE daterange(effective_from, effective_until, '[]'::text)
END) WITH &&) WHERE (((is_active = true) AND (is_recurring = true)));


--
-- Name: schedule_slots schedule_slots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_slots
    ADD CONSTRAINT schedule_slots_pkey PRIMARY KEY (id);


--
-- Name: schedule_validations schedule_validations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_validations
    ADD CONSTRAINT schedule_validations_pkey PRIMARY KEY (id);


--
-- Name: schedule_validations schedule_validations_schedule_slot_id_validation_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_validations
    ADD CONSTRAINT schedule_validations_schedule_slot_id_validation_date_key UNIQUE (schedule_slot_id, validation_date);


--
-- Name: school_years school_years_etablissement_id_label_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.school_years
    ADD CONSTRAINT school_years_etablissement_id_label_key UNIQUE (etablissement_id, label);


--
-- Name: school_years school_years_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.school_years
    ADD CONSTRAINT school_years_pkey PRIMARY KEY (id);


--
-- Name: staff_hourly_rates staff_hourly_rates_etablissement_id_school_year_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_hourly_rates
    ADD CONSTRAINT staff_hourly_rates_etablissement_id_school_year_id_key UNIQUE (etablissement_id, school_year_id);


--
-- Name: staff_hourly_rates staff_hourly_rates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_hourly_rates
    ADD CONSTRAINT staff_hourly_rates_pkey PRIMARY KEY (id);


--
-- Name: staff_time_entries staff_time_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_time_entries
    ADD CONSTRAINT staff_time_entries_pkey PRIMARY KEY (id);


--
-- Name: student_documents student_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_documents
    ADD CONSTRAINT student_documents_pkey PRIMARY KEY (id);


--
-- Name: student_warning_attachments student_warning_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_warning_attachments
    ADD CONSTRAINT student_warning_attachments_pkey PRIMARY KEY (id);


--
-- Name: student_warnings student_warnings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_warnings
    ADD CONSTRAINT student_warnings_pkey PRIMARY KEY (id);


--
-- Name: student_year_history student_year_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_year_history
    ADD CONSTRAINT student_year_history_pkey PRIMARY KEY (id);


--
-- Name: students students_etablissement_id_student_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_etablissement_id_student_number_key UNIQUE (etablissement_id, student_number);


--
-- Name: students students_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_pkey PRIMARY KEY (id);


--
-- Name: subjects subjects_etablissement_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subjects
    ADD CONSTRAINT subjects_etablissement_id_code_key UNIQUE (etablissement_id, code);


--
-- Name: subjects subjects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subjects
    ADD CONSTRAINT subjects_pkey PRIMARY KEY (id);


--
-- Name: teacher_documents teacher_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teacher_documents
    ADD CONSTRAINT teacher_documents_pkey PRIMARY KEY (id);


--
-- Name: teachers teachers_etablissement_id_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teachers
    ADD CONSTRAINT teachers_etablissement_id_email_key UNIQUE (etablissement_id, email);


--
-- Name: teachers teachers_etablissement_id_employee_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teachers
    ADD CONSTRAINT teachers_etablissement_id_employee_number_key UNIQUE (etablissement_id, employee_number);


--
-- Name: teachers teachers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teachers
    ADD CONSTRAINT teachers_pkey PRIMARY KEY (id);


--
-- Name: teaching_units teaching_units_etablissement_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teaching_units
    ADD CONSTRAINT teaching_units_etablissement_id_code_key UNIQUE (etablissement_id, code);


--
-- Name: teaching_units teaching_units_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teaching_units
    ADD CONSTRAINT teaching_units_pkey PRIMARY KEY (id);


--
-- Name: unites_enseignement unites_enseignement_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unites_enseignement
    ADD CONSTRAINT unites_enseignement_pkey PRIMARY KEY (id);


--
-- Name: year_closure year_closure_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.year_closure
    ADD CONSTRAINT year_closure_pkey PRIMARY KEY (id);


--
-- Name: year_closure year_closure_school_year_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.year_closure
    ADD CONSTRAINT year_closure_school_year_id_key UNIQUE (school_year_id);


--
-- Name: year_closure_steps year_closure_steps_closure_id_step_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.year_closure_steps
    ADD CONSTRAINT year_closure_steps_closure_id_step_key_key UNIQUE (closure_id, step_key);


--
-- Name: year_closure_steps year_closure_steps_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.year_closure_steps
    ADD CONSTRAINT year_closure_steps_pkey PRIMARY KEY (id);


--
-- Name: idx_absences_class_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_absences_class_period ON public.absences USING btree (class_id, period_id);


--
-- Name: idx_absences_etab; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_absences_etab ON public.absences USING btree (etablissement_id);


--
-- Name: idx_absences_student; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_absences_student ON public.absences USING btree (student_id);


--
-- Name: idx_adult_bull_appr_class_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_adult_bull_appr_class_period ON public.adult_bulletin_appreciations USING btree (class_id, period_id);


--
-- Name: idx_adult_bull_appr_participant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_adult_bull_appr_participant ON public.adult_bulletin_appreciations USING btree (parent_id, tutor_number);


--
-- Name: idx_adult_bull_arch_class_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_adult_bull_arch_class_period ON public.adult_bulletin_archives USING btree (class_id, period_id);


--
-- Name: idx_adult_bull_arch_participant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_adult_bull_arch_participant ON public.adult_bulletin_archives USING btree (parent_id, tutor_number);


--
-- Name: idx_adult_grades_evaluation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_adult_grades_evaluation ON public.adult_grades USING btree (evaluation_id);


--
-- Name: idx_adult_grades_participant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_adult_grades_participant ON public.adult_grades USING btree (parent_id, tutor_number);


--
-- Name: idx_adult_hwstatus_homework; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_adult_hwstatus_homework ON public.adult_homework_status USING btree (homework_id);


--
-- Name: idx_adult_hwstatus_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_adult_hwstatus_parent ON public.adult_homework_status USING btree (parent_id);


--
-- Name: idx_ann_attachments_announcement; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ann_attachments_announcement ON public.announcement_attachments USING btree (announcement_id);


--
-- Name: idx_ann_recipients_announcement; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ann_recipients_announcement ON public.announcement_recipients USING btree (announcement_id);


--
-- Name: idx_ann_recipients_is_read; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ann_recipients_is_read ON public.announcement_recipients USING btree (is_read);


--
-- Name: idx_ann_recipients_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ann_recipients_parent ON public.announcement_recipients USING btree (parent_id);


--
-- Name: idx_ann_staff_ann; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ann_staff_ann ON public.announcement_staff_recipients USING btree (announcement_id);


--
-- Name: idx_ann_staff_profile; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ann_staff_profile ON public.announcement_staff_recipients USING btree (profile_id);


--
-- Name: idx_ann_staff_read; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ann_staff_read ON public.announcement_staff_recipients USING btree (is_read);


--
-- Name: idx_announcements_class; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_announcements_class ON public.announcements USING btree (target_class_id);


--
-- Name: idx_announcements_etablissement; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_announcements_etablissement ON public.announcements USING btree (etablissement_id);


--
-- Name: idx_announcements_published; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_announcements_published ON public.announcements USING btree (is_published);


--
-- Name: idx_announcements_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_announcements_type ON public.announcements USING btree (announcement_type);


--
-- Name: idx_audit_logs_entity_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_entity_type ON public.audit_logs USING btree (entity_type);


--
-- Name: idx_audit_logs_etablissement_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_etablissement_created ON public.audit_logs USING btree (etablissement_id, created_at DESC);


--
-- Name: idx_audit_logs_user_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_user_created ON public.audit_logs USING btree (user_id, created_at DESC);


--
-- Name: idx_bulletin_appreciations_class_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bulletin_appreciations_class_period ON public.bulletin_appreciations USING btree (class_id, period_id);


--
-- Name: idx_bulletin_appreciations_student; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bulletin_appreciations_student ON public.bulletin_appreciations USING btree (student_id);


--
-- Name: idx_bulletin_archives_class_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bulletin_archives_class_period ON public.bulletin_archives USING btree (class_id, period_id);


--
-- Name: idx_bulletin_archives_student; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bulletin_archives_student ON public.bulletin_archives USING btree (student_id);


--
-- Name: idx_class_journal_class; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_class_journal_class ON public.class_journal USING btree (class_id, session_date DESC);


--
-- Name: idx_class_journal_etab; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_class_journal_etab ON public.class_journal USING btree (etablissement_id);


--
-- Name: idx_class_journal_teacher; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_class_journal_teacher ON public.class_journal USING btree (teacher_id);


--
-- Name: idx_class_teachers_class; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_class_teachers_class ON public.class_teachers USING btree (class_id);


--
-- Name: idx_class_teachers_effective; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_class_teachers_effective ON public.class_teachers USING btree (class_id, effective_from, effective_until);


--
-- Name: idx_class_teachers_teacher; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_class_teachers_teacher ON public.class_teachers USING btree (teacher_id);


--
-- Name: idx_classes_academic_year; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_classes_academic_year ON public.classes USING btree (academic_year);


--
-- Name: idx_classes_etablissement; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_classes_etablissement ON public.classes USING btree (etablissement_id);


--
-- Name: idx_classes_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_classes_is_active ON public.classes USING btree (is_active);


--
-- Name: idx_cotisation_types_year; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cotisation_types_year ON public.cotisation_types USING btree (etablissement_id, school_year_id);


--
-- Name: idx_doc_type_configs_etab; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_doc_type_configs_etab ON public.document_type_configs USING btree (etablissement_id);


--
-- Name: idx_enrollments_class; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_enrollments_class ON public.enrollments USING btree (class_id);


--
-- Name: idx_enrollments_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_enrollments_status ON public.enrollments USING btree (status);


--
-- Name: idx_enrollments_student; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_enrollments_student ON public.enrollments USING btree (student_id);


--
-- Name: idx_evaluations_class; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_evaluations_class ON public.evaluations USING btree (class_id);


--
-- Name: idx_evaluations_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_evaluations_date ON public.evaluations USING btree (evaluation_date);


--
-- Name: idx_evaluations_etablissement; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_evaluations_etablissement ON public.evaluations USING btree (etablissement_id);


--
-- Name: idx_evaluations_module; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_evaluations_module ON public.evaluations USING btree (module_id);


--
-- Name: idx_expenses_etab_year; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_expenses_etab_year ON public.expenses USING btree (etablissement_id, school_year_id);


--
-- Name: idx_family_fees_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_family_fees_parent ON public.family_fees USING btree (parent_id);


--
-- Name: idx_family_fees_year; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_family_fees_year ON public.family_fees USING btree (etablissement_id, school_year_id);


--
-- Name: idx_fee_adjustments_family; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fee_adjustments_family ON public.fee_adjustments USING btree (family_fee_id);


--
-- Name: idx_fee_installments_family; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fee_installments_family ON public.fee_installments USING btree (family_fee_id);


--
-- Name: idx_fee_installments_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fee_installments_status ON public.fee_installments USING btree (status);


--
-- Name: idx_fin_comm_parent_year; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fin_comm_parent_year ON public.financement_communications USING btree (parent_id, school_year_id);


--
-- Name: idx_fyf_etab_year; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fyf_etab_year ON public.family_year_finance USING btree (etablissement_id, school_year_id);


--
-- Name: idx_fyf_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fyf_parent ON public.family_year_finance USING btree (parent_id);


--
-- Name: idx_grades_evaluation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_grades_evaluation ON public.grades USING btree (evaluation_id);


--
-- Name: idx_grades_student; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_grades_student ON public.grades USING btree (student_id);


--
-- Name: idx_homework_class; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_homework_class ON public.homework USING btree (class_id, due_date);


--
-- Name: idx_homework_due; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_homework_due ON public.homework USING btree (due_date);


--
-- Name: idx_homework_etab; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_homework_etab ON public.homework USING btree (etablissement_id);


--
-- Name: idx_homework_status_homework; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_homework_status_homework ON public.homework_status USING btree (homework_id);


--
-- Name: idx_homework_status_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_homework_status_parent ON public.homework_status USING btree (parent_id);


--
-- Name: idx_modules_etablissement; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_modules_etablissement ON public.modules USING btree (etablissement_id);


--
-- Name: idx_modules_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_modules_order ON public.modules USING btree (order_index);


--
-- Name: idx_modules_teaching_unit; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_modules_teaching_unit ON public.modules USING btree (teaching_unit_id);


--
-- Name: idx_notifications_etablissement; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_etablissement ON public.notifications USING btree (etablissement_id);


--
-- Name: idx_notifications_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_parent ON public.notifications USING btree (parent_id, created_at DESC);


--
-- Name: idx_other_revenues_etab_year; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_other_revenues_etab_year ON public.other_revenues USING btree (etablissement_id, school_year_id);


--
-- Name: idx_parents_etablissement; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_parents_etablissement ON public.parents USING btree (etablissement_id);


--
-- Name: idx_parents_tutor1_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_parents_tutor1_name ON public.parents USING btree (tutor1_last_name);


--
-- Name: idx_parents_tutor1_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_parents_tutor1_user ON public.parents USING btree (tutor1_user_id);


--
-- Name: idx_parents_tutor2_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_parents_tutor2_user ON public.parents USING btree (tutor2_user_id);


--
-- Name: idx_parents_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_parents_user_id ON public.parents USING btree (user_id);


--
-- Name: idx_periods_one_current_per_year; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_periods_one_current_per_year ON public.periods USING btree (school_year_id) WHERE is_current;


--
-- Name: idx_presence_type_rates_year; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_presence_type_rates_year ON public.presence_type_rates USING btree (school_year_id);


--
-- Name: idx_presence_types_etablissement; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_presence_types_etablissement ON public.presence_types USING btree (etablissement_id);


--
-- Name: idx_presence_types_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_presence_types_order ON public.presence_types USING btree (order_index);


--
-- Name: idx_presence_types_reserved_kind; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_presence_types_reserved_kind ON public.presence_types USING btree (etablissement_id, school_year_id, reserved_kind) WHERE (reserved_kind IS NOT NULL);


--
-- Name: idx_presence_types_year; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_presence_types_year ON public.presence_types USING btree (etablissement_id, school_year_id);


--
-- Name: idx_profiles_etablissement; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_etablissement ON public.profiles USING btree (etablissement_id);


--
-- Name: idx_profiles_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_is_active ON public.profiles USING btree (is_active);


--
-- Name: idx_profiles_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_role ON public.profiles USING btree (role);


--
-- Name: idx_push_subscriptions_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_push_subscriptions_user ON public.push_subscriptions USING btree (user_id);


--
-- Name: idx_schedule_exceptions_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_schedule_exceptions_date ON public.schedule_exceptions USING btree (exception_date);


--
-- Name: idx_schedule_exceptions_slot; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_schedule_exceptions_slot ON public.schedule_exceptions USING btree (schedule_slot_id);


--
-- Name: idx_schedule_no_class_overlap_oneoff; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_schedule_no_class_overlap_oneoff ON public.schedule_slots USING btree (class_id, slot_date, start_time, end_time) WHERE ((is_active = true) AND (is_recurring = false));


--
-- Name: idx_schedule_slots_class; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_schedule_slots_class ON public.schedule_slots USING btree (class_id, day_of_week);


--
-- Name: idx_schedule_slots_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_schedule_slots_date ON public.schedule_slots USING btree (slot_date) WHERE (slot_date IS NOT NULL);


--
-- Name: idx_schedule_slots_teacher; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_schedule_slots_teacher ON public.schedule_slots USING btree (teacher_id, day_of_week);


--
-- Name: idx_schedule_slots_year; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_schedule_slots_year ON public.schedule_slots USING btree (etablissement_id, school_year_id);


--
-- Name: idx_schedule_validations_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_schedule_validations_date ON public.schedule_validations USING btree (etablissement_id, validation_date);


--
-- Name: idx_schedule_validations_teacher; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_schedule_validations_teacher ON public.schedule_validations USING btree (profile_id, validation_date);


--
-- Name: idx_staff_time_entries_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_staff_time_entries_date ON public.staff_time_entries USING btree (etablissement_id, entry_date);


--
-- Name: idx_staff_time_entries_profile; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_staff_time_entries_profile ON public.staff_time_entries USING btree (profile_id, entry_date);


--
-- Name: idx_student_documents_etab; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_student_documents_etab ON public.student_documents USING btree (etablissement_id);


--
-- Name: idx_student_documents_student; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_student_documents_student ON public.student_documents USING btree (student_id);


--
-- Name: idx_student_warnings_class_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_student_warnings_class_period ON public.student_warnings USING btree (class_id, period_id);


--
-- Name: idx_student_warnings_etab; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_student_warnings_etab ON public.student_warnings USING btree (etablissement_id);


--
-- Name: idx_student_warnings_student; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_student_warnings_student ON public.student_warnings USING btree (student_id);


--
-- Name: idx_students_etablissement; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_students_etablissement ON public.students USING btree (etablissement_id);


--
-- Name: idx_students_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_students_is_active ON public.students USING btree (is_active);


--
-- Name: idx_students_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_students_number ON public.students USING btree (student_number);


--
-- Name: idx_students_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_students_parent ON public.students USING btree (parent_id);


--
-- Name: idx_subjects_etablissement; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subjects_etablissement ON public.subjects USING btree (etablissement_id);


--
-- Name: idx_subjects_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subjects_order ON public.subjects USING btree (order_index);


--
-- Name: idx_syh_etab_year; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_syh_etab_year ON public.student_year_history USING btree (etablissement_id, school_year_id);


--
-- Name: idx_syh_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_syh_parent ON public.student_year_history USING btree (parent_id);


--
-- Name: idx_syh_student; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_syh_student ON public.student_year_history USING btree (student_id);


--
-- Name: idx_teacher_documents_etab; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_teacher_documents_etab ON public.teacher_documents USING btree (etablissement_id);


--
-- Name: idx_teacher_documents_teacher; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_teacher_documents_teacher ON public.teacher_documents USING btree (teacher_id);


--
-- Name: idx_teachers_etablissement; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_teachers_etablissement ON public.teachers USING btree (etablissement_id);


--
-- Name: idx_teachers_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_teachers_is_active ON public.teachers USING btree (is_active);


--
-- Name: idx_teachers_unique_name; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_teachers_unique_name ON public.teachers USING btree (etablissement_id, public.norm_name(last_name), public.norm_name(first_name));


--
-- Name: idx_teaching_units_etablissement; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_teaching_units_etablissement ON public.teaching_units USING btree (etablissement_id);


--
-- Name: idx_teaching_units_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_teaching_units_order ON public.teaching_units USING btree (order_index);


--
-- Name: idx_teaching_units_subject; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_teaching_units_subject ON public.teaching_units USING btree (subject_id);


--
-- Name: idx_warning_attachments_warning; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_warning_attachments_warning ON public.student_warning_attachments USING btree (warning_id);


--
-- Name: uq_syh_adult; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_syh_adult ON public.student_year_history USING btree (school_year_id, parent_id, tutor_number) WHERE (participant_type = 'adult'::text);


--
-- Name: uq_syh_student; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_syh_student ON public.student_year_history USING btree (school_year_id, student_id) WHERE (participant_type = 'student'::text);


--
-- Name: announcements announcements_auto_etablissement; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER announcements_auto_etablissement BEFORE INSERT ON public.announcements FOR EACH ROW EXECUTE FUNCTION public.set_etablissement_id();


--
-- Name: absences audit_absences; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_absences AFTER INSERT OR DELETE OR UPDATE ON public.absences FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();


--
-- Name: adult_bulletin_appreciations audit_adult_bulletin_appreciations; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_adult_bulletin_appreciations AFTER INSERT OR DELETE OR UPDATE ON public.adult_bulletin_appreciations FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();


--
-- Name: adult_bulletin_archives audit_adult_bulletin_archives; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_adult_bulletin_archives AFTER INSERT OR DELETE OR UPDATE ON public.adult_bulletin_archives FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();


--
-- Name: adult_grades audit_adult_grades; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_adult_grades AFTER INSERT OR DELETE OR UPDATE ON public.adult_grades FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();


--
-- Name: announcement_attachments audit_announcement_attachments; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_announcement_attachments AFTER INSERT OR DELETE OR UPDATE ON public.announcement_attachments FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();


--
-- Name: announcements audit_announcements; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_announcements AFTER INSERT OR DELETE OR UPDATE ON public.announcements FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();


--
-- Name: bulletin_archives audit_bulletin_archives; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_bulletin_archives AFTER INSERT OR DELETE OR UPDATE ON public.bulletin_archives FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();


--
-- Name: classes audit_classes; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_classes AFTER INSERT OR DELETE OR UPDATE ON public.classes FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();


--
-- Name: cotisation_types audit_cotisation_types; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_cotisation_types AFTER INSERT OR DELETE OR UPDATE ON public.cotisation_types FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();


--
-- Name: cours audit_cours; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_cours AFTER INSERT OR DELETE OR UPDATE ON public.cours FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();


--
-- Name: cours_modules audit_cours_modules; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_cours_modules AFTER INSERT OR DELETE OR UPDATE ON public.cours_modules FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();


--
-- Name: document_type_configs audit_document_type_configs; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_document_type_configs AFTER INSERT OR DELETE OR UPDATE ON public.document_type_configs FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();


--
-- Name: enrollments audit_enrollments; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_enrollments AFTER INSERT OR DELETE OR UPDATE ON public.enrollments FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();


--
-- Name: etablissements audit_etablissements; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_etablissements AFTER INSERT OR DELETE OR UPDATE ON public.etablissements FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();


--
-- Name: evaluation_order_config audit_evaluation_order_config; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_evaluation_order_config AFTER INSERT OR DELETE OR UPDATE ON public.evaluation_order_config FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();


--
-- Name: evaluations audit_evaluations; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_evaluations AFTER INSERT OR DELETE OR UPDATE ON public.evaluations FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();


--
-- Name: expenses audit_expenses; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_expenses AFTER INSERT OR DELETE OR UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();


--
-- Name: family_fees audit_family_fees; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_family_fees AFTER INSERT OR DELETE OR UPDATE ON public.family_fees FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();


--
-- Name: fee_adjustments audit_fee_adjustments; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_fee_adjustments AFTER INSERT OR DELETE OR UPDATE ON public.fee_adjustments FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();


--
-- Name: fee_installments audit_fee_installments; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_fee_installments AFTER INSERT OR DELETE OR UPDATE ON public.fee_installments FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();


--
-- Name: grades audit_grades; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_grades AFTER INSERT OR DELETE OR UPDATE ON public.grades FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();


--
-- Name: materials audit_materials; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_materials AFTER INSERT OR DELETE OR UPDATE ON public.materials FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();


--
-- Name: other_revenues audit_other_revenues; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_other_revenues AFTER INSERT OR DELETE OR UPDATE ON public.other_revenues FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();


--
-- Name: parent_class_enrollments audit_parent_class_enrollments; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_parent_class_enrollments AFTER INSERT OR DELETE OR UPDATE ON public.parent_class_enrollments FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();


--
-- Name: parents audit_parents; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_parents AFTER INSERT OR DELETE OR UPDATE ON public.parents FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();


--
-- Name: profiles audit_profiles; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_profiles AFTER INSERT OR DELETE OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();


--
-- Name: rooms audit_rooms; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_rooms AFTER INSERT OR DELETE OR UPDATE ON public.rooms FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();


--
-- Name: schedule_validations audit_schedule_validations; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_schedule_validations AFTER INSERT OR DELETE OR UPDATE ON public.schedule_validations FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();


--
-- Name: school_years audit_school_years; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_school_years AFTER INSERT OR DELETE OR UPDATE ON public.school_years FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();


--
-- Name: staff_hourly_rates audit_staff_hourly_rates; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_staff_hourly_rates AFTER INSERT OR DELETE OR UPDATE ON public.staff_hourly_rates FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();


--
-- Name: staff_time_entries audit_staff_time_entries; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_staff_time_entries AFTER INSERT OR DELETE OR UPDATE ON public.staff_time_entries FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();


--
-- Name: student_documents audit_student_documents; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_student_documents AFTER INSERT OR DELETE OR UPDATE ON public.student_documents FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();


--
-- Name: student_warning_attachments audit_student_warning_attachments; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_student_warning_attachments AFTER INSERT OR DELETE OR UPDATE ON public.student_warning_attachments FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();


--
-- Name: student_warnings audit_student_warnings; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_student_warnings AFTER INSERT OR DELETE OR UPDATE ON public.student_warnings FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();


--
-- Name: students audit_students; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_students AFTER INSERT OR DELETE OR UPDATE ON public.students FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();


--
-- Name: teacher_documents audit_teacher_documents; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_teacher_documents AFTER INSERT OR DELETE OR UPDATE ON public.teacher_documents FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();


--
-- Name: teachers audit_teachers; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_teachers AFTER INSERT OR DELETE OR UPDATE ON public.teachers FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();


--
-- Name: unites_enseignement audit_unites_enseignement; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_unites_enseignement AFTER INSERT OR DELETE OR UPDATE ON public.unites_enseignement FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();


--
-- Name: classes classes_auto_etablissement; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER classes_auto_etablissement BEFORE INSERT ON public.classes FOR EACH ROW EXECUTE FUNCTION public.set_etablissement_id();


--
-- Name: cotisation_types cotisation_types_auto_etablissement; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER cotisation_types_auto_etablissement BEFORE INSERT ON public.cotisation_types FOR EACH ROW EXECUTE FUNCTION public.set_etablissement_id();


--
-- Name: evaluations evaluations_auto_etablissement; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER evaluations_auto_etablissement BEFORE INSERT ON public.evaluations FOR EACH ROW EXECUTE FUNCTION public.set_etablissement_id();


--
-- Name: expenses expenses_auto_etablissement; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER expenses_auto_etablissement BEFORE INSERT ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.set_etablissement_id();


--
-- Name: family_fees family_fees_auto_etablissement; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER family_fees_auto_etablissement BEFORE INSERT ON public.family_fees FOR EACH ROW EXECUTE FUNCTION public.set_etablissement_id();


--
-- Name: fee_adjustments fee_adjustments_auto_etablissement; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER fee_adjustments_auto_etablissement BEFORE INSERT ON public.fee_adjustments FOR EACH ROW EXECUTE FUNCTION public.set_etablissement_id();


--
-- Name: fee_installments fee_installments_auto_etablissement; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER fee_installments_auto_etablissement BEFORE INSERT ON public.fee_installments FOR EACH ROW EXECUTE FUNCTION public.set_etablissement_id();


--
-- Name: modules modules_auto_etablissement; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER modules_auto_etablissement BEFORE INSERT ON public.modules FOR EACH ROW EXECUTE FUNCTION public.set_etablissement_id();


--
-- Name: other_revenues other_revenues_auto_etablissement; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER other_revenues_auto_etablissement BEFORE INSERT ON public.other_revenues FOR EACH ROW EXECUTE FUNCTION public.set_etablissement_id();


--
-- Name: parents parents_auto_etablissement; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER parents_auto_etablissement BEFORE INSERT ON public.parents FOR EACH ROW EXECUTE FUNCTION public.set_etablissement_id();


--
-- Name: presence_type_rates presence_type_rates_auto_etablissement; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER presence_type_rates_auto_etablissement BEFORE INSERT ON public.presence_type_rates FOR EACH ROW EXECUTE FUNCTION public.set_etablissement_id();


--
-- Name: presence_types presence_types_auto_etablissement; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER presence_types_auto_etablissement BEFORE INSERT ON public.presence_types FOR EACH ROW EXECUTE FUNCTION public.set_etablissement_id();


--
-- Name: schedule_exceptions schedule_exceptions_auto_etablissement; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER schedule_exceptions_auto_etablissement BEFORE INSERT ON public.schedule_exceptions FOR EACH ROW EXECUTE FUNCTION public.set_etablissement_id();


--
-- Name: schedule_slots schedule_slots_auto_etablissement; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER schedule_slots_auto_etablissement BEFORE INSERT ON public.schedule_slots FOR EACH ROW EXECUTE FUNCTION public.set_etablissement_id();


--
-- Name: schedule_validations schedule_validations_auto_etablissement; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER schedule_validations_auto_etablissement BEFORE INSERT ON public.schedule_validations FOR EACH ROW EXECUTE FUNCTION public.set_etablissement_id();


--
-- Name: parent_class_enrollments set_etablissement_id_parent_class_enrollments; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_etablissement_id_parent_class_enrollments BEFORE INSERT ON public.parent_class_enrollments FOR EACH ROW EXECUTE FUNCTION public.set_etablissement_id();


--
-- Name: expenses set_expenses_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_expenses_updated_at BEFORE UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: other_revenues set_other_revenues_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_other_revenues_updated_at BEFORE UPDATE ON public.other_revenues FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: staff_hourly_rates staff_hourly_rates_auto_etablissement; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER staff_hourly_rates_auto_etablissement BEFORE INSERT ON public.staff_hourly_rates FOR EACH ROW EXECUTE FUNCTION public.set_etablissement_id();


--
-- Name: staff_time_entries staff_time_entries_auto_etablissement; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER staff_time_entries_auto_etablissement BEFORE INSERT ON public.staff_time_entries FOR EACH ROW EXECUTE FUNCTION public.set_etablissement_id();


--
-- Name: students students_auto_etablissement; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER students_auto_etablissement BEFORE INSERT ON public.students FOR EACH ROW EXECUTE FUNCTION public.set_etablissement_id();


--
-- Name: subjects subjects_auto_etablissement; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER subjects_auto_etablissement BEFORE INSERT ON public.subjects FOR EACH ROW EXECUTE FUNCTION public.set_etablissement_id();


--
-- Name: teachers teachers_auto_etablissement; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER teachers_auto_etablissement BEFORE INSERT ON public.teachers FOR EACH ROW EXECUTE FUNCTION public.set_etablissement_id();


--
-- Name: teaching_units teaching_units_auto_etablissement; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER teaching_units_auto_etablissement BEFORE INSERT ON public.teaching_units FOR EACH ROW EXECUTE FUNCTION public.set_etablissement_id();


--
-- Name: parent_class_enrollments trg_block_adult_unenroll; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_block_adult_unenroll BEFORE DELETE ON public.parent_class_enrollments FOR EACH ROW EXECUTE FUNCTION public.fn_block_adult_unenroll();


--
-- Name: enrollments trg_block_student_unenroll; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_block_student_unenroll BEFORE DELETE ON public.enrollments FOR EACH ROW EXECUTE FUNCTION public.fn_block_student_unenroll();


--
-- Name: presence_types trg_guard_presence_type_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_guard_presence_type_delete BEFORE DELETE ON public.presence_types FOR EACH ROW EXECUTE FUNCTION public.fn_guard_presence_type_delete();


--
-- Name: profiles trg_guard_profile_sensitive; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_guard_profile_sensitive BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.fn_guard_profile_sensitive_columns();


--
-- Name: presence_types trg_protect_reserved_presence_types; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_protect_reserved_presence_types BEFORE DELETE OR UPDATE ON public.presence_types FOR EACH ROW EXECUTE FUNCTION public.fn_protect_reserved_presence_types();


--
-- Name: school_years trg_school_year_reserved_types; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_school_year_reserved_types AFTER INSERT ON public.school_years FOR EACH ROW EXECUTE FUNCTION public.fn_school_year_reserved_types();


--
-- Name: profiles trg_sync_identity_profile_to_teacher; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sync_identity_profile_to_teacher AFTER UPDATE OF civilite, first_name, last_name ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.fn_sync_identity_profile_to_teacher();


--
-- Name: teachers trg_sync_identity_teacher_to_profile; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sync_identity_teacher_to_profile AFTER UPDATE OF civilite, first_name, last_name ON public.teachers FOR EACH ROW EXECUTE FUNCTION public.fn_sync_identity_teacher_to_profile();


--
-- Name: etablissement_smtp trg_touch_etablissement_smtp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_touch_etablissement_smtp BEFORE UPDATE ON public.etablissement_smtp FOR EACH ROW EXECUTE FUNCTION public.fn_touch_etablissement_smtp();


--
-- Name: announcements update_announcements_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_announcements_updated_at BEFORE UPDATE ON public.announcements FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: classes update_classes_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_classes_updated_at BEFORE UPDATE ON public.classes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: enrollments update_enrollments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_enrollments_updated_at BEFORE UPDATE ON public.enrollments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: etablissements update_etablissements_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_etablissements_updated_at BEFORE UPDATE ON public.etablissements FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: evaluations update_evaluations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_evaluations_updated_at BEFORE UPDATE ON public.evaluations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: family_fees update_family_fees_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_family_fees_updated_at BEFORE UPDATE ON public.family_fees FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: fee_installments update_fee_installments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_fee_installments_updated_at BEFORE UPDATE ON public.fee_installments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: grades update_grades_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_grades_updated_at BEFORE UPDATE ON public.grades FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: modules update_modules_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_modules_updated_at BEFORE UPDATE ON public.modules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: parents update_parents_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_parents_updated_at BEFORE UPDATE ON public.parents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: presence_type_rates update_presence_type_rates_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_presence_type_rates_updated_at BEFORE UPDATE ON public.presence_type_rates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: presence_types update_presence_types_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_presence_types_updated_at BEFORE UPDATE ON public.presence_types FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: profiles update_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: schedule_slots update_schedule_slots_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_schedule_slots_updated_at BEFORE UPDATE ON public.schedule_slots FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: staff_hourly_rates update_staff_hourly_rates_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_staff_hourly_rates_updated_at BEFORE UPDATE ON public.staff_hourly_rates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: staff_time_entries update_staff_time_entries_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_staff_time_entries_updated_at BEFORE UPDATE ON public.staff_time_entries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: students update_students_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_students_updated_at BEFORE UPDATE ON public.students FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: subjects update_subjects_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_subjects_updated_at BEFORE UPDATE ON public.subjects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: teachers update_teachers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_teachers_updated_at BEFORE UPDATE ON public.teachers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: teaching_units update_teaching_units_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_teaching_units_updated_at BEFORE UPDATE ON public.teaching_units FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: absences absences_class_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.absences
    ADD CONSTRAINT absences_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE CASCADE;


--
-- Name: absences absences_etablissement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.absences
    ADD CONSTRAINT absences_etablissement_id_fkey FOREIGN KEY (etablissement_id) REFERENCES public.etablissements(id) ON DELETE CASCADE;


--
-- Name: absences absences_period_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.absences
    ADD CONSTRAINT absences_period_id_fkey FOREIGN KEY (period_id) REFERENCES public.periods(id) ON DELETE CASCADE;


--
-- Name: absences absences_recorded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.absences
    ADD CONSTRAINT absences_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.profiles(id);


--
-- Name: absences absences_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.absences
    ADD CONSTRAINT absences_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;


--
-- Name: adult_bulletin_appreciations adult_bulletin_appreciations_class_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.adult_bulletin_appreciations
    ADD CONSTRAINT adult_bulletin_appreciations_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE CASCADE;


--
-- Name: adult_bulletin_appreciations adult_bulletin_appreciations_etablissement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.adult_bulletin_appreciations
    ADD CONSTRAINT adult_bulletin_appreciations_etablissement_id_fkey FOREIGN KEY (etablissement_id) REFERENCES public.etablissements(id) ON DELETE CASCADE;


--
-- Name: adult_bulletin_appreciations adult_bulletin_appreciations_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.adult_bulletin_appreciations
    ADD CONSTRAINT adult_bulletin_appreciations_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.parents(id) ON DELETE CASCADE;


--
-- Name: adult_bulletin_appreciations adult_bulletin_appreciations_period_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.adult_bulletin_appreciations
    ADD CONSTRAINT adult_bulletin_appreciations_period_id_fkey FOREIGN KEY (period_id) REFERENCES public.periods(id) ON DELETE CASCADE;


--
-- Name: adult_bulletin_appreciations adult_bulletin_appreciations_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.adult_bulletin_appreciations
    ADD CONSTRAINT adult_bulletin_appreciations_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id);


--
-- Name: adult_bulletin_archives adult_bulletin_archives_archived_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.adult_bulletin_archives
    ADD CONSTRAINT adult_bulletin_archives_archived_by_fkey FOREIGN KEY (archived_by) REFERENCES public.profiles(id);


--
-- Name: adult_bulletin_archives adult_bulletin_archives_class_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.adult_bulletin_archives
    ADD CONSTRAINT adult_bulletin_archives_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE CASCADE;


--
-- Name: adult_bulletin_archives adult_bulletin_archives_etablissement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.adult_bulletin_archives
    ADD CONSTRAINT adult_bulletin_archives_etablissement_id_fkey FOREIGN KEY (etablissement_id) REFERENCES public.etablissements(id) ON DELETE CASCADE;


--
-- Name: adult_bulletin_archives adult_bulletin_archives_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.adult_bulletin_archives
    ADD CONSTRAINT adult_bulletin_archives_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.parents(id) ON DELETE CASCADE;


--
-- Name: adult_bulletin_archives adult_bulletin_archives_period_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.adult_bulletin_archives
    ADD CONSTRAINT adult_bulletin_archives_period_id_fkey FOREIGN KEY (period_id) REFERENCES public.periods(id) ON DELETE CASCADE;


--
-- Name: adult_grades adult_grades_etablissement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.adult_grades
    ADD CONSTRAINT adult_grades_etablissement_id_fkey FOREIGN KEY (etablissement_id) REFERENCES public.etablissements(id) ON DELETE CASCADE;


--
-- Name: adult_grades adult_grades_evaluation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.adult_grades
    ADD CONSTRAINT adult_grades_evaluation_id_fkey FOREIGN KEY (evaluation_id) REFERENCES public.evaluations(id) ON DELETE CASCADE;


--
-- Name: adult_grades adult_grades_graded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.adult_grades
    ADD CONSTRAINT adult_grades_graded_by_fkey FOREIGN KEY (graded_by) REFERENCES public.teachers(id);


--
-- Name: adult_grades adult_grades_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.adult_grades
    ADD CONSTRAINT adult_grades_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.parents(id) ON DELETE CASCADE;


--
-- Name: adult_homework_status adult_homework_status_homework_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.adult_homework_status
    ADD CONSTRAINT adult_homework_status_homework_id_fkey FOREIGN KEY (homework_id) REFERENCES public.homework(id) ON DELETE CASCADE;


--
-- Name: adult_homework_status adult_homework_status_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.adult_homework_status
    ADD CONSTRAINT adult_homework_status_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.parents(id) ON DELETE CASCADE;


--
-- Name: announcement_attachments announcement_attachments_announcement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcement_attachments
    ADD CONSTRAINT announcement_attachments_announcement_id_fkey FOREIGN KEY (announcement_id) REFERENCES public.announcements(id) ON DELETE CASCADE;


--
-- Name: announcement_recipients announcement_recipients_announcement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcement_recipients
    ADD CONSTRAINT announcement_recipients_announcement_id_fkey FOREIGN KEY (announcement_id) REFERENCES public.announcements(id) ON DELETE CASCADE;


--
-- Name: announcement_recipients announcement_recipients_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcement_recipients
    ADD CONSTRAINT announcement_recipients_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.parents(id) ON DELETE CASCADE;


--
-- Name: announcement_staff_recipients announcement_staff_recipients_announcement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcement_staff_recipients
    ADD CONSTRAINT announcement_staff_recipients_announcement_id_fkey FOREIGN KEY (announcement_id) REFERENCES public.announcements(id) ON DELETE CASCADE;


--
-- Name: announcement_staff_recipients announcement_staff_recipients_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcement_staff_recipients
    ADD CONSTRAINT announcement_staff_recipients_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: announcements announcements_etablissement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcements
    ADD CONSTRAINT announcements_etablissement_id_fkey FOREIGN KEY (etablissement_id) REFERENCES public.etablissements(id) ON DELETE CASCADE;


--
-- Name: announcements announcements_published_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcements
    ADD CONSTRAINT announcements_published_by_fkey FOREIGN KEY (published_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: announcements announcements_target_class_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcements
    ADD CONSTRAINT announcements_target_class_id_fkey FOREIGN KEY (target_class_id) REFERENCES public.classes(id) ON DELETE CASCADE;


--
-- Name: audit_logs audit_logs_etablissement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_etablissement_id_fkey FOREIGN KEY (etablissement_id) REFERENCES public.etablissements(id) ON DELETE CASCADE;


--
-- Name: audit_logs audit_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: bulletin_appreciations bulletin_appreciations_class_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bulletin_appreciations
    ADD CONSTRAINT bulletin_appreciations_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE CASCADE;


--
-- Name: bulletin_appreciations bulletin_appreciations_etablissement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bulletin_appreciations
    ADD CONSTRAINT bulletin_appreciations_etablissement_id_fkey FOREIGN KEY (etablissement_id) REFERENCES public.etablissements(id) ON DELETE CASCADE;


--
-- Name: bulletin_appreciations bulletin_appreciations_period_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bulletin_appreciations
    ADD CONSTRAINT bulletin_appreciations_period_id_fkey FOREIGN KEY (period_id) REFERENCES public.periods(id) ON DELETE CASCADE;


--
-- Name: bulletin_appreciations bulletin_appreciations_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bulletin_appreciations
    ADD CONSTRAINT bulletin_appreciations_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;


--
-- Name: bulletin_appreciations bulletin_appreciations_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bulletin_appreciations
    ADD CONSTRAINT bulletin_appreciations_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id);


--
-- Name: bulletin_archives bulletin_archives_archived_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bulletin_archives
    ADD CONSTRAINT bulletin_archives_archived_by_fkey FOREIGN KEY (archived_by) REFERENCES public.profiles(id);


--
-- Name: bulletin_archives bulletin_archives_class_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bulletin_archives
    ADD CONSTRAINT bulletin_archives_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE CASCADE;


--
-- Name: bulletin_archives bulletin_archives_etablissement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bulletin_archives
    ADD CONSTRAINT bulletin_archives_etablissement_id_fkey FOREIGN KEY (etablissement_id) REFERENCES public.etablissements(id) ON DELETE CASCADE;


--
-- Name: bulletin_archives bulletin_archives_period_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bulletin_archives
    ADD CONSTRAINT bulletin_archives_period_id_fkey FOREIGN KEY (period_id) REFERENCES public.periods(id) ON DELETE CASCADE;


--
-- Name: bulletin_archives bulletin_archives_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bulletin_archives
    ADD CONSTRAINT bulletin_archives_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;


--
-- Name: class_journal class_journal_class_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.class_journal
    ADD CONSTRAINT class_journal_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE CASCADE;


--
-- Name: class_journal class_journal_etablissement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.class_journal
    ADD CONSTRAINT class_journal_etablissement_id_fkey FOREIGN KEY (etablissement_id) REFERENCES public.etablissements(id) ON DELETE CASCADE;


--
-- Name: class_journal class_journal_teacher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.class_journal
    ADD CONSTRAINT class_journal_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.teachers(id) ON DELETE CASCADE;


--
-- Name: class_teachers class_teachers_class_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.class_teachers
    ADD CONSTRAINT class_teachers_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE CASCADE;


--
-- Name: class_teachers class_teachers_teacher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.class_teachers
    ADD CONSTRAINT class_teachers_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.teachers(id) ON DELETE CASCADE;


--
-- Name: classes classes_cotisation_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.classes
    ADD CONSTRAINT classes_cotisation_type_id_fkey FOREIGN KEY (cotisation_type_id) REFERENCES public.cotisation_types(id) ON DELETE SET NULL;


--
-- Name: classes classes_etablissement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.classes
    ADD CONSTRAINT classes_etablissement_id_fkey FOREIGN KEY (etablissement_id) REFERENCES public.etablissements(id) ON DELETE CASCADE;


--
-- Name: classes classes_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.classes
    ADD CONSTRAINT classes_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.rooms(id) ON DELETE SET NULL;


--
-- Name: cotisation_types cotisation_types_etablissement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cotisation_types
    ADD CONSTRAINT cotisation_types_etablissement_id_fkey FOREIGN KEY (etablissement_id) REFERENCES public.etablissements(id) ON DELETE CASCADE;


--
-- Name: cotisation_types cotisation_types_school_year_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cotisation_types
    ADD CONSTRAINT cotisation_types_school_year_id_fkey FOREIGN KEY (school_year_id) REFERENCES public.school_years(id) ON DELETE CASCADE;


--
-- Name: cours cours_module_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cours
    ADD CONSTRAINT cours_module_id_fkey FOREIGN KEY (module_id) REFERENCES public.cours_modules(id) ON DELETE SET NULL;


--
-- Name: cours_modules cours_modules_unite_enseignement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cours_modules
    ADD CONSTRAINT cours_modules_unite_enseignement_id_fkey FOREIGN KEY (unite_enseignement_id) REFERENCES public.unites_enseignement(id) ON DELETE CASCADE;


--
-- Name: cours cours_unite_enseignement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cours
    ADD CONSTRAINT cours_unite_enseignement_id_fkey FOREIGN KEY (unite_enseignement_id) REFERENCES public.unites_enseignement(id) ON DELETE CASCADE;


--
-- Name: document_type_configs document_type_configs_etablissement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_type_configs
    ADD CONSTRAINT document_type_configs_etablissement_id_fkey FOREIGN KEY (etablissement_id) REFERENCES public.etablissements(id) ON DELETE CASCADE;


--
-- Name: enrollments enrollments_class_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enrollments
    ADD CONSTRAINT enrollments_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE CASCADE;


--
-- Name: enrollments enrollments_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enrollments
    ADD CONSTRAINT enrollments_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;


--
-- Name: etablissement_smtp etablissement_smtp_etablissement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.etablissement_smtp
    ADD CONSTRAINT etablissement_smtp_etablissement_id_fkey FOREIGN KEY (etablissement_id) REFERENCES public.etablissements(id) ON DELETE CASCADE;


--
-- Name: eval_type_configs eval_type_configs_school_year_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eval_type_configs
    ADD CONSTRAINT eval_type_configs_school_year_id_fkey FOREIGN KEY (school_year_id) REFERENCES public.school_years(id) ON DELETE CASCADE;


--
-- Name: evaluations evaluations_class_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evaluations
    ADD CONSTRAINT evaluations_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE CASCADE;


--
-- Name: evaluations evaluations_cours_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evaluations
    ADD CONSTRAINT evaluations_cours_id_fkey FOREIGN KEY (cours_id) REFERENCES public.cours(id) ON DELETE SET NULL;


--
-- Name: evaluations evaluations_display_module_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evaluations
    ADD CONSTRAINT evaluations_display_module_id_fkey FOREIGN KEY (display_module_id) REFERENCES public.cours_modules(id) ON DELETE SET NULL;


--
-- Name: evaluations evaluations_display_ue_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evaluations
    ADD CONSTRAINT evaluations_display_ue_id_fkey FOREIGN KEY (display_ue_id) REFERENCES public.unites_enseignement(id) ON DELETE SET NULL;


--
-- Name: evaluations evaluations_etablissement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evaluations
    ADD CONSTRAINT evaluations_etablissement_id_fkey FOREIGN KEY (etablissement_id) REFERENCES public.etablissements(id) ON DELETE CASCADE;


--
-- Name: evaluations evaluations_module_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evaluations
    ADD CONSTRAINT evaluations_module_id_fkey FOREIGN KEY (module_id) REFERENCES public.modules(id) ON DELETE CASCADE;


--
-- Name: evaluations evaluations_period_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evaluations
    ADD CONSTRAINT evaluations_period_id_fkey FOREIGN KEY (period_id) REFERENCES public.periods(id) ON DELETE SET NULL;


--
-- Name: evaluations evaluations_teacher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evaluations
    ADD CONSTRAINT evaluations_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.teachers(id) ON DELETE SET NULL;


--
-- Name: expenses expenses_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id);


--
-- Name: expenses expenses_etablissement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_etablissement_id_fkey FOREIGN KEY (etablissement_id) REFERENCES public.etablissements(id);


--
-- Name: expenses expenses_school_year_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_school_year_id_fkey FOREIGN KEY (school_year_id) REFERENCES public.school_years(id);


--
-- Name: family_fees family_fees_etablissement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.family_fees
    ADD CONSTRAINT family_fees_etablissement_id_fkey FOREIGN KEY (etablissement_id) REFERENCES public.etablissements(id) ON DELETE CASCADE;


--
-- Name: family_fees family_fees_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.family_fees
    ADD CONSTRAINT family_fees_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.parents(id) ON DELETE CASCADE;


--
-- Name: family_fees family_fees_school_year_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.family_fees
    ADD CONSTRAINT family_fees_school_year_id_fkey FOREIGN KEY (school_year_id) REFERENCES public.school_years(id) ON DELETE CASCADE;


--
-- Name: family_year_finance family_year_finance_etablissement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.family_year_finance
    ADD CONSTRAINT family_year_finance_etablissement_id_fkey FOREIGN KEY (etablissement_id) REFERENCES public.etablissements(id) ON DELETE CASCADE;


--
-- Name: family_year_finance family_year_finance_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.family_year_finance
    ADD CONSTRAINT family_year_finance_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.parents(id) ON DELETE SET NULL;


--
-- Name: family_year_finance family_year_finance_school_year_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.family_year_finance
    ADD CONSTRAINT family_year_finance_school_year_id_fkey FOREIGN KEY (school_year_id) REFERENCES public.school_years(id) ON DELETE SET NULL;


--
-- Name: fee_adjustments fee_adjustments_etablissement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fee_adjustments
    ADD CONSTRAINT fee_adjustments_etablissement_id_fkey FOREIGN KEY (etablissement_id) REFERENCES public.etablissements(id) ON DELETE CASCADE;


--
-- Name: fee_adjustments fee_adjustments_family_fee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fee_adjustments
    ADD CONSTRAINT fee_adjustments_family_fee_id_fkey FOREIGN KEY (family_fee_id) REFERENCES public.family_fees(id) ON DELETE CASCADE;


--
-- Name: fee_adjustments fee_adjustments_recorded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fee_adjustments
    ADD CONSTRAINT fee_adjustments_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: fee_installments fee_installments_etablissement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fee_installments
    ADD CONSTRAINT fee_installments_etablissement_id_fkey FOREIGN KEY (etablissement_id) REFERENCES public.etablissements(id) ON DELETE CASCADE;


--
-- Name: fee_installments fee_installments_family_fee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fee_installments
    ADD CONSTRAINT fee_installments_family_fee_id_fkey FOREIGN KEY (family_fee_id) REFERENCES public.family_fees(id) ON DELETE CASCADE;


--
-- Name: fee_installments fee_installments_recorded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fee_installments
    ADD CONSTRAINT fee_installments_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: financement_communications financement_communications_etablissement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financement_communications
    ADD CONSTRAINT financement_communications_etablissement_id_fkey FOREIGN KEY (etablissement_id) REFERENCES public.etablissements(id) ON DELETE CASCADE;


--
-- Name: financement_communications financement_communications_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financement_communications
    ADD CONSTRAINT financement_communications_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.parents(id) ON DELETE CASCADE;


--
-- Name: financement_communications financement_communications_school_year_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financement_communications
    ADD CONSTRAINT financement_communications_school_year_id_fkey FOREIGN KEY (school_year_id) REFERENCES public.school_years(id) ON DELETE SET NULL;


--
-- Name: financement_communications financement_communications_sent_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financement_communications
    ADD CONSTRAINT financement_communications_sent_by_fkey FOREIGN KEY (sent_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: grades grades_evaluation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grades
    ADD CONSTRAINT grades_evaluation_id_fkey FOREIGN KEY (evaluation_id) REFERENCES public.evaluations(id) ON DELETE CASCADE;


--
-- Name: grades grades_graded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grades
    ADD CONSTRAINT grades_graded_by_fkey FOREIGN KEY (graded_by) REFERENCES public.teachers(id) ON DELETE SET NULL;


--
-- Name: grades grades_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grades
    ADD CONSTRAINT grades_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;


--
-- Name: homework homework_class_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.homework
    ADD CONSTRAINT homework_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE CASCADE;


--
-- Name: homework homework_etablissement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.homework
    ADD CONSTRAINT homework_etablissement_id_fkey FOREIGN KEY (etablissement_id) REFERENCES public.etablissements(id) ON DELETE CASCADE;


--
-- Name: homework homework_journal_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.homework
    ADD CONSTRAINT homework_journal_entry_id_fkey FOREIGN KEY (journal_entry_id) REFERENCES public.class_journal(id) ON DELETE SET NULL;


--
-- Name: homework_status homework_status_homework_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.homework_status
    ADD CONSTRAINT homework_status_homework_id_fkey FOREIGN KEY (homework_id) REFERENCES public.homework(id) ON DELETE CASCADE;


--
-- Name: homework_status homework_status_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.homework_status
    ADD CONSTRAINT homework_status_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.parents(id) ON DELETE CASCADE;


--
-- Name: homework_status homework_status_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.homework_status
    ADD CONSTRAINT homework_status_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;


--
-- Name: homework homework_teacher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.homework
    ADD CONSTRAINT homework_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.teachers(id) ON DELETE CASCADE;


--
-- Name: materials materials_etablissement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.materials
    ADD CONSTRAINT materials_etablissement_id_fkey FOREIGN KEY (etablissement_id) REFERENCES public.etablissements(id) ON DELETE CASCADE;


--
-- Name: materials materials_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.materials
    ADD CONSTRAINT materials_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.rooms(id) ON DELETE SET NULL;


--
-- Name: modules modules_etablissement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.modules
    ADD CONSTRAINT modules_etablissement_id_fkey FOREIGN KEY (etablissement_id) REFERENCES public.etablissements(id) ON DELETE CASCADE;


--
-- Name: modules modules_teaching_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.modules
    ADD CONSTRAINT modules_teaching_unit_id_fkey FOREIGN KEY (teaching_unit_id) REFERENCES public.teaching_units(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_etablissement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_etablissement_id_fkey FOREIGN KEY (etablissement_id) REFERENCES public.etablissements(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.parents(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE SET NULL;


--
-- Name: other_revenues other_revenues_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.other_revenues
    ADD CONSTRAINT other_revenues_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id);


--
-- Name: other_revenues other_revenues_etablissement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.other_revenues
    ADD CONSTRAINT other_revenues_etablissement_id_fkey FOREIGN KEY (etablissement_id) REFERENCES public.etablissements(id);


--
-- Name: other_revenues other_revenues_school_year_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.other_revenues
    ADD CONSTRAINT other_revenues_school_year_id_fkey FOREIGN KEY (school_year_id) REFERENCES public.school_years(id);


--
-- Name: parent_class_enrollments parent_class_enrollments_class_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parent_class_enrollments
    ADD CONSTRAINT parent_class_enrollments_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE CASCADE;


--
-- Name: parent_class_enrollments parent_class_enrollments_etablissement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parent_class_enrollments
    ADD CONSTRAINT parent_class_enrollments_etablissement_id_fkey FOREIGN KEY (etablissement_id) REFERENCES public.etablissements(id) ON DELETE CASCADE;


--
-- Name: parent_class_enrollments parent_class_enrollments_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parent_class_enrollments
    ADD CONSTRAINT parent_class_enrollments_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.parents(id) ON DELETE CASCADE;


--
-- Name: parents parents_etablissement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parents
    ADD CONSTRAINT parents_etablissement_id_fkey FOREIGN KEY (etablissement_id) REFERENCES public.etablissements(id) ON DELETE CASCADE;


--
-- Name: parents parents_tutor1_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parents
    ADD CONSTRAINT parents_tutor1_user_id_fkey FOREIGN KEY (tutor1_user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: parents parents_tutor2_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parents
    ADD CONSTRAINT parents_tutor2_user_id_fkey FOREIGN KEY (tutor2_user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: parents parents_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parents
    ADD CONSTRAINT parents_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: periods periods_school_year_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.periods
    ADD CONSTRAINT periods_school_year_id_fkey FOREIGN KEY (school_year_id) REFERENCES public.school_years(id) ON DELETE CASCADE;


--
-- Name: presence_type_rates presence_type_rates_etablissement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.presence_type_rates
    ADD CONSTRAINT presence_type_rates_etablissement_id_fkey FOREIGN KEY (etablissement_id) REFERENCES public.etablissements(id) ON DELETE CASCADE;


--
-- Name: presence_type_rates presence_type_rates_presence_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.presence_type_rates
    ADD CONSTRAINT presence_type_rates_presence_type_id_fkey FOREIGN KEY (presence_type_id) REFERENCES public.presence_types(id) ON DELETE CASCADE;


--
-- Name: presence_type_rates presence_type_rates_school_year_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.presence_type_rates
    ADD CONSTRAINT presence_type_rates_school_year_id_fkey FOREIGN KEY (school_year_id) REFERENCES public.school_years(id) ON DELETE CASCADE;


--
-- Name: presence_types presence_types_etablissement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.presence_types
    ADD CONSTRAINT presence_types_etablissement_id_fkey FOREIGN KEY (etablissement_id) REFERENCES public.etablissements(id) ON DELETE CASCADE;


--
-- Name: presence_types presence_types_school_year_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.presence_types
    ADD CONSTRAINT presence_types_school_year_id_fkey FOREIGN KEY (school_year_id) REFERENCES public.school_years(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_etablissement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_etablissement_id_fkey FOREIGN KEY (etablissement_id) REFERENCES public.etablissements(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: push_subscriptions push_subscriptions_etablissement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_etablissement_id_fkey FOREIGN KEY (etablissement_id) REFERENCES public.etablissements(id) ON DELETE CASCADE;


--
-- Name: rooms rooms_etablissement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rooms
    ADD CONSTRAINT rooms_etablissement_id_fkey FOREIGN KEY (etablissement_id) REFERENCES public.etablissements(id) ON DELETE CASCADE;


--
-- Name: schedule_exceptions schedule_exceptions_etablissement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_exceptions
    ADD CONSTRAINT schedule_exceptions_etablissement_id_fkey FOREIGN KEY (etablissement_id) REFERENCES public.etablissements(id) ON DELETE CASCADE;


--
-- Name: schedule_exceptions schedule_exceptions_override_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_exceptions
    ADD CONSTRAINT schedule_exceptions_override_room_id_fkey FOREIGN KEY (override_room_id) REFERENCES public.rooms(id) ON DELETE SET NULL;


--
-- Name: schedule_exceptions schedule_exceptions_override_teacher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_exceptions
    ADD CONSTRAINT schedule_exceptions_override_teacher_id_fkey FOREIGN KEY (override_teacher_id) REFERENCES public.teachers(id) ON DELETE SET NULL;


--
-- Name: schedule_exceptions schedule_exceptions_schedule_slot_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_exceptions
    ADD CONSTRAINT schedule_exceptions_schedule_slot_id_fkey FOREIGN KEY (schedule_slot_id) REFERENCES public.schedule_slots(id) ON DELETE CASCADE;


--
-- Name: schedule_slots schedule_slots_class_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_slots
    ADD CONSTRAINT schedule_slots_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE CASCADE;


--
-- Name: schedule_slots schedule_slots_cours_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_slots
    ADD CONSTRAINT schedule_slots_cours_id_fkey FOREIGN KEY (cours_id) REFERENCES public.cours(id) ON DELETE SET NULL;


--
-- Name: schedule_slots schedule_slots_etablissement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_slots
    ADD CONSTRAINT schedule_slots_etablissement_id_fkey FOREIGN KEY (etablissement_id) REFERENCES public.etablissements(id) ON DELETE CASCADE;


--
-- Name: schedule_slots schedule_slots_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_slots
    ADD CONSTRAINT schedule_slots_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.rooms(id) ON DELETE SET NULL;


--
-- Name: schedule_slots schedule_slots_school_year_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_slots
    ADD CONSTRAINT schedule_slots_school_year_id_fkey FOREIGN KEY (school_year_id) REFERENCES public.school_years(id) ON DELETE CASCADE;


--
-- Name: schedule_slots schedule_slots_teacher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_slots
    ADD CONSTRAINT schedule_slots_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.teachers(id) ON DELETE CASCADE;


--
-- Name: schedule_validations schedule_validations_etablissement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_validations
    ADD CONSTRAINT schedule_validations_etablissement_id_fkey FOREIGN KEY (etablissement_id) REFERENCES public.etablissements(id) ON DELETE CASCADE;


--
-- Name: schedule_validations schedule_validations_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_validations
    ADD CONSTRAINT schedule_validations_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: schedule_validations schedule_validations_schedule_slot_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_validations
    ADD CONSTRAINT schedule_validations_schedule_slot_id_fkey FOREIGN KEY (schedule_slot_id) REFERENCES public.schedule_slots(id) ON DELETE CASCADE;


--
-- Name: schedule_validations schedule_validations_time_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_validations
    ADD CONSTRAINT schedule_validations_time_entry_id_fkey FOREIGN KEY (time_entry_id) REFERENCES public.staff_time_entries(id) ON DELETE SET NULL;


--
-- Name: school_years school_years_etablissement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.school_years
    ADD CONSTRAINT school_years_etablissement_id_fkey FOREIGN KEY (etablissement_id) REFERENCES public.etablissements(id) ON DELETE CASCADE;


--
-- Name: staff_hourly_rates staff_hourly_rates_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_hourly_rates
    ADD CONSTRAINT staff_hourly_rates_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: staff_hourly_rates staff_hourly_rates_etablissement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_hourly_rates
    ADD CONSTRAINT staff_hourly_rates_etablissement_id_fkey FOREIGN KEY (etablissement_id) REFERENCES public.etablissements(id) ON DELETE CASCADE;


--
-- Name: staff_hourly_rates staff_hourly_rates_school_year_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_hourly_rates
    ADD CONSTRAINT staff_hourly_rates_school_year_id_fkey FOREIGN KEY (school_year_id) REFERENCES public.school_years(id) ON DELETE CASCADE;


--
-- Name: staff_time_entries staff_time_entries_etablissement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_time_entries
    ADD CONSTRAINT staff_time_entries_etablissement_id_fkey FOREIGN KEY (etablissement_id) REFERENCES public.etablissements(id) ON DELETE CASCADE;


--
-- Name: staff_time_entries staff_time_entries_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_time_entries
    ADD CONSTRAINT staff_time_entries_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: staff_time_entries staff_time_entries_recorded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_time_entries
    ADD CONSTRAINT staff_time_entries_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: staff_time_entries staff_time_entries_replaced_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_time_entries
    ADD CONSTRAINT staff_time_entries_replaced_profile_id_fkey FOREIGN KEY (replaced_profile_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: student_documents student_documents_etablissement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_documents
    ADD CONSTRAINT student_documents_etablissement_id_fkey FOREIGN KEY (etablissement_id) REFERENCES public.etablissements(id) ON DELETE CASCADE;


--
-- Name: student_documents student_documents_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_documents
    ADD CONSTRAINT student_documents_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;


--
-- Name: student_documents student_documents_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_documents
    ADD CONSTRAINT student_documents_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.profiles(id);


--
-- Name: student_warning_attachments student_warning_attachments_warning_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_warning_attachments
    ADD CONSTRAINT student_warning_attachments_warning_id_fkey FOREIGN KEY (warning_id) REFERENCES public.student_warnings(id) ON DELETE CASCADE;


--
-- Name: student_warnings student_warnings_class_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_warnings
    ADD CONSTRAINT student_warnings_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE CASCADE;


--
-- Name: student_warnings student_warnings_etablissement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_warnings
    ADD CONSTRAINT student_warnings_etablissement_id_fkey FOREIGN KEY (etablissement_id) REFERENCES public.etablissements(id) ON DELETE CASCADE;


--
-- Name: student_warnings student_warnings_issued_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_warnings
    ADD CONSTRAINT student_warnings_issued_by_fkey FOREIGN KEY (issued_by) REFERENCES public.profiles(id);


--
-- Name: student_warnings student_warnings_period_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_warnings
    ADD CONSTRAINT student_warnings_period_id_fkey FOREIGN KEY (period_id) REFERENCES public.periods(id) ON DELETE CASCADE;


--
-- Name: student_warnings student_warnings_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_warnings
    ADD CONSTRAINT student_warnings_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;


--
-- Name: student_year_history student_year_history_etablissement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_year_history
    ADD CONSTRAINT student_year_history_etablissement_id_fkey FOREIGN KEY (etablissement_id) REFERENCES public.etablissements(id) ON DELETE CASCADE;


--
-- Name: student_year_history student_year_history_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_year_history
    ADD CONSTRAINT student_year_history_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.parents(id) ON DELETE SET NULL;


--
-- Name: student_year_history student_year_history_school_year_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_year_history
    ADD CONSTRAINT student_year_history_school_year_id_fkey FOREIGN KEY (school_year_id) REFERENCES public.school_years(id) ON DELETE SET NULL;


--
-- Name: student_year_history student_year_history_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_year_history
    ADD CONSTRAINT student_year_history_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE SET NULL;


--
-- Name: students students_etablissement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_etablissement_id_fkey FOREIGN KEY (etablissement_id) REFERENCES public.etablissements(id) ON DELETE CASCADE;


--
-- Name: students students_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.parents(id) ON DELETE RESTRICT;


--
-- Name: students students_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: subjects subjects_etablissement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subjects
    ADD CONSTRAINT subjects_etablissement_id_fkey FOREIGN KEY (etablissement_id) REFERENCES public.etablissements(id) ON DELETE CASCADE;


--
-- Name: teacher_documents teacher_documents_etablissement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teacher_documents
    ADD CONSTRAINT teacher_documents_etablissement_id_fkey FOREIGN KEY (etablissement_id) REFERENCES public.etablissements(id) ON DELETE CASCADE;


--
-- Name: teacher_documents teacher_documents_teacher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teacher_documents
    ADD CONSTRAINT teacher_documents_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.teachers(id) ON DELETE CASCADE;


--
-- Name: teacher_documents teacher_documents_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teacher_documents
    ADD CONSTRAINT teacher_documents_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.profiles(id);


--
-- Name: teachers teachers_etablissement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teachers
    ADD CONSTRAINT teachers_etablissement_id_fkey FOREIGN KEY (etablissement_id) REFERENCES public.etablissements(id) ON DELETE CASCADE;


--
-- Name: teachers teachers_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teachers
    ADD CONSTRAINT teachers_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: teaching_units teaching_units_etablissement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teaching_units
    ADD CONSTRAINT teaching_units_etablissement_id_fkey FOREIGN KEY (etablissement_id) REFERENCES public.etablissements(id) ON DELETE CASCADE;


--
-- Name: teaching_units teaching_units_subject_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teaching_units
    ADD CONSTRAINT teaching_units_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON DELETE CASCADE;


--
-- Name: unites_enseignement unites_enseignement_etablissement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.unites_enseignement
    ADD CONSTRAINT unites_enseignement_etablissement_id_fkey FOREIGN KEY (etablissement_id) REFERENCES public.etablissements(id) ON DELETE CASCADE;


--
-- Name: year_closure year_closure_closed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.year_closure
    ADD CONSTRAINT year_closure_closed_by_fkey FOREIGN KEY (closed_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: year_closure year_closure_etablissement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.year_closure
    ADD CONSTRAINT year_closure_etablissement_id_fkey FOREIGN KEY (etablissement_id) REFERENCES public.etablissements(id) ON DELETE CASCADE;


--
-- Name: year_closure year_closure_school_year_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.year_closure
    ADD CONSTRAINT year_closure_school_year_id_fkey FOREIGN KEY (school_year_id) REFERENCES public.school_years(id) ON DELETE CASCADE;


--
-- Name: year_closure year_closure_started_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.year_closure
    ADD CONSTRAINT year_closure_started_by_fkey FOREIGN KEY (started_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: year_closure_steps year_closure_steps_closed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.year_closure_steps
    ADD CONSTRAINT year_closure_steps_closed_by_fkey FOREIGN KEY (closed_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: year_closure_steps year_closure_steps_closure_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.year_closure_steps
    ADD CONSTRAINT year_closure_steps_closure_id_fkey FOREIGN KEY (closure_id) REFERENCES public.year_closure(id) ON DELETE CASCADE;


--
-- Name: year_closure_steps year_closure_steps_etablissement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.year_closure_steps
    ADD CONSTRAINT year_closure_steps_etablissement_id_fkey FOREIGN KEY (etablissement_id) REFERENCES public.etablissements(id) ON DELETE CASCADE;


--
-- Name: eval_type_configs Admin and direction can manage eval type configs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin and direction can manage eval type configs" ON public.eval_type_configs USING ((public.get_user_role() = ANY (ARRAY['admin'::text, 'direction'::text])));


--
-- Name: periods Admin and direction can manage periods; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin and direction can manage periods" ON public.periods USING ((public.get_user_role() = ANY (ARRAY['admin'::text, 'direction'::text])));


--
-- Name: school_years Admin and direction can manage school years; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin and direction can manage school years" ON public.school_years USING ((public.get_user_role() = ANY (ARRAY['admin'::text, 'direction'::text])));


--
-- Name: profiles Admin and direction can update profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin and direction can update profiles" ON public.profiles FOR UPDATE USING (((COALESCE(public.get_user_role(), ''::text) = ANY (ARRAY['admin'::text, 'direction'::text])) AND (etablissement_id = public.current_etablissement_id()))) WITH CHECK (((COALESCE(public.get_user_role(), ''::text) = ANY (ARRAY['admin'::text, 'direction'::text])) AND (etablissement_id = public.current_etablissement_id())));


--
-- Name: evaluation_order_config Gestion evaluation_order_config; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Gestion evaluation_order_config" ON public.evaluation_order_config USING ((public.get_user_role() = ANY (ARRAY['admin'::text, 'direction'::text, 'responsable_pedagogique'::text, 'enseignant'::text])));


--
-- Name: absences; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.absences ENABLE ROW LEVEL SECURITY;

--
-- Name: absences absences_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY absences_select ON public.absences FOR SELECT USING (((etablissement_id = public.current_etablissement_id()) AND ((COALESCE(public.get_user_role(), ''::text) = ANY (ARRAY['admin'::text, 'direction'::text, 'responsable_pedagogique'::text, 'secretaire'::text])) OR ((public.get_user_role() = 'enseignant'::text) AND public.teaches_class(class_id)))));


--
-- Name: absences absences_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY absences_write ON public.absences USING (((etablissement_id = public.current_etablissement_id()) AND ((COALESCE(public.get_user_role(), ''::text) = ANY (ARRAY['admin'::text, 'direction'::text, 'responsable_pedagogique'::text, 'secretaire'::text])) OR ((public.get_user_role() = 'enseignant'::text) AND public.teaches_class(class_id))))) WITH CHECK (((etablissement_id = public.current_etablissement_id()) AND ((COALESCE(public.get_user_role(), ''::text) = ANY (ARRAY['admin'::text, 'direction'::text, 'responsable_pedagogique'::text, 'secretaire'::text])) OR ((public.get_user_role() = 'enseignant'::text) AND public.teaches_class(class_id)))));


--
-- Name: adult_bulletin_appreciations adult_bull_appr_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY adult_bull_appr_delete ON public.adult_bulletin_appreciations FOR DELETE USING ((etablissement_id = ( SELECT profiles.etablissement_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: adult_bulletin_appreciations adult_bull_appr_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY adult_bull_appr_insert ON public.adult_bulletin_appreciations FOR INSERT WITH CHECK ((etablissement_id = ( SELECT profiles.etablissement_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: adult_bulletin_appreciations adult_bull_appr_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY adult_bull_appr_select ON public.adult_bulletin_appreciations FOR SELECT USING ((etablissement_id = ( SELECT profiles.etablissement_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: adult_bulletin_appreciations adult_bull_appr_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY adult_bull_appr_update ON public.adult_bulletin_appreciations FOR UPDATE USING ((etablissement_id = ( SELECT profiles.etablissement_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: adult_bulletin_archives adult_bull_arch_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY adult_bull_arch_delete ON public.adult_bulletin_archives FOR DELETE USING ((etablissement_id = ( SELECT profiles.etablissement_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: adult_bulletin_archives adult_bull_arch_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY adult_bull_arch_insert ON public.adult_bulletin_archives FOR INSERT WITH CHECK ((etablissement_id = ( SELECT profiles.etablissement_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: adult_bulletin_archives adult_bull_arch_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY adult_bull_arch_select ON public.adult_bulletin_archives FOR SELECT USING ((etablissement_id = ( SELECT profiles.etablissement_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: adult_bulletin_appreciations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.adult_bulletin_appreciations ENABLE ROW LEVEL SECURITY;

--
-- Name: adult_bulletin_archives; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.adult_bulletin_archives ENABLE ROW LEVEL SECURITY;

--
-- Name: adult_grades; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.adult_grades ENABLE ROW LEVEL SECURITY;

--
-- Name: adult_grades adult_grades_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY adult_grades_admin_all ON public.adult_grades USING ((public.get_user_role() = ANY (ARRAY['admin'::text, 'direction'::text, 'responsable_pedagogique'::text])));


--
-- Name: adult_grades adult_grades_teacher_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY adult_grades_teacher_delete ON public.adult_grades FOR DELETE USING (((public.get_user_role() = 'enseignant'::text) AND (evaluation_id IN ( SELECT e.id
   FROM ((public.evaluations e
     JOIN public.class_teachers ct ON ((e.class_id = ct.class_id)))
     JOIN public.teachers t ON ((ct.teacher_id = t.id)))
  WHERE (t.user_id = auth.uid())))));


--
-- Name: adult_grades adult_grades_teacher_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY adult_grades_teacher_insert ON public.adult_grades FOR INSERT WITH CHECK (((public.get_user_role() = 'enseignant'::text) AND (evaluation_id IN ( SELECT e.id
   FROM ((public.evaluations e
     JOIN public.class_teachers ct ON ((e.class_id = ct.class_id)))
     JOIN public.teachers t ON ((ct.teacher_id = t.id)))
  WHERE (t.user_id = auth.uid())))));


--
-- Name: adult_grades adult_grades_teacher_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY adult_grades_teacher_select ON public.adult_grades FOR SELECT USING ((public.get_user_role() = 'enseignant'::text));


--
-- Name: adult_grades adult_grades_teacher_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY adult_grades_teacher_update ON public.adult_grades FOR UPDATE USING (((public.get_user_role() = 'enseignant'::text) AND (evaluation_id IN ( SELECT e.id
   FROM ((public.evaluations e
     JOIN public.class_teachers ct ON ((e.class_id = ct.class_id)))
     JOIN public.teachers t ON ((ct.teacher_id = t.id)))
  WHERE (t.user_id = auth.uid())))));


--
-- Name: adult_homework_status; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.adult_homework_status ENABLE ROW LEVEL SECURITY;

--
-- Name: adult_homework_status adult_hwstatus_participant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY adult_hwstatus_participant ON public.adult_homework_status USING ((EXISTS ( SELECT 1
   FROM public.parents p
  WHERE ((p.id = adult_homework_status.parent_id) AND (((adult_homework_status.tutor_number = 1) AND (p.tutor1_user_id = auth.uid())) OR ((adult_homework_status.tutor_number = 2) AND (p.tutor2_user_id = auth.uid()))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.parents p
  WHERE ((p.id = adult_homework_status.parent_id) AND (((adult_homework_status.tutor_number = 1) AND (p.tutor1_user_id = auth.uid())) OR ((adult_homework_status.tutor_number = 2) AND (p.tutor2_user_id = auth.uid())))))));


--
-- Name: adult_homework_status adult_hwstatus_staff_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY adult_hwstatus_staff_select ON public.adult_homework_status FOR SELECT USING ((homework_id IN ( SELECT h.id
   FROM public.homework h
  WHERE (h.etablissement_id IN ( SELECT profiles.etablissement_id
           FROM public.profiles
          WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'direction'::text, 'responsable_pedagogique'::text]))))))));


--
-- Name: adult_homework_status adult_hwstatus_teacher_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY adult_hwstatus_teacher_select ON public.adult_homework_status FOR SELECT USING ((homework_id IN ( SELECT h.id
   FROM public.homework h
  WHERE (h.class_id IN ( SELECT ct.class_id
           FROM (public.class_teachers ct
             JOIN public.teachers t ON ((t.id = ct.teacher_id)))
          WHERE ((t.user_id = auth.uid()) AND ((ct.effective_from IS NULL) OR ((ct.effective_from - '7 days'::interval) <= CURRENT_DATE)) AND ((ct.effective_until IS NULL) OR (ct.effective_until >= CURRENT_DATE))))))));


--
-- Name: announcement_attachments ann_attachments_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ann_attachments_tenant ON public.announcement_attachments USING ((announcement_id IN ( SELECT announcements.id
   FROM public.announcements
  WHERE (announcements.etablissement_id = public.current_etablissement_id()))));


--
-- Name: announcement_recipients ann_recipients_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ann_recipients_tenant ON public.announcement_recipients USING ((announcement_id IN ( SELECT announcements.id
   FROM public.announcements
  WHERE (announcements.etablissement_id = public.current_etablissement_id()))));


--
-- Name: announcement_staff_recipients ann_staff_recipients_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ann_staff_recipients_tenant ON public.announcement_staff_recipients USING ((announcement_id IN ( SELECT announcements.id
   FROM public.announcements
  WHERE (announcements.etablissement_id = public.current_etablissement_id()))));


--
-- Name: announcement_attachments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.announcement_attachments ENABLE ROW LEVEL SECURITY;

--
-- Name: announcement_recipients; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.announcement_recipients ENABLE ROW LEVEL SECURITY;

--
-- Name: announcement_staff_recipients; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.announcement_staff_recipients ENABLE ROW LEVEL SECURITY;

--
-- Name: announcements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

--
-- Name: announcements announcements_insert_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY announcements_insert_scoped ON public.announcements FOR INSERT WITH CHECK (((etablissement_id = public.current_etablissement_id()) AND (((announcement_type = ANY (ARRAY['all_active'::text, 'class'::text, 'selected'::text])) AND (COALESCE(public.get_user_role(), ''::text) = ANY (ARRAY['admin'::text, 'direction'::text, 'secretaire'::text, 'responsable_pedagogique'::text]))) OR ((announcement_type = 'all_registered'::text) AND (COALESCE(public.get_user_role(), ''::text) = ANY (ARRAY['admin'::text, 'direction'::text, 'secretaire'::text]))) OR ((announcement_type = 'staff'::text) AND (COALESCE(public.get_user_role(), ''::text) = ANY (ARRAY['admin'::text, 'direction'::text, 'secretaire'::text, 'responsable_pedagogique'::text, 'comptable'::text]))))));


--
-- Name: announcements announcements_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY announcements_tenant ON public.announcements USING ((etablissement_id = public.current_etablissement_id()));


--
-- Name: audit_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_logs audit_logs_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY audit_logs_insert ON public.audit_logs FOR INSERT WITH CHECK (true);


--
-- Name: audit_logs audit_logs_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY audit_logs_select ON public.audit_logs FOR SELECT USING (((etablissement_id = public.current_etablissement_id()) AND (public.get_user_role() = ANY (ARRAY['admin'::text, 'direction'::text]))));


--
-- Name: bulletin_appreciations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bulletin_appreciations ENABLE ROW LEVEL SECURITY;

--
-- Name: bulletin_appreciations bulletin_appreciations_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY bulletin_appreciations_delete ON public.bulletin_appreciations FOR DELETE USING ((etablissement_id = ( SELECT profiles.etablissement_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: bulletin_appreciations bulletin_appreciations_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY bulletin_appreciations_insert ON public.bulletin_appreciations FOR INSERT WITH CHECK ((etablissement_id = ( SELECT profiles.etablissement_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: bulletin_appreciations bulletin_appreciations_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY bulletin_appreciations_select ON public.bulletin_appreciations FOR SELECT USING ((etablissement_id = ( SELECT profiles.etablissement_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: bulletin_appreciations bulletin_appreciations_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY bulletin_appreciations_update ON public.bulletin_appreciations FOR UPDATE USING ((etablissement_id = ( SELECT profiles.etablissement_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: bulletin_archives; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bulletin_archives ENABLE ROW LEVEL SECURITY;

--
-- Name: bulletin_archives bulletin_archives_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY bulletin_archives_delete ON public.bulletin_archives FOR DELETE USING ((etablissement_id = ( SELECT profiles.etablissement_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: bulletin_archives bulletin_archives_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY bulletin_archives_insert ON public.bulletin_archives FOR INSERT WITH CHECK ((etablissement_id = ( SELECT profiles.etablissement_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: bulletin_archives bulletin_archives_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY bulletin_archives_select ON public.bulletin_archives FOR SELECT USING ((etablissement_id = ( SELECT profiles.etablissement_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: class_journal; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.class_journal ENABLE ROW LEVEL SECURITY;

--
-- Name: class_teachers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.class_teachers ENABLE ROW LEVEL SECURITY;

--
-- Name: class_teachers class_teachers_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY class_teachers_tenant ON public.class_teachers USING ((class_id IN ( SELECT classes.id
   FROM public.classes
  WHERE (classes.etablissement_id = public.current_etablissement_id()))));


--
-- Name: classes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;

--
-- Name: classes classes_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY classes_select ON public.classes FOR SELECT USING (((etablissement_id = public.current_etablissement_id()) AND (COALESCE(public.get_user_role(), ''::text) = ANY (ARRAY['admin'::text, 'direction'::text, 'comptable'::text, 'responsable_pedagogique'::text, 'enseignant'::text, 'secretaire'::text]))));


--
-- Name: classes classes_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY classes_write ON public.classes USING (((etablissement_id = public.current_etablissement_id()) AND (COALESCE(public.get_user_role(), ''::text) = ANY (ARRAY['admin'::text, 'direction'::text, 'responsable_pedagogique'::text, 'secretaire'::text])))) WITH CHECK (((etablissement_id = public.current_etablissement_id()) AND (COALESCE(public.get_user_role(), ''::text) = ANY (ARRAY['admin'::text, 'direction'::text, 'responsable_pedagogique'::text, 'secretaire'::text]))));


--
-- Name: cotisation_types; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cotisation_types ENABLE ROW LEVEL SECURITY;

--
-- Name: cotisation_types cotisation_types_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cotisation_types_tenant ON public.cotisation_types USING ((etablissement_id = public.current_etablissement_id()));


--
-- Name: cours; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cours ENABLE ROW LEVEL SECURITY;

--
-- Name: cours_modules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cours_modules ENABLE ROW LEVEL SECURITY;

--
-- Name: cours_modules cours_modules_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cours_modules_select ON public.cours_modules FOR SELECT USING (((unite_enseignement_id IN ( SELECT unites_enseignement.id
   FROM public.unites_enseignement
  WHERE (unites_enseignement.etablissement_id = public.current_etablissement_id()))) AND (COALESCE(public.get_user_role(), ''::text) = ANY (ARRAY['admin'::text, 'direction'::text, 'comptable'::text, 'responsable_pedagogique'::text, 'enseignant'::text, 'secretaire'::text]))));


--
-- Name: cours_modules cours_modules_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cours_modules_write ON public.cours_modules USING (((unite_enseignement_id IN ( SELECT unites_enseignement.id
   FROM public.unites_enseignement
  WHERE (unites_enseignement.etablissement_id = public.current_etablissement_id()))) AND (COALESCE(public.get_user_role(), ''::text) = ANY (ARRAY['admin'::text, 'direction'::text, 'responsable_pedagogique'::text])))) WITH CHECK (((unite_enseignement_id IN ( SELECT unites_enseignement.id
   FROM public.unites_enseignement
  WHERE (unites_enseignement.etablissement_id = public.current_etablissement_id()))) AND (COALESCE(public.get_user_role(), ''::text) = ANY (ARRAY['admin'::text, 'direction'::text, 'responsable_pedagogique'::text]))));


--
-- Name: cours cours_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cours_select ON public.cours FOR SELECT USING (((unite_enseignement_id IN ( SELECT unites_enseignement.id
   FROM public.unites_enseignement
  WHERE (unites_enseignement.etablissement_id = public.current_etablissement_id()))) AND (COALESCE(public.get_user_role(), ''::text) = ANY (ARRAY['admin'::text, 'direction'::text, 'comptable'::text, 'responsable_pedagogique'::text, 'enseignant'::text, 'secretaire'::text]))));


--
-- Name: cours cours_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cours_write ON public.cours USING (((unite_enseignement_id IN ( SELECT unites_enseignement.id
   FROM public.unites_enseignement
  WHERE (unites_enseignement.etablissement_id = public.current_etablissement_id()))) AND (COALESCE(public.get_user_role(), ''::text) = ANY (ARRAY['admin'::text, 'direction'::text, 'responsable_pedagogique'::text])))) WITH CHECK (((unite_enseignement_id IN ( SELECT unites_enseignement.id
   FROM public.unites_enseignement
  WHERE (unites_enseignement.etablissement_id = public.current_etablissement_id()))) AND (COALESCE(public.get_user_role(), ''::text) = ANY (ARRAY['admin'::text, 'direction'::text, 'responsable_pedagogique'::text]))));


--
-- Name: document_type_configs doc_type_configs_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY doc_type_configs_delete ON public.document_type_configs FOR DELETE USING ((etablissement_id = ( SELECT profiles.etablissement_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: document_type_configs doc_type_configs_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY doc_type_configs_insert ON public.document_type_configs FOR INSERT WITH CHECK ((etablissement_id = ( SELECT profiles.etablissement_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: document_type_configs doc_type_configs_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY doc_type_configs_select ON public.document_type_configs FOR SELECT USING ((etablissement_id = ( SELECT profiles.etablissement_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: document_type_configs doc_type_configs_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY doc_type_configs_update ON public.document_type_configs FOR UPDATE USING ((etablissement_id = ( SELECT profiles.etablissement_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: document_type_configs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.document_type_configs ENABLE ROW LEVEL SECURITY;

--
-- Name: enrollments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;

--
-- Name: enrollments enrollments_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY enrollments_select ON public.enrollments FOR SELECT USING (((student_id IN ( SELECT students.id
   FROM public.students
  WHERE (students.etablissement_id = public.current_etablissement_id()))) AND ((COALESCE(public.get_user_role(), ''::text) = ANY (ARRAY['admin'::text, 'direction'::text, 'comptable'::text, 'responsable_pedagogique'::text, 'secretaire'::text])) OR ((public.get_user_role() = 'enseignant'::text) AND public.teaches_class(class_id)))));


--
-- Name: enrollments enrollments_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY enrollments_write ON public.enrollments USING (((student_id IN ( SELECT students.id
   FROM public.students
  WHERE (students.etablissement_id = public.current_etablissement_id()))) AND (COALESCE(public.get_user_role(), ''::text) = ANY (ARRAY['admin'::text, 'direction'::text, 'responsable_pedagogique'::text, 'secretaire'::text])))) WITH CHECK (((student_id IN ( SELECT students.id
   FROM public.students
  WHERE (students.etablissement_id = public.current_etablissement_id()))) AND (COALESCE(public.get_user_role(), ''::text) = ANY (ARRAY['admin'::text, 'direction'::text, 'responsable_pedagogique'::text, 'secretaire'::text]))));


--
-- Name: etablissement_smtp; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.etablissement_smtp ENABLE ROW LEVEL SECURITY;

--
-- Name: etablissements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.etablissements ENABLE ROW LEVEL SECURITY;

--
-- Name: etablissements etablissements_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY etablissements_select ON public.etablissements FOR SELECT USING ((id = public.current_etablissement_id()));


--
-- Name: etablissements etablissements_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY etablissements_update ON public.etablissements FOR UPDATE USING (((id = public.current_etablissement_id()) AND (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'direction'::text])))))));


--
-- Name: eval_type_configs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.eval_type_configs ENABLE ROW LEVEL SECURITY;

--
-- Name: evaluation_order_config; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.evaluation_order_config ENABLE ROW LEVEL SECURITY;

--
-- Name: evaluations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.evaluations ENABLE ROW LEVEL SECURITY;

--
-- Name: evaluations evaluations_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY evaluations_select ON public.evaluations FOR SELECT USING (((etablissement_id = public.current_etablissement_id()) AND ((COALESCE(public.get_user_role(), ''::text) = ANY (ARRAY['admin'::text, 'direction'::text, 'responsable_pedagogique'::text, 'secretaire'::text])) OR ((public.get_user_role() = 'enseignant'::text) AND public.teaches_class(class_id)))));


--
-- Name: evaluations evaluations_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY evaluations_write ON public.evaluations USING (((etablissement_id = public.current_etablissement_id()) AND ((COALESCE(public.get_user_role(), ''::text) = ANY (ARRAY['admin'::text, 'direction'::text, 'responsable_pedagogique'::text, 'secretaire'::text])) OR ((public.get_user_role() = 'enseignant'::text) AND public.teaches_class(class_id))))) WITH CHECK (((etablissement_id = public.current_etablissement_id()) AND ((COALESCE(public.get_user_role(), ''::text) = ANY (ARRAY['admin'::text, 'direction'::text, 'responsable_pedagogique'::text, 'secretaire'::text])) OR ((public.get_user_role() = 'enseignant'::text) AND public.teaches_class(class_id)))));


--
-- Name: expenses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

--
-- Name: expenses expenses_finance_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY expenses_finance_all ON public.expenses USING (((etablissement_id = public.current_etablissement_id()) AND (COALESCE(public.get_user_role(), ''::text) = ANY (ARRAY['admin'::text, 'direction'::text, 'comptable'::text])))) WITH CHECK (((etablissement_id = public.current_etablissement_id()) AND (COALESCE(public.get_user_role(), ''::text) = ANY (ARRAY['admin'::text, 'direction'::text, 'comptable'::text]))));


--
-- Name: family_fees; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.family_fees ENABLE ROW LEVEL SECURITY;

--
-- Name: family_fees family_fees_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY family_fees_tenant ON public.family_fees USING ((etablissement_id = public.current_etablissement_id()));


--
-- Name: family_year_finance; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.family_year_finance ENABLE ROW LEVEL SECURITY;

--
-- Name: fee_adjustments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.fee_adjustments ENABLE ROW LEVEL SECURITY;

--
-- Name: fee_adjustments fee_adjustments_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY fee_adjustments_tenant ON public.fee_adjustments USING ((etablissement_id = public.current_etablissement_id()));


--
-- Name: fee_installments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.fee_installments ENABLE ROW LEVEL SECURITY;

--
-- Name: fee_installments fee_installments_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY fee_installments_tenant ON public.fee_installments USING ((etablissement_id = public.current_etablissement_id()));


--
-- Name: financement_communications fin_comm_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY fin_comm_delete ON public.financement_communications FOR DELETE USING (((etablissement_id = public.current_etablissement_id()) AND (COALESCE(public.get_user_role(), ''::text) = ANY (ARRAY['admin'::text, 'direction'::text, 'comptable'::text]))));


--
-- Name: financement_communications fin_comm_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY fin_comm_insert ON public.financement_communications FOR INSERT WITH CHECK (((etablissement_id = public.current_etablissement_id()) AND (COALESCE(public.get_user_role(), ''::text) = ANY (ARRAY['admin'::text, 'direction'::text, 'comptable'::text]))));


--
-- Name: financement_communications fin_comm_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY fin_comm_select ON public.financement_communications FOR SELECT USING (((etablissement_id = public.current_etablissement_id()) AND (COALESCE(public.get_user_role(), ''::text) = ANY (ARRAY['admin'::text, 'direction'::text, 'comptable'::text]))));


--
-- Name: financement_communications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.financement_communications ENABLE ROW LEVEL SECURITY;

--
-- Name: family_year_finance fyf_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY fyf_select ON public.family_year_finance FOR SELECT USING (((etablissement_id = public.current_etablissement_id()) AND (COALESCE(public.get_user_role(), ''::text) = ANY (ARRAY['admin'::text, 'direction'::text, 'comptable'::text]))));


--
-- Name: family_year_finance fyf_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY fyf_write ON public.family_year_finance USING (((etablissement_id = public.current_etablissement_id()) AND (COALESCE(public.get_user_role(), ''::text) = ANY (ARRAY['admin'::text, 'direction'::text])))) WITH CHECK (((etablissement_id = public.current_etablissement_id()) AND (COALESCE(public.get_user_role(), ''::text) = ANY (ARRAY['admin'::text, 'direction'::text]))));


--
-- Name: grades; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.grades ENABLE ROW LEVEL SECURITY;

--
-- Name: grades grades_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY grades_select ON public.grades FOR SELECT USING (((student_id IN ( SELECT students.id
   FROM public.students
  WHERE (students.etablissement_id = public.current_etablissement_id()))) AND ((COALESCE(public.get_user_role(), ''::text) = ANY (ARRAY['admin'::text, 'direction'::text, 'responsable_pedagogique'::text, 'secretaire'::text])) OR ((public.get_user_role() = 'enseignant'::text) AND (EXISTS ( SELECT 1
   FROM public.evaluations e
  WHERE ((e.id = grades.evaluation_id) AND public.teaches_class(e.class_id))))))));


--
-- Name: grades grades_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY grades_write ON public.grades USING (((student_id IN ( SELECT students.id
   FROM public.students
  WHERE (students.etablissement_id = public.current_etablissement_id()))) AND ((COALESCE(public.get_user_role(), ''::text) = ANY (ARRAY['admin'::text, 'direction'::text, 'responsable_pedagogique'::text, 'secretaire'::text])) OR ((public.get_user_role() = 'enseignant'::text) AND (EXISTS ( SELECT 1
   FROM public.evaluations e
  WHERE ((e.id = grades.evaluation_id) AND public.teaches_class(e.class_id)))))))) WITH CHECK (((student_id IN ( SELECT students.id
   FROM public.students
  WHERE (students.etablissement_id = public.current_etablissement_id()))) AND ((COALESCE(public.get_user_role(), ''::text) = ANY (ARRAY['admin'::text, 'direction'::text, 'responsable_pedagogique'::text, 'secretaire'::text])) OR ((public.get_user_role() = 'enseignant'::text) AND (EXISTS ( SELECT 1
   FROM public.evaluations e
  WHERE ((e.id = grades.evaluation_id) AND public.teaches_class(e.class_id))))))));


--
-- Name: homework; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.homework ENABLE ROW LEVEL SECURITY;

--
-- Name: homework homework_admin_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY homework_admin_select ON public.homework FOR SELECT USING ((etablissement_id IN ( SELECT profiles.etablissement_id
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));


--
-- Name: homework homework_parent_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY homework_parent_select ON public.homework FOR SELECT USING ((class_id IN ( SELECT e.class_id
   FROM ((public.enrollments e
     JOIN public.students s ON ((s.id = e.student_id)))
     JOIN public.parents p ON ((p.id = s.parent_id)))
  WHERE ((p.user_id = auth.uid()) AND (e.status = 'active'::text)))));


--
-- Name: homework homework_staff_crud; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY homework_staff_crud ON public.homework USING ((etablissement_id IN ( SELECT profiles.etablissement_id
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'direction'::text, 'responsable_pedagogique'::text]))))));


--
-- Name: homework_status; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.homework_status ENABLE ROW LEVEL SECURITY;

--
-- Name: homework homework_teacher_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY homework_teacher_delete ON public.homework FOR DELETE USING ((teacher_id IN ( SELECT teachers.id
   FROM public.teachers
  WHERE (teachers.user_id = auth.uid()))));


--
-- Name: homework homework_teacher_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY homework_teacher_insert ON public.homework FOR INSERT WITH CHECK (((teacher_id IN ( SELECT teachers.id
   FROM public.teachers
  WHERE (teachers.user_id = auth.uid()))) AND (class_id IN ( SELECT ct.class_id
   FROM (public.class_teachers ct
     JOIN public.teachers t ON ((t.id = ct.teacher_id)))
  WHERE ((t.user_id = auth.uid()) AND ((ct.effective_from IS NULL) OR (ct.effective_from <= CURRENT_DATE)) AND ((ct.effective_until IS NULL) OR (ct.effective_until >= CURRENT_DATE)))))));


--
-- Name: homework homework_teacher_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY homework_teacher_select ON public.homework FOR SELECT USING ((class_id IN ( SELECT ct.class_id
   FROM (public.class_teachers ct
     JOIN public.teachers t ON ((t.id = ct.teacher_id)))
  WHERE ((t.user_id = auth.uid()) AND ((ct.effective_from IS NULL) OR ((ct.effective_from - '7 days'::interval) <= CURRENT_DATE)) AND ((ct.effective_until IS NULL) OR (ct.effective_until >= CURRENT_DATE))))));


--
-- Name: homework homework_teacher_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY homework_teacher_update ON public.homework FOR UPDATE USING ((teacher_id IN ( SELECT teachers.id
   FROM public.teachers
  WHERE (teachers.user_id = auth.uid()))));


--
-- Name: homework_status hwstatus_parent_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hwstatus_parent_insert ON public.homework_status FOR INSERT WITH CHECK ((parent_id IN ( SELECT parents.id
   FROM public.parents
  WHERE (parents.user_id = auth.uid()))));


--
-- Name: homework_status hwstatus_parent_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hwstatus_parent_select ON public.homework_status FOR SELECT USING ((parent_id IN ( SELECT parents.id
   FROM public.parents
  WHERE (parents.user_id = auth.uid()))));


--
-- Name: homework_status hwstatus_parent_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hwstatus_parent_update ON public.homework_status FOR UPDATE USING ((parent_id IN ( SELECT parents.id
   FROM public.parents
  WHERE (parents.user_id = auth.uid()))));


--
-- Name: homework_status hwstatus_staff_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hwstatus_staff_select ON public.homework_status FOR SELECT USING ((homework_id IN ( SELECT homework.id
   FROM public.homework
  WHERE (homework.etablissement_id IN ( SELECT profiles.etablissement_id
           FROM public.profiles
          WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['direction'::text, 'responsable_pedagogique'::text, 'admin'::text]))))))));


--
-- Name: homework_status hwstatus_teacher_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hwstatus_teacher_select ON public.homework_status FOR SELECT USING ((homework_id IN ( SELECT h.id
   FROM public.homework h
  WHERE (h.class_id IN ( SELECT ct.class_id
           FROM (public.class_teachers ct
             JOIN public.teachers t ON ((t.id = ct.teacher_id)))
          WHERE ((t.user_id = auth.uid()) AND ((ct.effective_from IS NULL) OR ((ct.effective_from - '7 days'::interval) <= CURRENT_DATE)) AND ((ct.effective_until IS NULL) OR (ct.effective_until >= CURRENT_DATE))))))));


--
-- Name: class_journal journal_admin_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY journal_admin_select ON public.class_journal FOR SELECT USING ((etablissement_id IN ( SELECT profiles.etablissement_id
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));


--
-- Name: class_journal journal_parent_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY journal_parent_select ON public.class_journal FOR SELECT USING ((class_id IN ( SELECT e.class_id
   FROM ((public.enrollments e
     JOIN public.students s ON ((s.id = e.student_id)))
     JOIN public.parents p ON ((p.id = s.parent_id)))
  WHERE ((p.user_id = auth.uid()) AND (e.status = 'active'::text)))));


--
-- Name: class_journal journal_staff_crud; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY journal_staff_crud ON public.class_journal USING ((etablissement_id IN ( SELECT profiles.etablissement_id
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'direction'::text, 'responsable_pedagogique'::text]))))));


--
-- Name: class_journal journal_teacher_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY journal_teacher_delete ON public.class_journal FOR DELETE USING ((teacher_id IN ( SELECT teachers.id
   FROM public.teachers
  WHERE (teachers.user_id = auth.uid()))));


--
-- Name: class_journal journal_teacher_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY journal_teacher_insert ON public.class_journal FOR INSERT WITH CHECK (((teacher_id IN ( SELECT teachers.id
   FROM public.teachers
  WHERE (teachers.user_id = auth.uid()))) AND (class_id IN ( SELECT ct.class_id
   FROM (public.class_teachers ct
     JOIN public.teachers t ON ((t.id = ct.teacher_id)))
  WHERE ((t.user_id = auth.uid()) AND ((ct.effective_from IS NULL) OR (ct.effective_from <= CURRENT_DATE)) AND ((ct.effective_until IS NULL) OR (ct.effective_until >= CURRENT_DATE)))))));


--
-- Name: class_journal journal_teacher_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY journal_teacher_select ON public.class_journal FOR SELECT USING ((class_id IN ( SELECT ct.class_id
   FROM (public.class_teachers ct
     JOIN public.teachers t ON ((t.id = ct.teacher_id)))
  WHERE ((t.user_id = auth.uid()) AND ((ct.effective_from IS NULL) OR ((ct.effective_from - '7 days'::interval) <= CURRENT_DATE)) AND ((ct.effective_until IS NULL) OR (ct.effective_until >= CURRENT_DATE))))));


--
-- Name: class_journal journal_teacher_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY journal_teacher_update ON public.class_journal FOR UPDATE USING ((teacher_id IN ( SELECT teachers.id
   FROM public.teachers
  WHERE (teachers.user_id = auth.uid()))));


--
-- Name: materials; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;

--
-- Name: materials materials_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY materials_delete ON public.materials FOR DELETE USING ((etablissement_id IN ( SELECT profiles.etablissement_id
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'direction'::text, 'secretaire'::text]))))));


--
-- Name: materials materials_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY materials_insert ON public.materials FOR INSERT WITH CHECK ((etablissement_id IN ( SELECT profiles.etablissement_id
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'direction'::text, 'secretaire'::text]))))));


--
-- Name: materials materials_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY materials_select ON public.materials FOR SELECT USING ((etablissement_id IN ( SELECT profiles.etablissement_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: materials materials_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY materials_update ON public.materials FOR UPDATE USING ((etablissement_id IN ( SELECT profiles.etablissement_id
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'direction'::text, 'secretaire'::text]))))));


--
-- Name: modules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;

--
-- Name: modules modules_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY modules_tenant ON public.modules USING ((etablissement_id = public.current_etablissement_id()));


--
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications notifications_select_parent; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notifications_select_parent ON public.notifications FOR SELECT USING ((parent_id IN ( SELECT parents.id
   FROM public.parents
  WHERE (parents.user_id = auth.uid()))));


--
-- Name: notifications notifications_select_staff; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notifications_select_staff ON public.notifications FOR SELECT USING ((etablissement_id IN ( SELECT profiles.etablissement_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: other_revenues; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.other_revenues ENABLE ROW LEVEL SECURITY;

--
-- Name: other_revenues other_revenues_finance_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY other_revenues_finance_all ON public.other_revenues USING (((etablissement_id = public.current_etablissement_id()) AND (COALESCE(public.get_user_role(), ''::text) = ANY (ARRAY['admin'::text, 'direction'::text, 'comptable'::text])))) WITH CHECK (((etablissement_id = public.current_etablissement_id()) AND (COALESCE(public.get_user_role(), ''::text) = ANY (ARRAY['admin'::text, 'direction'::text, 'comptable'::text]))));


--
-- Name: parent_class_enrollments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.parent_class_enrollments ENABLE ROW LEVEL SECURITY;

--
-- Name: parent_class_enrollments parent_class_enrollments_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY parent_class_enrollments_tenant ON public.parent_class_enrollments USING ((etablissement_id = public.current_etablissement_id())) WITH CHECK ((etablissement_id = public.current_etablissement_id()));


--
-- Name: parents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.parents ENABLE ROW LEVEL SECURITY;

--
-- Name: parents parents_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY parents_select ON public.parents FOR SELECT USING (((etablissement_id = public.current_etablissement_id()) AND ((COALESCE(public.get_user_role(), ''::text) = ANY (ARRAY['admin'::text, 'direction'::text, 'comptable'::text, 'responsable_pedagogique'::text, 'secretaire'::text])) OR ((public.get_user_role() = 'enseignant'::text) AND public.teaches_parent(id)))));


--
-- Name: parents parents_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY parents_write ON public.parents USING (((etablissement_id = public.current_etablissement_id()) AND (COALESCE(public.get_user_role(), ''::text) = ANY (ARRAY['admin'::text, 'direction'::text, 'responsable_pedagogique'::text, 'secretaire'::text])))) WITH CHECK (((etablissement_id = public.current_etablissement_id()) AND (COALESCE(public.get_user_role(), ''::text) = ANY (ARRAY['admin'::text, 'direction'::text, 'responsable_pedagogique'::text, 'secretaire'::text]))));


--
-- Name: periods; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.periods ENABLE ROW LEVEL SECURITY;

--
-- Name: presence_type_rates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.presence_type_rates ENABLE ROW LEVEL SECURITY;

--
-- Name: presence_type_rates presence_type_rates_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY presence_type_rates_delete ON public.presence_type_rates FOR DELETE USING ((etablissement_id = public.current_etablissement_id()));


--
-- Name: presence_type_rates presence_type_rates_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY presence_type_rates_insert ON public.presence_type_rates FOR INSERT WITH CHECK ((etablissement_id = public.current_etablissement_id()));


--
-- Name: presence_type_rates presence_type_rates_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY presence_type_rates_tenant ON public.presence_type_rates USING ((etablissement_id = public.current_etablissement_id()));


--
-- Name: presence_type_rates presence_type_rates_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY presence_type_rates_update ON public.presence_type_rates FOR UPDATE USING ((etablissement_id = public.current_etablissement_id()));


--
-- Name: presence_types; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.presence_types ENABLE ROW LEVEL SECURITY;

--
-- Name: presence_types presence_types_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY presence_types_delete ON public.presence_types FOR DELETE USING ((etablissement_id = public.current_etablissement_id()));


--
-- Name: presence_types presence_types_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY presence_types_insert ON public.presence_types FOR INSERT WITH CHECK ((etablissement_id = public.current_etablissement_id()));


--
-- Name: presence_types presence_types_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY presence_types_tenant ON public.presence_types USING ((etablissement_id = public.current_etablissement_id()));


--
-- Name: presence_types presence_types_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY presence_types_update ON public.presence_types FOR UPDATE USING ((etablissement_id = public.current_etablissement_id()));


--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles profiles_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_select ON public.profiles FOR SELECT USING (((id = auth.uid()) OR (etablissement_id = public.current_etablissement_id())));


--
-- Name: profiles profiles_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_update ON public.profiles FOR UPDATE USING ((etablissement_id = public.current_etablissement_id()));


--
-- Name: push_subscriptions push_own_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY push_own_delete ON public.push_subscriptions FOR DELETE USING ((user_id = auth.uid()));


--
-- Name: push_subscriptions push_own_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY push_own_insert ON public.push_subscriptions FOR INSERT WITH CHECK ((user_id = auth.uid()));


--
-- Name: push_subscriptions push_own_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY push_own_select ON public.push_subscriptions FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: push_subscriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: rooms; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

--
-- Name: rooms rooms_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rooms_delete ON public.rooms FOR DELETE USING ((etablissement_id IN ( SELECT profiles.etablissement_id
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'direction'::text, 'secretaire'::text]))))));


--
-- Name: rooms rooms_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rooms_insert ON public.rooms FOR INSERT WITH CHECK ((etablissement_id IN ( SELECT profiles.etablissement_id
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'direction'::text, 'secretaire'::text]))))));


--
-- Name: rooms rooms_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rooms_select ON public.rooms FOR SELECT USING ((etablissement_id IN ( SELECT profiles.etablissement_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: rooms rooms_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rooms_update ON public.rooms FOR UPDATE USING ((etablissement_id IN ( SELECT profiles.etablissement_id
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = ANY (ARRAY['admin'::text, 'direction'::text, 'secretaire'::text]))))));


--
-- Name: schedule_exceptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.schedule_exceptions ENABLE ROW LEVEL SECURITY;

--
-- Name: schedule_exceptions schedule_exceptions_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY schedule_exceptions_tenant ON public.schedule_exceptions USING ((etablissement_id = public.current_etablissement_id()));


--
-- Name: schedule_slots; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.schedule_slots ENABLE ROW LEVEL SECURITY;

--
-- Name: schedule_slots schedule_slots_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY schedule_slots_tenant ON public.schedule_slots USING ((etablissement_id = public.current_etablissement_id()));


--
-- Name: schedule_validations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.schedule_validations ENABLE ROW LEVEL SECURITY;

--
-- Name: schedule_validations schedule_validations_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY schedule_validations_manage ON public.schedule_validations USING (((etablissement_id = public.current_etablissement_id()) AND (public.get_user_role() = ANY (ARRAY['admin'::text, 'direction'::text, 'responsable_pedagogique'::text, 'secretaire'::text])))) WITH CHECK (((etablissement_id = public.current_etablissement_id()) AND (public.get_user_role() = ANY (ARRAY['admin'::text, 'direction'::text, 'responsable_pedagogique'::text, 'secretaire'::text]))));


--
-- Name: schedule_validations schedule_validations_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY schedule_validations_select ON public.schedule_validations FOR SELECT USING ((etablissement_id = public.current_etablissement_id()));


--
-- Name: schedule_validations schedule_validations_teacher_own_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY schedule_validations_teacher_own_delete ON public.schedule_validations FOR DELETE USING (((etablissement_id = public.current_etablissement_id()) AND (public.get_user_role() = 'enseignant'::text) AND (profile_id = auth.uid())));


--
-- Name: schedule_validations schedule_validations_teacher_own_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY schedule_validations_teacher_own_insert ON public.schedule_validations FOR INSERT WITH CHECK (((etablissement_id = public.current_etablissement_id()) AND (public.get_user_role() = 'enseignant'::text) AND (profile_id = auth.uid())));


--
-- Name: school_years; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.school_years ENABLE ROW LEVEL SECURITY;

--
-- Name: staff_hourly_rates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.staff_hourly_rates ENABLE ROW LEVEL SECURITY;

--
-- Name: staff_hourly_rates staff_hourly_rates_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY staff_hourly_rates_tenant ON public.staff_hourly_rates USING ((etablissement_id = public.current_etablissement_id()));


--
-- Name: announcement_staff_recipients staff_recipients_write_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY staff_recipients_write_scoped ON public.announcement_staff_recipients USING ((COALESCE(public.get_user_role(), ''::text) = ANY (ARRAY['admin'::text, 'direction'::text, 'secretaire'::text, 'responsable_pedagogique'::text, 'comptable'::text]))) WITH CHECK ((COALESCE(public.get_user_role(), ''::text) = ANY (ARRAY['admin'::text, 'direction'::text, 'secretaire'::text, 'responsable_pedagogique'::text, 'comptable'::text])));


--
-- Name: staff_time_entries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.staff_time_entries ENABLE ROW LEVEL SECURITY;

--
-- Name: staff_time_entries staff_time_entries_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY staff_time_entries_manage ON public.staff_time_entries USING (((etablissement_id = public.current_etablissement_id()) AND (public.get_user_role() = ANY (ARRAY['admin'::text, 'direction'::text, 'comptable'::text, 'secretaire'::text])))) WITH CHECK (((etablissement_id = public.current_etablissement_id()) AND (public.get_user_role() = ANY (ARRAY['admin'::text, 'direction'::text, 'comptable'::text, 'secretaire'::text]))));


--
-- Name: staff_time_entries staff_time_entries_resp_pedago; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY staff_time_entries_resp_pedago ON public.staff_time_entries USING (((etablissement_id = public.current_etablissement_id()) AND (public.get_user_role() = 'responsable_pedagogique'::text) AND ((profile_id = auth.uid()) OR (profile_id IN ( SELECT profiles.id
   FROM public.profiles
  WHERE ((profiles.role = 'enseignant'::text) AND (profiles.etablissement_id = public.current_etablissement_id()))))))) WITH CHECK (((etablissement_id = public.current_etablissement_id()) AND (public.get_user_role() = 'responsable_pedagogique'::text) AND ((profile_id = auth.uid()) OR (profile_id IN ( SELECT profiles.id
   FROM public.profiles
  WHERE ((profiles.role = 'enseignant'::text) AND (profiles.etablissement_id = public.current_etablissement_id())))))));


--
-- Name: staff_time_entries staff_time_entries_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY staff_time_entries_select ON public.staff_time_entries FOR SELECT USING ((etablissement_id = public.current_etablissement_id()));


--
-- Name: staff_time_entries staff_time_entries_teacher_own_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY staff_time_entries_teacher_own_delete ON public.staff_time_entries FOR DELETE USING (((etablissement_id = public.current_etablissement_id()) AND (public.get_user_role() = 'enseignant'::text) AND (profile_id = auth.uid())));


--
-- Name: staff_time_entries staff_time_entries_teacher_own_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY staff_time_entries_teacher_own_insert ON public.staff_time_entries FOR INSERT WITH CHECK (((etablissement_id = public.current_etablissement_id()) AND (public.get_user_role() = 'enseignant'::text) AND (profile_id = auth.uid())));


--
-- Name: staff_time_entries staff_time_entries_teacher_own_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY staff_time_entries_teacher_own_update ON public.staff_time_entries FOR UPDATE USING (((etablissement_id = public.current_etablissement_id()) AND (public.get_user_role() = 'enseignant'::text) AND (profile_id = auth.uid()))) WITH CHECK (((etablissement_id = public.current_etablissement_id()) AND (public.get_user_role() = 'enseignant'::text) AND (profile_id = auth.uid())));


--
-- Name: student_documents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.student_documents ENABLE ROW LEVEL SECURITY;

--
-- Name: student_documents student_documents_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY student_documents_delete ON public.student_documents FOR DELETE USING ((etablissement_id = ( SELECT profiles.etablissement_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: student_documents student_documents_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY student_documents_insert ON public.student_documents FOR INSERT WITH CHECK ((etablissement_id = ( SELECT profiles.etablissement_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: student_documents student_documents_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY student_documents_select ON public.student_documents FOR SELECT USING ((etablissement_id = ( SELECT profiles.etablissement_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: student_documents student_documents_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY student_documents_update ON public.student_documents FOR UPDATE USING ((etablissement_id = ( SELECT profiles.etablissement_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: student_warning_attachments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.student_warning_attachments ENABLE ROW LEVEL SECURITY;

--
-- Name: student_warnings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.student_warnings ENABLE ROW LEVEL SECURITY;

--
-- Name: student_warnings student_warnings_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY student_warnings_delete ON public.student_warnings FOR DELETE USING ((etablissement_id = ( SELECT profiles.etablissement_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: student_warnings student_warnings_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY student_warnings_insert ON public.student_warnings FOR INSERT WITH CHECK ((etablissement_id = ( SELECT profiles.etablissement_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: student_warnings student_warnings_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY student_warnings_select ON public.student_warnings FOR SELECT USING ((etablissement_id = ( SELECT profiles.etablissement_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: student_warnings student_warnings_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY student_warnings_update ON public.student_warnings FOR UPDATE USING ((etablissement_id = ( SELECT profiles.etablissement_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: student_year_history; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.student_year_history ENABLE ROW LEVEL SECURITY;

--
-- Name: students; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

--
-- Name: students students_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY students_select ON public.students FOR SELECT USING (((etablissement_id = public.current_etablissement_id()) AND ((COALESCE(public.get_user_role(), ''::text) = ANY (ARRAY['admin'::text, 'direction'::text, 'comptable'::text, 'responsable_pedagogique'::text, 'secretaire'::text])) OR ((public.get_user_role() = 'enseignant'::text) AND public.teaches_student(id)))));


--
-- Name: students students_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY students_write ON public.students USING (((etablissement_id = public.current_etablissement_id()) AND (COALESCE(public.get_user_role(), ''::text) = ANY (ARRAY['admin'::text, 'direction'::text, 'responsable_pedagogique'::text, 'secretaire'::text])))) WITH CHECK (((etablissement_id = public.current_etablissement_id()) AND (COALESCE(public.get_user_role(), ''::text) = ANY (ARRAY['admin'::text, 'direction'::text, 'responsable_pedagogique'::text, 'secretaire'::text]))));


--
-- Name: subjects; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;

--
-- Name: subjects subjects_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY subjects_tenant ON public.subjects USING ((etablissement_id = public.current_etablissement_id()));


--
-- Name: student_year_history syh_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY syh_select ON public.student_year_history FOR SELECT USING (((etablissement_id = public.current_etablissement_id()) AND (COALESCE(public.get_user_role(), ''::text) = ANY (ARRAY['admin'::text, 'direction'::text, 'secretaire'::text, 'responsable_pedagogique'::text, 'comptable'::text]))));


--
-- Name: student_year_history syh_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY syh_write ON public.student_year_history USING (((etablissement_id = public.current_etablissement_id()) AND (COALESCE(public.get_user_role(), ''::text) = ANY (ARRAY['admin'::text, 'direction'::text])))) WITH CHECK (((etablissement_id = public.current_etablissement_id()) AND (COALESCE(public.get_user_role(), ''::text) = ANY (ARRAY['admin'::text, 'direction'::text]))));


--
-- Name: teacher_documents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.teacher_documents ENABLE ROW LEVEL SECURITY;

--
-- Name: teacher_documents teacher_documents_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY teacher_documents_delete ON public.teacher_documents FOR DELETE USING ((etablissement_id = ( SELECT profiles.etablissement_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: teacher_documents teacher_documents_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY teacher_documents_insert ON public.teacher_documents FOR INSERT WITH CHECK ((etablissement_id = ( SELECT profiles.etablissement_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: teacher_documents teacher_documents_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY teacher_documents_select ON public.teacher_documents FOR SELECT USING ((etablissement_id = ( SELECT profiles.etablissement_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: teacher_documents teacher_documents_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY teacher_documents_update ON public.teacher_documents FOR UPDATE USING ((etablissement_id = ( SELECT profiles.etablissement_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));


--
-- Name: teachers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;

--
-- Name: teachers teachers_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY teachers_delete ON public.teachers FOR DELETE USING (((etablissement_id = public.current_etablissement_id()) AND (COALESCE(public.get_user_role(), ''::text) = ANY (ARRAY['admin'::text, 'direction'::text]))));


--
-- Name: teachers teachers_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY teachers_insert ON public.teachers FOR INSERT WITH CHECK (((etablissement_id = public.current_etablissement_id()) AND (COALESCE(public.get_user_role(), ''::text) = ANY (ARRAY['admin'::text, 'direction'::text, 'secretaire'::text]))));


--
-- Name: teachers teachers_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY teachers_select ON public.teachers FOR SELECT USING (((etablissement_id = public.current_etablissement_id()) AND ((COALESCE(public.get_user_role(), ''::text) = ANY (ARRAY['admin'::text, 'direction'::text, 'comptable'::text, 'responsable_pedagogique'::text, 'secretaire'::text])) OR ((public.get_user_role() = 'enseignant'::text) AND (user_id = auth.uid())))));


--
-- Name: teachers teachers_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY teachers_update ON public.teachers FOR UPDATE USING (((etablissement_id = public.current_etablissement_id()) AND (COALESCE(public.get_user_role(), ''::text) = ANY (ARRAY['admin'::text, 'direction'::text, 'secretaire'::text])))) WITH CHECK (((etablissement_id = public.current_etablissement_id()) AND (COALESCE(public.get_user_role(), ''::text) = ANY (ARRAY['admin'::text, 'direction'::text, 'secretaire'::text]))));


--
-- Name: teaching_units; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.teaching_units ENABLE ROW LEVEL SECURITY;

--
-- Name: teaching_units teaching_units_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY teaching_units_tenant ON public.teaching_units USING ((etablissement_id = public.current_etablissement_id()));


--
-- Name: unites_enseignement ue_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ue_select ON public.unites_enseignement FOR SELECT USING (((etablissement_id = public.current_etablissement_id()) AND (COALESCE(public.get_user_role(), ''::text) = ANY (ARRAY['admin'::text, 'direction'::text, 'comptable'::text, 'responsable_pedagogique'::text, 'enseignant'::text, 'secretaire'::text]))));


--
-- Name: unites_enseignement ue_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ue_write ON public.unites_enseignement USING (((etablissement_id = public.current_etablissement_id()) AND (COALESCE(public.get_user_role(), ''::text) = ANY (ARRAY['admin'::text, 'direction'::text, 'responsable_pedagogique'::text])))) WITH CHECK (((etablissement_id = public.current_etablissement_id()) AND (COALESCE(public.get_user_role(), ''::text) = ANY (ARRAY['admin'::text, 'direction'::text, 'responsable_pedagogique'::text]))));


--
-- Name: unites_enseignement; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.unites_enseignement ENABLE ROW LEVEL SECURITY;

--
-- Name: student_warning_attachments warning_attachments_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY warning_attachments_delete ON public.student_warning_attachments FOR DELETE USING ((warning_id IN ( SELECT student_warnings.id
   FROM public.student_warnings
  WHERE (student_warnings.etablissement_id = ( SELECT profiles.etablissement_id
           FROM public.profiles
          WHERE (profiles.id = auth.uid()))))));


--
-- Name: student_warning_attachments warning_attachments_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY warning_attachments_insert ON public.student_warning_attachments FOR INSERT WITH CHECK ((warning_id IN ( SELECT student_warnings.id
   FROM public.student_warnings
  WHERE (student_warnings.etablissement_id = ( SELECT profiles.etablissement_id
           FROM public.profiles
          WHERE (profiles.id = auth.uid()))))));


--
-- Name: student_warning_attachments warning_attachments_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY warning_attachments_select ON public.student_warning_attachments FOR SELECT USING ((warning_id IN ( SELECT student_warnings.id
   FROM public.student_warnings
  WHERE (student_warnings.etablissement_id = ( SELECT profiles.etablissement_id
           FROM public.profiles
          WHERE (profiles.id = auth.uid()))))));


--
-- Name: year_closure; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.year_closure ENABLE ROW LEVEL SECURITY;

--
-- Name: year_closure year_closure_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY year_closure_all ON public.year_closure USING (((etablissement_id = public.current_etablissement_id()) AND (COALESCE(public.get_user_role(), ''::text) = ANY (ARRAY['admin'::text, 'direction'::text])))) WITH CHECK (((etablissement_id = public.current_etablissement_id()) AND (COALESCE(public.get_user_role(), ''::text) = ANY (ARRAY['admin'::text, 'direction'::text]))));


--
-- Name: year_closure_steps; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.year_closure_steps ENABLE ROW LEVEL SECURITY;

--
-- Name: year_closure_steps year_closure_steps_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY year_closure_steps_all ON public.year_closure_steps USING (((etablissement_id = public.current_etablissement_id()) AND (COALESCE(public.get_user_role(), ''::text) = ANY (ARRAY['admin'::text, 'direction'::text])))) WITH CHECK (((etablissement_id = public.current_etablissement_id()) AND (COALESCE(public.get_user_role(), ''::text) = ANY (ARRAY['admin'::text, 'direction'::text]))));


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- Name: FUNCTION cleanup_profile_only(p_profile_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.cleanup_profile_only(p_profile_id uuid) TO anon;
GRANT ALL ON FUNCTION public.cleanup_profile_only(p_profile_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.cleanup_profile_only(p_profile_id uuid) TO service_role;


--
-- Name: FUNCTION cleanup_user_and_parent(p_profile_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.cleanup_user_and_parent(p_profile_id uuid) TO anon;
GRANT ALL ON FUNCTION public.cleanup_user_and_parent(p_profile_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.cleanup_user_and_parent(p_profile_id uuid) TO service_role;


--
-- Name: FUNCTION cleanup_user_and_teacher(p_profile_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.cleanup_user_and_teacher(p_profile_id uuid) TO anon;
GRANT ALL ON FUNCTION public.cleanup_user_and_teacher(p_profile_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.cleanup_user_and_teacher(p_profile_id uuid) TO service_role;


--
-- Name: FUNCTION create_parent_login_profile(p_profile_id uuid, p_email text, p_first_name text, p_last_name text, p_phone text, p_etablissement_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.create_parent_login_profile(p_profile_id uuid, p_email text, p_first_name text, p_last_name text, p_phone text, p_etablissement_id uuid) TO anon;
GRANT ALL ON FUNCTION public.create_parent_login_profile(p_profile_id uuid, p_email text, p_first_name text, p_last_name text, p_phone text, p_etablissement_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.create_parent_login_profile(p_profile_id uuid, p_email text, p_first_name text, p_last_name text, p_phone text, p_etablissement_id uuid) TO service_role;


--
-- Name: FUNCTION create_profile_and_parent(p_profile_id uuid, p_email text, p_role text, p_first_name text, p_last_name text, p_phone text, p_is_active boolean, p_etablissement_id uuid, p_tutor1_first_name text, p_tutor1_last_name text, p_tutor1_email text, p_tutor1_phone text, p_tutor1_relationship text, p_tutor1_address text, p_tutor1_city text, p_tutor1_postal_code text, p_tutor1_profession text, p_tutor1_adult_courses boolean, p_tutor2_first_name text, p_tutor2_last_name text, p_tutor2_email text, p_tutor2_phone text, p_tutor2_relationship text, p_tutor2_address text, p_tutor2_city text, p_tutor2_postal_code text, p_tutor2_profession text, p_tutor2_adult_courses boolean, p_situation_familiale text, p_type_garde text, p_notes text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.create_profile_and_parent(p_profile_id uuid, p_email text, p_role text, p_first_name text, p_last_name text, p_phone text, p_is_active boolean, p_etablissement_id uuid, p_tutor1_first_name text, p_tutor1_last_name text, p_tutor1_email text, p_tutor1_phone text, p_tutor1_relationship text, p_tutor1_address text, p_tutor1_city text, p_tutor1_postal_code text, p_tutor1_profession text, p_tutor1_adult_courses boolean, p_tutor2_first_name text, p_tutor2_last_name text, p_tutor2_email text, p_tutor2_phone text, p_tutor2_relationship text, p_tutor2_address text, p_tutor2_city text, p_tutor2_postal_code text, p_tutor2_profession text, p_tutor2_adult_courses boolean, p_situation_familiale text, p_type_garde text, p_notes text) TO anon;
GRANT ALL ON FUNCTION public.create_profile_and_parent(p_profile_id uuid, p_email text, p_role text, p_first_name text, p_last_name text, p_phone text, p_is_active boolean, p_etablissement_id uuid, p_tutor1_first_name text, p_tutor1_last_name text, p_tutor1_email text, p_tutor1_phone text, p_tutor1_relationship text, p_tutor1_address text, p_tutor1_city text, p_tutor1_postal_code text, p_tutor1_profession text, p_tutor1_adult_courses boolean, p_tutor2_first_name text, p_tutor2_last_name text, p_tutor2_email text, p_tutor2_phone text, p_tutor2_relationship text, p_tutor2_address text, p_tutor2_city text, p_tutor2_postal_code text, p_tutor2_profession text, p_tutor2_adult_courses boolean, p_situation_familiale text, p_type_garde text, p_notes text) TO authenticated;
GRANT ALL ON FUNCTION public.create_profile_and_parent(p_profile_id uuid, p_email text, p_role text, p_first_name text, p_last_name text, p_phone text, p_is_active boolean, p_etablissement_id uuid, p_tutor1_first_name text, p_tutor1_last_name text, p_tutor1_email text, p_tutor1_phone text, p_tutor1_relationship text, p_tutor1_address text, p_tutor1_city text, p_tutor1_postal_code text, p_tutor1_profession text, p_tutor1_adult_courses boolean, p_tutor2_first_name text, p_tutor2_last_name text, p_tutor2_email text, p_tutor2_phone text, p_tutor2_relationship text, p_tutor2_address text, p_tutor2_city text, p_tutor2_postal_code text, p_tutor2_profession text, p_tutor2_adult_courses boolean, p_situation_familiale text, p_type_garde text, p_notes text) TO service_role;


--
-- Name: FUNCTION create_profile_and_teacher(p_profile_id uuid, p_email text, p_role text, p_first_name text, p_last_name text, p_civilite text, p_phone text, p_is_active boolean, p_etablissement_id uuid, p_employee_number text, p_specialization text, p_hire_date date); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.create_profile_and_teacher(p_profile_id uuid, p_email text, p_role text, p_first_name text, p_last_name text, p_civilite text, p_phone text, p_is_active boolean, p_etablissement_id uuid, p_employee_number text, p_specialization text, p_hire_date date) TO anon;
GRANT ALL ON FUNCTION public.create_profile_and_teacher(p_profile_id uuid, p_email text, p_role text, p_first_name text, p_last_name text, p_civilite text, p_phone text, p_is_active boolean, p_etablissement_id uuid, p_employee_number text, p_specialization text, p_hire_date date) TO authenticated;
GRANT ALL ON FUNCTION public.create_profile_and_teacher(p_profile_id uuid, p_email text, p_role text, p_first_name text, p_last_name text, p_civilite text, p_phone text, p_is_active boolean, p_etablissement_id uuid, p_employee_number text, p_specialization text, p_hire_date date) TO service_role;


--
-- Name: FUNCTION create_profile_only(p_profile_id uuid, p_email text, p_role text, p_first_name text, p_last_name text, p_civilite text, p_phone text, p_is_active boolean, p_etablissement_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.create_profile_only(p_profile_id uuid, p_email text, p_role text, p_first_name text, p_last_name text, p_civilite text, p_phone text, p_is_active boolean, p_etablissement_id uuid) TO anon;
GRANT ALL ON FUNCTION public.create_profile_only(p_profile_id uuid, p_email text, p_role text, p_first_name text, p_last_name text, p_civilite text, p_phone text, p_is_active boolean, p_etablissement_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.create_profile_only(p_profile_id uuid, p_email text, p_role text, p_first_name text, p_last_name text, p_civilite text, p_phone text, p_is_active boolean, p_etablissement_id uuid) TO service_role;


--
-- Name: FUNCTION current_etablissement_id(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.current_etablissement_id() TO anon;
GRANT ALL ON FUNCTION public.current_etablissement_id() TO authenticated;
GRANT ALL ON FUNCTION public.current_etablissement_id() TO service_role;


--
-- Name: FUNCTION fn_audit_log(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_audit_log() TO anon;
GRANT ALL ON FUNCTION public.fn_audit_log() TO authenticated;
GRANT ALL ON FUNCTION public.fn_audit_log() TO service_role;


--
-- Name: FUNCTION fn_block_adult_unenroll(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_block_adult_unenroll() TO anon;
GRANT ALL ON FUNCTION public.fn_block_adult_unenroll() TO authenticated;
GRANT ALL ON FUNCTION public.fn_block_adult_unenroll() TO service_role;


--
-- Name: FUNCTION fn_block_student_unenroll(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_block_student_unenroll() TO anon;
GRANT ALL ON FUNCTION public.fn_block_student_unenroll() TO authenticated;
GRANT ALL ON FUNCTION public.fn_block_student_unenroll() TO service_role;


--
-- Name: FUNCTION fn_ensure_reserved_presence_types(p_etab uuid, p_year uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_ensure_reserved_presence_types(p_etab uuid, p_year uuid) TO anon;
GRANT ALL ON FUNCTION public.fn_ensure_reserved_presence_types(p_etab uuid, p_year uuid) TO authenticated;
GRANT ALL ON FUNCTION public.fn_ensure_reserved_presence_types(p_etab uuid, p_year uuid) TO service_role;


--
-- Name: FUNCTION fn_guard_presence_type_delete(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_guard_presence_type_delete() TO anon;
GRANT ALL ON FUNCTION public.fn_guard_presence_type_delete() TO authenticated;
GRANT ALL ON FUNCTION public.fn_guard_presence_type_delete() TO service_role;


--
-- Name: FUNCTION fn_guard_profile_sensitive_columns(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_guard_profile_sensitive_columns() TO anon;
GRANT ALL ON FUNCTION public.fn_guard_profile_sensitive_columns() TO authenticated;
GRANT ALL ON FUNCTION public.fn_guard_profile_sensitive_columns() TO service_role;


--
-- Name: FUNCTION fn_protect_reserved_presence_types(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_protect_reserved_presence_types() TO anon;
GRANT ALL ON FUNCTION public.fn_protect_reserved_presence_types() TO authenticated;
GRANT ALL ON FUNCTION public.fn_protect_reserved_presence_types() TO service_role;


--
-- Name: FUNCTION fn_school_year_reserved_types(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_school_year_reserved_types() TO anon;
GRANT ALL ON FUNCTION public.fn_school_year_reserved_types() TO authenticated;
GRANT ALL ON FUNCTION public.fn_school_year_reserved_types() TO service_role;


--
-- Name: FUNCTION fn_sync_identity_profile_to_teacher(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_sync_identity_profile_to_teacher() TO anon;
GRANT ALL ON FUNCTION public.fn_sync_identity_profile_to_teacher() TO authenticated;
GRANT ALL ON FUNCTION public.fn_sync_identity_profile_to_teacher() TO service_role;


--
-- Name: FUNCTION fn_sync_identity_teacher_to_profile(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_sync_identity_teacher_to_profile() TO anon;
GRANT ALL ON FUNCTION public.fn_sync_identity_teacher_to_profile() TO authenticated;
GRANT ALL ON FUNCTION public.fn_sync_identity_teacher_to_profile() TO service_role;


--
-- Name: FUNCTION fn_touch_etablissement_smtp(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.fn_touch_etablissement_smtp() TO anon;
GRANT ALL ON FUNCTION public.fn_touch_etablissement_smtp() TO authenticated;
GRANT ALL ON FUNCTION public.fn_touch_etablissement_smtp() TO service_role;


--
-- Name: FUNCTION get_user_role(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_user_role() TO anon;
GRANT ALL ON FUNCTION public.get_user_role() TO authenticated;
GRANT ALL ON FUNCTION public.get_user_role() TO service_role;


--
-- Name: FUNCTION get_verified_totp_user_ids(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_verified_totp_user_ids() TO anon;
GRANT ALL ON FUNCTION public.get_verified_totp_user_ids() TO authenticated;
GRANT ALL ON FUNCTION public.get_verified_totp_user_ids() TO service_role;


--
-- Name: FUNCTION is_admin(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.is_admin() TO anon;
GRANT ALL ON FUNCTION public.is_admin() TO authenticated;
GRANT ALL ON FUNCTION public.is_admin() TO service_role;


--
-- Name: FUNCTION norm_name(txt text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.norm_name(txt text) TO anon;
GRANT ALL ON FUNCTION public.norm_name(txt text) TO authenticated;
GRANT ALL ON FUNCTION public.norm_name(txt text) TO service_role;


--
-- Name: FUNCTION purge_school_year(p_year_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.purge_school_year(p_year_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.purge_school_year(p_year_id uuid) TO anon;
GRANT ALL ON FUNCTION public.purge_school_year(p_year_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.purge_school_year(p_year_id uuid) TO service_role;


--
-- Name: FUNCTION set_etablissement_id(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.set_etablissement_id() TO anon;
GRANT ALL ON FUNCTION public.set_etablissement_id() TO authenticated;
GRANT ALL ON FUNCTION public.set_etablissement_id() TO service_role;


--
-- Name: FUNCTION set_teacher_profile_active(p_teacher_id uuid, p_active boolean); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.set_teacher_profile_active(p_teacher_id uuid, p_active boolean) TO anon;
GRANT ALL ON FUNCTION public.set_teacher_profile_active(p_teacher_id uuid, p_active boolean) TO authenticated;
GRANT ALL ON FUNCTION public.set_teacher_profile_active(p_teacher_id uuid, p_active boolean) TO service_role;


--
-- Name: FUNCTION set_updated_at(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.set_updated_at() TO anon;
GRANT ALL ON FUNCTION public.set_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.set_updated_at() TO service_role;


--
-- Name: FUNCTION teaches_class(p_class_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.teaches_class(p_class_id uuid) TO anon;
GRANT ALL ON FUNCTION public.teaches_class(p_class_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.teaches_class(p_class_id uuid) TO service_role;


--
-- Name: FUNCTION teaches_parent(p_parent_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.teaches_parent(p_parent_id uuid) TO anon;
GRANT ALL ON FUNCTION public.teaches_parent(p_parent_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.teaches_parent(p_parent_id uuid) TO service_role;


--
-- Name: FUNCTION teaches_student(p_student_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.teaches_student(p_student_id uuid) TO anon;
GRANT ALL ON FUNCTION public.teaches_student(p_student_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.teaches_student(p_student_id uuid) TO service_role;


--
-- Name: FUNCTION update_updated_at_column(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_updated_at_column() TO anon;
GRANT ALL ON FUNCTION public.update_updated_at_column() TO authenticated;
GRANT ALL ON FUNCTION public.update_updated_at_column() TO service_role;


--
-- Name: TABLE absences; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.absences TO anon;
GRANT ALL ON TABLE public.absences TO authenticated;
GRANT ALL ON TABLE public.absences TO service_role;


--
-- Name: TABLE adult_bulletin_appreciations; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.adult_bulletin_appreciations TO anon;
GRANT ALL ON TABLE public.adult_bulletin_appreciations TO authenticated;
GRANT ALL ON TABLE public.adult_bulletin_appreciations TO service_role;


--
-- Name: TABLE adult_bulletin_archives; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.adult_bulletin_archives TO anon;
GRANT ALL ON TABLE public.adult_bulletin_archives TO authenticated;
GRANT ALL ON TABLE public.adult_bulletin_archives TO service_role;


--
-- Name: TABLE adult_grades; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.adult_grades TO anon;
GRANT ALL ON TABLE public.adult_grades TO authenticated;
GRANT ALL ON TABLE public.adult_grades TO service_role;


--
-- Name: TABLE adult_homework_status; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.adult_homework_status TO anon;
GRANT ALL ON TABLE public.adult_homework_status TO authenticated;
GRANT ALL ON TABLE public.adult_homework_status TO service_role;


--
-- Name: TABLE announcement_attachments; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.announcement_attachments TO anon;
GRANT ALL ON TABLE public.announcement_attachments TO authenticated;
GRANT ALL ON TABLE public.announcement_attachments TO service_role;


--
-- Name: TABLE announcement_recipients; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.announcement_recipients TO anon;
GRANT ALL ON TABLE public.announcement_recipients TO authenticated;
GRANT ALL ON TABLE public.announcement_recipients TO service_role;


--
-- Name: TABLE announcement_staff_recipients; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.announcement_staff_recipients TO anon;
GRANT ALL ON TABLE public.announcement_staff_recipients TO authenticated;
GRANT ALL ON TABLE public.announcement_staff_recipients TO service_role;


--
-- Name: TABLE announcements; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.announcements TO anon;
GRANT ALL ON TABLE public.announcements TO authenticated;
GRANT ALL ON TABLE public.announcements TO service_role;


--
-- Name: TABLE audit_logs; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.audit_logs TO anon;
GRANT ALL ON TABLE public.audit_logs TO authenticated;
GRANT ALL ON TABLE public.audit_logs TO service_role;


--
-- Name: TABLE bulletin_appreciations; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.bulletin_appreciations TO anon;
GRANT ALL ON TABLE public.bulletin_appreciations TO authenticated;
GRANT ALL ON TABLE public.bulletin_appreciations TO service_role;


--
-- Name: TABLE bulletin_archives; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.bulletin_archives TO anon;
GRANT ALL ON TABLE public.bulletin_archives TO authenticated;
GRANT ALL ON TABLE public.bulletin_archives TO service_role;


--
-- Name: TABLE class_journal; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.class_journal TO anon;
GRANT ALL ON TABLE public.class_journal TO authenticated;
GRANT ALL ON TABLE public.class_journal TO service_role;


--
-- Name: TABLE class_teachers; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.class_teachers TO anon;
GRANT ALL ON TABLE public.class_teachers TO authenticated;
GRANT ALL ON TABLE public.class_teachers TO service_role;


--
-- Name: TABLE classes; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.classes TO anon;
GRANT ALL ON TABLE public.classes TO authenticated;
GRANT ALL ON TABLE public.classes TO service_role;


--
-- Name: TABLE cotisation_types; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.cotisation_types TO anon;
GRANT ALL ON TABLE public.cotisation_types TO authenticated;
GRANT ALL ON TABLE public.cotisation_types TO service_role;


--
-- Name: TABLE cours; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.cours TO anon;
GRANT ALL ON TABLE public.cours TO authenticated;
GRANT ALL ON TABLE public.cours TO service_role;


--
-- Name: TABLE cours_modules; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.cours_modules TO anon;
GRANT ALL ON TABLE public.cours_modules TO authenticated;
GRANT ALL ON TABLE public.cours_modules TO service_role;


--
-- Name: TABLE document_type_configs; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.document_type_configs TO anon;
GRANT ALL ON TABLE public.document_type_configs TO authenticated;
GRANT ALL ON TABLE public.document_type_configs TO service_role;


--
-- Name: TABLE enrollments; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.enrollments TO anon;
GRANT ALL ON TABLE public.enrollments TO authenticated;
GRANT ALL ON TABLE public.enrollments TO service_role;


--
-- Name: TABLE etablissement_smtp; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.etablissement_smtp TO service_role;


--
-- Name: TABLE etablissements; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.etablissements TO anon;
GRANT ALL ON TABLE public.etablissements TO authenticated;
GRANT ALL ON TABLE public.etablissements TO service_role;


--
-- Name: TABLE eval_type_configs; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.eval_type_configs TO anon;
GRANT ALL ON TABLE public.eval_type_configs TO authenticated;
GRANT ALL ON TABLE public.eval_type_configs TO service_role;


--
-- Name: TABLE evaluation_order_config; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.evaluation_order_config TO anon;
GRANT ALL ON TABLE public.evaluation_order_config TO authenticated;
GRANT ALL ON TABLE public.evaluation_order_config TO service_role;


--
-- Name: TABLE evaluations; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.evaluations TO anon;
GRANT ALL ON TABLE public.evaluations TO authenticated;
GRANT ALL ON TABLE public.evaluations TO service_role;


--
-- Name: TABLE expenses; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.expenses TO anon;
GRANT ALL ON TABLE public.expenses TO authenticated;
GRANT ALL ON TABLE public.expenses TO service_role;


--
-- Name: TABLE family_fees; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.family_fees TO anon;
GRANT ALL ON TABLE public.family_fees TO authenticated;
GRANT ALL ON TABLE public.family_fees TO service_role;


--
-- Name: TABLE family_year_finance; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.family_year_finance TO anon;
GRANT ALL ON TABLE public.family_year_finance TO authenticated;
GRANT ALL ON TABLE public.family_year_finance TO service_role;


--
-- Name: TABLE fee_adjustments; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.fee_adjustments TO anon;
GRANT ALL ON TABLE public.fee_adjustments TO authenticated;
GRANT ALL ON TABLE public.fee_adjustments TO service_role;


--
-- Name: TABLE fee_installments; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.fee_installments TO anon;
GRANT ALL ON TABLE public.fee_installments TO authenticated;
GRANT ALL ON TABLE public.fee_installments TO service_role;


--
-- Name: TABLE financement_communications; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.financement_communications TO anon;
GRANT ALL ON TABLE public.financement_communications TO authenticated;
GRANT ALL ON TABLE public.financement_communications TO service_role;


--
-- Name: TABLE grades; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.grades TO anon;
GRANT ALL ON TABLE public.grades TO authenticated;
GRANT ALL ON TABLE public.grades TO service_role;


--
-- Name: TABLE homework; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.homework TO anon;
GRANT ALL ON TABLE public.homework TO authenticated;
GRANT ALL ON TABLE public.homework TO service_role;


--
-- Name: TABLE homework_status; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.homework_status TO anon;
GRANT ALL ON TABLE public.homework_status TO authenticated;
GRANT ALL ON TABLE public.homework_status TO service_role;


--
-- Name: TABLE materials; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.materials TO anon;
GRANT ALL ON TABLE public.materials TO authenticated;
GRANT ALL ON TABLE public.materials TO service_role;


--
-- Name: TABLE modules; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.modules TO anon;
GRANT ALL ON TABLE public.modules TO authenticated;
GRANT ALL ON TABLE public.modules TO service_role;


--
-- Name: TABLE notifications; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.notifications TO anon;
GRANT ALL ON TABLE public.notifications TO authenticated;
GRANT ALL ON TABLE public.notifications TO service_role;


--
-- Name: TABLE other_revenues; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.other_revenues TO anon;
GRANT ALL ON TABLE public.other_revenues TO authenticated;
GRANT ALL ON TABLE public.other_revenues TO service_role;


--
-- Name: TABLE parent_class_enrollments; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.parent_class_enrollments TO anon;
GRANT ALL ON TABLE public.parent_class_enrollments TO authenticated;
GRANT ALL ON TABLE public.parent_class_enrollments TO service_role;


--
-- Name: TABLE parents; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.parents TO anon;
GRANT ALL ON TABLE public.parents TO authenticated;
GRANT ALL ON TABLE public.parents TO service_role;


--
-- Name: TABLE periods; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.periods TO anon;
GRANT ALL ON TABLE public.periods TO authenticated;
GRANT ALL ON TABLE public.periods TO service_role;


--
-- Name: TABLE presence_type_rates; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.presence_type_rates TO anon;
GRANT ALL ON TABLE public.presence_type_rates TO authenticated;
GRANT ALL ON TABLE public.presence_type_rates TO service_role;


--
-- Name: TABLE presence_types; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.presence_types TO anon;
GRANT ALL ON TABLE public.presence_types TO authenticated;
GRANT ALL ON TABLE public.presence_types TO service_role;


--
-- Name: TABLE profiles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.profiles TO anon;
GRANT ALL ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;


--
-- Name: TABLE push_subscriptions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.push_subscriptions TO anon;
GRANT ALL ON TABLE public.push_subscriptions TO authenticated;
GRANT ALL ON TABLE public.push_subscriptions TO service_role;


--
-- Name: TABLE rooms; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.rooms TO anon;
GRANT ALL ON TABLE public.rooms TO authenticated;
GRANT ALL ON TABLE public.rooms TO service_role;


--
-- Name: TABLE schedule_exceptions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.schedule_exceptions TO anon;
GRANT ALL ON TABLE public.schedule_exceptions TO authenticated;
GRANT ALL ON TABLE public.schedule_exceptions TO service_role;


--
-- Name: TABLE schedule_slots; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.schedule_slots TO anon;
GRANT ALL ON TABLE public.schedule_slots TO authenticated;
GRANT ALL ON TABLE public.schedule_slots TO service_role;


--
-- Name: TABLE schedule_validations; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.schedule_validations TO anon;
GRANT ALL ON TABLE public.schedule_validations TO authenticated;
GRANT ALL ON TABLE public.schedule_validations TO service_role;


--
-- Name: TABLE school_years; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.school_years TO anon;
GRANT ALL ON TABLE public.school_years TO authenticated;
GRANT ALL ON TABLE public.school_years TO service_role;


--
-- Name: TABLE staff_hourly_rates; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.staff_hourly_rates TO anon;
GRANT ALL ON TABLE public.staff_hourly_rates TO authenticated;
GRANT ALL ON TABLE public.staff_hourly_rates TO service_role;


--
-- Name: TABLE staff_time_entries; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.staff_time_entries TO anon;
GRANT ALL ON TABLE public.staff_time_entries TO authenticated;
GRANT ALL ON TABLE public.staff_time_entries TO service_role;


--
-- Name: TABLE student_documents; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.student_documents TO anon;
GRANT ALL ON TABLE public.student_documents TO authenticated;
GRANT ALL ON TABLE public.student_documents TO service_role;


--
-- Name: TABLE student_warning_attachments; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.student_warning_attachments TO anon;
GRANT ALL ON TABLE public.student_warning_attachments TO authenticated;
GRANT ALL ON TABLE public.student_warning_attachments TO service_role;


--
-- Name: TABLE student_warnings; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.student_warnings TO anon;
GRANT ALL ON TABLE public.student_warnings TO authenticated;
GRANT ALL ON TABLE public.student_warnings TO service_role;


--
-- Name: TABLE student_year_history; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.student_year_history TO anon;
GRANT ALL ON TABLE public.student_year_history TO authenticated;
GRANT ALL ON TABLE public.student_year_history TO service_role;


--
-- Name: TABLE students; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.students TO anon;
GRANT ALL ON TABLE public.students TO authenticated;
GRANT ALL ON TABLE public.students TO service_role;


--
-- Name: TABLE subjects; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.subjects TO anon;
GRANT ALL ON TABLE public.subjects TO authenticated;
GRANT ALL ON TABLE public.subjects TO service_role;


--
-- Name: TABLE teacher_documents; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.teacher_documents TO anon;
GRANT ALL ON TABLE public.teacher_documents TO authenticated;
GRANT ALL ON TABLE public.teacher_documents TO service_role;


--
-- Name: TABLE teachers; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.teachers TO anon;
GRANT ALL ON TABLE public.teachers TO authenticated;
GRANT ALL ON TABLE public.teachers TO service_role;


--
-- Name: TABLE teaching_units; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.teaching_units TO anon;
GRANT ALL ON TABLE public.teaching_units TO authenticated;
GRANT ALL ON TABLE public.teaching_units TO service_role;


--
-- Name: TABLE unites_enseignement; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.unites_enseignement TO anon;
GRANT ALL ON TABLE public.unites_enseignement TO authenticated;
GRANT ALL ON TABLE public.unites_enseignement TO service_role;


--
-- Name: TABLE year_closure; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.year_closure TO anon;
GRANT ALL ON TABLE public.year_closure TO authenticated;
GRANT ALL ON TABLE public.year_closure TO service_role;


--
-- Name: TABLE year_closure_steps; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.year_closure_steps TO anon;
GRANT ALL ON TABLE public.year_closure_steps TO authenticated;
GRANT ALL ON TABLE public.year_closure_steps TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- PostgreSQL database dump complete
--

\unrestrict T0Zn2JeZPjqoRaZqFD1PIpBHocyIDdt5eBj0bvw18kBdpHgybaxaiUCjtocuIsn

