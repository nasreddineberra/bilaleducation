-- ============================================================================
-- CONTROLE 17 — Journal, registre des migrations, notifications
--
-- Cree deux ecoles JETABLES ; dans la premiere, admin, direction, secretaire
-- et enseignant, un foyer et une notification pour ce foyer. Chaque compte,
-- sous identite reelle :
--   journal : ecrit une ligne vraie (son ecole, son id), puis deux fausses
--             (l'autre ecole ; au nom d'un autre compte) ;
--   registre : lit et ecrit `migrations_appliquees` ;
--   notifications : compte celles de son ecole.
-- On mesure les lignes REELLEMENT ecrites (une ligne d'admin est ecartee
-- sans erreur par `fn_audit_logs_sans_editeur`, avant meme la policy).
-- Attendu : ligne vraie ecrite (sauf admin, jamais trace), fausses jamais ;
-- registre ferme a tous ; notifications lues par admin et direction seulement.
-- Format : journal vrai/autre-ecole/autre-compte · registre lu/ecrit · notif N.
--
-- Migration : supabase/migrations/secure-journal-registre-notifications.sql.
-- LECTURE SEULE : exception volontaire finale, tout est annule.
-- ============================================================================
DO $ctl$
DECLARE
  e uuid := gen_random_uuid();
  e2 uuid := gen_random_uuid();
  par uuid := gen_random_uuid();
  autre uuid := gen_random_uuid();
  v_role text;
  v_id uuid;
  i integer := 0;
  j1 integer; j2 integer; j3 integer; r_lu text; r_ecrit integer; n_notif integer;
  attendu text;
  obtenu text;
  rapport text := '';
  nb_ko integer := 0;
BEGIN
  INSERT INTO etablissements (id, slug, nom, is_active) VALUES
    (e,  'ctl-jrn-'   || left(e::text, 8),  'CONTROLE JOURNAL', true),
    (e2, 'ctl-jrn-b-' || left(e2::text, 8), 'CONTROLE JOURNAL B', true);
  INSERT INTO parents (id, etablissement_id, tutor1_last_name, tutor1_first_name, tutor1_email)
  VALUES (par, e, 'CTL' || left(e::text, 8), 'Foyer', 'ctl-jrn-' || left(e::text, 8) || '@exemple.invalid');
  INSERT INTO notifications (etablissement_id, type, parent_id, title, body)
  VALUES (e, 'absence', par, 'CTL', 'CTL');
  -- Le compte dont on usurpe l'identite (meme ecole).
  INSERT INTO auth.users (id, email, aud, role)
  VALUES (autre, 'ctl-jrn-autre-' || left(e::text, 8) || '@exemple.invalid', 'authenticated', 'authenticated');
  INSERT INTO profiles (id, email, role, first_name, last_name, etablissement_id)
  VALUES (autre, 'ctl-jrn-autre-' || left(e::text, 8) || '@exemple.invalid', 'direction', 'Controle', 'USURPE', e);

  FOREACH v_role IN ARRAY ARRAY['admin', 'direction', 'secretaire', 'enseignant'] LOOP
    i := i + 1;
    v_id := gen_random_uuid();
    INSERT INTO auth.users (id, email, aud, role)
    VALUES (v_id, 'ctl-jrn-' || i || '-' || left(e::text, 8) || '@exemple.invalid', 'authenticated', 'authenticated');
    INSERT INTO profiles (id, email, role, first_name, last_name, etablissement_id)
    VALUES (v_id, 'ctl-jrn-' || i || '-' || left(e::text, 8) || '@exemple.invalid', v_role,
            'Controle', upper(v_role), e);

    SET LOCAL ROLE authenticated;
    PERFORM set_config('request.jwt.claims',
                       json_build_object('sub', v_id, 'role', 'authenticated')::text, true);

    BEGIN
      INSERT INTO audit_logs (etablissement_id, user_id, user_email, user_name, entity_type, action, description)
      VALUES (e, v_id, 'x@exemple.invalid', 'Controle', 'controle', 'UPDATE', 'vraie');
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    BEGIN
      INSERT INTO audit_logs (etablissement_id, user_id, user_email, user_name, entity_type, action, description)
      VALUES (e2, v_id, 'x@exemple.invalid', 'Controle', 'controle', 'UPDATE', 'autre ecole');
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    BEGIN
      INSERT INTO audit_logs (etablissement_id, user_id, user_email, user_name, entity_type, action, description)
      VALUES (e, autre, 'x@exemple.invalid', 'Controle', 'controle', 'UPDATE', 'autre compte ' || i);
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;

    BEGIN
      SELECT CASE WHEN count(*) > 0 THEN '1' ELSE '0' END INTO r_lu FROM migrations_appliquees;
    EXCEPTION WHEN insufficient_privilege THEN r_lu := '0'; END;
    r_ecrit := 1;
    BEGIN
      INSERT INTO migrations_appliquees (nom, empreinte) VALUES ('ctl-' || i || '.sql', repeat('0', 64));
    EXCEPTION WHEN insufficient_privilege THEN r_ecrit := 0; END;

    SELECT count(*) INTO n_notif FROM notifications WHERE etablissement_id = e;

    RESET ROLE;
    PERFORM set_config('request.jwt.claims', NULL, true);

    SELECT count(*) INTO j1 FROM audit_logs WHERE etablissement_id = e  AND user_id = v_id  AND description = 'vraie';
    SELECT count(*) INTO j2 FROM audit_logs WHERE etablissement_id = e2 AND user_id = v_id  AND description = 'autre ecole';
    SELECT count(*) INTO j3 FROM audit_logs WHERE etablissement_id = e  AND user_id = autre AND description = 'autre compte ' || i;

    obtenu := 'journal ' || j1 || '/' || j2 || '/' || j3 || ' · registre ' || r_lu || '/' || r_ecrit
              || ' · notif ' || n_notif;
    attendu := 'journal ' || CASE WHEN v_role = 'admin' THEN '0' ELSE '1' END || '/0/0 · registre 0/0 · notif '
               || CASE WHEN v_role IN ('admin', 'direction') THEN '1' ELSE '0' END;

    IF attendu <> obtenu THEN nb_ko := nb_ko + 1; END IF;
    rapport := rapport || E'\n[' || CASE WHEN attendu = obtenu THEN 'OK' ELSE 'KO' END || '] '
      || rpad(v_role, 12) || obtenu || CASE WHEN attendu <> obtenu THEN '   (attendu ' || attendu || ')' ELSE '' END;
  END LOOP;

  RAISE EXCEPTION 'CONTROLE 17 : % KO (tout est annule)%', nb_ko, rapport;
END
$ctl$;
