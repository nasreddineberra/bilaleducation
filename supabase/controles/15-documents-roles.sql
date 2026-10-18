-- ============================================================================
-- CONTROLE 15 — Documents et justificatifs : les droits des tables
--
-- Cree deux ecoles JETABLES. Dans la premiere : classes A et B, eleve sA
-- inscrit en A, eleve sB en B, un adulte inscrit en A ; une absence par eleve
-- et une absence adulte ; un avertissement par eleve et sa piece jointe ; une
-- fiche enseignant. Des objets Storage (lignes seulement, aucun fichier) :
--   student-documents   ecole/sA/..., ecole/sB/...
--   warning-attachments ecole/sA/..., ecole/sB/...
--   teacher-documents   ecole/T/...
--   absence-justificatifs ecole/<absence sA>, ecole/<absence sB>, ecole/<absence adulte>
-- et un document d'eleve dans la SECONDE ecole.
--
-- Chaque role (+ l'editeur rattache, + une direction de la seconde ecole),
-- sous identite reelle, lit, modifie puis cree dans chaque bucket, et lit /
-- cree une piece jointe d'avertissement (table). L'enseignant n'enseigne que A.
-- Aucune suppression : `storage.protect_delete` interdit le DELETE en SQL ;
-- les policies DELETE portent la meme condition que les UPDATE.
--
-- Format par compte : eleve-docs / avert. / enseignant-docs / justificatifs.
-- Migration : supabase/migrations/secure-storage-documents-roles.sql.
-- LECTURE SEULE : exception volontaire finale, tout est annule.
-- ============================================================================
DO $ctl$
DECLARE
  e uuid := gen_random_uuid();
  e2 uuid := gen_random_uuid();
  sy uuid := gen_random_uuid();
  pe uuid := gen_random_uuid();
  c_a uuid := gen_random_uuid();
  c_b uuid := gen_random_uuid();
  s_a uuid := gen_random_uuid();
  s_b uuid := gen_random_uuid();
  par uuid := gen_random_uuid();
  ab_a uuid := gen_random_uuid();
  ab_b uuid := gen_random_uuid();
  ab_ad uuid := gen_random_uuid();
  w_a uuid := gen_random_uuid();
  w_b uuid := gen_random_uuid();
  t_id uuid := gen_random_uuid();
  v_role text;
  v_id uuid;
  v_etab uuid;
  i integer := 0;
  n1 integer; n2 integer; n3 integer; n4 integer; n5 integer;
  lu text; modif text; cree text; table_pj text; autre integer;
  attendu text;
  obtenu text;
  fixes text[];
  rapport text := '';
  nb_ko integer := 0;
BEGIN
  INSERT INTO etablissements (id, slug, nom, is_active) VALUES
    (e,  'ctl-docr-'   || left(e::text, 8),  'CONTROLE DOCUMENTS ROLES', true),
    (e2, 'ctl-docr-b-' || left(e2::text, 8), 'CONTROLE DOCUMENTS ROLES B', true);
  INSERT INTO school_years (id, etablissement_id, label) VALUES (sy, e, 'CTL');
  INSERT INTO periods (id, school_year_id, label, order_index) VALUES (pe, sy, 'CTL', 1);
  INSERT INTO classes (id, etablissement_id, name, level, academic_year) VALUES
    (c_a, e, 'CTL A', 'CTL', '2026-2027'),
    (c_b, e, 'CTL B', 'CTL', '2026-2027');
  INSERT INTO students (id, etablissement_id, student_number, first_name, last_name, date_of_birth) VALUES
    (s_a, e, 'CTL-A-' || left(e::text, 8), 'Eleve', 'CTLA', '2015-01-01'),
    (s_b, e, 'CTL-B-' || left(e::text, 8), 'Eleve', 'CTLB', '2015-01-01');
  INSERT INTO enrollments (student_id, class_id, status) VALUES
    (s_a, c_a, 'active'), (s_b, c_b, 'active');
  INSERT INTO parents (id, etablissement_id, tutor1_last_name, tutor1_first_name, tutor1_email)
  VALUES (par, e, 'CTL' || left(e::text, 8), 'Adulte', 'ctl-docr-' || left(e::text, 8) || '@exemple.invalid');
  INSERT INTO parent_class_enrollments (etablissement_id, parent_id, class_id, tutor_number, status)
  VALUES (e, par, c_a, 1, 'active');
  INSERT INTO absences (id, etablissement_id, student_id, class_id, period_id, absence_date, absence_type) VALUES
    (ab_a, e, s_a, c_a, pe, current_date, 'absence'),
    (ab_b, e, s_b, c_b, pe, current_date, 'absence');
  INSERT INTO adult_absences (id, etablissement_id, parent_id, tutor_number, class_id, period_id, absence_date, absence_type)
  VALUES (ab_ad, e, par, 1, c_a, pe, current_date, 'absence');
  INSERT INTO student_warnings (id, etablissement_id, student_id, class_id, period_id, severity) VALUES
    (w_a, e, s_a, c_a, pe, 'prevention'),
    (w_b, e, s_b, c_b, pe, 'prevention');
  INSERT INTO student_warning_attachments (warning_id, file_url, file_name) VALUES
    (w_a, e || '/' || s_a || '/' || w_a || '/f.pdf', 'f.pdf'),
    (w_b, e || '/' || s_b || '/' || w_b || '/f.pdf', 'f.pdf');
  INSERT INTO teachers (id, etablissement_id, first_name, last_name, employee_number, email)
  VALUES (t_id, e, 'Controle', 'ENSEIGNANT', 'CTL-' || left(e::text, 8), 'ctl-docr-ens@exemple.invalid');
  INSERT INTO class_teachers (class_id, teacher_id, is_main_teacher) VALUES (c_a, t_id, true);

  fixes := ARRAY[
    e  || '/' || s_a || '/identite/f.pdf',
    e  || '/' || s_b || '/identite/f.pdf',
    e2 || '/' || s_a || '/identite/f.pdf',
    e  || '/' || s_a || '/' || w_a || '/f.pdf',
    e  || '/' || s_b || '/' || w_b || '/f.pdf',
    e  || '/' || t_id || '/f.pdf',
    e  || '/' || ab_a  || '.pdf',
    e  || '/' || ab_b  || '.pdf',
    e  || '/' || ab_ad || '.pdf'];
  INSERT INTO storage.objects (bucket_id, name) VALUES
    ('student-documents',     e  || '/' || s_a || '/identite/f.pdf'),
    ('student-documents',     e  || '/' || s_b || '/identite/f.pdf'),
    ('student-documents',     e2 || '/' || s_a || '/identite/f.pdf'),
    ('warning-attachments',   e  || '/' || s_a || '/' || w_a || '/f.pdf'),
    ('warning-attachments',   e  || '/' || s_b || '/' || w_b || '/f.pdf'),
    ('teacher-documents',     e  || '/' || t_id || '/f.pdf'),
    ('absence-justificatifs', e  || '/' || ab_a  || '.pdf'),
    ('absence-justificatifs', e  || '/' || ab_b  || '.pdf'),
    ('absence-justificatifs', e  || '/' || ab_ad || '.pdf');

  FOREACH v_role IN ARRAY ARRAY['admin', 'direction', 'super_admin', 'responsable_pedagogique',
                                'secretaire', 'enseignant', 'comptable', 'parent', 'autre_direction'] LOOP
    i := i + 1;
    v_id := gen_random_uuid();
    v_etab := CASE WHEN v_role = 'autre_direction' THEN e2 ELSE e END;

    INSERT INTO auth.users (id, email, aud, role)
    VALUES (v_id, 'ctl-docr-' || i || '-' || left(e::text, 8) || '@exemple.invalid', 'authenticated', 'authenticated');
    INSERT INTO profiles (id, email, role, first_name, last_name, etablissement_id)
    VALUES (v_id, 'ctl-docr-' || i || '-' || left(e::text, 8) || '@exemple.invalid',
            CASE WHEN v_role = 'autre_direction' THEN 'direction' ELSE v_role END,
            'Controle', upper(v_role), v_etab);
    IF v_role = 'enseignant' THEN
      UPDATE teachers SET user_id = v_id WHERE id = t_id;
    END IF;

    SET LOCAL ROLE authenticated;
    PERFORM set_config('request.jwt.claims',
                       json_build_object('sub', v_id, 'role', 'authenticated')::text, true);

    -- Lecture (premiere ecole), sur les seuls objets poses au depart.
    SELECT count(*) INTO n1 FROM storage.objects WHERE bucket_id = 'student-documents'     AND name LIKE e || '/%' AND name = ANY (fixes);
    SELECT count(*) INTO n2 FROM storage.objects WHERE bucket_id = 'warning-attachments'   AND name LIKE e || '/%' AND name = ANY (fixes);
    SELECT count(*) INTO n3 FROM storage.objects WHERE bucket_id = 'teacher-documents'     AND name LIKE e || '/%' AND name = ANY (fixes);
    SELECT count(*) INTO n4 FROM storage.objects WHERE bucket_id = 'absence-justificatifs' AND name LIKE e || '/%' AND name = ANY (fixes);
    lu := n1 || '/' || n2 || '/' || n3 || '/' || n4;
    SELECT count(*) INTO autre FROM storage.objects WHERE bucket_id = 'student-documents' AND name = ANY (fixes) AND name LIKE e2 || '/%';

    -- Modification (premiere ecole), avant toute creation.
    UPDATE storage.objects SET metadata = '{"ctl":1}' WHERE bucket_id = 'student-documents'     AND name LIKE e || '/%' AND name = ANY (fixes);
    GET DIAGNOSTICS n1 = ROW_COUNT;
    UPDATE storage.objects SET metadata = '{"ctl":1}' WHERE bucket_id = 'warning-attachments'   AND name LIKE e || '/%' AND name = ANY (fixes);
    GET DIAGNOSTICS n2 = ROW_COUNT;
    UPDATE storage.objects SET metadata = '{"ctl":1}' WHERE bucket_id = 'teacher-documents'     AND name LIKE e || '/%' AND name = ANY (fixes);
    GET DIAGNOSTICS n3 = ROW_COUNT;
    UPDATE storage.objects SET metadata = '{"ctl":1}' WHERE bucket_id = 'absence-justificatifs' AND name LIKE e || '/%' AND name = ANY (fixes);
    GET DIAGNOSTICS n4 = ROW_COUNT;
    modif := n1 || '/' || n2 || '/' || n3 || '/' || n4;

    -- Creation (premiere ecole), sur l'eleve sA et l'absence de sA.
    n1 := 1; n2 := 1; n3 := 1; n4 := 1;
    BEGIN
      INSERT INTO storage.objects (bucket_id, name) VALUES ('student-documents', e || '/' || s_a || '/identite/n' || i || '.pdf');
    EXCEPTION WHEN insufficient_privilege THEN n1 := 0; END;
    BEGIN
      INSERT INTO storage.objects (bucket_id, name) VALUES ('warning-attachments', e || '/' || s_a || '/' || w_a || '/n' || i || '.pdf');
    EXCEPTION WHEN insufficient_privilege THEN n2 := 0; END;
    BEGIN
      INSERT INTO storage.objects (bucket_id, name) VALUES ('teacher-documents', e || '/' || t_id || '/n' || i || '.pdf');
    EXCEPTION WHEN insufficient_privilege THEN n3 := 0; END;
    BEGIN
      INSERT INTO storage.objects (bucket_id, name) VALUES ('absence-justificatifs', e || '/' || ab_a || '.p' || i);
    EXCEPTION WHEN insufficient_privilege THEN n4 := 0; END;
    cree := n1 || '/' || n2 || '/' || n3 || '/' || n4;

    -- Table des pieces jointes d'avertissement.
    SELECT count(*) INTO n5 FROM student_warning_attachments WHERE warning_id IN (w_a, w_b) AND file_name = 'f.pdf';
    n1 := 1;
    BEGIN
      INSERT INTO student_warning_attachments (warning_id, file_url, file_name) VALUES (w_a, 'x' || i, 'x');
    EXCEPTION WHEN insufficient_privilege THEN n1 := 0; END;
    table_pj := n5 || '/' || n1;

    RESET ROLE;
    PERFORM set_config('request.jwt.claims', NULL, true);

    obtenu := 'lit ' || lu || ' · modifie ' || modif || ' · cree ' || cree
              || ' · table pj ' || table_pj || ' · autre ecole ' || autre;
    attendu := CASE
      WHEN v_role IN ('admin', 'direction', 'super_admin', 'secretaire')
        THEN 'lit 2/2/1/3 · modifie 2/2/1/3 · cree 1/1/1/1 · table pj 2/1 · autre ecole 0'
      WHEN v_role = 'responsable_pedagogique'
        THEN 'lit 2/2/0/3 · modifie 2/2/0/3 · cree 1/1/0/1 · table pj 2/1 · autre ecole 0'
      WHEN v_role = 'enseignant'
        THEN 'lit 1/1/0/2 · modifie 0/0/0/2 · cree 0/0/0/1 · table pj 1/0 · autre ecole 0'
      WHEN v_role = 'autre_direction'
        THEN 'lit 0/0/0/0 · modifie 0/0/0/0 · cree 0/0/0/0 · table pj 0/0 · autre ecole 1'
      ELSE   'lit 0/0/0/0 · modifie 0/0/0/0 · cree 0/0/0/0 · table pj 0/0 · autre ecole 0'
    END;

    IF attendu <> obtenu THEN nb_ko := nb_ko + 1; END IF;
    rapport := rapport || E'\n[' || CASE WHEN attendu = obtenu THEN 'OK' ELSE 'KO' END || '] '
      || rpad(v_role, 24) || obtenu
      || CASE WHEN attendu <> obtenu THEN E'\n     attendu                  ' || attendu ELSE '' END;
  END LOOP;

  RAISE EXCEPTION 'CONTROLE 15 : % KO (tout est annule)%', nb_ko, rapport;
END
$ctl$;
