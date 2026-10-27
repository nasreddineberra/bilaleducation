-- ============================================================================
-- CONTROLE 27 — Photos d'eleves : bucket prive, droits de la table `students`
--
-- Cree deux ecoles JETABLES. Dans la premiere : classes A et B, eleve sA en A
-- (photo sous un identifiant PROVISOIRE, comme une photo prise avant la creation
-- de la fiche), eleve sB en B (photo sous son propre identifiant). Objets
-- Storage (lignes seulement, aucun fichier) : les deux photos de la premiere
-- ecole et une photo dans la seconde. L'enseignant n'enseigne que A.
--
-- Chaque role (+ l'editeur rattache, + une direction de la seconde ecole), sous
-- identite reelle, lit, modifie puis cree une photo. Puis un appel anonyme.
-- Format : lit / modifie / cree (premiere ecole) · autre ecole (lecture).
-- Migration : supabase/migrations/secure-student-photos.sql.
-- LECTURE SEULE : exception volontaire finale, tout est annule.
-- ============================================================================
DO $ctl$
DECLARE
  e uuid := gen_random_uuid();
  e2 uuid := gen_random_uuid();
  c_a uuid := gen_random_uuid();
  c_b uuid := gen_random_uuid();
  s_a uuid := gen_random_uuid();
  s_b uuid := gen_random_uuid();
  provisoire uuid := gen_random_uuid();
  t_id uuid := gen_random_uuid();
  photo_a text;
  photo_b text;
  photo_autre text;
  v_role text;
  v_id uuid;
  v_etab uuid;
  i integer := 0;
  n1 integer; n2 integer; n3 integer; autre integer;
  b record;
  ok boolean;
  attendu text;
  obtenu text;
  rapport text := '';
  nb_ko integer := 0;
BEGIN
  SELECT public, file_size_limit, allowed_mime_types INTO b FROM storage.buckets WHERE id = 'student-photos';
  ok := b.public = false AND b.file_size_limit = 512000 AND b.allowed_mime_types = ARRAY['image/jpeg'];
  rapport := rapport || E'\n[' || CASE WHEN ok THEN 'OK' ELSE 'KO' END || '] bucket                   '
    || CASE WHEN b.public THEN 'PUBLIC' ELSE 'prive' END || ' · ' || coalesce(b.file_size_limit::text, 'sans limite')
    || ' · ' || coalesce(array_to_string(b.allowed_mime_types, ','), 'tout type');
  IF NOT ok THEN nb_ko := nb_ko + 1; END IF;

  photo_a     := e  || '/' || provisoire || '.jpg';
  photo_b     := e  || '/' || s_b || '.jpg';
  photo_autre := e2 || '/' || s_a || '.jpg';

  INSERT INTO etablissements (id, slug, nom, is_active) VALUES
    (e,  'ctl-photo-'   || left(e::text, 8),  'CONTROLE PHOTOS', true),
    (e2, 'ctl-photo-b-' || left(e2::text, 8), 'CONTROLE PHOTOS B', true);
  INSERT INTO classes (id, etablissement_id, name, level, academic_year) VALUES
    (c_a, e, 'CTL A', 'CTL', '2026-2027'),
    (c_b, e, 'CTL B', 'CTL', '2026-2027');
  INSERT INTO students (id, etablissement_id, student_number, first_name, last_name, date_of_birth, photo_url) VALUES
    (s_a, e, 'CTL-A-' || left(e::text, 8), 'Eleve', 'CTLA', '2015-01-01', photo_a),
    (s_b, e, 'CTL-B-' || left(e::text, 8), 'Eleve', 'CTLB', '2015-01-01', photo_b);
  INSERT INTO enrollments (student_id, class_id, status) VALUES
    (s_a, c_a, 'active'), (s_b, c_b, 'active');
  INSERT INTO teachers (id, etablissement_id, first_name, last_name, employee_number, email)
  VALUES (t_id, e, 'Controle', 'ENSEIGNANT', 'CTL-' || left(e::text, 8), 'ctl-photo-ens@exemple.invalid');
  INSERT INTO class_teachers (class_id, teacher_id, is_main_teacher) VALUES (c_a, t_id, true);

  INSERT INTO storage.objects (bucket_id, name) VALUES
    ('student-photos', photo_a), ('student-photos', photo_b), ('student-photos', photo_autre);

  FOREACH v_role IN ARRAY ARRAY['admin', 'direction', 'super_admin', 'responsable_pedagogique',
                                'secretaire', 'comptable', 'enseignant', 'parent', 'autre_direction'] LOOP
    i := i + 1;
    v_id := gen_random_uuid();
    v_etab := CASE WHEN v_role = 'autre_direction' THEN e2 ELSE e END;

    INSERT INTO auth.users (id, email, aud, role)
    VALUES (v_id, 'ctl-photo-' || i || '-' || left(e::text, 8) || '@exemple.invalid', 'authenticated', 'authenticated');
    INSERT INTO profiles (id, email, role, first_name, last_name, etablissement_id)
    VALUES (v_id, 'ctl-photo-' || i || '-' || left(e::text, 8) || '@exemple.invalid',
            CASE WHEN v_role = 'autre_direction' THEN 'direction' ELSE v_role END,
            'Controle', upper(v_role), v_etab);
    IF v_role = 'enseignant' THEN
      UPDATE teachers SET user_id = v_id WHERE id = t_id;
    END IF;

    SET LOCAL ROLE authenticated;
    PERFORM set_config('request.jwt.claims',
                       json_build_object('sub', v_id, 'role', 'authenticated')::text, true);

    SELECT count(*) INTO n1 FROM storage.objects WHERE bucket_id = 'student-photos' AND name IN (photo_a, photo_b);
    SELECT count(*) INTO autre FROM storage.objects WHERE bucket_id = 'student-photos' AND name = photo_autre;
    UPDATE storage.objects SET metadata = '{"ctl":1}' WHERE bucket_id = 'student-photos' AND name IN (photo_a, photo_b);
    GET DIAGNOSTICS n2 = ROW_COUNT;
    n3 := 1;
    BEGIN
      INSERT INTO storage.objects (bucket_id, name) VALUES ('student-photos', e || '/' || gen_random_uuid() || '.jpg');
    EXCEPTION WHEN insufficient_privilege THEN n3 := 0; END;

    RESET ROLE;
    PERFORM set_config('request.jwt.claims', NULL, true);

    obtenu := 'lit ' || n1 || ' · modifie ' || n2 || ' · cree ' || n3 || ' · autre ecole ' || autre;
    attendu := CASE
      WHEN v_role IN ('admin', 'direction', 'super_admin', 'responsable_pedagogique', 'secretaire')
        THEN 'lit 2 · modifie 2 · cree 1 · autre ecole 0'
      WHEN v_role = 'comptable'
        THEN 'lit 2 · modifie 0 · cree 0 · autre ecole 0'
      WHEN v_role = 'enseignant'
        THEN 'lit 1 · modifie 0 · cree 0 · autre ecole 0'
      WHEN v_role = 'autre_direction'
        THEN 'lit 0 · modifie 0 · cree 0 · autre ecole 1'
      ELSE   'lit 0 · modifie 0 · cree 0 · autre ecole 0'
    END;

    IF attendu <> obtenu THEN nb_ko := nb_ko + 1; END IF;
    rapport := rapport || E'\n[' || CASE WHEN attendu = obtenu THEN 'OK' ELSE 'KO' END || '] '
      || rpad(v_role, 24) || obtenu
      || CASE WHEN attendu <> obtenu THEN E'\n     attendu                  ' || attendu ELSE '' END;
  END LOOP;

  -- Appel anonyme.
  SET LOCAL ROLE anon;
  BEGIN
    SELECT count(*) INTO n1 FROM storage.objects WHERE bucket_id = 'student-photos';
  EXCEPTION WHEN insufficient_privilege THEN n1 := 0; END;
  RESET ROLE;
  ok := n1 = 0;
  rapport := rapport || E'\n[' || CASE WHEN ok THEN 'OK' ELSE 'KO' END || '] anonyme                  lit ' || n1;
  IF NOT ok THEN nb_ko := nb_ko + 1; END IF;

  RAISE EXCEPTION 'CONTROLE 27 : % KO (tout est annule)%', nb_ko, rapport;
END
$ctl$;
