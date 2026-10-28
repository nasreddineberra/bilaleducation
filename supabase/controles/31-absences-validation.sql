-- ============================================================================
-- CONTROLE 31 — Validation d'une seance et cahier de texte du remplacant
-- (lot 3b-2a)
--
-- Ecole JETABLE : l'absent tient le CE1 (09:00-10:00 et 14:00-16:00), un autre
-- enseignant le CM1 (14:30-15:30), le meme jour de la semaine qu'AVANT-HIER
-- (dates relatives a CURRENT_DATE : le controle reste rejouable).
-- Verifie : qui recoit l'heure (titulaire ; remplacant enseignant ; remplacant
-- secretaire, valide par l'encadrement), les refus (future, deja validee,
-- annulee, a decider, enseignant qui n'assure pas, retrait par un autre), le
-- retrait (heure effacee avec la validation), et l'acces du remplacant au
-- cahier de texte de la classe (aucun avant la decision, lu apres).
-- Migration : supabase/migrations/absences-enseignants-validation.sql.
-- LECTURE SEULE : exception volontaire finale, tout est annule.
-- ============================================================================

CREATE OR REPLACE FUNCTION pg_temp.ctl31(p_compte uuid, p_sql text)
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
    RETURN 'ok' || coalesce(':' || nullif(v, ''), '');
  EXCEPTION
    WHEN insufficient_privilege THEN RETURN 'droits';
    WHEN others THEN RETURN SQLERRM;
  END;
END
$f$;

DO $ctl$
DECLARE
  e   uuid := gen_random_uuid();
  y   uuid := gen_random_uuid();
  ce1 uuid := gen_random_uuid();
  cm1 uuid := gen_random_uuid();
  t_abs uuid := gen_random_uuid();
  t_rem uuid := gen_random_uuid();
  s_matin uuid := gen_random_uuid();
  s_aprem uuid := gen_random_uuid();
  s_cm1   uuid := gen_random_uuid();
  j  date := CURRENT_DATE - 2;          -- jour des seances
  jf date := CURRENT_DATE - 2 + 7 * 30; -- meme jour de la semaine, dans 30 semaines
  dow smallint := extract(dow FROM CURRENT_DATE - 2);
  dir uuid; sec uuid; ens uuid; rem uuid;
  v_role text; v_id uuid; i integer := 0;
  a1 uuid;
  r text;
  n integer;
  rapport text := '';
  nb_ko integer := 0;
  essais text[][] := '{}';
  valider text;
