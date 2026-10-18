-- ============================================================================
-- CONTROLE 18 — Journal d'activite : nom et email de l'auteur lus en base
--
-- Cree une ecole JETABLE et deux comptes (direction, enseignant). Chacun, sous
-- identite reelle, ecrit une ligne du journal en se faisant passer pour
-- « USURPATEUR Faux » <faux@exemple.invalid>, puis agit sur une salle (trace
-- du declencheur generique `fn_audit_log`, direction seulement).
-- Attendu : la ligne garde le vrai nom et le vrai email du profil ; la trace
-- du declencheur est inchangee.
--
-- Migration : supabase/migrations/add-journal-auteur-verifie.sql.
-- LECTURE SEULE : exception volontaire finale, tout est annule.
-- ============================================================================
DO $ctl$
DECLARE
  e uuid := gen_random_uuid();
  v_role text;
  v_id uuid;
  v_mail text;
  i integer := 0;
  r record;
  attendu text;
  obtenu text;
  rapport text := '';
  nb_ko integer := 0;
  nb integer;
BEGIN
  INSERT INTO etablissements (id, slug, nom, is_active)
  VALUES (e, 'ctl-auteur-' || left(e::text, 8), 'CONTROLE AUTEUR', true);

  FOREACH v_role IN ARRAY ARRAY['direction', 'enseignant'] LOOP
    i := i + 1;
    v_id := gen_random_uuid();
    v_mail := 'ctl-auteur-' || i || '-' || left(e::text, 8) || '@exemple.invalid';
    INSERT INTO auth.users (id, email, aud, role) VALUES (v_id, v_mail, 'authenticated', 'authenticated');
    INSERT INTO profiles (id, email, role, first_name, last_name, etablissement_id)
    VALUES (v_id, v_mail, v_role, 'Vrai', 'CONTROLE' || i, e);

    SET LOCAL ROLE authenticated;
    PERFORM set_config('request.jwt.claims',
                       json_build_object('sub', v_id, 'role', 'authenticated')::text, true);
    INSERT INTO audit_logs (etablissement_id, user_id, user_email, user_name, entity_type, action, description)
    VALUES (e, v_id, 'faux@exemple.invalid', 'USURPATEUR Faux', 'controle', 'UPDATE', 'ligne manuelle');
    IF v_role = 'direction' THEN
      INSERT INTO rooms (etablissement_id, name) VALUES (e, 'Salle controle');
    END IF;
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', NULL, true);

    FOR r IN
      SELECT entity_type, user_name, user_email FROM audit_logs
       WHERE etablissement_id = e AND user_id = v_id ORDER BY entity_type
    LOOP
      attendu := 'CONTROLE' || i || ' Vrai <' || v_mail || '>';
      obtenu  := coalesce(r.user_name, '?') || ' <' || coalesce(r.user_email, '?') || '>';
      IF attendu <> obtenu THEN nb_ko := nb_ko + 1; END IF;
      rapport := rapport || E'\n[' || CASE WHEN attendu = obtenu THEN 'OK' ELSE 'KO' END || '] '
        || rpad(v_role || ' · ' || r.entity_type, 24) || obtenu
        || CASE WHEN attendu <> obtenu THEN '   (attendu ' || attendu || ')' ELSE '' END;
    END LOOP;
  END LOOP;

  -- Le controle doit avoir lu 3 lignes d'auteur (2 manuelles + 1 du
  -- declencheur) ; la creation des donnees laisse des traces sans auteur.
  SELECT count(*) INTO nb FROM audit_logs WHERE etablissement_id = e AND user_id IS NOT NULL;
  IF nb <> 3 THEN
    nb_ko := nb_ko + 1;
    rapport := rapport || E'\n[KO] lignes lues : ' || nb || ' (attendu 3)';
  END IF;

  RAISE EXCEPTION 'CONTROLE 18 : % KO (tout est annule)%', nb_ko, rapport;
END
$ctl$;
