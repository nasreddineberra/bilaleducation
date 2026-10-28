-- ============================================================================
-- CONTROLE 30 — Absences enseignants : qui peut remplacer (lot 3b-1)
--
-- Meme ecole jetable que le controle 29 (l'absent est titulaire du CE1 le
-- mercredi 14:00-16:00, un autre enseignant tient le CM1 a 14:30-15:30).
-- Verifie : la liste des remplacants possibles d'une seance (membres actifs de
-- l'equipe, ni l'absent, ni le compte admin, ni un parent, ni une autre ecole ;
-- l'enseignant pris a 14:30 marque occupe avec la raison) ; les roles qui
-- l'obtiennent ; le refus du compte admin comme remplacant par
-- `decider_seances_absence`.
-- Migration : supabase/migrations/absences-enseignants-remplacants.sql.
-- LECTURE SEULE : exception volontaire finale, tout est annule.
-- ============================================================================

CREATE OR REPLACE FUNCTION pg_temp.ctl30(p_compte uuid, p_sql text)
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
  e2  uuid := gen_random_uuid();
  y   uuid := gen_random_uuid();
  ce1 uuid := gen_random_uuid();
  cm1 uuid := gen_random_uuid();
  t_abs uuid := gen_random_uuid();
  t_rem uuid := gen_random_uuid();
  s_aprem uuid := gen_random_uuid();
  s_cm1   uuid := gen_random_uuid();
  dir uuid; adm uuid; sec uuid; cpt uuid; ens uuid; rem uuid; dir2 uuid;
  v_role text; v_id uuid; i integer := 0;
  a1 uuid;
  r text;
  seance jsonb;
  liste text;
  rapport text := '';
  nb_ko integer := 0;
  essais text[][] := '{}';
