-- ============================================================================
-- CONTROLE 13 — Ordre des gabarits : cloisonne par ecole et par classe
--
-- Cree deux ecoles JETABLES : la premiere a deux classes (A, B), la seconde une
-- (C). Un compte par role dans la premiere (+ l'editeur rattache), l'enseignant
-- n'enseignant QUE la classe A, plus une direction de la seconde ecole.
-- Pour chaque compte, une periode neuve et une ligne d'ordre par classe ; sous
-- identite reelle (`SET LOCAL ROLE authenticated`), il lit, cree une ligne sur
-- A, puis modifie les lignes de A, B et C.
--   admin, direction, super_admin, resp. pedago, secretaire : A et B, pas C ;
--   enseignant : A seulement ;
--   comptable, parent : rien ;
--   direction de l'autre ecole : C seulement.
--
-- Migration : supabase/migrations/fix-evaluation-order-config-rls.sql.
-- LECTURE SEULE : exception volontaire finale, tout est annule.
-- ============================================================================
DO $ctl$
DECLARE
  e uuid := gen_random_uuid();
  e_autre uuid := gen_random_uuid();
  c_a uuid := gen_random_uuid();
  c_b uuid := gen_random_uuid();
  c_c uuid := gen_random_uuid();
  v_role text;
  v_etab uuid;
  v_id uuid;
  v_p uuid;
  n_lu integer;
  n_cree integer;
  n_a integer;
  n_b integer;
  n_c integer;
  attendu text;
  obtenu text;
  rapport text := '';
  nb_ko integer := 0;
  i integer := 0;
BEGIN
  INSERT INTO etablissements (id, slug, nom, is_active) VALUES
    (e,       'ctl-ordre-'   || left(e::text, 8),       'CONTROLE ORDRE', true),
    (e_autre, 'ctl-ordre-a-' || left(e_autre::text, 8), 'CONTROLE ORDRE AUTRE', true);
  INSERT INTO classes (id, etablissement_id, name, level, academic_year) VALUES
    (c_a, e,       'CTL A', 'CTL', '2026-2027'),
    (c_b, e,       'CTL B', 'CTL', '2026-2027'),
    (c_c, e_autre, 'CTL C', 'CTL', '2026-2027');

  FOREACH v_role IN ARRAY ARRAY['admin', 'direction', 'super_admin', 'responsable_pedagogique',
                                'secretaire', 'enseignant', 'comptable', 'parent', 'autre_direction'] LOOP
    i := i + 1;
    v_id := gen_random_uuid();
    v_p := gen_random_uuid();
    v_etab := CASE WHEN v_role = 'autre_direction' THEN e_autre ELSE e END;

    INSERT INTO auth.users (id, email, aud, role)
    VALUES (v_id, 'ctl-ordre-' || i || '-' || left(e::text, 8) || '@exemple.invalid', 'authenticated', 'authenticated');
    INSERT INTO profiles (id, email, role, first_name, last_name, etablissement_id)
    VALUES (v_id, 'ctl-ordre-' || i || '-' || left(e::text, 8) || '@exemple.invalid',
            CASE WHEN v_role = 'autre_direction' THEN 'direction' ELSE v_role END,
            'Controle', upper(v_role), v_etab);

    IF v_role = 'enseignant' THEN
      WITH t AS (
        INSERT INTO teachers (etablissement_id, first_name, last_name, employee_number, email, user_id)
        VALUES (e, 'Controle', 'ENSEIGNANT', 'CTL-' || left(e::text, 8), 'ctl-ordre-ens@exemple.invalid', v_id)
        RETURNING id
      )
      INSERT INTO class_teachers (class_id, teacher_id, is_main_teacher)
      SELECT c_a, t.id, true FROM t;
    END IF;

    -- Une ligne d'ordre par classe pour la periode de ce compte (cle : classe + periode).
    INSERT INTO evaluation_order_config (class_id, period_id) VALUES (c_b, v_p), (c_c, v_p);

    SET LOCAL ROLE authenticated;
    PERFORM set_config('request.jwt.claims',
                       json_build_object('sub', v_id, 'role', 'authenticated')::text, true);

    BEGIN
      INSERT INTO evaluation_order_config (class_id, period_id, ue_order) VALUES (c_a, v_p, '{x}');
      n_cree := 1;
    EXCEPTION WHEN insufficient_privilege THEN
      n_cree := 0;
    END;

    SELECT count(*) INTO n_lu FROM evaluation_order_config WHERE period_id = v_p;
    UPDATE evaluation_order_config SET ue_order = '{y}' WHERE class_id = c_a AND period_id = v_p;
    GET DIAGNOSTICS n_a = ROW_COUNT;
    UPDATE evaluation_order_config SET ue_order = '{y}' WHERE class_id = c_b AND period_id = v_p;
    GET DIAGNOSTICS n_b = ROW_COUNT;
    UPDATE evaluation_order_config SET ue_order = '{y}' WHERE class_id = c_c AND period_id = v_p;
    GET DIAGNOSTICS n_c = ROW_COUNT;

    RESET ROLE;
    PERFORM set_config('request.jwt.claims', NULL, true);

    -- lit = lignes visibles parmi A (si creee), B, C.
    attendu := CASE
      WHEN v_role IN ('comptable', 'parent')  THEN 'lit 0 · cree 0 · modifie A0 B0 C0'
      WHEN v_role = 'enseignant'              THEN 'lit 1 · cree 1 · modifie A1 B0 C0'
      WHEN v_role = 'autre_direction'         THEN 'lit 1 · cree 0 · modifie A0 B0 C1'
      ELSE                                         'lit 2 · cree 1 · modifie A1 B1 C0'
    END;
    obtenu := 'lit ' || n_lu || ' · cree ' || n_cree
              || ' · modifie A' || n_a || ' B' || n_b || ' C' || n_c;

    IF attendu <> obtenu THEN nb_ko := nb_ko + 1; END IF;
    rapport := rapport || E'\n[' || CASE WHEN attendu = obtenu THEN 'OK' ELSE 'KO' END || '] '
      || rpad(v_role, 24) || obtenu || CASE WHEN attendu <> obtenu THEN '   (attendu ' || attendu || ')' ELSE '' END;
  END LOOP;

  RAISE EXCEPTION 'CONTROLE 13 : % KO (tout est annule)%', nb_ko, rapport;
END
$ctl$;
