-- ============================================================================
-- CONTROLE 32 — Familles prevenues d'une seance annulee (lot 3c)
--
-- Ecole JETABLE : l'absent tient le CE1 (09:00-10:00 et 14:00-16:00) un jour
-- futur (dates relatives a CURRENT_DATE : le controle reste rejouable).
-- Verifie : qui marque l'annonce (encadrement, secretaire ; ni l'enseignant ni
-- l'anonyme), seules les seances ANNULEES de l'absence sont marquees, la date
-- d'annonce tient tant que la seance reste annulee, s'efface quand elle ne
-- l'est plus (remplacee, a decider) et le retablissement est rendu par
-- `decider_seances_absence` ; le type de notification « seance ».
-- Migration : supabase/migrations/absences-enseignants-familles.sql.
-- LECTURE SEULE : exception volontaire finale, tout est annule.
-- ============================================================================

CREATE OR REPLACE FUNCTION pg_temp.ctl32(p_compte uuid, p_sql text)
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
  t_abs uuid := gen_random_uuid();
  s_matin uuid := gen_random_uuid();
  s_aprem uuid := gen_random_uuid();
  jf  date := CURRENT_DATE + 14;
  dow smallint := extract(dow FROM CURRENT_DATE + 14);
  dir uuid; sec uuid; ens uuid;
  v_role text; v_id uuid; i integer := 0;
  a1 uuid;
  r text;
  rapport text := '';
  nb_ko integer := 0;
  essais text[][] := '{}';
  marquer text;
  decider text;
  date_annonce text;
