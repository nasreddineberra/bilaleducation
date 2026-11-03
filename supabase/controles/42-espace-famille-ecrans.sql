-- ============================================================================
-- CONTROLE 42 — Espace famille, ecrans du parent (03/11)
--
-- E1 avec l'option. F1 : P1 ; S1 actif en C1, S1B parti (retire de C1).
-- F2 : P2 ; S2 actif en C2. Une notification et un message pour F1 et pour F2.
-- Verifie :
--   - `famille_enfants` : ses enfants, leur classe de l'annee, le depart ;
--     rien pour la direction, rien pour l'autre foyer ;
--   - `marquer_notification_lue` : sa notification et son message marques lus ;
--     ceux de F2 intouchables ; refusee a la direction ; source inconnue refusee.
-- Migration : supabase/migrations/espace-famille-ecrans.sql.
-- LECTURE SEULE : exception volontaire finale, tout est annule.
-- ============================================================================

CREATE OR REPLACE FUNCTION pg_temp.ctl42(p_compte uuid, p_sql text)
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
      RETURN SQLERRM;
  END;
END
$f$;

DO $ctl$
DECLARE
  e1 uuid := gen_random_uuid();  y1 uuid := gen_random_uuid();
  c1 uuid := gen_random_uuid();  c2 uuid := gen_random_uuid();
  f1 uuid := gen_random_uuid();  f2 uuid := gen_random_uuid();
  s1 uuid := gen_random_uuid();  s1b uuid := gen_random_uuid();  s2 uuid := gen_random_uuid();
  p1 uuid := gen_random_uuid();  p2 uuid := gen_random_uuid();  dir uuid := gen_random_uuid();
  n1 uuid := gen_random_uuid();  n2 uuid := gen_random_uuid();
  a1 uuid := gen_random_uuid();  a2 uuid := gen_random_uuid();
  r1 uuid := gen_random_uuid();  r2 uuid := gen_random_uuid();
  sx text := left(e1::text, 8);
  enfants text := 'SELECT string_agg(first_name || '':'' || coalesce(classe_nom, ''-'') || '':'' || inscription_active || '':'' || coalesce(date_depart::text, ''-''), '','' ORDER BY first_name) FROM famille_enfants()';
  i integer;
  rapport text := '';
  nb_ko integer := 0;
  attendus constant integer := 10;
  essais text[][] := '{}';