BEGIN
  INSERT INTO etablissements (id, slug, nom, is_active) VALUES
    (e,  'ctl-rempl-'   || left(e::text, 8),  'CONTROLE REMPLACANTS', true),
    (e2, 'ctl-rempl-b-' || left(e2::text, 8), 'CONTROLE REMPLACANTS B', true);
  INSERT INTO school_years (id, etablissement_id, label) VALUES (y, e, 'CTL-1');
  INSERT INTO classes (id, etablissement_id, name, level, academic_year) VALUES
    (ce1, e, 'CE1', 'CTL', 'CTL-1'), (cm1, e, 'CM1', 'CTL', 'CTL-1');

  FOREACH v_role IN ARRAY ARRAY['direction', 'admin', 'responsable_pedagogique', 'secretaire', 'comptable',
                                'enseignant', 'remplacant', 'parent', 'autre_direction', 'inactif'] LOOP
    i := i + 1;
    v_id := gen_random_uuid();
    INSERT INTO auth.users (id, email, aud, role)
    VALUES (v_id, 'ctl-rempl-' || i || '-' || left(e::text, 8) || '@exemple.invalid', 'authenticated', 'authenticated');
    INSERT INTO profiles (id, email, role, first_name, last_name, etablissement_id, is_active)
    VALUES (v_id, 'ctl-rempl-' || i || '-' || left(e::text, 8) || '@exemple.invalid',
            CASE v_role WHEN 'autre_direction' THEN 'direction' WHEN 'remplacant' THEN 'enseignant'
                        WHEN 'inactif' THEN 'secretaire' ELSE v_role END,
            'Controle', upper(v_role), CASE WHEN v_role = 'autre_direction' THEN e2 ELSE e END, v_role <> 'inactif');
    CASE v_role
      WHEN 'direction' THEN dir := v_id;
      WHEN 'admin' THEN adm := v_id;
      WHEN 'secretaire' THEN sec := v_id;
      WHEN 'comptable' THEN cpt := v_id;
      WHEN 'enseignant' THEN ens := v_id;
      WHEN 'remplacant' THEN rem := v_id;
      WHEN 'autre_direction' THEN dir2 := v_id;
      ELSE NULL;
    END CASE;
  END LOOP;

  INSERT INTO teachers (id, etablissement_id, user_id, first_name, last_name, employee_number, email) VALUES
    (t_abs, e, ens, 'Controle', 'ABSENT',     'CTL-A-' || left(e::text, 8), 'ctl-rempl-ens@exemple.invalid'),
    (t_rem, e, rem, 'Controle', 'REMPLACANT', 'CTL-R-' || left(e::text, 8), 'ctl-rempl-rem@exemple.invalid');
  INSERT INTO class_teachers (class_id, teacher_id, is_main_teacher, effective_from) VALUES
    (ce1, t_abs, true, '2026-09-01'), (cm1, t_rem, true, '2026-09-01');
  INSERT INTO schedule_slots (id, etablissement_id, school_year_id, class_id, is_recurring, day_of_week,
                              start_time, end_time, slot_type, is_active, effective_from) VALUES
    (s_aprem, e, y, ce1, true, 3, '14:00', '16:00', 'cours', true, '2026-09-01'),
    (s_cm1,   e, y, cm1, true, 3, '14:30', '15:30', 'cours', true, '2026-09-01');

  r := pg_temp.ctl30(dir, format(
    'SELECT enregistrer_absence_enseignant(NULL, %L, %L, %L, %L)', t_abs, '2026-11-04 10:00', '2026-11-04 18:00', 'maladie'));
  a1 := CASE WHEN r LIKE 'ok:%' THEN substr(r, 4)::uuid END;
  seance := json_build_array(json_build_object('slot_id', s_aprem, 'date', '2026-11-04'))::jsonb;

  -- Liste : NOM (= role) et raison d'occupation, dans l'ordre rendu.
  liste := format($q$SELECT string_agg(p.last_name || '=' || coalesce(r.occupe, 'libre'), ' ' ORDER BY p.last_name)
                       FROM remplacants_possibles(%L, %L) r JOIN profiles p ON p.id = r.profile_id$q$, a1, seance);
  essais := essais || ARRAY[['liste de la direction',
    'ok:COMPTABLE=libre DIRECTION=libre REMPLACANT=CM1 · 14:30-15:30 RESPONSABLE_PEDAGOGIQUE=libre SECRETAIRE=libre',
    pg_temp.ctl30(dir, liste)]];
  essais := essais || ARRAY[['liste de la secretaire', 'ok', left(pg_temp.ctl30(sec, liste), 2)]];
  essais := essais || ARRAY[['liste du comptable', 'ABSENCE_REFUSEE', pg_temp.ctl30(cpt, liste)]];
  essais := essais || ARRAY[['liste de l''enseignant', 'ABSENCE_REFUSEE', pg_temp.ctl30(ens, liste)]];
  essais := essais || ARRAY[['liste d''une autre ecole', 'ABSENCE_INTROUVABLE', pg_temp.ctl30(dir2, liste)]];
  essais := essais || ARRAY[['liste anonyme', 'droits', pg_temp.ctl30(NULL, liste)]];

  essais := essais || ARRAY[['remplace par le compte admin', 'ABSENCE_REMPLACANT', pg_temp.ctl30(dir, format(
    'SELECT decider_seances_absence(%L, %L)::text', a1,
    json_build_array(json_build_object('slot_id', s_aprem, 'date', '2026-11-04', 'decision', 'remplacee', 'remplacant', adm))))]];
  essais := essais || ARRAY[['remplace par la direction', 'ok:{"retablies": []}', pg_temp.ctl30(dir, format(
    'SELECT decider_seances_absence(%L, %L)::text', a1,
    json_build_array(json_build_object('slot_id', s_aprem, 'date', '2026-11-04', 'decision', 'remplacee', 'remplacant', dir))))]];
  -- La seance elle-meme n'occupe pas son propre remplacant.
  essais := essais || ARRAY[['liste apres decision', 'ok:DIRECTION=libre',
    pg_temp.ctl30(dir, replace(liste, 'ORDER BY p.last_name)', 'ORDER BY p.last_name) FILTER (WHERE p.last_name = ''DIRECTION'')'))]];

  FOR i IN 1 .. array_length(essais, 1) LOOP
    IF essais[i][2] <> essais[i][3] THEN nb_ko := nb_ko + 1; END IF;
    rapport := rapport || E'\n[' || CASE WHEN essais[i][2] = essais[i][3] THEN 'OK' ELSE 'KO' END || '] '
      || rpad(essais[i][1], 34) || essais[i][3]
      || CASE WHEN essais[i][2] <> essais[i][3] THEN E'\n     attendu' || repeat(' ', 30) || essais[i][2] ELSE '' END;
  END LOOP;
  IF array_length(essais, 1) IS DISTINCT FROM 9 THEN
    nb_ko := nb_ko + 1;
    rapport := rapport || E'\n[KO] ' || coalesce(array_length(essais, 1), 0) || ' essais menes, 9 attendus';
  END IF;

  RAISE EXCEPTION 'CONTROLE 30 : % KO (tout est annule)%', nb_ko, rapport;
END
$ctl$;
