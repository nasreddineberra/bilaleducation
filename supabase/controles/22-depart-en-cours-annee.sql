-- ============================================================================
-- CONTROLE 22 — Depart en cours d'annee : correction ou depart, jamais les deux
--
-- Ecole JETABLE (annee 2026-2027 en cours, du 01/09/2026 au 30/06/2027), une
-- classe avec cotisation et une evaluation, trois eleves, un foyer avec un
-- tuteur en cours adulte. Comptes : secretaire, comptable, enseignant.
--   depart d'un eleve SANS donnees           -> refuse (DEPART_SANS_DONNEES)
--   depart hors de l'annee                   -> refuse (DEPART_DATE_HORS_ANNEE)
--   depart d'un eleve avec une absence       -> accepte : withdrawn + date,
--                                               inactif, absence conservee,
--                                               mouvement « depart » date, regle figee
--   suppression de cette inscription         -> toujours refusee (garde-fou)
--   retrait d'un eleve sans donnees          -> mouvement « correction »
--   depart par un enseignant                 -> refuse
--   depart d'un adulte avec une note         -> accepte, mouvement « depart »
--   reglage par la comptable / la secretaire -> accepte / refuse
--   decision au cas par cas                  -> comptable accepte, secretaire
--                                               refusee, hors cas par cas refusee
--
-- Migration : supabase/migrations/add-depart-en-cours-annee.sql.
-- LECTURE SEULE : exception volontaire finale, tout est annule.
-- ============================================================================
DO $ctl$
DECLARE
  e    uuid := gen_random_uuid();
  y    uuid := gen_random_uuid();
  ct   uuid := gen_random_uuid();
  c    uuid := gen_random_uuid();
  ev   uuid := gen_random_uuid();
  pe   uuid := gen_random_uuid();
  par  uuid := gen_random_uuid();
  s1   uuid := gen_random_uuid();   -- part avec une absence
  s2   uuid := gen_random_uuid();   -- sans donnees
  s3   uuid := gen_random_uuid();   -- part au cas par cas
  sec  uuid := gen_random_uuid();
  cpt  uuid := gen_random_uuid();
  ens  uuid := gen_random_uuid();
  mvt  uuid;
  m    record;
  ok   boolean;
  msg  text;
  rapport text := '';
  nb_ko   integer := 0;
