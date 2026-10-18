-- ============================================================================
-- CONTROLE 16 — Abonnement expire : la base coupe aussi
--
-- Cree quatre ecoles JETABLES :
--   hier    : echeance HIER (jour de Paris)     -> coupee
--   jour    : echeance AUJOURD'HUI              -> ouverte (jour inclus)
--   actif   : sans echeance                     -> ouverte
--   inactif : is_active = false                 -> coupee
-- Chacune : une classe, un eleve inscrit, un enseignant (compte) titulaire,
-- un devoir et une seance de cahier de texte. Comptes : direction et
-- enseignant partout ; dans « hier », aussi secretaire, comptable et
-- l'editeur rattache (super_admin), qui garde l'acces.
--
-- Chaque compte, sous identite reelle, lit eleves / classes / devoirs /
-- seances / sa fiche d'ecole, et tente de modifier l'eleve.
-- Format : lit eleves/classes/devoirs/seances/ecole · ecrit N.
--
-- RPC, sous la direction de « actif » :
--   get_verified_totp_user_ids ne rend que des comptes de SON ecole ;
--   set_teacher_profile_active ne desactive pas l'enseignant d'une AUTRE ecole.
--
-- Migration : supabase/migrations/abonnement-expire-coupe-la-base.sql.
-- LECTURE SEULE : exception volontaire finale, tout est annule.
-- ============================================================================
DO $ctl$
DECLARE
  jour_paris date := (now() AT TIME ZONE 'Europe/Paris')::date;
  ecoles text[] := ARRAY['hier', 'jour', 'actif', 'inactif'];
  v_code text;
  v_role text;
  v_e uuid; v_c uuid; v_s uuid; v_t uuid; v_u uuid;
  etab jsonb := '{}';     -- code -> etablissement_id
  ens  jsonb := '{}';     -- code -> profil de l'enseignant
  comptes jsonb := '[]';  -- [{code, role, id}]
  r jsonb;
  ouverte boolean;
  n1 integer; n2 integer; n3 integer; n4 integer; n5 integer; n6 integer;
  attendu text;
  obtenu text;
  rapport text := '';
  nb_ko integer := 0;
  i integer := 0;
