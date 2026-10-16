-- ============================================================================
-- CONTROLE 10 — Journal d'activite : ni les comptes admin, ni l'editeur
--
-- Decision utilisateur du 16/10 : le role admin et l'editeur (super_admin, en
-- intervention ou depuis sa console) ne laissent AUCUNE trace dans le journal
-- d'une ecole. Le controle cree une ecole jetable et trois comptes (direction,
-- admin, super_admin rattache), fait agir chacun par les DEUX chemins
-- d'ecriture — le declencheur generique `fn_audit_log` (insertion d'une salle)
-- et l'insertion directe de `logAudit` —, puis compte les traces :
--   direction : 2 traces attendues (le journal fonctionne toujours) ;
--   admin, super_admin : 0, et l'action elle-meme a bien eu lieu.
-- Verifie enfin qu'aucune trace d'un compte admin / super_admin ne subsiste.
--
-- LECTURE SEULE : exception volontaire finale, tout est annule.
-- ============================================================================
DO $ctl$
DECLARE
  e uuid := gen_random_uuid();
  v_role text;
  v_id uuid;
  n_trace bigint;
  n_salle bigint;
  attendu bigint;
  rapport text := '';
  i integer := 0;
BEGIN
  INSERT INTO etablissements (id, slug, nom, is_active)
  VALUES (e, 'ctl-journal-' || left(e::text, 8), 'CONTROLE JOURNAL', true);

  FOREACH v_role IN ARRAY ARRAY['direction', 'admin', 'super_admin'] LOOP
    i := i + 1;
    v_id := gen_random_uuid();
    INSERT INTO auth.users (id, email, aud, role)
    VALUES (v_id, 'ctl-journal-' || i || '-' || left(e::text, 8) || '@exemple.invalid', 'authenticated', 'authenticated');
    -- Le super_admin est RATTACHE a l'ecole : c'est l'etat d'une intervention.
    INSERT INTO profiles (id, email, role, first_name, last_name, etablissement_id)
    VALUES (v_id, 'ctl-journal-' || i || '@exemple.invalid', v_role, 'Controle', upper(v_role), e);

    -- Agir sous ce compte.
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_id, 'role', 'authenticated')::text, true);

    -- Chemin 1 : declencheur generique.
    INSERT INTO rooms (etablissement_id, name) VALUES (e, 'Salle ' || v_role);
    -- Chemin 2 : insertion directe, comme `logAudit`.
    INSERT INTO audit_logs (etablissement_id, user_id, user_email, user_name, entity_type, action, description)
    VALUES (e, v_id, 'x@exemple.invalid', 'Controle', 'controle', 'UPDATE', 'trace directe ' || v_role);

    SELECT count(*) INTO n_trace FROM audit_logs WHERE etablissement_id = e AND user_id = v_id;
    SELECT count(*) INTO n_salle FROM rooms WHERE etablissement_id = e AND name = 'Salle ' || v_role;
    attendu := CASE WHEN v_role = 'direction' THEN 2 ELSE 0 END;

    rapport := rapport || E'\n[' || CASE WHEN n_trace = attendu AND n_salle = 1 THEN 'OK' ELSE 'KO' END
      || '] ' || v_role || ' : ' || n_trace || ' trace(s) (attendu ' || attendu || '), action '
      || CASE WHEN n_salle = 1 THEN 'effectuee' ELSE 'NON effectuee' END;
  END LOOP;

  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true);
  SELECT count(*) INTO n_trace
    FROM audit_logs a JOIN profiles p ON p.id = a.user_id
   WHERE p.role IN ('admin', 'super_admin');
  rapport := rapport || E'\n[' || CASE WHEN n_trace = 0 THEN 'OK' ELSE 'KO' END
    || '] traces admin / super_admin restantes dans toutes les ecoles : ' || n_trace;

  RAISE EXCEPTION 'CONTROLE 10 (tout est annule)%', rapport;
END
$ctl$;