BEGIN
  INSERT INTO etablissements (id, slug, nom, is_active) VALUES
    (e, 'ctl-famil-' || left(e::text, 8), 'CONTROLE FAMILLES', true);
  INSERT INTO school_years (id, etablissement_id, label) VALUES (y, e, 'CTL-1');
  INSERT INTO classes (id, etablissement_id, name, level, academic_year) VALUES
    (ce1, e, 'CE1', 'CTL', 'CTL-1');

  FOREACH v_role IN ARRAY ARRAY['direction', 'secretaire', 'enseignant'] LOOP
    i := i + 1;
    v_id := gen_random_uuid();
    INSERT INTO auth.users (id, email, aud, role)
    VALUES (v_id, 'ctl-famil-' || i || '-' || left(e::text, 8) || '@exemple.invalid', 'authenticated', 'authenticated');
    INSERT INTO profiles (id, email, role, first_name, last_name, etablissement_id, is_active)
    VALUES (v_id, 'ctl-famil-' || i || '-' || left(e::text, 8) || '@exemple.invalid',
            v_role, 'Controle', upper(v_role), e, true);
    CASE v_role
      WHEN 'direction' THEN dir := v_id;
      WHEN 'secretaire' THEN sec := v_id;
      ELSE ens := v_id;
    END CASE;
  END LOOP;

  INSERT INTO teachers (id, etablissement_id, user_id, first_name, last_name, employee_number, email) VALUES
    (t_abs, e, ens, 'Controle', 'ABSENT', 'CTL-A-' || left(e::text, 8), 'ctl-famil-ens@exemple.invalid');
  INSERT INTO class_teachers (class_id, teacher_id, is_main_teacher, effective_from) VALUES
    (ce1, t_abs, true, CURRENT_DATE - 60);
  INSERT INTO schedule_slots (id, etablissement_id, school_year_id, class_id, is_recurring, day_of_week,
                              start_time, end_time, slot_type, is_active, effective_from) VALUES
    (s_matin, e, y, ce1, true, dow, '09:00', '10:00', 'cours', true, CURRENT_DATE - 60),
    (s_aprem, e, y, ce1, true, dow, '14:00', '16:00', 'cours', true, CURRENT_DATE - 60);

  r := pg_temp.ctl32(dir, format('SELECT enregistrer_absence_enseignant(NULL, %L, %L, %L, %L)',
    t_abs, (jf + time '00:00')::text, (jf + time '23:59')::text, 'maladie'));
  a1 := CASE WHEN r LIKE 'ok:%' THEN substr(r, 4)::uuid END;

  marquer := 'SELECT marquer_familles_prevenues(%L, %L)::text';
  -- Nombre de seances retablies rendu par la decision.
  decider := 'SELECT jsonb_array_length(decider_seances_absence(%L, %L)->''retablies'')::text';

  -- Matin annule, apres-midi remplace par la secretaire.
  essais := essais || ARRAY[['decision initiale (aucun retablissement)', 'ok:0', pg_temp.ctl32(dir, format(decider, a1, json_build_array(
    json_build_object('slot_id', s_matin, 'date', jf, 'decision', 'annulee'),
    json_build_object('slot_id', s_aprem, 'date', jf, 'decision', 'remplacee', 'remplacant', sec))))]];

  -- ── Qui marque ────────────────────────────────────────────────────────────
  essais := essais || ARRAY[['enseignant ne marque pas', 'ABSENCE_REFUSEE', pg_temp.ctl32(ens, format(marquer, a1,
    json_build_array(json_build_object('slot_id', s_matin, 'date', jf))))]];
  essais := essais || ARRAY[['anonyme', 'droits', pg_temp.ctl32(NULL, format(marquer, a1,
    json_build_array(json_build_object('slot_id', s_matin, 'date', jf))))]];
  essais := essais || ARRAY[['absence inconnue', 'ABSENCE_INTROUVABLE', pg_temp.ctl32(dir, format(marquer, gen_random_uuid(),
    json_build_array(json_build_object('slot_id', s_matin, 'date', jf))))]];
  essais := essais || ARRAY[['seance remplacee : non marquee', 'ok:0', pg_temp.ctl32(dir, format(marquer, a1,
    json_build_array(json_build_object('slot_id', s_aprem, 'date', jf))))]];
  essais := essais || ARRAY[['secretaire marque l''annulee', 'ok:1', pg_temp.ctl32(sec, format(marquer, a1, json_build_array(
    json_build_object('slot_id', s_matin, 'date', jf), json_build_object('slot_id', s_aprem, 'date', jf))))]];

  date_annonce := (SELECT familles_prevenues_le::text FROM absences_enseignants_seances
                    WHERE schedule_slot_id = s_matin AND seance_date = jf);
  essais := essais || ARRAY[['date d''annonce posee', 'oui', CASE WHEN date_annonce IS NOT NULL THEN 'oui' ELSE 'non' END]];

  -- ── Reste annulee : la date tient, rien a retablir ─────────────────────────
  essais := essais || ARRAY[['annulee re-enregistree', 'ok:0', pg_temp.ctl32(dir, format(decider, a1, json_build_array(
    json_build_object('slot_id', s_matin, 'date', jf, 'decision', 'annulee'))))]];
  essais := essais || ARRAY[['date d''annonce conservee', 'oui', CASE WHEN (SELECT familles_prevenues_le::text
    FROM absences_enseignants_seances WHERE schedule_slot_id = s_matin AND seance_date = jf) = date_annonce THEN 'oui' ELSE 'non' END]];

  -- ── Annulee puis remplacee : retablie, date effacee ───────────────────────
  -- (l'apres-midi repasse a decider pour liberer la secretaire)
  essais := essais || ARRAY[['annulee -> remplacee : retablie', 'ok:1', pg_temp.ctl32(dir, format(decider, a1, json_build_array(
    json_build_object('slot_id', s_aprem, 'date', jf, 'decision', 'a_decider'),
    json_build_object('slot_id', s_matin, 'date', jf, 'decision', 'remplacee', 'remplacant', sec))))]];
  essais := essais || ARRAY[['date effacee', 'oui', CASE WHEN EXISTS (SELECT 1 FROM absences_enseignants_seances
    WHERE schedule_slot_id = s_matin AND seance_date = jf AND familles_prevenues_le IS NULL) THEN 'oui' ELSE 'non' END]];

  -- ── Re-annulee : nouvelle annonce a faire ; puis a decider : retablie ─────
  essais := essais || ARRAY[['re-annulee sans annonce : rien a retablir', 'ok:0', pg_temp.ctl32(dir, format(decider, a1, json_build_array(
    json_build_object('slot_id', s_matin, 'date', jf, 'decision', 'annulee'))))]];
  essais := essais || ARRAY[['nouvelle annonce marquee', 'ok:1', pg_temp.ctl32(dir, format(marquer, a1,
    json_build_array(json_build_object('slot_id', s_matin, 'date', jf))))]];
  essais := essais || ARRAY[['annulee -> a decider : retablie', 'ok:1', pg_temp.ctl32(dir, format(decider, a1, json_build_array(
    json_build_object('slot_id', s_matin, 'date', jf, 'decision', 'a_decider'))))]];

  -- ── Type de notification ──────────────────────────────────────────────────
  essais := essais || ARRAY[['type de notification seance', 'oui', CASE WHEN pg_get_constraintdef(
    (SELECT oid FROM pg_constraint WHERE conname = 'notifications_type_check')) LIKE '%''seance''%' THEN 'oui' ELSE 'non' END]];

  FOR i IN 1 .. array_length(essais, 1) LOOP
    IF essais[i][2] <> essais[i][3] THEN nb_ko := nb_ko + 1; END IF;
    rapport := rapport || E'\n[' || CASE WHEN essais[i][2] = essais[i][3] THEN 'OK' ELSE 'KO' END || '] '
      || rpad(essais[i][1], 44) || essais[i][3]
      || CASE WHEN essais[i][2] <> essais[i][3] THEN E'\n     attendu' || repeat(' ', 40) || essais[i][2] ELSE '' END;
  END LOOP;
  IF array_length(essais, 1) IS DISTINCT FROM 15 THEN
    nb_ko := nb_ko + 1;
    rapport := rapport || E'\n[KO] ' || coalesce(array_length(essais, 1), 0) || ' essais menes, 15 attendus';
  END IF;

  RAISE EXCEPTION 'CONTROLE 32 : % KO (tout est annule)%', nb_ko, rapport;
END
$ctl$;
