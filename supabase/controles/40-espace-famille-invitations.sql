-- ============================================================================
-- CONTROLE 40 — Espace famille, invitations (03/11)
--
-- E1 avec l'option, E2 sans. F1 (E1) : tuteur 1 avec email, tuteur 2 sans email.
-- F3 (E2). Comptes : direction, secretaire, comptable, enseignant de E1 ;
-- direction de E2 ; U1 et U9 (comptes d'authentification sans profil, comme
-- juste apres la creation par l'API admin).
-- Verifie :
--   - `invitations_famille` illisible hors serveur ;
--   - `preparer_invitation_tuteur` : refusee a l'enseignant et au comptable ;
--     acceptee a la secretaire (profil cree, tuteur relie, date posee, jeton) ;
--     renvoi = l'ancien jeton annule ; tuteur sans email, ecole sans option,
--     foyer d'une autre ecole, tuteur deja relie a un autre compte : refuses ;
--   - garde : un tuteur ne designe qu'un compte parent de son ecole ;
--   - profil desactive = plus de foyer ;
--   - `marquer_acces_configure` : pose la date de SA place, rien pour le personnel.
-- Migration : supabase/migrations/espace-famille-invitations.sql.
-- LECTURE SEULE : exception volontaire finale, tout est annule.
-- ============================================================================

CREATE OR REPLACE FUNCTION pg_temp.ctl40(p_compte uuid, p_sql text)
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
      RETURN CASE
        WHEN SQLERRM LIKE '%pas d''adresse email%' THEN 'sans email'
        WHEN SQLERRM LIKE '%pas ouvert%' THEN 'option coupee'
        WHEN SQLERRM LIKE 'Foyer introuvable%' THEN 'introuvable'
        WHEN SQLERRM LIKE '%deja relie%' THEN 'deja relie'
        ELSE SQLERRM END;
  END;
END
$f$;

CREATE OR REPLACE FUNCTION pg_temp.ctl40_refus(p_sql text)
RETURNS text
LANGUAGE plpgsql
AS $f$
BEGIN
  BEGIN
    EXECUTE p_sql;
    RETURN 'accepte';
  EXCEPTION
    WHEN check_violation THEN RETURN 'refuse';
    WHEN others THEN RETURN SQLERRM;
  END;
END
$f$;

-- Etat des deux jetons (fonction : la table n'existe pas avant la migration).
CREATE OR REPLACE FUNCTION pg_temp.ctl40_jetons()
RETURNS text
LANGUAGE plpgsql
AS $f$
DECLARE
  v text;
BEGIN
  EXECUTE $q$
    SELECT (SELECT 'J1 ' || CASE WHEN annule_le IS NOT NULL THEN 'annule' ELSE 'actif' END FROM invitations_famille WHERE empreinte = 'J1')
        || '/' ||
           (SELECT 'J2 ' || CASE WHEN annule_le IS NULL AND expire_le BETWEEN now() + interval '6 days 23 hours' AND now() + interval '7 days 1 hour' THEN '7j' ELSE '?' END FROM invitations_famille WHERE empreinte = 'J2')
  $q$ INTO v;
  RETURN v;
END
$f$;

DO $ctl$
DECLARE
  e1 uuid := gen_random_uuid();  e2 uuid := gen_random_uuid();
  f1 uuid := gen_random_uuid();  f3 uuid := gen_random_uuid();
  dir uuid := gen_random_uuid(); sec uuid := gen_random_uuid();
  cpt uuid := gen_random_uuid(); ens uuid := gen_random_uuid();
  dir2 uuid := gen_random_uuid();
  u1 uuid := gen_random_uuid();  u9 uuid := gen_random_uuid();  u3 uuid := gen_random_uuid();
  sx text := left(e1::text, 8);
  prep text;
  r text;
  i integer;
  rapport text := '';
  nb_ko integer := 0;
  attendus constant integer := 20;
  essais text[][] := '{}';
BEGIN
  prep := 'SELECT (preparer_invitation_tuteur(%L, %s::smallint, %L, %L))->>''email''';

  INSERT INTO etablissements (id, slug, nom, is_active) VALUES
    (e1, 'ctl-invit-1-' || sx, 'CONTROLE INVITATION 1', true),
    (e2, 'ctl-invit-2-' || sx, 'CONTROLE INVITATION 2', true);
  UPDATE etablissements SET option_espace_famille = true WHERE id = e1;

  FOR i IN 1 .. 8 LOOP
    INSERT INTO auth.users (id, email, aud, role)
    VALUES ((ARRAY[dir, sec, cpt, ens, dir2, u1, u9, u3])[i], 'ctl40-' || i || '-' || sx || '@exemple.invalid', 'authenticated', 'authenticated');
  END LOOP;
  FOR i IN 1 .. 5 LOOP
    INSERT INTO profiles (id, email, role, first_name, last_name, etablissement_id, is_active)
    VALUES ((ARRAY[dir, sec, cpt, ens, dir2])[i], 'ctl40-' || i || '-' || sx || '@exemple.invalid',
            (ARRAY['direction', 'secretaire', 'comptable', 'enseignant', 'direction'])[i], 'Compte' || i, 'CTL40',
            CASE i WHEN 5 THEN e2 ELSE e1 END, true);
  END LOOP;
  -- U3 : un compte parent de E2 (pour la garde « meme ecole »).
  INSERT INTO profiles (id, email, role, first_name, last_name, etablissement_id, is_active)
  VALUES (u3, 'ctl40-8-' || sx || '@exemple.invalid', 'parent', 'Parent', 'E2', e2, true);

  INSERT INTO parents (id, etablissement_id, tutor1_last_name, tutor1_first_name, tutor1_relationship, tutor1_email,
                       tutor2_last_name, tutor2_first_name, tutor2_relationship, tutor2_email) VALUES
    (f1, e1, 'UN', 'Ctl', 'père', 'F1@Exemple.invalid ', 'UN', 'Ctlbis', 'mère', NULL),
    (f3, e2, 'TROIS', 'Ctl', 'père', 'f3@exemple.invalid', NULL, NULL, NULL, NULL);

  -- ── Table des invitations ─────────────────────────────────────────────────
  essais := essais || ARRAY[['invitations : lecture par la direction', 'droits',
    pg_temp.ctl40(dir, 'SELECT count(*)::text FROM invitations_famille')]];
  essais := essais || ARRAY[['invitations : droits anon / authenticated', 'aucun',
    CASE WHEN to_regclass('public.invitations_famille') IS NULL THEN 'absente'
         WHEN has_table_privilege('anon', 'public.invitations_famille', 'SELECT')
           OR has_table_privilege('authenticated', 'public.invitations_famille', 'SELECT')
           OR has_table_privilege('authenticated', 'public.invitations_famille', 'INSERT')
         THEN 'ouverts' ELSE 'aucun' END]];

  -- ── Preparer une invitation ───────────────────────────────────────────────
  essais := essais || ARRAY[['enseignant', 'droits', pg_temp.ctl40(ens, format(prep, f1, 1, u1, 'J1'))]];
  essais := essais || ARRAY[['comptable', 'droits', pg_temp.ctl40(cpt, format(prep, f1, 1, u1, 'J1'))]];
  essais := essais || ARRAY[['secretaire : tuteur 1 (email normalise)', 'ok:f1@exemple.invalid',
    pg_temp.ctl40(sec, format(prep, f1, 1, u1, 'J1'))]];
  essais := essais || ARRAY[['profil cree : parent de E1', 'parent/oui',
    (SELECT role || '/' || CASE WHEN etablissement_id = e1 THEN 'oui' ELSE 'non' END FROM profiles WHERE id = u1)]];
  essais := essais || ARRAY[['tuteur relie, date posee', 'oui/oui',
    (SELECT CASE WHEN tutor1_user_id = u1 THEN 'oui' ELSE 'non' END || '/' || CASE WHEN tutor1_invite_le IS NOT NULL THEN 'oui' ELSE 'non' END FROM parents WHERE id = f1)]];
  essais := essais || ARRAY[['renvoi par la direction', 'ok:f1@exemple.invalid',
    pg_temp.ctl40(dir, format(prep, f1, 1, u1, 'J2'))]];
  essais := essais || ARRAY[['renvoi : ancien jeton annule, 7 jours', 'J1 annule/J2 7j',
    CASE WHEN to_regclass('public.invitations_famille') IS NULL THEN 'absente' ELSE pg_temp.ctl40_jetons() END]];
  essais := essais || ARRAY[['tuteur 2 sans email', 'sans email', pg_temp.ctl40(dir, format(prep, f1, 2, u9, 'J3'))]];
  essais := essais || ARRAY[['autre compte pour un tuteur relie', 'deja relie', pg_temp.ctl40(dir, format(prep, f1, 1, u9, 'J4'))]];
  essais := essais || ARRAY[['ecole sans option', 'option coupee', pg_temp.ctl40(dir2, format(prep, f3, 1, u9, 'J5'))]];
  essais := essais || ARRAY[['foyer d''une autre ecole', 'introuvable', pg_temp.ctl40(dir, format(prep, f3, 1, u9, 'J6'))]];
  essais := essais || ARRAY[['anon : execution', 'refusee',
    CASE WHEN has_function_privilege('anon', 'public.preparer_invitation_tuteur(uuid, smallint, uuid, text)', 'EXECUTE')
           OR has_function_privilege('anon', 'public.marquer_acces_configure()', 'EXECUTE')
         THEN 'permise' ELSE 'refusee' END]];

  -- ── Garde du compte relie ─────────────────────────────────────────────────
  essais := essais || ARRAY[['tuteur relie a un compte du personnel', 'refuse',
    pg_temp.ctl40_refus(format('UPDATE parents SET tutor2_user_id = %L WHERE id = %L', sec, f1))]];
  essais := essais || ARRAY[['tuteur relie a un parent d''une autre ecole', 'refuse',
    pg_temp.ctl40_refus(format('UPDATE parents SET tutor2_user_id = %L WHERE id = %L', u3, f1))]];

  -- ── Profil actif, acces configure ─────────────────────────────────────────
  essais := essais || ARRAY[['foyer : U1 actif', 'ok:F1',
    pg_temp.ctl40(u1, format('SELECT CASE foyer_du_compte() WHEN %L THEN ''F1'' END', f1))]];
  -- Desactivation au nom du serveur (garde `fn_guard_profile_sensitive_columns`).
  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true);
  UPDATE profiles SET is_active = false WHERE id = u1;
  PERFORM set_config('request.jwt.claims', NULL, true);
  essais := essais || ARRAY[['foyer : U1 desactive', 'ok',
    pg_temp.ctl40(u1, format('SELECT CASE foyer_du_compte() WHEN %L THEN ''F1'' END', f1))]];
  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true);
  UPDATE profiles SET is_active = true WHERE id = u1;
  PERFORM set_config('request.jwt.claims', NULL, true);
  r := pg_temp.ctl40(u1, 'SELECT marquer_acces_configure()::text');
  essais := essais || ARRAY[['configure : place de U1 seulement', 'oui/non',
    (SELECT CASE WHEN tutor1_acces_configure_le IS NOT NULL THEN 'oui' ELSE 'non (' || r || ')' END || '/'
         || CASE WHEN tutor2_acces_configure_le IS NOT NULL THEN 'oui' ELSE 'non' END FROM parents WHERE id = f1)]];
  UPDATE parents SET tutor1_acces_configure_le = NULL WHERE id = f1;
  r := pg_temp.ctl40(dir, 'SELECT marquer_acces_configure()::text');
  essais := essais || ARRAY[['configure : rien pour la direction', 'non',
    (SELECT CASE WHEN tutor1_acces_configure_le IS NOT NULL THEN 'oui' ELSE 'non' END FROM parents WHERE id = f1)]];

  -- ── Rapport ───────────────────────────────────────────────────────────────
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

  RAISE EXCEPTION 'CONTROLE 40 : % KO (tout est annule)%', nb_ko, rapport;
END
$ctl$;
