-- ============================================================================
-- CONTROLE 36 — Historisation avant purge (02/11)
--
-- Ecole JETABLE, annee archivee (passee, close). Verifie :
--   - `verifier_historisation` refusee au comptable, ouverte a la direction ;
--   - archive incomplete (eleve et classe sans historique, bilan absent) =
--     manques listes ET purge refusee ;
--   - archive complete = liste vide ;
--   - une depense AJOUTEE puis SUPPRIMEE apres l'archivage se voit (releve) ;
--   - une donnee MODIFIEE apres l'archivage se voit (date) ;
--   - archive complete et a jour = purge acceptee.
-- Migration : supabase/migrations/historisation-avant-purge.sql.
-- LECTURE SEULE : exception volontaire finale, tout est annule.
-- ============================================================================

CREATE OR REPLACE FUNCTION pg_temp.ctl36(p_compte uuid, p_sql text)
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
    WHEN insufficient_privilege THEN RETURN 'droits';
    WHEN others THEN RETURN SQLERRM;
  END;
END
$f$;

DO $ctl$
DECLARE
  e   uuid := gen_random_uuid();
  y   uuid := gen_random_uuid();
  c   uuid := gen_random_uuid();
  s   uuid := gen_random_uuid();
  dep uuid := gen_random_uuid();
  dir uuid := gen_random_uuid();
  cpt uuid := gen_random_uuid();
  manques text;
  r text;
  i integer;
  rapport text := '';
  nb_ko integer := 0;
  essais text[][] := '{}';
