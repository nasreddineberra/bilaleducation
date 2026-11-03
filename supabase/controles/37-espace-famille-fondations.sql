-- ============================================================================
-- CONTROLE 37 — Espace famille, fondations (03/11)
--
-- Deux ecoles JETABLES : E1 avec l'option espace famille, E2 sans.
--   F1 (E1) : tuteur 1 = P1A, tuteur 2 = P1B (inscrit au cours adulte CA),
--             enfant S1 en classe C1 (et une ancienne classe COLD, annee passee)
--   F2 (E1) : tuteur 1 = P2, enfant S2 en classe C2
--   F3 (E2) : tuteur 1 = P3, enfant S3 en classe C3
--   DIR : direction de E1.
-- Verifie :
--   - foyer_du_compte / tuteur_du_compte : le bon foyer, NULL hors parent,
--     hors option, apres coupure de l'option, apres expiration de l'ecole ;
--   - devoirs : classes de ses enfants (annee en cours) et SON cours adulte ;
--   - seances du cahier de texte : jamais pour un parent ;
--   - notifications : celles de son foyer ;
--   - devoir fait (enfant / adulte) : son enfant, sa classe, son numero ;
--   - un compte tuteur d'un seul foyer, jamais deux fois sur une fiche ;
--   - anon n'execute aucune des nouvelles fonctions ;
--   - le releve mensuel fige l'option et son tarif.
-- Migration : supabase/migrations/espace-famille-fondations.sql.
-- LECTURE SEULE : exception volontaire finale, tout est annule.
-- ============================================================================

CREATE OR REPLACE FUNCTION pg_temp.ctl37(p_compte uuid, p_sql text)
RETURNS text
LANGUAGE plpgsql
AS $f$
DECLARE
  v text;
BEGIN
  BEGIN
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', p_compte, 'role', 'authenticated')::text, true);
    -- Un INSERT sans RETURNING ne rend rien : pas de INTO (sinon 42601).
    IF p_sql ~* '^\s*INSERT' THEN
      EXECUTE p_sql;
    ELSE
      EXECUTE p_sql INTO v;
    END IF;
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', NULL, true);
    RETURN 'ok' || coalesce(':' || nullif(v, ''), '');
  EXCEPTION
    WHEN insufficient_privilege THEN
      RESET ROLE;
      RETURN 'droits';
    WHEN others THEN
      RESET ROLE;
      RETURN SQLERRM;
  END;
END
$f$;

-- Ecriture directe (proprietaire) dont on attend le refus d'un declencheur ou d'un index.
CREATE OR REPLACE FUNCTION pg_temp.ctl37_refus(p_sql text)
RETURNS text
LANGUAGE plpgsql
AS $f$
BEGIN
  BEGIN
    EXECUTE p_sql;
    RETURN 'accepte';
  EXCEPTION
    WHEN unique_violation THEN RETURN 'refuse';
    WHEN others THEN RETURN SQLERRM;
  END;
END
$f$;

DO $ctl$
DECLARE
  e1 uuid := gen_random_uuid();  e2 uuid := gen_random_uuid();
  y1 uuid := gen_random_uuid();  y2 uuid := gen_random_uuid();
  c1 uuid := gen_random_uuid();  c2 uuid := gen_random_uuid();
  ca uuid := gen_random_uuid();  cold uuid := gen_random_uuid();
  c3 uuid := gen_random_uuid();
  t1 uuid := gen_random_uuid();  t2 uuid := gen_random_uuid();
  f1 uuid := gen_random_uuid();  f2 uuid := gen_random_uuid();
  f3 uuid := gen_random_uuid();
  s1 uuid := gen_random_uuid();  s2 uuid := gen_random_uuid();
  s3 uuid := gen_random_uuid();
  h1 uuid := gen_random_uuid();  h2 uuid := gen_random_uuid();
  ha uuid := gen_random_uuid();  hold uuid := gen_random_uuid();
  h3 uuid := gen_random_uuid();
  p1a uuid := gen_random_uuid(); p1b uuid := gen_random_uuid();
  p2  uuid := gen_random_uuid(); p3  uuid := gen_random_uuid();
  dir uuid := gen_random_uuid();
  suffixe text := left(e1::text, 8);
  foyer text;
  devoirs text := 'SELECT string_agg(title, '','' ORDER BY title) FROM homework';
  r text;
  i integer;
  rapport text := '';
  nb_ko integer := 0;
  attendus constant integer := 33;
  essais text[][] := '{}';