BEGIN
  -- ── Ecoles et donnees ────────────────────────────────────────────────────
  FOREACH v_code IN ARRAY ecoles LOOP
    v_e := gen_random_uuid(); v_c := gen_random_uuid(); v_s := gen_random_uuid(); v_t := gen_random_uuid();
    INSERT INTO etablissements (id, slug, nom, is_active, subscription_expires_at)
    VALUES (v_e, 'ctl-abo-' || v_code || '-' || left(v_e::text, 8), 'CONTROLE ABO ' || upper(v_code),
            v_code <> 'inactif',
            -- Comme la console : une date seule, rangee a minuit UTC.
            CASE v_code WHEN 'hier' THEN (jour_paris - 1)::timestamp AT TIME ZONE 'UTC'
                        WHEN 'jour' THEN jour_paris::timestamp AT TIME ZONE 'UTC'
                        ELSE NULL END);
    etab := etab || jsonb_build_object(v_code, v_e);

    INSERT INTO classes (id, etablissement_id, name, level, academic_year)
    VALUES (v_c, v_e, 'CTL', 'CTL', '2026-2027');
    INSERT INTO students (id, etablissement_id, student_number, first_name, last_name, date_of_birth)
    VALUES (v_s, v_e, 'CTL-' || left(v_e::text, 8), 'Eleve', 'CTL' || upper(v_code), '2015-01-01');
    INSERT INTO enrollments (student_id, class_id, status) VALUES (v_s, v_c, 'active');

    -- Comptes de l'ecole.
    FOREACH v_role IN ARRAY CASE WHEN v_code = 'hier'
        THEN ARRAY['direction', 'enseignant', 'secretaire', 'comptable', 'super_admin']
        ELSE ARRAY['direction', 'enseignant'] END LOOP
      i := i + 1;
      v_u := gen_random_uuid();
      INSERT INTO auth.users (id, email, aud, role)
      VALUES (v_u, 'ctl-abo-' || i || '-' || left(v_e::text, 8) || '@exemple.invalid', 'authenticated', 'authenticated');
      INSERT INTO profiles (id, email, role, first_name, last_name, etablissement_id)
      VALUES (v_u, 'ctl-abo-' || i || '-' || left(v_e::text, 8) || '@exemple.invalid', v_role,
              'Controle', upper(v_role), v_e);
      comptes := comptes || jsonb_build_object('code', v_code, 'role', v_role, 'id', v_u);
      IF v_role = 'enseignant' THEN
        INSERT INTO teachers (id, etablissement_id, first_name, last_name, employee_number, email, user_id)
        VALUES (v_t, v_e, 'Controle', 'ENS' || upper(v_code), 'CTL-' || left(v_e::text, 8),
                'ctl-abo-ens-' || left(v_e::text, 8) || '@exemple.invalid', v_u);
        INSERT INTO class_teachers (class_id, teacher_id, is_main_teacher) VALUES (v_c, v_t, true);
        ens := ens || jsonb_build_object(v_code, v_u);
      END IF;
    END LOOP;

    INSERT INTO homework (etablissement_id, class_id, teacher_id, subject, title, homework_type, due_date)
    VALUES (v_e, v_c, v_t, 'General', 'CTL', 'exercice', jour_paris + 7);
    INSERT INTO class_journal (etablissement_id, class_id, teacher_id, session_date, title)
    VALUES (v_e, v_c, v_t, jour_paris, 'CTL');
  END LOOP;

  -- ── Chaque compte ────────────────────────────────────────────────────────
  FOR r IN SELECT * FROM jsonb_array_elements(comptes) LOOP
    v_code := r->>'code';
    v_role := r->>'role';
    v_e := (etab->>v_code)::uuid;

    SET LOCAL ROLE authenticated;
    PERFORM set_config('request.jwt.claims',
                       json_build_object('sub', r->>'id', 'role', 'authenticated')::text, true);

    SELECT count(*) INTO n1 FROM students       WHERE etablissement_id = v_e;
    SELECT count(*) INTO n2 FROM classes        WHERE etablissement_id = v_e;
    SELECT count(*) INTO n3 FROM homework       WHERE etablissement_id = v_e;
    SELECT count(*) INTO n4 FROM class_journal  WHERE etablissement_id = v_e;
    SELECT count(*) INTO n5 FROM etablissements WHERE id = v_e;
    UPDATE students SET first_name = first_name WHERE etablissement_id = v_e;
    GET DIAGNOSTICS n6 = ROW_COUNT;

    RESET ROLE;
    PERFORM set_config('request.jwt.claims', NULL, true);

    obtenu := 'lit ' || n1 || '/' || n2 || '/' || n3 || '/' || n4 || '/' || n5 || ' · ecrit ' || n6;
    ouverte := v_code IN ('jour', 'actif') OR v_role = 'super_admin';
    attendu := CASE
      WHEN NOT ouverte                                THEN 'lit 0/0/0/0/0 · ecrit 0'
      WHEN v_role IN ('direction', 'super_admin')     THEN 'lit 1/1/1/1/1 · ecrit 1'
      WHEN v_role = 'enseignant'                      THEN 'lit 1/1/1/1/1 · ecrit 0'
    END;

    IF attendu IS DISTINCT FROM obtenu THEN nb_ko := nb_ko + 1; END IF;
    rapport := rapport || E'\n[' || CASE WHEN attendu = obtenu THEN 'OK' ELSE 'KO' END || '] '
      || rpad(v_code || ' · ' || v_role, 24) || obtenu
      || CASE WHEN attendu IS DISTINCT FROM obtenu THEN '   (attendu ' || coalesce(attendu, '?') || ')' ELSE '' END;
  END LOOP;

  -- ── RPC, sous la direction de « actif » ──────────────────────────────────
  INSERT INTO auth.mfa_factors (id, user_id, factor_type, status, created_at, updated_at)
  SELECT gen_random_uuid(), (c->>'id')::uuid, 'totp', 'verified', now(), now()
    FROM jsonb_array_elements(comptes) c
   WHERE c->>'role' = 'enseignant' AND c->>'code' IN ('actif', 'jour');

  SELECT (c->>'id')::uuid INTO v_u FROM jsonb_array_elements(comptes) c
   WHERE c->>'code' = 'actif' AND c->>'role' = 'direction';
  -- Lu AVANT de changer d'identite : sous la RLS de la direction de « actif »,
  -- l'enseignant de « jour » est invisible et la RPC recevrait NULL.
  SELECT t.id INTO v_t FROM teachers t WHERE t.user_id = (ens->>'jour')::uuid;

  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_u, 'role', 'authenticated')::text, true);
  SELECT count(*) FILTER (WHERE g.user_id = (ens->>'actif')::uuid),
         count(*) FILTER (WHERE g.user_id = (ens->>'jour')::uuid)
    INTO n1, n2
    FROM get_verified_totp_user_ids() g;
  PERFORM set_teacher_profile_active(v_t, false);
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', NULL, true);
  SELECT count(*) INTO n3 FROM profiles WHERE id = (ens->>'jour')::uuid AND is_active;

  rapport := rapport || E'\n[' || CASE WHEN n1 = 1 AND n2 = 0 THEN 'OK' ELSE 'KO' END
    || '] 2FA : son ecole ' || n1 || ' (attendu 1), autre ecole ' || n2 || ' (attendu 0)';
  IF NOT (n1 = 1 AND n2 = 0) THEN nb_ko := nb_ko + 1; END IF;
  rapport := rapport || E'\n[' || CASE WHEN n3 = 1 THEN 'OK' ELSE 'KO' END
    || '] desactiver l''enseignant d''une autre ecole : ' || CASE WHEN n3 = 1 THEN 'refuse' ELSE 'EFFECTUE' END;
  IF n3 <> 1 THEN nb_ko := nb_ko + 1; END IF;

  RAISE EXCEPTION 'CONTROLE 16 : % KO (tout est annule)%', nb_ko, rapport;
END
$ctl$;
