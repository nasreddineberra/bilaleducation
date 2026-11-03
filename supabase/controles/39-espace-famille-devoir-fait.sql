-- ============================================================================
-- CONTROLE 39 — Espace famille, devoir fait (03/11)
--
-- Ecole JETABLE avec l'option. F1 : P1A tuteur 1 (enfants S1 et S1B en C1),
-- P1B tuteur 2 (cours adulte CA). Devoirs a rendre plus tard (HF, HF2, HAF) et
-- deja passes (HP, HAP). Verifie :
--   - cocher / decocher avant la date : accepte ; apres : refuse (gel) ;
--   - « Vu » apres la date : accepte ;
--   - l'horodatage est celui de la base, jamais celui envoye ;
--   - un statut ne change ni d'enfant ni de devoir ;
--   - upsert (deux tuteurs du meme enfant) : accepte ;
--   - cours adulte : meme gel, suppression refusee.
-- Migration : supabase/migrations/espace-famille-devoir-fait.sql.
-- LECTURE SEULE : exception volontaire finale, tout est annule.
-- ============================================================================

CREATE OR REPLACE FUNCTION pg_temp.ctl39(p_compte uuid, p_sql text)
RETURNS text
LANGUAGE plpgsql
AS $f$
DECLARE
  v text;
BEGIN
  BEGIN
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', p_compte, 'role', 'authenticated')::text, true);
    EXECUTE p_sql INTO v;
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', NULL, true);
    RETURN 'ok' || coalesce(':' || nullif(v, ''), '');
  EXCEPTION
    WHEN insufficient_privilege THEN
      RESET ROLE;
      RETURN 'droits';
    WHEN others THEN
      RESET ROLE;
      RETURN CASE
        WHEN SQLERRM LIKE 'La date de rendu est passée%' THEN 'gele'
        WHEN SQLERRM LIKE 'Un suivi de devoir ne change%' THEN 'identite'
        ELSE SQLERRM END;
  END;
END
$f$;

DO $ctl$
DECLARE
  e uuid := gen_random_uuid();   y uuid := gen_random_uuid();
  c1 uuid := gen_random_uuid();  ca uuid := gen_random_uuid();
  t1 uuid := gen_random_uuid();  f1 uuid := gen_random_uuid();
  s1 uuid := gen_random_uuid();  s1b uuid := gen_random_uuid();
  hf uuid := gen_random_uuid();  hf2 uuid := gen_random_uuid(); hp uuid := gen_random_uuid();
  haf uuid := gen_random_uuid(); hap uuid := gen_random_uuid();
  p1a uuid := gen_random_uuid(); p1b uuid := gen_random_uuid();
  sx text := left(e::text, 8);
  r text;
  i integer;
  rapport text := '';
  nb_ko integer := 0;
  attendus constant integer := 15;
  essais text[][] := '{}';
