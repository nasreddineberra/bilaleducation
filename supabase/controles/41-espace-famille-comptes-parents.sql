-- ============================================================================
-- CONTROLE 41 — Espace famille, liste des comptes parents (03/11)
--
-- E1 : foyer F1 (tuteur 1 relie a P1, invite, configure), direction et
-- secretaire. E2 : foyer F2 (tuteur 1 relie a P2), direction.
-- Verifie : `comptes_parents_ecole` refusee au parent et a l'enseignant, ouverte
-- a la direction et a la secretaire (03/11) ; chacun ne voit que SON ecole ; les dates
-- d'invitation et de configuration remontent ; anon ne l'execute pas.
-- Migration : supabase/migrations/espace-famille-comptes-parents.sql.
-- LECTURE SEULE : exception volontaire finale, tout est annule.
-- ============================================================================

CREATE OR REPLACE FUNCTION pg_temp.ctl41(p_compte uuid, p_sql text)
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
  e1 uuid := gen_random_uuid();  e2 uuid := gen_random_uuid();
  f1 uuid := gen_random_uuid();  f2 uuid := gen_random_uuid();
  dir1 uuid := gen_random_uuid(); sec1 uuid := gen_random_uuid(); dir2 uuid := gen_random_uuid();
  p1 uuid := gen_random_uuid();  p2 uuid := gen_random_uuid();
  sx text := left(e1::text, 8);
  liste text := 'SELECT string_agg(last_name || '':'' || tutor_number || '':'' || (invite_le IS NOT NULL) || '':'' || (configure_le IS NOT NULL), '','') FROM comptes_parents_ecole()';
  i integer;
  rapport text := '';
  nb_ko integer := 0;
  attendus constant integer := 6;
  essais text[][] := '{}';
BEGIN
  INSERT INTO etablissements (id, slug, nom, is_active) VALUES
    (e1, 'ctl-comptes-1-' || sx, 'CONTROLE COMPTES 1', true),
    (e2, 'ctl-comptes-2-' || sx, 'CONTROLE COMPTES 2', true);
  FOR i IN 1 .. 5 LOOP
    INSERT INTO auth.users (id, email, aud, role)
    VALUES ((ARRAY[dir1, sec1, dir2, p1, p2])[i], 'ctl41-' || i || '-' || sx || '@exemple.invalid', 'authenticated', 'authenticated');
    INSERT INTO profiles (id, email, role, first_name, last_name, etablissement_id, is_active)
    VALUES ((ARRAY[dir1, sec1, dir2, p1, p2])[i], 'ctl41-' || i || '-' || sx || '@exemple.invalid',
            (ARRAY['direction', 'secretaire', 'direction', 'parent', 'parent'])[i], 'Compte',
            (ARRAY['DIR1', 'SEC1', 'DIR2', 'UN', 'DEUX'])[i],
            CASE WHEN i IN (3, 5) THEN e2 ELSE e1 END, true);
  END LOOP;
  INSERT INTO parents (id, etablissement_id, tutor1_last_name, tutor1_first_name, tutor1_relationship, tutor1_email,
                       tutor1_user_id, tutor1_invite_le, tutor1_acces_configure_le) VALUES
    (f1, e1, 'UN', 'Ctl', 'père', 'f1@exemple.invalid', p1, now(), now()),
    (f2, e2, 'DEUX', 'Ctl', 'père', 'f2@exemple.invalid', p2, now(), NULL);

  essais := essais || ARRAY[['secretaire : son ecole', 'ok:UN:1:true:true', pg_temp.ctl41(sec1, liste)]];
  essais := essais || ARRAY[['parent', 'droits', pg_temp.ctl41(p1, liste)]];
  essais := essais || ARRAY[['direction E1 : son ecole, dates', 'ok:UN:1:true:true', pg_temp.ctl41(dir1, liste)]];
  essais := essais || ARRAY[['direction E2 : son ecole', 'ok:DEUX:1:true:false', pg_temp.ctl41(dir2, liste)]];
  essais := essais || ARRAY[['derniere connexion lisible', 'ok:1',
    pg_temp.ctl41(dir1, 'SELECT count(*)::text FROM comptes_parents_ecole() WHERE derniere_connexion IS NULL')]];
  essais := essais || ARRAY[['anon : execution', 'refusee',
    CASE WHEN to_regprocedure('public.comptes_parents_ecole()') IS NULL THEN 'absente'
         WHEN has_function_privilege('anon', 'public.comptes_parents_ecole()', 'EXECUTE') THEN 'permise'
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

  RAISE EXCEPTION 'CONTROLE 41 : % KO (tout est annule)%', nb_ko, rapport;
END
$ctl$;
