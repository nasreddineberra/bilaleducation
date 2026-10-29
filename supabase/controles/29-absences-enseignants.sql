-- ============================================================================
-- CONTROLE 29 — Absences enseignants (lot 3a)
--
-- Cree deux ecoles JETABLES (comptes de chaque role, deux classes, trois
-- creneaux le mercredi 04/11/2026), puis appelle les trois fonctions sous
-- l'identite de chaque compte et compare chaque resultat a l'attendu :
--   - cas limites du chevauchement (memes cas que lib/edt/absences.test.ts) :
--     seance qui finit a l'heure du debut de l'absence (pas touchee), absences
--     bout a bout (acceptees), chevauchement (refuse) ;
--   - refus : periode inversee, motif inconnu, seance hors absence ou hors
--     date, remplacant occupe, absent, d'une autre ecole ; seance validee
--     (decision, modification, suppression, declaration a posteriori) ;
--   - effets : modification qui fait sortir une seance (decision retiree),
--     retour « a decider » d'une seance dont les familles avaient ete prevenues ;
--   - droits : roles qui declarent, lecture par role, ecriture directe et
--     appel anonyme refuses, autre ecole aveugle.
-- Migration : supabase/migrations/add-absences-enseignants.sql.
-- LECTURE SEULE : exception volontaire finale, tout est annule.
-- ============================================================================

-- Appel sous l'identite d'un compte : rend 'ok' (ou 'ok:<valeur>') ou le code
-- de refus (message de RAISE, ou SQLSTATE pour un refus de droits).
CREATE OR REPLACE FUNCTION pg_temp.ctl29(p_compte uuid, p_sql text)
RETURNS text
LANGUAGE plpgsql
AS $f$
DECLARE
  v text;
BEGIN
  BEGIN
    IF p_compte IS NULL THEN
      PERFORM set_config('role', 'anon', true);
    ELSE
      PERFORM set_config('role', 'authenticated', true);
      PERFORM set_config('request.jwt.claims', json_build_object('sub', p_compte, 'role', 'authenticated')::text, true);
    END IF;
    EXECUTE p_sql INTO v;
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', NULL, true);
    RETURN 'ok' || coalesce(':' || nullif(v, ''), '');   -- fonction void : 'ok'
  EXCEPTION
    WHEN insufficient_privilege THEN RETURN 'droits';
    WHEN others THEN RETURN SQLERRM;
  END;
END
$f$;

DO $ctl$
DECLARE
  e   uuid := gen_random_uuid();
  e2  uuid := gen_random_uuid();
  y   uuid := gen_random_uuid();
  ce1 uuid := gen_random_uuid();
  cm1 uuid := gen_random_uuid();
  t_abs uuid := gen_random_uuid();   -- fiche de l'absent
  t_rem uuid := gen_random_uuid();   -- fiche d'un enseignant pris a 14:30
  s_matin uuid := gen_random_uuid(); -- CE1 mercredi 09:00-10:00
  s_aprem uuid := gen_random_uuid(); -- CE1 mercredi 14:00-16:00
  s_cm1   uuid := gen_random_uuid(); -- CM1 mercredi 14:30-15:30 (titulaire t_rem)
  dir uuid; adm uuid; resp uuid; sec uuid; cpt uuid; ens uuid; rem uuid; par uuid; dir2 uuid;
  v_role text; v_id uuid; i integer := 0;
  a1 uuid;
  r text; attendu text;
  n integer;
  rapport text := '';
  nb_ko integer := 0;
  essais text[][] := '{}';
