-- ============================================================================
-- CONTROLE 24 — Import : la limite d'inscrits a un seul juge, le declencheur
--
-- Ecole JETABLE limitee a 3 inscrits, deux eleves actifs, un compte direction.
--   import de 2 enfants (2 + 2 > 3)          -> refuse, repere `limite_inscrits`
--                                               (le pre-controle levait SANS repere)
--   import d'1 enfant (2 + 1 = 3)            -> accepte
--   limite a 5, un adulte inscrit (3 + 1),
--   import de 2 enfants (3 + 1 + 2 > 5)      -> refuse, repere `limite_inscrits`
--                                               (les adultes comptent)
--   un refus n'ecrit rien (foyer en bloc)
--
-- Migration : supabase/migrations/import-foyer-sans-precontrole-limite.sql.
-- LECTURE SEULE : exception volontaire finale, tout est annule.
-- ============================================================================
DO $ctl$
DECLARE
  e    uuid := gen_random_uuid();
  y    uuid := gen_random_uuid();
  par  uuid := gen_random_uuid();
  dir  uuid := gen_random_uuid();
  k    text := left(e::text, 8);
  ok   boolean;
  msg  text;
  hint text;
  n    integer;
  rapport text := '';
  nb_ko   integer := 0;
BEGIN
  INSERT INTO etablissements (id, slug, nom, is_active, max_students)
  VALUES (e, 'ctl-imp-' || k, 'CONTROLE IMPORT', true, 3);
  INSERT INTO school_years (id, etablissement_id, label, is_current, start_date, end_date)
  VALUES (y, e, '2026-2027', true, '2026-09-01', '2027-06-30');
  INSERT INTO parents (id, etablissement_id, tutor1_last_name, tutor1_first_name, tutor1_email)
  VALUES (par, e, 'CTLIMP' || k, 'Adulte', 'ctl-imp-' || k || '@exemple.invalid');
  INSERT INTO students (etablissement_id, parent_id, student_number, first_name, last_name, date_of_birth) VALUES
    (e, par, 'CTI1-' || k, 'Un',   'CTLIMP', '2015-01-01'),
    (e, par, 'CTI2-' || k, 'Deux', 'CTLIMP', '2016-01-01');

  INSERT INTO auth.users (id, email, aud, role)
  VALUES (dir, 'ctl-imp-dir-' || k || '@exemple.invalid', 'authenticated', 'authenticated');
  INSERT INTO profiles (id, email, role, first_name, last_name, etablissement_id)
  VALUES (dir, 'ctl-imp-dir-' || k || '@exemple.invalid', 'direction', 'Diane', 'Ctldir', e);

  -- ── 2 + 2 > 3 ──
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', dir, 'role', 'authenticated')::text, true);
  BEGIN
    PERFORM import_foyer(
      jsonb_build_object('tutor1_last_name', 'CTLA' || k, 'tutor1_first_name', 'Alain', 'tutor1_email', 'ctl-a-' || k || '@exemple.invalid'),
      jsonb_build_array(
        jsonb_build_object('last_name', 'CTLA' || k, 'first_name', 'Anna', 'date_of_birth', '2015-02-02', 'gender', 'female'),
        jsonb_build_object('last_name', 'CTLA' || k, 'first_name', 'Axel', 'date_of_birth', '2016-03-03', 'gender', 'male')));
    msg := 'accepte'; hint := NULL;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT, hint = PG_EXCEPTION_HINT;
  END;
  RESET ROLE;
  SELECT count(*) INTO n FROM parents WHERE etablissement_id = e;
  ok := hint = 'limite_inscrits' AND n = 1;
  rapport := rapport || E'\n[' || CASE WHEN ok THEN 'OK' ELSE 'KO' END || '] 2 + 2 > 3                 repere ' || coalesce(hint, 'AUCUN') || ' · ' || msg;
  IF NOT ok THEN nb_ko := nb_ko + 1; END IF;

  -- ── 2 + 1 = 3 ──
  SET LOCAL ROLE authenticated;
  BEGIN
    PERFORM import_foyer(
      jsonb_build_object('tutor1_last_name', 'CTLB' || k, 'tutor1_first_name', 'Benoit', 'tutor1_email', 'ctl-b-' || k || '@exemple.invalid'),
      jsonb_build_array(jsonb_build_object('last_name', 'CTLB' || k, 'first_name', 'Bea', 'date_of_birth', '2015-04-04', 'gender', 'female')));
    msg := 'accepte';
  EXCEPTION WHEN OTHERS THEN msg := SQLERRM; END;
  RESET ROLE;
  ok := msg = 'accepte' AND (SELECT count(*) FROM students WHERE etablissement_id = e AND is_active) = 3;
  rapport := rapport || E'\n[' || CASE WHEN ok THEN 'OK' ELSE 'KO' END || '] 2 + 1 = 3                 ' || msg;
  IF NOT ok THEN nb_ko := nb_ko + 1; END IF;

  -- ── Les adultes comptent : limite 5, base 3 + 1 adulte, import de 2 ──
  UPDATE etablissements SET max_students = 5 WHERE id = e;
  UPDATE parents SET tutor1_adult_courses = true WHERE id = par;
  SET LOCAL ROLE authenticated;
  BEGIN
    PERFORM import_foyer(
      jsonb_build_object('tutor1_last_name', 'CTLC' || k, 'tutor1_first_name', 'Carl', 'tutor1_email', 'ctl-c-' || k || '@exemple.invalid'),
      jsonb_build_array(
        jsonb_build_object('last_name', 'CTLC' || k, 'first_name', 'Chloe', 'date_of_birth', '2015-05-05', 'gender', 'female'),
        jsonb_build_object('last_name', 'CTLC' || k, 'first_name', 'Cyril', 'date_of_birth', '2016-06-06', 'gender', 'male')));
    msg := 'accepte'; hint := NULL;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT, hint = PG_EXCEPTION_HINT;
  END;
  RESET ROLE;
  ok := hint = 'limite_inscrits'
        AND (SELECT count(*) FROM students WHERE etablissement_id = e) = 3
        AND NOT EXISTS (SELECT 1 FROM parents WHERE etablissement_id = e AND tutor1_last_name = 'CTLC' || k);
  rapport := rapport || E'\n[' || CASE WHEN ok THEN 'OK' ELSE 'KO' END || '] adultes comptes (3+1+2>5) repere ' || coalesce(hint, 'AUCUN') || ' · ' || msg;
  IF NOT ok THEN nb_ko := nb_ko + 1; END IF;

  PERFORM set_config('request.jwt.claims', NULL, true);
  RAISE EXCEPTION 'CONTROLE 24 : % KO (tout est annule)%', nb_ko, rapport;
END
$ctl$;
