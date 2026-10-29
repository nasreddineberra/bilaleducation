-- ============================================================================
-- CONTROLE 33 — Absences enseignants visibles de tout le personnel (29/10)
--
-- Deux ecoles JETABLES ; dans la premiere, deux enseignants absents (un
-- « maladie », un « personnel ») et un compte par role. Verifie, sous l'identite
-- de chaque compte, ce que rend `absences_enseignants_information` :
--   - tout le personnel (enseignant compris) lit les DEUX absences de l'ecole,
--     avec le nom de l'enseignant ;
--   - parent, anonyme et direction d'une autre ecole ne lisent rien ;
--   - la periode borne le resultat (jours compris) ;
--   - le motif est rendu au personnel (decision du 29/10, migration
--     absences-enseignants-information-motif.sql) ;
--   - la table reste fermee : l'enseignant n'y lit que SON absence.
-- Migrations : supabase/migrations/absences-enseignants-information.sql et
-- absences-enseignants-information-motif.sql.
-- LECTURE SEULE : exception volontaire finale, tout est annule.
-- ============================================================================

CREATE OR REPLACE FUNCTION pg_temp.ctl33(p_compte uuid, p_sql text)
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
  t1  uuid := gen_random_uuid();
  t2  uuid := gen_random_uuid();
  ids uuid[] := '{}';
  dir uuid; adm uuid; resp uuid; sec uuid; cpt uuid; ens uuid; ens2 uuid; par uuid; dir2 uuid;
  v_role text; v_id uuid; i integer := 0;
  r text; attendu text;
  rapport text := '';
  nb_ko integer := 0;
  essais text[][] := '{}';