BEGIN
  manques := format('SELECT string_agg(m->>''code'', '','' ORDER BY m->>''code'') FROM jsonb_array_elements(verifier_historisation(%L)) m', y);

  INSERT INTO etablissements (id, slug, nom, is_active) VALUES (e, 'ctl-histo-' || left(e::text, 8), 'CONTROLE HISTORISATION', true);
  -- Archivee DANS une heure : tout ce que le controle cree est « avant l'archivage ».
  INSERT INTO school_years (id, etablissement_id, label, is_current, start_date, end_date, closed_at, archived_at)
  VALUES (y, e, 'CTL-36', false, '2025-09-01', '2026-06-30', now(), now() + interval '1 hour');
  INSERT INTO classes (id, etablissement_id, name, level, academic_year) VALUES (c, e, 'CE1', 'CTL', 'CTL-36');
  INSERT INTO students (id, etablissement_id, student_number, first_name, last_name, date_of_birth, is_active)
  VALUES (s, e, 'CTL-36-' || left(e::text, 8), 'Eleve', 'CTL36', '2015-01-01', true);
  INSERT INTO enrollments (student_id, class_id, status) VALUES (s, c, 'active');
  INSERT INTO expenses (etablissement_id, school_year_id, label, amount, expense_date)
  VALUES (e, y, 'Fournitures', 10, '2026-01-15');

  FOR i IN 1 .. 2 LOOP
    INSERT INTO auth.users (id, email, aud, role)
    VALUES (CASE i WHEN 1 THEN dir ELSE cpt END, 'ctl-histo-' || i || '-' || left(e::text, 8) || '@exemple.invalid', 'authenticated', 'authenticated');
    INSERT INTO profiles (id, email, role, first_name, last_name, etablissement_id, is_active)
    VALUES (CASE i WHEN 1 THEN dir ELSE cpt END, 'ctl-histo-' || i || '-' || left(e::text, 8) || '@exemple.invalid',
            CASE i WHEN 1 THEN 'direction' ELSE 'comptable' END, 'Controle', 'HISTO', e, true);
  END LOOP;

  -- ── Droits ────────────────────────────────────────────────────────────────
  essais := essais || ARRAY[['comptable : verification refusee', 'droits', pg_temp.ctl36(cpt, manques)]];

  -- ── Archive incomplete ────────────────────────────────────────────────────
  essais := essais || ARRAY[['archive incomplete : manques', 'ok:bilan,classes,eleves', pg_temp.ctl36(dir, manques)]];
  r := pg_temp.ctl36(dir, format('SELECT (purge_school_year(%L))->>''label''', y));
  essais := essais || ARRAY[['archive incomplete : purge', 'refusee',
    CASE WHEN r LIKE '%historisation incomplete%' THEN 'refusee' ELSE r END]];

  -- ── Archive complete ──────────────────────────────────────────────────────
  INSERT INTO student_year_history (etablissement_id, school_year_id, year_label, participant_type, student_id, last_name, first_name)
  VALUES (e, y, 'CTL-36', 'student', s, 'CTL36', 'Eleve');
  INSERT INTO class_year_history (etablissement_id, school_year_id, year_label, class_id, class_name)
  VALUES (e, y, 'CTL-36', c, 'CE1');
  r := pg_temp.ctl36(dir, format('SELECT releve_historisation(%L)::text', y));
  INSERT INTO bilans_financiers (etablissement_id, school_year_id, year_label, chiffres, comptages)
  VALUES (e, y, 'CTL-36', '{}'::jsonb, substr(r, 4)::jsonb);
  essais := essais || ARRAY[['archive complete : aucun manque', 'ok', pg_temp.ctl36(dir, manques)]];

  -- ── Ajout puis suppression apres l'archivage ──────────────────────────────
  INSERT INTO expenses (id, etablissement_id, school_year_id, label, amount, expense_date)
  VALUES (dep, e, y, 'Oubli', 5, '2026-06-01');
  essais := essais || ARRAY[['depense ajoutee : vue', 'ok:releve_depenses', pg_temp.ctl36(dir, manques)]];
  DELETE FROM expenses WHERE id = dep;
  DELETE FROM expenses WHERE school_year_id = y;
  essais := essais || ARRAY[['depense supprimee : vue', 'ok:releve_depenses', pg_temp.ctl36(dir, manques)]];
  INSERT INTO expenses (etablissement_id, school_year_id, label, amount, expense_date)
  VALUES (e, y, 'Fournitures', 10, '2026-01-15');
  essais := essais || ARRAY[['releve retabli : aucun manque', 'ok', pg_temp.ctl36(dir, manques)]];

  -- ── Modification apres l'archivage ────────────────────────────────────────
  UPDATE school_years SET archived_at = now() - interval '1 hour' WHERE id = y;
  essais := essais || ARRAY[['depense modifiee : vue', 'ok:finance_modifiee', pg_temp.ctl36(dir, manques)]];
  UPDATE school_years SET archived_at = now() + interval '1 hour' WHERE id = y;

  -- ── Purge acceptee ────────────────────────────────────────────────────────
  essais := essais || ARRAY[['archive a jour : purge', 'ok:CTL-36',
    pg_temp.ctl36(dir, format('SELECT (purge_school_year(%L))->>''label''', y))]];

  FOR i IN 1 .. array_length(essais, 1) LOOP
    IF essais[i][2] <> essais[i][3] THEN nb_ko := nb_ko + 1; END IF;
    rapport := rapport || E'\n[' || CASE WHEN essais[i][2] = essais[i][3] THEN 'OK' ELSE 'KO' END || '] '
      || rpad(essais[i][1], 42) || essais[i][3]
      || CASE WHEN essais[i][2] <> essais[i][3] THEN E'\n     attendu' || repeat(' ', 38) || essais[i][2] ELSE '' END;
  END LOOP;
  IF array_length(essais, 1) IS DISTINCT FROM 9 THEN
    nb_ko := nb_ko + 1;
    rapport := rapport || E'\n[KO] ' || coalesce(array_length(essais, 1), 0) || ' essais menes, 9 attendus';
  END IF;

  RAISE EXCEPTION 'CONTROLE 36 : % KO (tout est annule)%', nb_ko, rapport;
END
$ctl$;