BEGIN
  INSERT INTO etablissements (id, slug, nom, is_active) VALUES
    (e, 'ctl-valid-' || left(e::text, 8), 'CONTROLE VALIDATION', true);
  INSERT INTO school_years (id, etablissement_id, label) VALUES (y, e, 'CTL-1');
  INSERT INTO presence_types (etablissement_id, school_year_id, label, code, reserved_kind)
  SELECT e, y, 'Cours', 'CRS', 'cours'
   WHERE NOT EXISTS (SELECT 1 FROM presence_types WHERE school_year_id = y AND reserved_kind = 'cours');
  INSERT INTO classes (id, etablissement_id, name, level, academic_year) VALUES
    (ce1, e, 'CE1', 'CTL', 'CTL-1'), (cm1, e, 'CM1', 'CTL', 'CTL-1');

  FOREACH v_role IN ARRAY ARRAY['direction', 'secretaire', 'enseignant', 'remplacant'] LOOP
    i := i + 1;
    v_id := gen_random_uuid();
    INSERT INTO auth.users (id, email, aud, role)
    VALUES (v_id, 'ctl-valid-' || i || '-' || left(e::text, 8) || '@exemple.invalid', 'authenticated', 'authenticated');
    INSERT INTO profiles (id, email, role, first_name, last_name, etablissement_id, is_active)
    VALUES (v_id, 'ctl-valid-' || i || '-' || left(e::text, 8) || '@exemple.invalid',
            CASE v_role WHEN 'remplacant' THEN 'enseignant' ELSE v_role END, 'Controle', upper(v_role), e, true);
    CASE v_role
      WHEN 'direction' THEN dir := v_id;
      WHEN 'secretaire' THEN sec := v_id;
      WHEN 'enseignant' THEN ens := v_id;
      ELSE rem := v_id;
    END CASE;
  END LOOP;

  INSERT INTO teachers (id, etablissement_id, user_id, first_name, last_name, employee_number, email) VALUES
    (t_abs, e, ens, 'Controle', 'ABSENT',     'CTL-A-' || left(e::text, 8), 'ctl-valid-ens@exemple.invalid'),
    (t_rem, e, rem, 'Controle', 'REMPLACANT', 'CTL-R-' || left(e::text, 8), 'ctl-valid-rem@exemple.invalid');
  INSERT INTO class_teachers (class_id, teacher_id, is_main_teacher, effective_from) VALUES
    (ce1, t_abs, true, j - 60), (cm1, t_rem, true, j - 60);
  INSERT INTO schedule_slots (id, etablissement_id, school_year_id, class_id, is_recurring, day_of_week,
                              start_time, end_time, slot_type, is_active, effective_from) VALUES
    (s_matin, e, y, ce1, true, dow, '09:00', '10:00', 'cours', true, j - 60),
    (s_aprem, e, y, ce1, true, dow, '14:00', '16:00', 'cours', true, j - 60),
    (s_cm1,   e, y, cm1, true, dow, '14:30', '15:30', 'cours', true, j - 60);
  INSERT INTO class_journal (etablissement_id, class_id, teacher_id, session_date, title)
  VALUES (e, ce1, t_abs, j, 'Seance du titulaire');

  valider := 'SELECT (valider_seance(%L, %L))->>''profile_id''';

  -- ── Sans absence : le titulaire ───────────────────────────────────────────
  essais := essais || ARRAY[['titulaire valide sa seance', 'ok:' || ens, pg_temp.ctl31(ens, format(valider, s_matin, j))]];
  essais := essais || ARRAY[['deja validee', 'VALIDATION_DEJA', pg_temp.ctl31(dir, format(valider, s_matin, j))]];
  essais := essais || ARRAY[['retrait par un autre enseignant', 'VALIDATION_REFUSEE',
    pg_temp.ctl31(rem, format('SELECT retirer_validation_seance(%L, %L)::text', s_matin, j))]];
  essais := essais || ARRAY[['retrait par le titulaire', 'ok',
    pg_temp.ctl31(ens, format('SELECT retirer_validation_seance(%L, %L)::text', s_matin, j))]];
  SELECT count(*) INTO n FROM staff_time_entries WHERE etablissement_id = e;
  essais := essais || ARRAY[['heure effacee avec la validation', '0', n::text]];
  essais := essais || ARRAY[['seance future', 'VALIDATION_FUTURE', pg_temp.ctl31(dir, format(valider, s_matin, jf))]];
  essais := essais || ARRAY[['enseignant qui n''assure pas', 'VALIDATION_REFUSEE', pg_temp.ctl31(rem, format(valider, s_aprem, j))]];

  -- ── Absence du titulaire toute la journee ─────────────────────────────────
  r := pg_temp.ctl31(dir, format('SELECT enregistrer_absence_enseignant(NULL, %L, %L, %L, %L)',
    t_abs, (j + time '00:00')::text, (j + time '23:59')::text, 'maladie'));
  a1 := CASE WHEN r LIKE 'ok:%' THEN substr(r, 4)::uuid END;
  essais := essais || ARRAY[['a decider : refusee', 'VALIDATION_A_DECIDER', pg_temp.ctl31(dir, format(valider, s_aprem, j))]];

  -- Apres-midi remplace par la secretaire, matin par l'autre enseignant (libre a 09:00).
  PERFORM pg_temp.ctl31(dir, format('SELECT decider_seances_absence(%L, %L)::text', a1, json_build_array(
    json_build_object('slot_id', s_aprem, 'date', j, 'decision', 'remplacee', 'remplacant', sec),
    json_build_object('slot_id', s_matin, 'date', j, 'decision', 'remplacee', 'remplacant', rem))));
  essais := essais || ARRAY[['l''absent ne valide pas', 'VALIDATION_REFUSEE', pg_temp.ctl31(ens, format(valider, s_aprem, j))]];
  essais := essais || ARRAY[['encadrement valide pour la secretaire', 'ok:' || sec, pg_temp.ctl31(dir, format(valider, s_aprem, j))]];
  SELECT count(*) INTO n FROM staff_time_entries
   WHERE etablissement_id = e AND profile_id = sec AND is_replacement AND replaced_profile_id = ens AND duration_minutes = 120;
  essais := essais || ARRAY[['heure de la secretaire, en remplacement', '1', n::text]];
  essais := essais || ARRAY[['remplacant enseignant valide', 'ok:' || rem, pg_temp.ctl31(rem, format(valider, s_matin, j))]];

  -- Cahier de texte du CE1 : le remplacant le lit (seance remplacee il y a 2 jours).
  essais := essais || ARRAY[['remplacant lit le cahier du CE1', 'ok:1', pg_temp.ctl31(rem,
    format('SELECT count(*)::text FROM class_journal WHERE class_id = %L', ce1))]];
  essais := essais || ARRAY[['remplacant ecrit dans le cahier du CE1', 'ok', left(pg_temp.ctl31(rem, format(
    'INSERT INTO class_journal (etablissement_id, class_id, teacher_id, session_date, title) VALUES (%L, %L, %L, %L, %L) RETURNING id',
    e, ce1, t_rem, j, 'Seance du remplacant')), 2)]];

  -- Seance annulee pour l'absence (retrait de la validation d'abord).
  PERFORM pg_temp.ctl31(dir, format('SELECT retirer_validation_seance(%L, %L)::text', s_aprem, j));
  PERFORM pg_temp.ctl31(dir, format('SELECT decider_seances_absence(%L, %L)::text', a1, json_build_array(
    json_build_object('slot_id', s_aprem, 'date', j, 'decision', 'annulee'))));
  essais := essais || ARRAY[['seance annulee', 'VALIDATION_ANNULEE', pg_temp.ctl31(dir, format(valider, s_aprem, j))]];
  essais := essais || ARRAY[['anonyme', 'droits', pg_temp.ctl31(NULL, format(valider, s_matin, j))]];

  -- Sans decision de remplacement, le remplacant ne lit plus le cahier.
  PERFORM pg_temp.ctl31(dir, format('SELECT retirer_validation_seance(%L, %L)::text', s_matin, j));
  PERFORM pg_temp.ctl31(dir, format('SELECT decider_seances_absence(%L, %L)::text', a1, json_build_array(
    json_build_object('slot_id', s_matin, 'date', j, 'decision', 'a_decider'))));
  essais := essais || ARRAY[['sans remplacement : cahier fermé', 'ok:0', pg_temp.ctl31(rem,
    format('SELECT count(*)::text FROM class_journal WHERE class_id = %L AND title = %L', ce1, 'Seance du titulaire'))]];

  FOR i IN 1 .. array_length(essais, 1) LOOP
    IF essais[i][2] <> essais[i][3] THEN nb_ko := nb_ko + 1; END IF;
    rapport := rapport || E'\n[' || CASE WHEN essais[i][2] = essais[i][3] THEN 'OK' ELSE 'KO' END || '] '
      || rpad(essais[i][1], 42) || essais[i][3]
      || CASE WHEN essais[i][2] <> essais[i][3] THEN E'\n     attendu' || repeat(' ', 38) || essais[i][2] ELSE '' END;
  END LOOP;
  IF array_length(essais, 1) IS DISTINCT FROM 17 THEN
    nb_ko := nb_ko + 1;
    rapport := rapport || E'\n[KO] ' || coalesce(array_length(essais, 1), 0) || ' essais menes, 17 attendus';
  END IF;

  RAISE EXCEPTION 'CONTROLE 31 : % KO (tout est annule)%', nb_ko, rapport;
END
$ctl$;