BEGIN
  INSERT INTO etablissements (id, slug, nom, is_active) VALUES (e1, 'ctl-ecrans-' || sx, 'CONTROLE ECRANS', true);
  UPDATE etablissements SET option_espace_famille = true, espace_famille_ouvert = true WHERE id = e1;
  INSERT INTO school_years (id, etablissement_id, label, is_current, start_date, end_date)
  VALUES (y1, e1, 'CTL-42', true, '2026-09-01', '2099-06-30');
  INSERT INTO classes (id, etablissement_id, name, level, academic_year) VALUES
    (c1, e1, 'C1', 'CTL', 'CTL-42'), (c2, e1, 'C2', 'CTL', 'CTL-42');
  FOR i IN 1 .. 3 LOOP
    INSERT INTO auth.users (id, email, aud, role)
    VALUES ((ARRAY[p1, p2, dir])[i], 'ctl42-' || i || '-' || sx || '@exemple.invalid', 'authenticated', 'authenticated');
    INSERT INTO profiles (id, email, role, first_name, last_name, etablissement_id, is_active)
    VALUES ((ARRAY[p1, p2, dir])[i], 'ctl42-' || i || '-' || sx || '@exemple.invalid',
            (ARRAY['parent', 'parent', 'direction'])[i], 'Compte', 'CTL42', e1, true);
  END LOOP;
  INSERT INTO parents (id, etablissement_id, tutor1_last_name, tutor1_first_name, tutor1_relationship, tutor1_email, tutor1_user_id) VALUES
    (f1, e1, 'UN', 'Ctl', 'père', 'f1@exemple.invalid', p1),
    (f2, e1, 'DEUX', 'Ctl', 'père', 'f2@exemple.invalid', p2);
  INSERT INTO students (id, etablissement_id, student_number, first_name, last_name, date_of_birth, is_active, parent_id) VALUES
    (s1,  e1, 'CTL42-S1-'  || sx, 'S1',  'UN', '2018-01-01', true,  f1),
    (s1b, e1, 'CTL42-S1B-' || sx, 'S1B', 'UN', '2017-01-01', false, f1),
    (s2,  e1, 'CTL42-S2-'  || sx, 'S2',  'DEUX', '2018-01-01', true, f2);
  INSERT INTO enrollments (student_id, class_id, status, date_depart) VALUES
    (s1, c1, 'active', NULL), (s1b, c1, 'withdrawn', '2026-10-15'), (s2, c2, 'active', NULL);
  INSERT INTO notifications (id, etablissement_id, type, parent_id, title, body) VALUES
    (n1, e1, 'homework', f1, 'N1', 'corps'), (n2, e1, 'homework', f2, 'N2', 'corps');
  INSERT INTO announcements (id, etablissement_id, title, content, announcement_type) VALUES
    (a1, e1, 'A1', 'corps', 'selected'), (a2, e1, 'A2', 'corps', 'selected');
  INSERT INTO announcement_recipients (id, announcement_id, parent_id) VALUES (r1, a1, f1), (r2, a2, f2);

  -- ── Enfants ───────────────────────────────────────────────────────────────
  essais := essais || ARRAY[['enfants : P1 (actif + parti)', 'ok:S1:C1:true:-,S1B:C1:false:2026-10-15', pg_temp.ctl42(p1, enfants)]];
  essais := essais || ARRAY[['enfants : P2', 'ok:S2:C2:true:-', pg_temp.ctl42(p2, enfants)]];
  essais := essais || ARRAY[['enfants : direction', 'ok', pg_temp.ctl42(dir, enfants)]];

  -- ── Marquer lu ────────────────────────────────────────────────────────────
  essais := essais || ARRAY[['P1 : sa notification', 'ok:true', pg_temp.ctl42(p1, format('SELECT marquer_notification_lue(%L, ''auto'')::text', n1))]];
  essais := essais || ARRAY[['P1 : son message', 'ok:true', pg_temp.ctl42(p1, format('SELECT marquer_notification_lue(%L, ''announcement'')::text', r1))]];
  essais := essais || ARRAY[['P1 : notification de F2', 'ok:false', pg_temp.ctl42(p1, format('SELECT marquer_notification_lue(%L, ''auto'')::text', n2))]];
  essais := essais || ARRAY[['P1 : message de F2', 'ok:false', pg_temp.ctl42(p1, format('SELECT marquer_notification_lue(%L, ''announcement'')::text', r2))]];
  essais := essais || ARRAY[['direction', 'droits', pg_temp.ctl42(dir, format('SELECT marquer_notification_lue(%L, ''auto'')::text', n1))]];
  essais := essais || ARRAY[['etat en base : lus / non lus', 'true/true/false/false',
    (SELECT is_read::text FROM notifications WHERE id = n1) || '/' || (SELECT is_read::text FROM announcement_recipients WHERE id = r1)
    || '/' || (SELECT is_read::text FROM notifications WHERE id = n2) || '/' || (SELECT is_read::text FROM announcement_recipients WHERE id = r2)]];
  essais := essais || ARRAY[['anon : execution', 'refusee',
    CASE WHEN to_regprocedure('public.famille_enfants()') IS NULL THEN 'absente'
         WHEN has_function_privilege('anon', 'public.famille_enfants()', 'EXECUTE')
           OR has_function_privilege('anon', 'public.marquer_notification_lue(uuid, text)', 'EXECUTE') THEN 'permise'
         ELSE 'refusee' END]];

  FOR i IN 1 .. array_length(essais, 1) LOOP
    IF essais[i][2] IS DISTINCT FROM essais[i][3] THEN nb_ko := nb_ko + 1; END IF;
    rapport := rapport || E'\n[' || CASE WHEN essais[i][2] IS NOT DISTINCT FROM essais[i][3] THEN 'OK' ELSE 'KO' END || '] '
      || rpad(essais[i][1], 40) || coalesce(essais[i][3], '(null)')
      || CASE WHEN essais[i][2] IS DISTINCT FROM essais[i][3] THEN E'\n     attendu' || repeat(' ', 36) || essais[i][2] ELSE '' END;
  END LOOP;
  IF array_length(essais, 1) IS DISTINCT FROM attendus THEN
    nb_ko := nb_ko + 1;
    rapport := rapport || E'\n[KO] ' || coalesce(array_length(essais, 1), 0) || ' essais menes, ' || attendus || ' attendus';
  END IF;

  RAISE EXCEPTION 'CONTROLE 42 : % KO (tout est annule)%', nb_ko, rapport;
END
$ctl$;