BEGIN
  INSERT INTO etablissements (id, slug, nom, is_active) VALUES
    (e,  'ctl-info-'   || left(e::text, 8),  'CONTROLE INFORMATION', true),
    (e2, 'ctl-info-b-' || left(e2::text, 8), 'CONTROLE INFORMATION B', true);

  FOREACH v_role IN ARRAY ARRAY['direction', 'admin', 'responsable_pedagogique', 'secretaire', 'comptable',
                                'enseignant', 'enseignant2', 'parent', 'autre_direction'] LOOP
    i := i + 1;
    v_id := gen_random_uuid();
    INSERT INTO auth.users (id, email, aud, role)
    VALUES (v_id, 'ctl-info-' || i || '-' || left(e::text, 8) || '@exemple.invalid', 'authenticated', 'authenticated');
    INSERT INTO profiles (id, email, role, first_name, last_name, etablissement_id, is_active)
    VALUES (v_id, 'ctl-info-' || i || '-' || left(e::text, 8) || '@exemple.invalid',
            CASE v_role WHEN 'autre_direction' THEN 'direction' WHEN 'enseignant2' THEN 'enseignant' ELSE v_role END,
            'Controle', upper(v_role), CASE WHEN v_role = 'autre_direction' THEN e2 ELSE e END, true);
    CASE v_role
      WHEN 'direction' THEN dir := v_id;
      WHEN 'admin' THEN adm := v_id;
      WHEN 'responsable_pedagogique' THEN resp := v_id;
      WHEN 'secretaire' THEN sec := v_id;
      WHEN 'comptable' THEN cpt := v_id;
      WHEN 'enseignant' THEN ens := v_id;
      WHEN 'enseignant2' THEN ens2 := v_id;
      WHEN 'parent' THEN par := v_id;
      ELSE dir2 := v_id;
    END CASE;
    ids := ids || v_id;
  END LOOP;

  INSERT INTO teachers (id, etablissement_id, user_id, first_name, last_name, employee_number, email) VALUES
    (t1, e, ens,  'Controle', 'PREMIER', 'CTL-I1-' || left(e::text, 8), 'ctl-info-1@exemple.invalid'),
    (t2, e, ens2, 'Controle', 'SECOND',  'CTL-I2-' || left(e::text, 8), 'ctl-info-2@exemple.invalid');
  -- Ecriture directe (droits du proprietaire) : le controle ne porte pas sur la declaration.
  INSERT INTO absences_enseignants (etablissement_id, teacher_id, debut, fin, motif) VALUES
    (e, t1, '2026-11-04 08:00', '2026-11-06 18:00', 'maladie'),
    (e, t2, '2026-11-10 14:00', '2026-11-10 16:00', 'personnel');

  -- ── Lecture par role (periode novembre : les deux absences) ───────────────
  FOREACH v_role IN ARRAY ARRAY['direction', 'admin', 'responsable_pedagogique', 'secretaire', 'comptable',
                                'enseignant', 'parent', 'anonyme', 'autre_direction'] LOOP
    r := pg_temp.ctl33(CASE v_role WHEN 'direction' THEN dir WHEN 'admin' THEN adm
                                   WHEN 'responsable_pedagogique' THEN resp WHEN 'secretaire' THEN sec
                                   WHEN 'comptable' THEN cpt WHEN 'enseignant' THEN ens WHEN 'parent' THEN par
                                   WHEN 'anonyme' THEN NULL ELSE dir2 END,
      $q$SELECT count(*) || ':' || coalesce(string_agg(last_name, ',' ORDER BY debut), '')
           FROM absences_enseignants_information('2026-11-01', '2026-11-30')$q$);
    attendu := CASE WHEN v_role IN ('parent', 'autre_direction') THEN 'ok:0:'
                    WHEN v_role = 'anonyme' THEN 'droits'
                    ELSE 'ok:2:PREMIER,SECOND' END;
    essais := essais || ARRAY[[v_role || ' lit les absences', attendu, r]];
  END LOOP;

  -- ── Periode (jours compris) ───────────────────────────────────────────────
  essais := essais || ARRAY[['periode 06/11 (dernier jour du 1er)', 'ok:1', pg_temp.ctl33(ens2,
    $q$SELECT count(*) FROM absences_enseignants_information('2026-11-06', '2026-11-06')$q$)]];
  essais := essais || ARRAY[['periode 07/11-09/11 (entre les deux)', 'ok:0', pg_temp.ctl33(ens2,
    $q$SELECT count(*) FROM absences_enseignants_information('2026-11-07', '2026-11-09')$q$)]];
  essais := essais || ARRAY[['periode 10/11 (le second)', 'ok:1', pg_temp.ctl33(dir,
    $q$SELECT count(*) FROM absences_enseignants_information('2026-11-10', '2026-11-10')$q$)]];

  -- ── Le motif, rendu au personnel ──────────────────────────────────────────
  essais := essais || ARRAY[['motifs lus par un collegue', 'ok:maladie,personnel', pg_temp.ctl33(ens2,
    $q$SELECT string_agg(motif, ',' ORDER BY debut)
         FROM absences_enseignants_information('2026-11-01', '2026-11-30')$q$)]];

  -- ── La table reste fermee ─────────────────────────────────────────────────
  essais := essais || ARRAY[['enseignant lit la table (la sienne)', 'ok:1', pg_temp.ctl33(ens,
    'SELECT count(*) FROM absences_enseignants')]];

  -- ── Rapport ───────────────────────────────────────────────────────────────
  FOR i IN 1 .. array_length(essais, 1) LOOP
    IF essais[i][2] <> essais[i][3] THEN nb_ko := nb_ko + 1; END IF;
    rapport := rapport || E'\n[' || CASE WHEN essais[i][2] = essais[i][3] THEN 'OK' ELSE 'KO' END || '] '
      || rpad(essais[i][1], 44) || essais[i][3]
      || CASE WHEN essais[i][2] <> essais[i][3] THEN E'\n     attendu' || repeat(' ', 40) || essais[i][2] ELSE '' END;
  END LOOP;
  IF array_length(essais, 1) IS DISTINCT FROM 14 THEN
    nb_ko := nb_ko + 1;
    rapport := rapport || E'\n[KO] ' || coalesce(array_length(essais, 1), 0) || ' essais menes, 14 attendus';
  END IF;

  RAISE EXCEPTION 'CONTROLE 33 : % KO (tout est annule)%', nb_ko, rapport;
END
$ctl$;
