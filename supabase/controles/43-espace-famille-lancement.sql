-- ============================================================================
-- CONTROLE 43 — Espace famille : deux interrupteurs, colonnes de l'editeur (03/11)
--
-- E1 : direction, secretaire, foyer F1 (tuteur 1 = parent P1).
-- Verifie :
--   - la direction (requete de l'application) ne modifie ni abonnement, ni
--     ecole active, ni limite d'inscrits, ni adresse, ni option ; elle modifie
--     son nom et l'interrupteur de l'etablissement ;
--   - le serveur (service role) modifie l'option ;
--   - etablissement jamais ouvert sans l'option ; option non desactivable tant
--     que l'etablissement l'a ouvert ;
--   - la secretaire ne touche pas l'interrupteur ;
--   - parent : foyer seulement avec les DEUX ; invitation refusee si l'ecole
--     n'a pas ouvert.
-- Migration : supabase/migrations/espace-famille-lancement.sql.
-- LECTURE SEULE : exception volontaire finale, tout est annule.
-- ============================================================================

CREATE OR REPLACE FUNCTION pg_temp.ctl43(p_compte uuid, p_sql text, p_role text DEFAULT 'authenticated')
RETURNS text
LANGUAGE plpgsql
AS $f$
DECLARE
  v text;
BEGIN
  BEGIN
    PERFORM set_config('role', CASE WHEN p_role = 'service_role' THEN 'service_role' ELSE 'authenticated' END, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', p_compte, 'role', p_role)::text, true);
    EXECUTE p_sql INTO v;
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', NULL, true);
    RETURN 'ok' || coalesce(':' || nullif(v, ''), '');
  EXCEPTION
    WHEN insufficient_privilege THEN
      RESET ROLE;
      RETURN 'droits';
    WHEN check_violation THEN
      RESET ROLE;
      RETURN 'incoherent';
    WHEN others THEN
      RESET ROLE;
      RETURN CASE WHEN SQLERRM LIKE '%pas ouvert%' THEN 'non ouvert' ELSE SQLERRM END;
  END;
END
$f$;

DO $ctl$
DECLARE
  e1 uuid := gen_random_uuid();  f1 uuid := gen_random_uuid();
  dir uuid := gen_random_uuid(); sec uuid := gen_random_uuid(); p1 uuid := gen_random_uuid();
  u9 uuid := gen_random_uuid();
  sx text := left(e1::text, 8);
  maj text := 'WITH u AS (UPDATE etablissements SET %s WHERE id = %L RETURNING 1) SELECT count(*)::text FROM u';
  foyer text;
  i integer;
  rapport text := '';
  nb_ko integer := 0;
  attendus constant integer := 16;
  essais text[][] := '{}';
BEGIN
  foyer := format('SELECT CASE foyer_du_compte() WHEN %L THEN ''F1'' END', f1);
  INSERT INTO etablissements (id, slug, nom, is_active) VALUES (e1, 'ctl-lancement-' || sx, 'CONTROLE LANCEMENT', true);
  FOR i IN 1 .. 4 LOOP
    INSERT INTO auth.users (id, email, aud, role)
    VALUES ((ARRAY[dir, sec, p1, u9])[i], 'ctl43-' || i || '-' || sx || '@exemple.invalid', 'authenticated', 'authenticated');
  END LOOP;
  FOR i IN 1 .. 3 LOOP
    INSERT INTO profiles (id, email, role, first_name, last_name, etablissement_id, is_active)
    VALUES ((ARRAY[dir, sec, p1])[i], 'ctl43-' || i || '-' || sx || '@exemple.invalid',
            (ARRAY['direction', 'secretaire', 'parent'])[i], 'Compte', 'CTL43', e1, true);
  END LOOP;
  INSERT INTO parents (id, etablissement_id, tutor1_last_name, tutor1_first_name, tutor1_relationship, tutor1_email, tutor1_user_id)
  VALUES (f1, e1, 'UN', 'Ctl', 'père', 'f1@exemple.invalid', p1);

  -- ── Colonnes de l'editeur ─────────────────────────────────────────────────
  essais := essais || ARRAY[['direction : abonnement', 'droits', pg_temp.ctl43(dir, format(maj, 'subscription_expires_at = ''2099-01-01''', e1))]];
  essais := essais || ARRAY[['direction : ecole active', 'droits', pg_temp.ctl43(dir, format(maj, 'is_active = false', e1))]];
  essais := essais || ARRAY[['direction : limite d''inscrits', 'droits', pg_temp.ctl43(dir, format(maj, 'max_students = 9999', e1))]];
  essais := essais || ARRAY[['direction : adresse (slug)', 'droits', pg_temp.ctl43(dir, format(maj, 'slug = ''autre-' || sx || '''', e1))]];
  essais := essais || ARRAY[['direction : option', 'droits', pg_temp.ctl43(dir, format(maj, 'option_espace_famille = true', e1))]];
  essais := essais || ARRAY[['direction : son nom', 'ok:1', pg_temp.ctl43(dir, format(maj, 'nom = ''CONTROLE LANCEMENT BIS''', e1))]];
  essais := essais || ARRAY[['direction : ouvrir sans l''option', 'incoherent', pg_temp.ctl43(dir, format(maj, 'espace_famille_ouvert = true', e1))]];
  essais := essais || ARRAY[['serveur : option activee', 'ok:1', pg_temp.ctl43(dir, format(maj, 'option_espace_famille = true', e1), 'service_role')]];

  -- ── Option active, etablissement ferme ────────────────────────────────────
  essais := essais || ARRAY[['parent : option seule', 'ok', pg_temp.ctl43(p1, foyer)]];
  essais := essais || ARRAY[['invitation : ecole non ouverte', 'non ouvert',
    pg_temp.ctl43(dir, format('SELECT (preparer_invitation_tuteur(%L, 1::smallint, %L, ''J1''))->>''email''', f1, u9))]];
  essais := essais || ARRAY[['secretaire : ouvrir', 'ok:0', pg_temp.ctl43(sec, format(maj, 'espace_famille_ouvert = true', e1))]];
  essais := essais || ARRAY[['direction : ouvrir', 'ok:1', pg_temp.ctl43(dir, format(maj, 'espace_famille_ouvert = true', e1))]];
  essais := essais || ARRAY[['parent : les deux', 'ok:F1', pg_temp.ctl43(p1, foyer)]];
  essais := essais || ARRAY[['serveur : couper l''option, ecole ouverte', 'incoherent',
    pg_temp.ctl43(dir, format(maj, 'option_espace_famille = false', e1), 'service_role')]];
  essais := essais || ARRAY[['direction : fermer (comptes conserves)', 'ok:1', pg_temp.ctl43(dir, format(maj, 'espace_famille_ouvert = false', e1))]];
  essais := essais || ARRAY[['parent : etablissement ferme', 'ok', pg_temp.ctl43(p1, foyer)]];

  FOR i IN 1 .. array_length(essais, 1) LOOP
    IF essais[i][2] IS DISTINCT FROM essais[i][3] THEN nb_ko := nb_ko + 1; END IF;
    rapport := rapport || E'\n[' || CASE WHEN essais[i][2] IS NOT DISTINCT FROM essais[i][3] THEN 'OK' ELSE 'KO' END || '] '
      || rpad(essais[i][1], 44) || coalesce(essais[i][3], '(null)')
      || CASE WHEN essais[i][2] IS DISTINCT FROM essais[i][3] THEN E'\n     attendu' || repeat(' ', 40) || essais[i][2] ELSE '' END;
  END LOOP;
  IF array_length(essais, 1) IS DISTINCT FROM attendus THEN
    nb_ko := nb_ko + 1;
    rapport := rapport || E'\n[KO] ' || coalesce(array_length(essais, 1), 0) || ' essais menes, ' || attendus || ' attendus';
  END IF;

  RAISE EXCEPTION 'CONTROLE 43 : % KO (tout est annule)%', nb_ko, rapport;
END
$ctl$;