BEGIN
  INSERT INTO etablissements (id, slug, nom, is_active)
  VALUES (e, 'ctl-dep-' || left(e::text, 8), 'CONTROLE DEPART', true);
  INSERT INTO school_years (id, etablissement_id, label, is_current, start_date, end_date)
  VALUES (y, e, '2026-2027', true, '2026-09-01', '2027-06-30');
  INSERT INTO periods (id, school_year_id, label, order_index)
  VALUES (pe, y, 'T1', 1);
  INSERT INTO cotisation_types (id, etablissement_id, school_year_id, label, amount, registration_fee)
  VALUES (ct, e, y, 'CTL Enfant', 300, 20);
  INSERT INTO classes (id, etablissement_id, name, level, academic_year, cotisation_type_id)
  VALUES (c, e, 'CTL-DEP', 'CTL', '2026-2027', ct);
  INSERT INTO evaluations (id, etablissement_id, class_id, title) VALUES (ev, e, c, 'CTL');
  INSERT INTO parents (id, etablissement_id, tutor1_last_name, tutor1_first_name, tutor1_email)
  VALUES (par, e, 'CTLDEP' || left(e::text, 8), 'Adulte', 'ctl-dep-' || left(e::text, 8) || '@exemple.invalid');
  INSERT INTO students (id, etablissement_id, parent_id, student_number, first_name, last_name, date_of_birth) VALUES
    (s1, e, par, 'CTL1-' || left(e::text, 8), 'Un',    'CTLDEP', '2015-01-01'),
    (s2, e, par, 'CTL2-' || left(e::text, 8), 'Deux',  'CTLDEP', '2016-01-01'),
    (s3, e, par, 'CTL3-' || left(e::text, 8), 'Trois', 'CTLDEP', '2017-01-01');
  INSERT INTO enrollments (student_id, class_id, status, enrollment_date) VALUES
    (s1, c, 'active', '2026-09-01'), (s2, c, 'active', '2026-09-01'), (s3, c, 'active', '2026-09-01');
  INSERT INTO parent_class_enrollments (etablissement_id, parent_id, class_id, tutor_number, status, enrollment_date)
  VALUES (e, par, c, 1, 'active', '2026-09-01');

  INSERT INTO auth.users (id, email, aud, role) VALUES
    (sec, 'ctl-dep-sec-' || left(e::text, 8) || '@exemple.invalid', 'authenticated', 'authenticated'),
    (cpt, 'ctl-dep-cpt-' || left(e::text, 8) || '@exemple.invalid', 'authenticated', 'authenticated'),
    (ens, 'ctl-dep-ens-' || left(e::text, 8) || '@exemple.invalid', 'authenticated', 'authenticated');
  INSERT INTO profiles (id, email, role, first_name, last_name, etablissement_id) VALUES
    (sec, 'ctl-dep-sec-' || left(e::text, 8) || '@exemple.invalid', 'secretaire', 'Sophie', 'Ctlsec', e),
    (cpt, 'ctl-dep-cpt-' || left(e::text, 8) || '@exemple.invalid', 'comptable',  'Camille', 'Ctlcpt', e),
    (ens, 'ctl-dep-ens-' || left(e::text, 8) || '@exemple.invalid', 'enseignant', 'Eric', 'Ctlens', e);

  UPDATE etablissements SET regle_ajustement = 'prorata' WHERE id = e;

  -- ── Par la secretaire ──
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', sec, 'role', 'authenticated')::text, true);

  BEGIN
    PERFORM declarer_depart_eleve(s1, '2026-11-15');
    msg := 'accepte';
  EXCEPTION WHEN raise_exception THEN msg := SQLERRM; END;
  ok := msg = 'DEPART_SANS_DONNEES';
  rapport := rapport || E'\n[' || CASE WHEN ok THEN 'OK' ELSE 'KO' END || '] depart sans donnees        ' || msg;
  IF NOT ok THEN nb_ko := nb_ko + 1; END IF;

  RESET ROLE;
  INSERT INTO absences (etablissement_id, student_id, class_id, period_id, absence_date, absence_type)
  VALUES (e, s1, c, pe, '2026-10-05', 'absence');
  SET LOCAL ROLE authenticated;

  BEGIN
    PERFORM declarer_depart_eleve(s1, '2027-08-01');
    msg := 'accepte';
  EXCEPTION WHEN raise_exception THEN msg := SQLERRM; END;
  ok := msg = 'DEPART_DATE_HORS_ANNEE';
  rapport := rapport || E'\n[' || CASE WHEN ok THEN 'OK' ELSE 'KO' END || '] depart hors annee          ' || msg;
  IF NOT ok THEN nb_ko := nb_ko + 1; END IF;

  BEGIN
    PERFORM declarer_depart_eleve(s1, '2026-11-15');
    msg := 'accepte';
  EXCEPTION WHEN raise_exception THEN msg := SQLERRM; END;
  RESET ROLE;
  SELECT * INTO m FROM mouvements_inscription WHERE student_id = s1 AND sens = 'depart';
  ok := msg = 'accepte'
        AND EXISTS (SELECT 1 FROM enrollments WHERE student_id = s1 AND status = 'withdrawn' AND date_depart = '2026-11-15')
        AND NOT (SELECT is_active FROM students WHERE id = s1)
        AND EXISTS (SELECT 1 FROM absences WHERE student_id = s1)
        AND m.motif = 'depart' AND m.date_effet = '2026-11-15' AND m.regle = 'prorata' AND m.auteur_id = sec
        AND (SELECT count(*) FROM mouvements_inscription WHERE student_id = s1 AND sens = 'depart') = 1;
  rapport := rapport || E'\n[' || CASE WHEN ok THEN 'OK' ELSE 'KO' END || '] depart avec absence        ' || msg
    || ' · ' || coalesce(m.motif, '?') || ' · effet ' || coalesce(m.date_effet::text, '?') || ' · ' || coalesce(m.regle, '?');
  IF NOT ok THEN nb_ko := nb_ko + 1; END IF;

  SET LOCAL ROLE authenticated;
  BEGIN
    DELETE FROM enrollments WHERE student_id = s1;
    msg := 'acceptee';
  EXCEPTION WHEN raise_exception THEN msg := SQLERRM; END;
  ok := msg = 'ENROLLMENT_HAS_DATA';
  rapport := rapport || E'\n[' || CASE WHEN ok THEN 'OK' ELSE 'KO' END || '] suppression apres depart   ' || msg;
  IF NOT ok THEN nb_ko := nb_ko + 1; END IF;

  DELETE FROM enrollments WHERE student_id = s2;
  RESET ROLE;
  SELECT * INTO m FROM mouvements_inscription WHERE student_id = s2 AND sens = 'depart';
  ok := m.motif = 'correction';
  rapport := rapport || E'\n[' || CASE WHEN ok THEN 'OK' ELSE 'KO' END || '] retrait sans donnees       ' || coalesce(m.motif, 'aucun mouvement');
  IF NOT ok THEN nb_ko := nb_ko + 1; END IF;

  -- ── Par l'enseignant ──
  INSERT INTO absences (etablissement_id, student_id, class_id, period_id, absence_date, absence_type)
  VALUES (e, s3, c, pe, '2026-10-06', 'absence');
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', ens, 'role', 'authenticated')::text, true);
  BEGIN
    PERFORM declarer_depart_eleve(s3, '2026-11-20');
    msg := 'accepte';
  EXCEPTION WHEN raise_exception THEN msg := SQLERRM; END;
  RESET ROLE;
  ok := msg = 'DEPART_REFUSE';
  rapport := rapport || E'\n[' || CASE WHEN ok THEN 'OK' ELSE 'KO' END || '] depart par un enseignant   ' || msg;
  IF NOT ok THEN nb_ko := nb_ko + 1; END IF;

  -- ── Adulte, par la secretaire ──
  INSERT INTO adult_grades (etablissement_id, parent_id, tutor_number, evaluation_id, score) VALUES (e, par, 1, ev, 14);
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', sec, 'role', 'authenticated')::text, true);
  BEGIN
    PERFORM declarer_depart_adulte(par, 1::smallint, c, '2026-12-01');
    msg := 'accepte';
  EXCEPTION WHEN raise_exception THEN msg := SQLERRM; END;
  RESET ROLE;
  ok := msg = 'accepte'
        AND EXISTS (SELECT 1 FROM parent_class_enrollments WHERE parent_id = par AND status = 'withdrawn' AND date_depart = '2026-12-01')
        AND EXISTS (SELECT 1 FROM mouvements_inscription WHERE parent_id = par AND tutor_number = 1 AND motif = 'depart' AND date_effet = '2026-12-01');
  rapport := rapport || E'\n[' || CASE WHEN ok THEN 'OK' ELSE 'KO' END || '] depart d''un adulte         ' || msg;
  IF NOT ok THEN nb_ko := nb_ko + 1; END IF;

  -- ── Reglage ──
  SET LOCAL ROLE authenticated;
  BEGIN
    PERFORM definir_regle_ajustement('due');
    msg := 'accepte';
  EXCEPTION WHEN raise_exception THEN msg := SQLERRM; END;
  RESET ROLE;
  ok := msg = 'REGLE_REFUSEE' AND (SELECT regle_ajustement FROM etablissements WHERE id = e) = 'prorata';
  rapport := rapport || E'\n[' || CASE WHEN ok THEN 'OK' ELSE 'KO' END || '] reglage par la secretaire  ' || msg;
  IF NOT ok THEN nb_ko := nb_ko + 1; END IF;

  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', cpt, 'role', 'authenticated')::text, true);
  BEGIN
    PERFORM definir_regle_ajustement('cas_par_cas');
    msg := 'accepte';
  EXCEPTION WHEN raise_exception THEN msg := SQLERRM; END;
  RESET ROLE;
  SELECT regle_ajustement, regle_ajustement_par INTO m FROM etablissements WHERE id = e;
  ok := msg = 'accepte' AND m.regle_ajustement = 'cas_par_cas' AND m.regle_ajustement_par = cpt;
  rapport := rapport || E'\n[' || CASE WHEN ok THEN 'OK' ELSE 'KO' END || '] reglage par la comptable   ' || msg || ' · ' || coalesce(m.regle_ajustement, '?');
  IF NOT ok THEN nb_ko := nb_ko + 1; END IF;

  -- ── Au cas par cas ──
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', sec, 'role', 'authenticated')::text, true);
  PERFORM declarer_depart_eleve(s3, '2026-11-20');
  RESET ROLE;
  SELECT id INTO mvt FROM mouvements_inscription WHERE student_id = s3 AND motif = 'depart';

  SET LOCAL ROLE authenticated;
  BEGIN
    PERFORM decider_mouvement(mvt, 'due');
    msg := 'acceptee';
  EXCEPTION WHEN raise_exception THEN msg := SQLERRM; END;
  RESET ROLE;
  ok := msg = 'DECISION_REFUSEE';
  rapport := rapport || E'\n[' || CASE WHEN ok THEN 'OK' ELSE 'KO' END || '] decision par la secretaire ' || msg;
  IF NOT ok THEN nb_ko := nb_ko + 1; END IF;

  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', cpt, 'role', 'authenticated')::text, true);
  BEGIN
    PERFORM decider_mouvement(mvt, 'prorata');
    msg := 'acceptee';
  EXCEPTION WHEN raise_exception THEN msg := SQLERRM; END;
  RESET ROLE;
  SELECT decision, decide_par INTO m FROM mouvements_inscription WHERE id = mvt;
  ok := msg = 'acceptee' AND m.decision = 'prorata' AND m.decide_par = cpt;
  rapport := rapport || E'\n[' || CASE WHEN ok THEN 'OK' ELSE 'KO' END || '] decision par la comptable  ' || msg || ' · ' || coalesce(m.decision, '?');
  IF NOT ok THEN nb_ko := nb_ko + 1; END IF;

  SELECT id INTO mvt FROM mouvements_inscription WHERE student_id = s1 AND motif = 'depart';
  SET LOCAL ROLE authenticated;
  BEGIN
    PERFORM decider_mouvement(mvt, 'due');
    msg := 'acceptee';
  EXCEPTION WHEN raise_exception THEN msg := SQLERRM; END;
  RESET ROLE;
  ok := msg = 'DECISION_REFUSEE';
  rapport := rapport || E'\n[' || CASE WHEN ok THEN 'OK' ELSE 'KO' END || '] decision hors cas par cas  ' || msg;
  IF NOT ok THEN nb_ko := nb_ko + 1; END IF;

  PERFORM set_config('request.jwt.claims', NULL, true);
  RAISE EXCEPTION 'CONTROLE 22 : % KO (tout est annule)%', nb_ko, rapport;
END
$ctl$;
