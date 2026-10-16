-- ============================================================================
-- CONTROLE 11 — Ecole de demonstration : couper les sessions d'un compte
--
-- Cree une ecole de demonstration et une vraie ecole JETABLES, un compte dans
-- chacune avec une session ouverte (et son jeton de rafraichissement), puis
-- verifie : la fonction coupe la session du compte de demonstration (et son
-- jeton, par cascade), refuse un compte d'une vraie ecole, refuse tout appel
-- hors service-role.
--
-- LECTURE SEULE : exception volontaire finale, tout est annule.
-- ============================================================================
DO $ctl$
DECLARE
  e_demo uuid := gen_random_uuid();
  e_vraie uuid := gen_random_uuid();
  u_demo uuid := gen_random_uuid();
  u_vraie uuid := gen_random_uuid();
  s_demo uuid := gen_random_uuid();
  s_vraie uuid := gen_random_uuid();
  n integer;
  rapport text := '';
BEGIN
  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true);
  INSERT INTO etablissements (id, slug, nom, is_active, est_demo) VALUES
    (e_demo,  'ctl-demo-s-'  || left(e_demo::text, 8),  'CONTROLE DEMO SESSIONS', true, true),
    (e_vraie, 'ctl-vraie-s-' || left(e_vraie::text, 8), 'CONTROLE VRAIE SESSIONS', true, false);
  INSERT INTO auth.users (id, email, aud, role) VALUES
    (u_demo,  'ctl-s-demo-'  || left(e_demo::text, 8)  || '@exemple.invalid', 'authenticated', 'authenticated'),
    (u_vraie, 'ctl-s-vraie-' || left(e_vraie::text, 8) || '@exemple.invalid', 'authenticated', 'authenticated');
  INSERT INTO profiles (id, email, role, first_name, last_name, etablissement_id) VALUES
    (u_demo,  'ctl-s-demo@exemple.invalid',  'direction', 'Controle', 'DEMO',  e_demo),
    (u_vraie, 'ctl-s-vraie@exemple.invalid', 'direction', 'Controle', 'VRAIE', e_vraie);
  INSERT INTO auth.sessions (id, user_id, created_at, updated_at) VALUES
    (s_demo, u_demo, now(), now()), (s_vraie, u_vraie, now(), now());
  INSERT INTO auth.refresh_tokens (token, user_id, session_id, revoked, created_at, updated_at) VALUES
    ('ctl-' || s_demo, u_demo::text, s_demo, false, now(), now()),
    ('ctl-' || s_vraie, u_vraie::text, s_vraie, false, now(), now());

  -- Hors service-role : refuse.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u_demo, 'role', 'authenticated')::text, true);
  BEGIN
    PERFORM demo_couper_sessions(u_demo);
    rapport := rapport || E'\n[KO] appel accepte hors service-role';
  EXCEPTION WHEN OTHERS THEN
    rapport := rapport || E'\n[OK] refuse hors service-role : ' || SQLERRM;
  END;

  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true);

  -- Vraie ecole : refuse, session intacte.
  BEGIN
    PERFORM demo_couper_sessions(u_vraie);
    rapport := rapport || E'\n[KO] compte d''une vraie ecole accepte';
  EXCEPTION WHEN OTHERS THEN
    rapport := rapport || E'\n[OK] refuse sur une vraie ecole : ' || SQLERRM;
  END;
  SELECT count(*) INTO n FROM auth.sessions WHERE user_id = u_vraie;
  rapport := rapport || E'\n[' || CASE WHEN n = 1 THEN 'OK' ELSE 'KO' END || '] session de la vraie ecole intacte : ' || n;

  -- Demonstration : coupee, jeton compris.
  n := demo_couper_sessions(u_demo);
  rapport := rapport || E'\n[' || CASE WHEN n = 1 THEN 'OK' ELSE 'KO' END || '] sessions coupees : ' || n;
  SELECT count(*) INTO n FROM auth.refresh_tokens WHERE session_id = s_demo;
  rapport := rapport || E'\n[' || CASE WHEN n = 0 THEN 'OK' ELSE 'KO' END || '] jeton de rafraichissement supprime par cascade : ' || n || ' restant';

  RAISE EXCEPTION 'CONTROLE 11 (tout est annule)%', rapport;
END
$ctl$;