BEGIN
  INSERT INTO etablissements (id, slug, nom, is_active) VALUES (e, 'ctl-devoir-' || sx, 'CONTROLE DEVOIR FAIT', true);
  UPDATE etablissements SET option_espace_famille = true, espace_famille_ouvert = true WHERE id = e;
  INSERT INTO school_years (id, etablissement_id, label, is_current, start_date, end_date)
  VALUES (y, e, 'CTL-39', true, '2025-09-01', '2099-06-30');
  INSERT INTO classes (id, etablissement_id, name, level, academic_year) VALUES
    (c1, e, 'C1', 'CTL', 'CTL-39'), (ca, e, 'CA', 'CTL', 'CTL-39');
  INSERT INTO teachers (id, etablissement_id, first_name, last_name, employee_number, email)
  VALUES (t1, e, 'Prof', 'CTL39', 'CTL39-' || sx, 'ctl39-t-' || sx || '@exemple.invalid');
  FOR i IN 1 .. 2 LOOP
    INSERT INTO auth.users (id, email, aud, role)
    VALUES ((ARRAY[p1a, p1b])[i], 'ctl39-' || i || '-' || sx || '@exemple.invalid', 'authenticated', 'authenticated');
    INSERT INTO profiles (id, email, role, first_name, last_name, etablissement_id, is_active)
    VALUES ((ARRAY[p1a, p1b])[i], 'ctl39-' || i || '-' || sx || '@exemple.invalid', 'parent', 'Compte' || i, 'CTL39', e, true);
  END LOOP;
  INSERT INTO parents (id, etablissement_id, tutor1_last_name, tutor1_first_name, tutor1_relationship, tutor1_email,
                       tutor2_last_name, tutor2_first_name, tutor2_relationship, tutor2_email, tutor2_adult_courses,
                       tutor1_user_id, tutor2_user_id)
  VALUES (f1, e, 'UN', 'Ctl', 'père', 'f1@exemple.invalid', 'UN', 'Ctlbis', 'mère', 'f1b@exemple.invalid', true, p1a, p1b);
  INSERT INTO students (id, etablissement_id, student_number, first_name, last_name, date_of_birth, is_active, parent_id) VALUES
    (s1,  e, 'CTL39-S1-'  || sx, 'S1',  'UN', '2018-01-01', true, f1),
    (s1b, e, 'CTL39-S1B-' || sx, 'S1B', 'UN', '2017-01-01', true, f1);
  INSERT INTO enrollments (student_id, class_id, status) VALUES (s1, c1, 'active'), (s1b, c1, 'active');
  INSERT INTO parent_class_enrollments (etablissement_id, parent_id, class_id, tutor_number, status)
  VALUES (e, f1, ca, 2, 'active');
  INSERT INTO homework (id, etablissement_id, class_id, teacher_id, subject, title, homework_type, due_date) VALUES
    (hf,  e, c1, t1, 'Général', 'HF',  'exercice', '2099-01-15'),
    (hf2, e, c1, t1, 'Général', 'HF2', 'exercice', '2099-01-15'),
    (hp,  e, c1, t1, 'Général', 'HP',  'exercice', '2026-01-15'),
    (haf, e, ca, t1, 'Général', 'HAF', 'exercice', '2099-01-15'),
    (hap, e, ca, t1, 'Général', 'HAP', 'exercice', '2026-01-15');
  -- Etat de depart pose par le proprietaire : HF2 fait (date future), puis passee.
  INSERT INTO homework_status (homework_id, student_id, parent_id, is_done) VALUES (hf2, s1, f1, true);
  UPDATE homework SET due_date = '2026-01-15' WHERE id = hf2;
  INSERT INTO homework_status (homework_id, student_id, parent_id) VALUES (hp, s1, f1);

  -- ── Avant la date de rendu ────────────────────────────────────────────────
  essais := essais || ARRAY[['cocher avant la date', 'ok',
    pg_temp.ctl39(p1a, format('INSERT INTO homework_status (homework_id, student_id, parent_id, is_done, done_at) VALUES (%L, %L, %L, true, ''2000-01-01'') RETURNING ''''', hf, s1, f1))]];
  essais := essais || ARRAY[['horodatage de la base (envoye 2000)', 'ok:recent',
    pg_temp.ctl39(p1a, format('SELECT CASE WHEN done_at > now() - interval ''1 minute'' THEN ''recent'' ELSE done_at::text END FROM homework_status WHERE homework_id = %L', hf))]];
  essais := essais || ARRAY[['decocher avant la date', 'ok:1',
    pg_temp.ctl39(p1a, format('WITH u AS (UPDATE homework_status SET is_done = false WHERE homework_id = %L AND student_id = %L RETURNING 1) SELECT count(*)::text FROM u', hf, s1))]];
  essais := essais || ARRAY[['decoche : date effacee', 'ok:vide',
    pg_temp.ctl39(p1a, format('SELECT coalesce(done_at::text, ''vide'') FROM homework_status WHERE homework_id = %L', hf))]];
  essais := essais || ARRAY[['upsert (second tuteur)', 'ok',
    pg_temp.ctl39(p1b, format('INSERT INTO homework_status (homework_id, student_id, parent_id, is_done) VALUES (%L, %L, %L, true) ON CONFLICT (homework_id, student_id) DO UPDATE SET is_done = EXCLUDED.is_done RETURNING ''''', hf, s1, f1))]];
  essais := essais || ARRAY[['changer d''enfant', 'identite',
    pg_temp.ctl39(p1a, format('UPDATE homework_status SET student_id = %L WHERE homework_id = %L AND student_id = %L RETURNING ''''', s1b, hf, s1))]];
  essais := essais || ARRAY[['changer de devoir', 'identite',
    pg_temp.ctl39(p1a, format('UPDATE homework_status SET homework_id = %L WHERE homework_id = %L AND student_id = %L RETURNING ''''', hf2, hf, s1))]];

  -- ── Apres la date de rendu ────────────────────────────────────────────────
  essais := essais || ARRAY[['cocher apres la date (creation)', 'gele',
    pg_temp.ctl39(p1a, format('INSERT INTO homework_status (homework_id, student_id, parent_id, is_done) VALUES (%L, %L, %L, true) RETURNING ''''', hp, s1b, f1))]];
  essais := essais || ARRAY[['cocher apres la date (modification)', 'gele',
    pg_temp.ctl39(p1a, format('UPDATE homework_status SET is_done = true WHERE homework_id = %L RETURNING ''''', hp))]];
  essais := essais || ARRAY[['decocher apres la date', 'gele',
    pg_temp.ctl39(p1a, format('UPDATE homework_status SET is_done = false WHERE homework_id = %L RETURNING ''''', hf2))]];
  essais := essais || ARRAY[['« Vu » apres la date', 'ok:1',
    pg_temp.ctl39(p1a, format('WITH u AS (UPDATE homework_status SET is_seen = true WHERE homework_id = %L RETURNING 1) SELECT count(*)::text FROM u', hp))]];

  -- ── Cours adulte ──────────────────────────────────────────────────────────
  essais := essais || ARRAY[['adulte : cocher avant la date', 'ok',
    pg_temp.ctl39(p1b, format('INSERT INTO adult_homework_status (homework_id, parent_id, tutor_number, is_done) VALUES (%L, %L, 2, true) RETURNING ''''', haf, f1))]];
  essais := essais || ARRAY[['adulte : cocher apres la date', 'gele',
    pg_temp.ctl39(p1b, format('INSERT INTO adult_homework_status (homework_id, parent_id, tutor_number, is_done) VALUES (%L, %L, 2, true) RETURNING ''''', hap, f1))]];
  essais := essais || ARRAY[['adulte : suppression', 'ok:0',
    pg_temp.ctl39(p1b, format('WITH d AS (DELETE FROM adult_homework_status WHERE homework_id = %L RETURNING 1) SELECT count(*)::text FROM d', haf))]];
  essais := essais || ARRAY[['adulte : changer de numero', 'identite',
    pg_temp.ctl39(p1b, format('UPDATE adult_homework_status SET tutor_number = 1 WHERE homework_id = %L RETURNING ''''', haf))]];

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

  RAISE EXCEPTION 'CONTROLE 39 : % KO (tout est annule)%', nb_ko, rapport;
END
$ctl$;
