-- ============================================================================
-- CONTROLE 12 — Documents requis : lecture par l'ecole, ecriture admin / direction
--
-- Cree deux ecoles JETABLES et, dans la premiere, un compte par role de staff
-- (+ l'editeur rattache, c.-a-d. en intervention), plus une direction de
-- l'AUTRE ecole. Chacun, sous identite reelle (`SET LOCAL ROLE authenticated`),
-- lit la liste, tente une creation, une modification et une suppression.
--   admin, direction, super_admin rattache : lit, cree, modifie, supprime ;
--   secretaire, comptable, resp. pedago, enseignant, parent : lit, rien d'autre ;
--   direction de l'autre ecole : ne lit rien, n'ecrit rien.
--
-- Migration : supabase/migrations/restrict-document-type-configs.sql.
-- LECTURE SEULE : exception volontaire finale, tout est annule.
-- ============================================================================
DO $ctl$
DECLARE
  e uuid := gen_random_uuid();
  e_autre uuid := gen_random_uuid();
  v_role text;
  v_etab uuid;
  v_id uuid;
  v_doc uuid;
  ecrit boolean;
  n_lu integer;
  n_cree integer;
  n_modif integer;
  n_suppr integer;
  attendu text;
  obtenu text;
  rapport text := '';
  nb_ko integer := 0;
  i integer := 0;
BEGIN
  INSERT INTO etablissements (id, slug, nom, is_active) VALUES
    (e,       'ctl-docs-'   || left(e::text, 8),       'CONTROLE DOCUMENTS', true),
    (e_autre, 'ctl-docs-a-' || left(e_autre::text, 8), 'CONTROLE DOCUMENTS AUTRE', true);

  FOREACH v_role IN ARRAY ARRAY['admin', 'direction', 'super_admin', 'secretaire', 'comptable',
                                'responsable_pedagogique', 'enseignant', 'parent', 'autre_direction'] LOOP
    i := i + 1;
    v_id := gen_random_uuid();
    v_etab := CASE WHEN v_role = 'autre_direction' THEN e_autre ELSE e END;

    INSERT INTO auth.users (id, email, aud, role)
    VALUES (v_id, 'ctl-docs-' || i || '-' || left(e::text, 8) || '@exemple.invalid', 'authenticated', 'authenticated');
    INSERT INTO profiles (id, email, role, first_name, last_name, etablissement_id)
    VALUES (v_id, 'ctl-docs-' || i || '-' || left(e::text, 8) || '@exemple.invalid',
            CASE WHEN v_role = 'autre_direction' THEN 'direction' ELSE v_role END,
            'Controle', upper(v_role), v_etab);

    -- Une ligne cible par compte, dans la PREMIERE ecole.
    INSERT INTO document_type_configs (etablissement_id, category, doc_key, label)
    VALUES (e, 'autres', 'cible_' || i, 'Cible ' || v_role)
    RETURNING id INTO v_doc;

    SET LOCAL ROLE authenticated;
    PERFORM set_config('request.jwt.claims',
                       json_build_object('sub', v_id, 'role', 'authenticated')::text, true);

    SELECT count(*) INTO n_lu FROM document_type_configs WHERE etablissement_id = e;

    BEGIN
      INSERT INTO document_type_configs (etablissement_id, category, doc_key, label)
      VALUES (e, 'autres', 'cree_' || i, 'Cree ' || v_role);
      n_cree := 1;
    EXCEPTION WHEN insufficient_privilege THEN
      n_cree := 0;
    END;

    UPDATE document_type_configs SET is_required = NOT is_required WHERE id = v_doc;
    GET DIAGNOSTICS n_modif = ROW_COUNT;
    DELETE FROM document_type_configs WHERE id = v_doc;
    GET DIAGNOSTICS n_suppr = ROW_COUNT;

    RESET ROLE;
    PERFORM set_config('request.jwt.claims', NULL, true);

    ecrit := v_role IN ('admin', 'direction', 'super_admin');
    -- Le staff de l'ecole lit (au moins sa ligne cible) ; l'autre ecole, rien.
    attendu := CASE WHEN v_role = 'autre_direction' THEN 'lit 0' ELSE 'lit 1' END
               || CASE WHEN ecrit THEN ' · cree 1 · modifie 1 · supprime 1'
                       ELSE ' · cree 0 · modifie 0 · supprime 0' END;
    obtenu := 'lit ' || (n_lu > 0)::int
              || ' · cree ' || n_cree || ' · modifie ' || n_modif || ' · supprime ' || n_suppr;

    IF attendu <> obtenu THEN nb_ko := nb_ko + 1; END IF;
    rapport := rapport || E'\n[' || CASE WHEN attendu = obtenu THEN 'OK' ELSE 'KO' END || '] '
      || rpad(v_role, 24) || obtenu || CASE WHEN attendu <> obtenu THEN '   (attendu ' || attendu || ')' ELSE '' END;
  END LOOP;

  RAISE EXCEPTION 'CONTROLE 12 : % KO (tout est annule)%', nb_ko, rapport;
END
$ctl$;
