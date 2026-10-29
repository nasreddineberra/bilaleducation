-- ============================================================================
-- CONTROLE 34 — Lot 5 du chantier Planning / absences : le nettoyage (29/10)
--
-- Verifie :
--   - les colonnes recopiees ont disparu (enseignant d'un creneau, enseignant et
--     horaire d'une seance modifiee, salle en texte d'une classe) ;
--   - `valider_seance` et `fn_demo_peupler` ne les citent plus ;
--   - une seance « modifiee » sans salle est refusee, avec salle acceptee ;
--   - `class_teachers` refuse un remplacant, accepte un titulaire.
-- `valider_seance` elle-meme reste eprouvee par le controle 31 (a relancer).
-- Migration : supabase/migrations/lot5-nettoyage.sql.
-- LECTURE SEULE : exception volontaire finale, tout est annule.
-- ============================================================================

DO $ctl$
DECLARE
  e   uuid := gen_random_uuid();
  y   uuid := gen_random_uuid();
  c   uuid := gen_random_uuid();
  t   uuid := gen_random_uuid();
  s   uuid := gen_random_uuid();
  r   uuid := gen_random_uuid();
  res text;
  rapport text := '';
  nb_ko integer := 0;
  essais text[][] := '{}';
  i integer;
BEGIN
  -- ── Colonnes ──────────────────────────────────────────────────────────────
  SELECT coalesce(string_agg(table_name || '.' || column_name, ',' ORDER BY 1), '') INTO res
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND (table_name, column_name) IN (('schedule_slots', 'teacher_id'),
                                       ('schedule_exceptions', 'override_teacher_id'),
                                       ('schedule_exceptions', 'override_start_time'),
                                       ('schedule_exceptions', 'override_end_time'),
                                       ('classes', 'room_number'));
  essais := essais || ARRAY[['colonnes retirees', '', res]];

  -- ── Fonctions ─────────────────────────────────────────────────────────────
  essais := essais || ARRAY[['valider_seance sans override_', 'false',
    (position('override_' IN pg_get_functiondef('public.valider_seance(uuid, date)'::regprocedure)) > 0)::text]];
  essais := essais || ARRAY[['fn_demo_peupler sans enseignant de creneau', 'false',
    (position('class_id, teacher_id, is_recurring' IN pg_get_functiondef('public.fn_demo_peupler(uuid)'::regprocedure)) > 0)::text]];

  -- ── Gardes (ecole jetable) ────────────────────────────────────────────────
  INSERT INTO etablissements (id, slug, nom, is_active) VALUES (e, 'ctl-lot5-' || left(e::text, 8), 'CONTROLE LOT 5', true);
  INSERT INTO school_years (id, etablissement_id, label) VALUES (y, e, 'CTL-5');
  INSERT INTO classes (id, etablissement_id, name, level, academic_year) VALUES (c, e, 'CE1', 'CTL', 'CTL-5');
  INSERT INTO teachers (id, etablissement_id, first_name, last_name, employee_number, email)
  VALUES (t, e, 'Controle', 'LOT5', 'CTL-5-' || left(e::text, 8), 'ctl-lot5@exemple.invalid');
  INSERT INTO rooms (id, etablissement_id, name, room_type) VALUES (r, e, 'Salle CTL', 'salle_cours');
  INSERT INTO schedule_slots (id, etablissement_id, school_year_id, class_id, is_recurring, day_of_week,
                              start_time, end_time, slot_type, is_active, effective_from)
  VALUES (s, e, y, c, true, 3, '09:00', '10:00', 'cours', true, '2026-09-01');

  BEGIN
    INSERT INTO schedule_exceptions (etablissement_id, schedule_slot_id, exception_date, exception_type)
    VALUES (e, s, '2026-11-04', 'modified');
    res := 'accepte';
  EXCEPTION WHEN check_violation THEN res := 'refuse';
  END;
  essais := essais || ARRAY[['seance modifiee sans salle', 'refuse', res]];

  BEGIN
    INSERT INTO schedule_exceptions (etablissement_id, schedule_slot_id, exception_date, exception_type, override_room_id)
    VALUES (e, s, '2026-11-11', 'modified', r);
    res := 'accepte';
  EXCEPTION WHEN check_violation THEN res := 'refuse';
  END;
  essais := essais || ARRAY[['seance modifiee avec salle', 'accepte', res]];

  BEGIN
    INSERT INTO schedule_exceptions (etablissement_id, schedule_slot_id, exception_date, exception_type)
    VALUES (e, s, '2026-11-18', 'cancelled');
    res := 'accepte';
  EXCEPTION WHEN check_violation THEN res := 'refuse';
  END;
  essais := essais || ARRAY[['seance annulee', 'accepte', res]];

  BEGIN
    INSERT INTO class_teachers (class_id, teacher_id, is_main_teacher, effective_from) VALUES (c, t, false, '2026-09-01');
    res := 'accepte';
  EXCEPTION WHEN check_violation THEN res := 'refuse';
  END;
  essais := essais || ARRAY[['remplacant dans class_teachers', 'refuse', res]];

  BEGIN
    INSERT INTO class_teachers (class_id, teacher_id, is_main_teacher, effective_from) VALUES (c, t, true, '2026-09-01');
    res := 'accepte';
  EXCEPTION WHEN check_violation THEN res := 'refuse';
  END;
  essais := essais || ARRAY[['titulaire dans class_teachers', 'accepte', res]];

  -- ── Rapport ───────────────────────────────────────────────────────────────
  FOR i IN 1 .. array_length(essais, 1) LOOP
    IF essais[i][2] <> essais[i][3] THEN nb_ko := nb_ko + 1; END IF;
    rapport := rapport || E'\n[' || CASE WHEN essais[i][2] = essais[i][3] THEN 'OK' ELSE 'KO' END || '] '
      || rpad(essais[i][1], 44) || coalesce(nullif(essais[i][3], ''), '(aucune)')
      || CASE WHEN essais[i][2] <> essais[i][3] THEN E'\n     attendu' || repeat(' ', 40) || coalesce(nullif(essais[i][2], ''), '(aucune)') ELSE '' END;
  END LOOP;
  IF array_length(essais, 1) IS DISTINCT FROM 8 THEN
    nb_ko := nb_ko + 1;
    rapport := rapport || E'\n[KO] ' || coalesce(array_length(essais, 1), 0) || ' essais menes, 8 attendus';
  END IF;

  RAISE EXCEPTION 'CONTROLE 34 : % KO (tout est annule)%', nb_ko, rapport;
END
$ctl$;