BEGIN
  INSERT INTO etablissements (id, slug, nom, is_active) VALUES
    (e,  'ctl-absences-'   || left(e::text, 8),  'CONTROLE ABSENCES', true),
    (e2, 'ctl-absences-b-' || left(e2::text, 8), 'CONTROLE ABSENCES B', true);
  INSERT INTO school_years (id, etablissement_id, label) VALUES (y, e, 'CTL-1');
  INSERT INTO classes (id, etablissement_id, name, level, academic_year) VALUES
    (ce1, e, 'CE1', 'CTL', 'CTL-1'), (cm1, e, 'CM1', 'CTL', 'CTL-1');

  -- Un compte par role (+ une direction de l'autre ecole).
  FOREACH v_role IN ARRAY ARRAY['direction', 'admin', 'responsable_pedagogique', 'secretaire', 'comptable',
                                'enseignant', 'remplacant', 'parent', 'autre_direction'] LOOP
    i := i + 1;
    v_id := gen_random_uuid();
    INSERT INTO auth.users (id, email, aud, role)
    VALUES (v_id, 'ctl-abs-' || i || '-' || left(e::text, 8) || '@exemple.invalid', 'authenticated', 'authenticated');
    INSERT INTO profiles (id, email, role, first_name, last_name, etablissement_id, is_active)
    VALUES (v_id, 'ctl-abs-' || i || '-' || left(e::text, 8) || '@exemple.invalid',
            CASE v_role WHEN 'autre_direction' THEN 'direction' WHEN 'remplacant' THEN 'enseignant' ELSE v_role END,
            'Controle', upper(v_role), CASE WHEN v_role = 'autre_direction' THEN e2 ELSE e END, true);
    CASE v_role
      WHEN 'direction' THEN dir := v_id;
      WHEN 'admin' THEN adm := v_id;
      WHEN 'responsable_pedagogique' THEN resp := v_id;
      WHEN 'secretaire' THEN sec := v_id;
      WHEN 'comptable' THEN cpt := v_id;
      WHEN 'enseignant' THEN ens := v_id;
      WHEN 'remplacant' THEN rem := v_id;
      WHEN 'parent' THEN par := v_id;
      ELSE dir2 := v_id;
    END CASE;
  END LOOP;

  INSERT INTO teachers (id, etablissement_id, user_id, first_name, last_name, employee_number, email) VALUES
    (t_abs, e, ens, 'Controle', 'ABSENT',     'CTL-A-' || left(e::text, 8), 'ctl-abs-ens@exemple.invalid'),
    (t_rem, e, rem, 'Controle', 'REMPLACANT', 'CTL-R-' || left(e::text, 8), 'ctl-abs-rem@exemple.invalid');
  INSERT INTO class_teachers (class_id, teacher_id, is_main_teacher, effective_from) VALUES
    (ce1, t_abs, true, '2026-09-01'), (cm1, t_rem, true, '2026-09-01');
  -- 04/11/2026 = mercredi (day_of_week 3, 0 = dimanche).
  INSERT INTO schedule_slots (id, etablissement_id, school_year_id, class_id, is_recurring, day_of_week,
                              start_time, end_time, slot_type, is_active, effective_from) VALUES
    (s_matin, e, y, ce1, true, 3, '09:00', '10:00', 'cours', true, '2026-09-01'),
    (s_aprem, e, y, ce1, true, 3, '14:00', '16:00', 'cours', true, '2026-09-01'),
    (s_cm1,   e, y, cm1, true, 3, '14:30', '15:30', 'cours', true, '2026-09-01');

  -- ── Declarer ──────────────────────────────────────────────────────────────
  r := pg_temp.ctl29(dir, format(
    'SELECT enregistrer_absence_enseignant(NULL, %L, %L, %L, %L)', t_abs, '2026-11-04 10:00', '2026-11-04 15:00', 'maladie'));
  a1 := CASE WHEN r LIKE 'ok:%' THEN substr(r, 4)::uuid END;
  essais := essais || ARRAY[['declarer 04/11 10:00-15:00', 'ok', CASE WHEN a1 IS NOT NULL THEN 'ok' ELSE r END]];

  essais := essais || ARRAY[['chevauchement 14:00-18:00', 'ABSENCE_CHEVAUCHEMENT', pg_temp.ctl29(dir, format(
    'SELECT enregistrer_absence_enseignant(NULL, %L, %L, %L, %L)', t_abs, '2026-11-04 14:00', '2026-11-04 18:00', 'conge'))]];

  r := pg_temp.ctl29(dir, format(
    'SELECT enregistrer_absence_enseignant(NULL, %L, %L, %L, %L)', t_abs, '2026-11-04 15:00', '2026-11-04 16:00', 'conge'));
  essais := essais || ARRAY[['bout a bout 15:00-16:00', 'ok', CASE WHEN r LIKE 'ok:%' THEN 'ok' ELSE r END]];
  IF r LIKE 'ok:%' THEN
    essais := essais || ARRAY[['supprimer l''absence bout a bout', 'ok',
      pg_temp.ctl29(dir, format('SELECT supprimer_absence_enseignant(%L)::text', substr(r, 4)))]];
  END IF;

  essais := essais || ARRAY[['periode inversee', 'ABSENCE_PERIODE', pg_temp.ctl29(dir, format(
    'SELECT enregistrer_absence_enseignant(NULL, %L, %L, %L, %L)', t_abs, '2026-11-05 10:00', '2026-11-05 10:00', 'conge'))]];
  essais := essais || ARRAY[['motif inconnu', 'ABSENCE_MOTIF', pg_temp.ctl29(dir, format(
    'SELECT enregistrer_absence_enseignant(NULL, %L, %L, %L, %L)', t_abs, '2026-11-06 10:00', '2026-11-06 11:00', 'vacances'))]];
  essais := essais || ARRAY[['enseignant d''une autre ecole', 'ABSENCE_ENSEIGNANT', pg_temp.ctl29(dir2, format(
    'SELECT enregistrer_absence_enseignant(NULL, %L, %L, %L, %L)', t_abs, '2026-11-06 10:00', '2026-11-06 11:00', 'conge'))]];

  -- ── Decider ───────────────────────────────────────────────────────────────
  essais := essais || ARRAY[['seance 09:00-10:00 (finit au debut)', 'ABSENCE_SEANCE_HORS', pg_temp.ctl29(dir, format(
    'SELECT decider_seances_absence(%L, %L)::text', a1,
    json_build_array(json_build_object('slot_id', s_matin, 'date', '2026-11-04', 'decision', 'annulee'))))]];
  essais := essais || ARRAY[['seance a une autre date', 'ABSENCE_SEANCE_HORS', pg_temp.ctl29(dir, format(
    'SELECT decider_seances_absence(%L, %L)::text', a1,
    json_build_array(json_build_object('slot_id', s_aprem, 'date', '2026-11-05', 'decision', 'annulee'))))]];
  essais := essais || ARRAY[['remplacant pris a 14:30 (CM1)', 'ABSENCE_REMPLACANT_OCCUPE', pg_temp.ctl29(dir, format(
    'SELECT decider_seances_absence(%L, %L)::text', a1,
    json_build_array(json_build_object('slot_id', s_aprem, 'date', '2026-11-04', 'decision', 'remplacee', 'remplacant', rem))))]];
  essais := essais || ARRAY[['remplace par l''absent', 'ABSENCE_REMPLACANT', pg_temp.ctl29(dir, format(
    'SELECT decider_seances_absence(%L, %L)::text', a1,
    json_build_array(json_build_object('slot_id', s_aprem, 'date', '2026-11-04', 'decision', 'remplacee', 'remplacant', ens))))]];
  essais := essais || ARRAY[['remplacant d''une autre ecole', 'ABSENCE_REMPLACANT', pg_temp.ctl29(dir, format(
    'SELECT decider_seances_absence(%L, %L)::text', a1,
    json_build_array(json_build_object('slot_id', s_aprem, 'date', '2026-11-04', 'decision', 'remplacee', 'remplacant', dir2))))]];
  essais := essais || ARRAY[['remplacee par la secretaire', 'ok:{"retablies": []}', pg_temp.ctl29(dir, format(
    'SELECT decider_seances_absence(%L, %L)::text', a1,
    json_build_array(json_build_object('slot_id', s_aprem, 'date', '2026-11-04', 'decision', 'remplacee', 'remplacant', sec))))]];
  essais := essais || ARRAY[['autre ecole decide', 'ABSENCE_INTROUVABLE', pg_temp.ctl29(dir2, format(
    'SELECT decider_seances_absence(%L, %L)::text', a1, '[]'))]];

  -- Seance validee : decision, modification, suppression refusees.
  INSERT INTO schedule_validations (etablissement_id, schedule_slot_id, profile_id, validation_date)
  VALUES (e, s_aprem, sec, '2026-11-04');
  essais := essais || ARRAY[['validee : changer la decision', 'ABSENCE_SEANCE_VALIDEE', pg_temp.ctl29(dir, format(
    'SELECT decider_seances_absence(%L, %L)::text', a1,
    json_build_array(json_build_object('slot_id', s_aprem, 'date', '2026-11-04', 'decision', 'annulee'))))]];
  essais := essais || ARRAY[['validee : la faire sortir', 'ABSENCE_SEANCE_VALIDEE', pg_temp.ctl29(dir, format(
    'SELECT enregistrer_absence_enseignant(%L, %L, %L, %L, %L)', a1, t_abs, '2026-11-04 10:00', '2026-11-04 11:00', 'maladie'))]];
  essais := essais || ARRAY[['validee : supprimer l''absence', 'ABSENCE_SEANCE_VALIDEE', pg_temp.ctl29(dir, format(
    'SELECT supprimer_absence_enseignant(%L)::text', a1))]];
  DELETE FROM schedule_validations WHERE schedule_slot_id = s_aprem;

  -- Annulee, familles prevenues, puis remise « a decider » : signalee retablie.
  PERFORM pg_temp.ctl29(dir, format('SELECT decider_seances_absence(%L, %L)::text', a1,
    json_build_array(json_build_object('slot_id', s_aprem, 'date', '2026-11-04', 'decision', 'annulee'))));
  UPDATE absences_enseignants_seances SET familles_prevenues_le = now() WHERE absence_id = a1;
  r := pg_temp.ctl29(dir, format('SELECT decider_seances_absence(%L, %L)::text', a1,
    json_build_array(json_build_object('slot_id', s_aprem, 'date', '2026-11-04', 'decision', 'a_decider'))));
  SELECT count(*) INTO n FROM absences_enseignants_seances WHERE absence_id = a1;
  essais := essais || ARRAY[['a decider apres email : retablie, ligne retiree', '1 retablie · 0 ligne',
    CASE WHEN r LIKE 'ok:%' THEN jsonb_array_length((substr(r, 4)::jsonb)->'retablies') || ' retablie · ' || n || ' ligne' ELSE r END]];

  -- Modification qui fait sortir une seance decidee : decision retiree.
  PERFORM pg_temp.ctl29(dir, format('SELECT decider_seances_absence(%L, %L)::text', a1,
    json_build_array(json_build_object('slot_id', s_aprem, 'date', '2026-11-04', 'decision', 'annulee'))));
  r := pg_temp.ctl29(dir, format('SELECT enregistrer_absence_enseignant(%L, %L, %L, %L, %L)',
    a1, t_abs, '2026-11-04 10:00', '2026-11-04 11:00', 'maladie'));
  SELECT count(*) INTO n FROM absences_enseignants_seances WHERE absence_id = a1;
  essais := essais || ARRAY[['raccourcie a 10:00-11:00 : decision retiree', 'ok · 0 ligne',
    CASE WHEN r LIKE 'ok:%' THEN 'ok' ELSE r END || ' · ' || n || ' ligne']];
  essais := essais || ARRAY[['changer l''enseignant d''une absence', 'ABSENCE_ENSEIGNANT_FIGE', pg_temp.ctl29(dir, format(
    'SELECT enregistrer_absence_enseignant(%L, %L, %L, %L, %L)', a1, t_rem, '2026-11-04 10:00', '2026-11-04 11:00', 'maladie'))]];

  -- Declaration a posteriori sur une seance que l'absent a validee.
  INSERT INTO schedule_validations (etablissement_id, schedule_slot_id, profile_id, validation_date)
  VALUES (e, s_matin, ens, '2026-11-04');
  essais := essais || ARRAY[['absence sur une seance qu''il a validee', 'ABSENCE_SEANCE_VALIDEE', pg_temp.ctl29(dir, format(
    'SELECT enregistrer_absence_enseignant(NULL, %L, %L, %L, %L)', t_abs, '2026-11-04 08:00', '2026-11-04 09:30', 'conge'))]];
  DELETE FROM schedule_validations WHERE schedule_slot_id = s_matin;

  -- ── Roles qui declarent (absence du remplacant, 11/11, une par role) ──────
  essais := essais || ARRAY[['admin declare', 'ok', left(pg_temp.ctl29(adm, format(
    'SELECT enregistrer_absence_enseignant(NULL, %L, %L, %L, %L)', t_rem, '2026-11-11 08:00', '2026-11-11 09:00', 'conge')), 2)]];
  essais := essais || ARRAY[['resp. pedagogique declare', 'ok', left(pg_temp.ctl29(resp, format(
    'SELECT enregistrer_absence_enseignant(NULL, %L, %L, %L, %L)', t_rem, '2026-11-11 09:00', '2026-11-11 10:00', 'conge')), 2)]];
  essais := essais || ARRAY[['secretaire declare', 'ok', left(pg_temp.ctl29(sec, format(
    'SELECT enregistrer_absence_enseignant(NULL, %L, %L, %L, %L)', t_rem, '2026-11-11 10:00', '2026-11-11 11:00', 'conge')), 2)]];
  FOREACH v_role IN ARRAY ARRAY['comptable', 'enseignant', 'parent'] LOOP
    essais := essais || ARRAY[[v_role || ' declare', 'ABSENCE_REFUSEE', pg_temp.ctl29(
      CASE v_role WHEN 'comptable' THEN cpt WHEN 'enseignant' THEN ens ELSE par END, format(
      'SELECT enregistrer_absence_enseignant(NULL, %L, %L, %L, %L)', t_rem, '2026-11-11 12:00', '2026-11-11 13:00', 'conge'))]];
  END LOOP;
  essais := essais || ARRAY[['anonyme declare', 'droits', pg_temp.ctl29(NULL, format(
    'SELECT enregistrer_absence_enseignant(NULL, %L, %L, %L, %L)', t_rem, '2026-11-11 12:00', '2026-11-11 13:00', 'conge'))]];
  essais := essais || ARRAY[['ecriture directe (direction)', 'droits', pg_temp.ctl29(dir, format(
    'INSERT INTO absences_enseignants (teacher_id, debut, fin, motif) VALUES (%L, %L, %L, %L) RETURNING id',
    t_rem, '2026-11-12 08:00', '2026-11-12 09:00', 'conge'))]];

  -- ── Lecture (4 absences de l'ecole : 1 de l'absent, 3 du remplacant) ──────
  PERFORM pg_temp.ctl29(dir, format('SELECT decider_seances_absence(%L, %L)::text', a1, '[]'));
  FOREACH v_role IN ARRAY ARRAY['direction', 'secretaire', 'comptable', 'enseignant', 'parent', 'autre_direction'] LOOP
    r := pg_temp.ctl29(CASE v_role WHEN 'direction' THEN dir WHEN 'secretaire' THEN sec WHEN 'comptable' THEN cpt
                                   WHEN 'enseignant' THEN ens WHEN 'parent' THEN par ELSE dir2 END,
      'SELECT (SELECT count(*) FROM absences_enseignants)::text');
    attendu := CASE v_role WHEN 'direction' THEN 'ok:4' WHEN 'secretaire' THEN 'ok:4'
                           WHEN 'comptable' THEN 'ok:4' WHEN 'enseignant' THEN 'ok:1' ELSE 'ok:0' END;
    essais := essais || ARRAY[[v_role || ' lit les absences', attendu, r]];
  END LOOP;

  -- ── Rapport ───────────────────────────────────────────────────────────────
  FOR i IN 1 .. array_length(essais, 1) LOOP
    IF essais[i][2] <> essais[i][3] THEN nb_ko := nb_ko + 1; END IF;
    rapport := rapport || E'\n[' || CASE WHEN essais[i][2] = essais[i][3] THEN 'OK' ELSE 'KO' END || '] '
      || rpad(essais[i][1], 48) || essais[i][3]
      || CASE WHEN essais[i][2] <> essais[i][3] THEN E'\n     attendu' || repeat(' ', 44) || essais[i][2] ELSE '' END;
  END LOOP;
  IF array_length(essais, 1) IS DISTINCT FROM 35 THEN
    nb_ko := nb_ko + 1;
    rapport := rapport || E'\n[KO] ' || coalesce(array_length(essais, 1), 0) || ' essais menes, 35 attendus';
  END IF;

  RAISE EXCEPTION 'CONTROLE 29 : % KO (tout est annule)%', nb_ko, rapport;
END
$ctl$;