BEGIN
  foyer := format('SELECT CASE foyer_du_compte() WHEN %L THEN ''F1'' WHEN %L THEN ''F2'' WHEN %L THEN ''F3'' END', f1, f2, f3);

  -- ── Donnees ───────────────────────────────────────────────────────────────
  INSERT INTO etablissements (id, slug, nom, is_active) VALUES
    (e1, 'ctl-famille-1-' || suffixe, 'CONTROLE FAMILLE 1', true),
    (e2, 'ctl-famille-2-' || suffixe, 'CONTROLE FAMILLE 2', true);
  INSERT INTO school_years (id, etablissement_id, label, is_current, start_date, end_date) VALUES
    (y1, e1, 'CTL-37', true, '2026-09-01', '2027-06-30'),
    (y2, e2, 'CTL-37', true, '2026-09-01', '2027-06-30');
  INSERT INTO classes (id, etablissement_id, name, level, academic_year) VALUES
    (c1, e1, 'CE1', 'CTL', 'CTL-37'), (c2, e1, 'CE2', 'CTL', 'CTL-37'),
    (ca, e1, 'ADULTES', 'CTL', 'CTL-37'), (cold, e1, 'CP', 'CTL', 'CTL-36'),
    (c3, e2, 'CE1', 'CTL', 'CTL-37');
  INSERT INTO teachers (id, etablissement_id, first_name, last_name, employee_number, email) VALUES
    (t1, e1, 'Prof', 'CTL37', 'CTL37-1-' || suffixe, 'ctl37-t1-' || suffixe || '@exemple.invalid'),
    (t2, e2, 'Prof', 'CTL37', 'CTL37-2-' || suffixe, 'ctl37-t2-' || suffixe || '@exemple.invalid');

  FOR i IN 1 .. 5 LOOP
    INSERT INTO auth.users (id, email, aud, role)
    VALUES ((ARRAY[p1a, p1b, p2, p3, dir])[i], 'ctl37-' || i || '-' || suffixe || '@exemple.invalid', 'authenticated', 'authenticated');
    INSERT INTO profiles (id, email, role, first_name, last_name, etablissement_id, is_active)
    VALUES ((ARRAY[p1a, p1b, p2, p3, dir])[i], 'ctl37-' || i || '-' || suffixe || '@exemple.invalid',
            CASE i WHEN 5 THEN 'direction' ELSE 'parent' END, 'Compte' || i, 'CTL37',
            CASE i WHEN 4 THEN e2 ELSE e1 END, true);
  END LOOP;

  INSERT INTO parents (id, etablissement_id, tutor1_last_name, tutor1_first_name, tutor1_relationship, tutor1_email,
                       tutor2_last_name, tutor2_first_name, tutor2_relationship, tutor2_email, tutor2_adult_courses,
                       tutor1_user_id, tutor2_user_id) VALUES
    (f1, e1, 'UN', 'Ctl', 'père', 'f1@exemple.invalid', 'UN', 'Ctlbis', 'mère', 'f1b@exemple.invalid', true, p1a, p1b),
    (f2, e1, 'DEUX', 'Ctl', 'père', 'f2@exemple.invalid', NULL, NULL, NULL, NULL, false, p2, NULL),
    (f3, e2, 'TROIS', 'Ctl', 'père', 'f3@exemple.invalid', NULL, NULL, NULL, NULL, false, p3, NULL);

  INSERT INTO students (id, etablissement_id, student_number, first_name, last_name, date_of_birth, is_active, parent_id) VALUES
    (s1, e1, 'CTL37-S1-' || suffixe, 'Enfant', 'UN', '2018-01-01', true, f1),
    (s2, e1, 'CTL37-S2-' || suffixe, 'Enfant', 'DEUX', '2018-01-01', true, f2),
    (s3, e2, 'CTL37-S3-' || suffixe, 'Enfant', 'TROIS', '2018-01-01', true, f3);
  INSERT INTO enrollments (student_id, class_id, status) VALUES
    (s1, c1, 'active'), (s1, cold, 'active'), (s2, c2, 'active'), (s3, c3, 'active');
  INSERT INTO parent_class_enrollments (etablissement_id, parent_id, class_id, tutor_number, status)
  VALUES (e1, f1, ca, 2, 'active');

  INSERT INTO homework (id, etablissement_id, class_id, teacher_id, subject, title, homework_type, due_date) VALUES
    (h1, e1, c1, t1, 'Général', 'H1', 'exercice', '2027-01-15'),
    (h2, e1, c2, t1, 'Général', 'H2', 'exercice', '2027-01-15'),
    (ha, e1, ca, t1, 'Général', 'HA', 'exercice', '2027-01-15'),
    (hold, e1, cold, t1, 'Général', 'HOLD', 'exercice', '2099-01-15'),
    (h3, e2, c3, t2, 'Général', 'H3', 'exercice', '2027-01-15');
  INSERT INTO class_journal (etablissement_id, class_id, teacher_id, session_date, title)
  VALUES (e1, c1, t1, '2026-11-02', 'Seance interne');
  INSERT INTO notifications (etablissement_id, type, parent_id, title, body) VALUES
    (e1, 'homework', f1, 'N1', 'corps'), (e1, 'homework', f2, 'N2', 'corps'), (e2, 'homework', f3, 'N3', 'corps');

  -- ── Option : ouverte sur E1 seulement ─────────────────────────────────────
  BEGIN
    EXECUTE format('UPDATE etablissements SET option_espace_famille = true WHERE id = %L', e1);
    r := 'ok';
  EXCEPTION WHEN others THEN r := SQLERRM;
  END;
  essais := essais || ARRAY[['option ouverte sur E1', 'ok', r]];

  -- ── Foyer et numero de tuteur ─────────────────────────────────────────────
  essais := essais || ARRAY[['foyer : P1A tuteur 1 de F1', 'ok:F1', pg_temp.ctl37(p1a, foyer)]];
  essais := essais || ARRAY[['foyer : P1B tuteur 2 de F1', 'ok:F1', pg_temp.ctl37(p1b, foyer)]];
  essais := essais || ARRAY[['foyer : P2 de F2', 'ok:F2', pg_temp.ctl37(p2, foyer)]];
  essais := essais || ARRAY[['foyer : P3, ecole sans option', 'ok', pg_temp.ctl37(p3, foyer)]];
  essais := essais || ARRAY[['foyer : direction', 'ok', pg_temp.ctl37(dir, foyer)]];
  essais := essais || ARRAY[['tuteur : P1A', 'ok:1', pg_temp.ctl37(p1a, 'SELECT tuteur_du_compte()::text')]];
  essais := essais || ARRAY[['tuteur : P1B', 'ok:2', pg_temp.ctl37(p1b, 'SELECT tuteur_du_compte()::text')]];

  -- ── Devoirs, seances, notifications ───────────────────────────────────────
  essais := essais || ARRAY[['devoirs : P1A (enfant, annee en cours)', 'ok:H1', pg_temp.ctl37(p1a, devoirs)]];
  essais := essais || ARRAY[['devoirs : P1B (enfant + cours adulte)', 'ok:H1,HA', pg_temp.ctl37(p1b, devoirs)]];
  essais := essais || ARRAY[['devoirs : P2', 'ok:H2', pg_temp.ctl37(p2, devoirs)]];
  essais := essais || ARRAY[['devoirs : P3 sans option', 'ok', pg_temp.ctl37(p3, devoirs)]];
  essais := essais || ARRAY[['seances internes : P1A', 'ok:0', pg_temp.ctl37(p1a, 'SELECT count(*)::text FROM class_journal')]];
  essais := essais || ARRAY[['notifications : P1A', 'ok:N1', pg_temp.ctl37(p1a, 'SELECT string_agg(title, '','') FROM notifications')]];
  essais := essais || ARRAY[['notifications : P3 sans option', 'ok', pg_temp.ctl37(p3, 'SELECT string_agg(title, '','') FROM notifications')]];

  -- ── Devoir fait (enfant) ──────────────────────────────────────────────────
  essais := essais || ARRAY[['fait : P1A, son enfant, sa classe', 'ok',
    pg_temp.ctl37(p1a, format('INSERT INTO homework_status (homework_id, student_id, parent_id, is_done) VALUES (%L, %L, %L, true)', h1, s1, f1))]];
  essais := essais || ARRAY[['fait : P1A pour l''enfant de F2', 'droits',
    pg_temp.ctl37(p1a, format('INSERT INTO homework_status (homework_id, student_id, parent_id, is_done) VALUES (%L, %L, %L, true)', h2, s2, f2))]];
  essais := essais || ARRAY[['fait : P1A, devoir d''une autre classe', 'droits',
    pg_temp.ctl37(p1a, format('INSERT INTO homework_status (homework_id, student_id, parent_id, is_done) VALUES (%L, %L, %L, true)', h2, s1, f1))]];
  essais := essais || ARRAY[['fait : P1A, ancienne classe', 'droits',
    pg_temp.ctl37(p1a, format('INSERT INTO homework_status (homework_id, student_id, parent_id, is_done) VALUES (%L, %L, %L, true)', hold, s1, f1))]];
  essais := essais || ARRAY[['fait : P1B lit le statut du foyer', 'ok:1',
    pg_temp.ctl37(p1b, 'SELECT count(*)::text FROM homework_status')]];
  essais := essais || ARRAY[['fait : P2 ne lit pas F1', 'ok:0',
    pg_temp.ctl37(p2, 'SELECT count(*)::text FROM homework_status')]];
  essais := essais || ARRAY[['fait : P2 ne modifie pas F1', 'ok:0',
    pg_temp.ctl37(p2, format('WITH u AS (UPDATE homework_status SET is_done = false WHERE homework_id = %L RETURNING 1) SELECT count(*)::text FROM u', h1))]];

  -- ── Devoir fait (cours adulte) ────────────────────────────────────────────
  essais := essais || ARRAY[['adulte : P1B, son cours', 'ok',
    pg_temp.ctl37(p1b, format('INSERT INTO adult_homework_status (homework_id, parent_id, tutor_number, is_done) VALUES (%L, %L, 2, true)', ha, f1))]];
  essais := essais || ARRAY[['adulte : P1A sous le numero 2', 'droits',
    pg_temp.ctl37(p1a, format('INSERT INTO adult_homework_status (homework_id, parent_id, tutor_number, is_done) VALUES (%L, %L, 2, true)', ha, f1))]];
  essais := essais || ARRAY[['adulte : P1A, cours non suivi', 'droits',
    pg_temp.ctl37(p1a, format('INSERT INTO adult_homework_status (homework_id, parent_id, tutor_number, is_done) VALUES (%L, %L, 1, true)', ha, f1))]];

  -- ── Option coupee, ecole expiree ──────────────────────────────────────────
  BEGIN
    EXECUTE format('UPDATE etablissements SET option_espace_famille = false WHERE id = %L', e1);
  EXCEPTION WHEN others THEN NULL;
  END;
  essais := essais || ARRAY[['option coupee : foyer P1A', 'ok', pg_temp.ctl37(p1a, foyer)]];
  essais := essais || ARRAY[['option coupee : devoirs P1B', 'ok', pg_temp.ctl37(p1b, devoirs)]];
  BEGIN
    EXECUTE format('UPDATE etablissements SET option_espace_famille = true WHERE id = %L', e1);
  EXCEPTION WHEN others THEN NULL;
  END;
  UPDATE etablissements SET subscription_expires_at = now() - interval '3 days' WHERE id = e1;
  essais := essais || ARRAY[['ecole expiree : foyer P1A', 'ok', pg_temp.ctl37(p1a, foyer)]];
  UPDATE etablissements SET subscription_expires_at = NULL WHERE id = e1;

  -- ── Un compte = un tuteur d'un seul foyer ─────────────────────────────────
  essais := essais || ARRAY[['compte tuteur 1 de deux foyers', 'refuse',
    pg_temp.ctl37_refus(format('UPDATE parents SET tutor1_user_id = %L WHERE id = %L', p1a, f2))]];
  essais := essais || ARRAY[['compte tuteur 1 ici, tuteur 2 ailleurs', 'refuse',
    pg_temp.ctl37_refus(format('UPDATE parents SET tutor2_user_id = %L WHERE id = %L', p2, f1))]];
  essais := essais || ARRAY[['compte deux fois sur une fiche', 'refuse',
    pg_temp.ctl37_refus(format('UPDATE parents SET tutor2_user_id = %L WHERE id = %L', p2, f2))]];

  -- ── anon ──────────────────────────────────────────────────────────────────
  BEGIN
    r := CASE WHEN has_function_privilege('anon', 'public.foyer_du_compte()', 'EXECUTE')
                OR has_function_privilege('anon', 'public.tuteur_du_compte()', 'EXECUTE')
                OR has_function_privilege('anon', 'public.classes_du_compte()', 'EXECUTE')
              THEN 'permises' ELSE 'refusees' END;
  EXCEPTION WHEN others THEN r := SQLERRM;
  END;
  essais := essais || ARRAY[['anon : nouvelles fonctions', 'refusees', r]];

  -- ── Releve mensuel ────────────────────────────────────────────────────────
  BEGIN
    EXECUTE format('INSERT INTO etablissement_facturation (etablissement_id, prix_inscrit, forfait, famille_prix_inscrit, famille_forfait) VALUES (%L, 2, 50, 1, 10)', e1);
    PERFORM fn_releve_facturation();
    EXECUTE format('SELECT option_espace_famille::text || ''/'' || famille_forfait || ''/'' || famille_prix_inscrit FROM releves_facturation WHERE etablissement_id = %L', e1) INTO r;
  EXCEPTION WHEN others THEN r := SQLERRM;
  END;
  essais := essais || ARRAY[['releve : option et tarif figes', 'true/10/1', r]];

  -- ── Rapport ───────────────────────────────────────────────────────────────
  FOR i IN 1 .. array_length(essais, 1) LOOP
    IF essais[i][2] IS DISTINCT FROM essais[i][3] THEN nb_ko := nb_ko + 1; END IF;
    rapport := rapport || E'\n[' || CASE WHEN essais[i][2] IS NOT DISTINCT FROM essais[i][3] THEN 'OK' ELSE 'KO' END || '] '
      || rpad(essais[i][1], 42) || coalesce(essais[i][3], '(null)')
      || CASE WHEN essais[i][2] IS DISTINCT FROM essais[i][3] THEN E'\n     attendu' || repeat(' ', 38) || essais[i][2] ELSE '' END;
  END LOOP;
  IF array_length(essais, 1) IS DISTINCT FROM attendus THEN
    nb_ko := nb_ko + 1;
    rapport := rapport || E'\n[KO] ' || coalesce(array_length(essais, 1), 0) || ' essais menes, ' || attendus || ' attendus';
  END IF;

  RAISE EXCEPTION 'CONTROLE 37 : % KO (tout est annule)%', nb_ko, rapport;
END
$ctl$;
