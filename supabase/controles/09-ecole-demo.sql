-- ============================================================================
-- CONTROLE 09 — Ecole de demonstration : peuplement et remise a zero
--
-- Cree une ecole de demonstration JETABLE avec ses 7 comptes, la remet a zero
-- DEUX fois (la seconde prouve que le vidage est complet), puis verifie :
-- volumes, comptes conserves, aucune autre ecole touchee, refus sur une ecole
-- non marquee, marqueur `est_demo` impossible a poser hors service-role.
--
-- LECTURE SEULE : exception volontaire finale, tout est annule.
-- ============================================================================
DO $ctl$
DECLARE
  e   uuid := gen_random_uuid();
  tb  record;
  n   bigint;
  autres_avant bigint := 0;
  autres_apres bigint := 0;
  r   jsonb;
  v_comptes uuid[] := '{}';
  v_id uuid;
  v_role text;
  i integer := 0;
  rapport text := '';
  ok boolean;
  bilal uuid := (SELECT id FROM etablissements WHERE slug = 'bilal-neuville');
BEGIN
  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true);

  -- Lignes de l'ecole BILAL, table par table, avant.
  FOR tb IN SELECT * FROM fn_depart_tables() WHERE filtre IS NOT NULL LOOP
    EXECUTE format('SELECT count(*) FROM public.%I WHERE %s', tb.nom, tb.filtre) INTO n USING bilal;
    autres_avant := autres_avant + n;
  END LOOP;

  INSERT INTO etablissements (id, slug, nom, is_active, est_demo) VALUES (e, 'ctl-demo-' || left(e::text, 8), 'CONTROLE DEMO', true, true);
  FOREACH v_role IN ARRAY ARRAY['direction','comptable','secretaire','responsable_pedagogique','enseignant','enseignant','enseignant'] LOOP
    i := i + 1;
    v_id := gen_random_uuid();
    INSERT INTO auth.users (id, email, aud, role) VALUES (v_id, 'ctl-demo-' || i || '-' || left(e::text, 8) || '@exemple.invalid', 'authenticated', 'authenticated');
    INSERT INTO profiles (id, email, role, first_name, last_name, etablissement_id)
    VALUES (v_id, 'ctl-demo-' || i || '-' || left(e::text, 8) || '@exemple.invalid', v_role, 'Prenom' || i, 'NOM' || i, e)
    ON CONFLICT (id) DO UPDATE SET etablissement_id = e, role = v_role;
    v_comptes := v_comptes || v_id;
  END LOOP;

  r := reinitialiser_ecole_demo(e);
  rapport := rapport || E'\n[INFO] 1re remise a zero : ' || r::text;
  r := reinitialiser_ecole_demo(e);

  SELECT (SELECT count(*) FROM students WHERE etablissement_id = e) = 60
     AND (SELECT count(*) FROM parents WHERE etablissement_id = e) = 30
     AND (SELECT count(*) FROM classes WHERE etablissement_id = e) = 4
     AND (SELECT count(*) FROM teachers WHERE etablissement_id = e) = 3
     AND (SELECT count(*) FROM school_years WHERE etablissement_id = e) = 1
     AND (SELECT count(*) FROM enrollments en JOIN classes c ON c.id = en.class_id WHERE c.etablissement_id = e) = 60
     AND (SELECT count(*) FROM parent_class_enrollments WHERE etablissement_id = e) = 6
    INTO ok;
  rapport := rapport || E'\n[' || CASE WHEN ok THEN 'OK' ELSE 'KO' END || '] apres 2 remises a zero : 60 eleves, 30 foyers, 4 classes, 3 enseignants, 1 annee (pas de doublons)';

  rapport := rapport || E'\n[INFO] evaluations=' || (SELECT count(*) FROM evaluations WHERE etablissement_id = e)
     || ' notes=' || (SELECT count(*) FROM grades g JOIN evaluations ev ON ev.id = g.evaluation_id WHERE ev.etablissement_id = e)
     || ' notes adultes=' || (SELECT count(*) FROM adult_grades WHERE etablissement_id = e)
     || ' absences=' || (SELECT count(*) FROM absences WHERE etablissement_id = e)
     || ' creneaux=' || (SELECT count(*) FROM schedule_slots WHERE etablissement_id = e)
     || ' dossiers=' || (SELECT count(*) FROM family_fees WHERE etablissement_id = e)
     || ' paiements=' || (SELECT count(*) FROM fee_installments WHERE etablissement_id = e)
     || ' journal=' || (SELECT count(*) FROM audit_logs WHERE etablissement_id = e);

  ok := (SELECT count(*) FROM profiles WHERE id = ANY (v_comptes)) = 7
    AND (SELECT count(*) FROM auth.users WHERE id = ANY (v_comptes)) = 7
    AND (SELECT count(*) FROM teachers WHERE etablissement_id = e AND user_id = ANY (v_comptes)) = 3;
  rapport := rapport || E'\n[' || CASE WHEN ok THEN 'OK' ELSE 'KO' END || '] comptes conserves, fiches enseignant rattachees aux comptes';

  FOR tb IN SELECT * FROM fn_depart_tables() WHERE filtre IS NOT NULL LOOP
    EXECUTE format('SELECT count(*) FROM public.%I WHERE %s', tb.nom, tb.filtre) INTO n USING bilal;
    autres_apres := autres_apres + n;
  END LOOP;
  rapport := rapport || E'\n[' || CASE WHEN autres_avant = autres_apres THEN 'OK' ELSE 'KO' END
     || '] ECOLE BILAL intacte : ' || autres_avant || ' lignes avant, ' || autres_apres || ' apres';

  BEGIN
    PERFORM reinitialiser_ecole_demo(bilal);
    rapport := rapport || E'\n[KO] remise a zero acceptee sur une ecole non marquee';
  EXCEPTION WHEN OTHERS THEN
    rapport := rapport || E'\n[OK] refusee sur une ecole non marquee : ' || SQLERRM;
  END;

  PERFORM set_config('request.jwt.claims', '{"role":"authenticated"}', true);
  BEGIN
    UPDATE etablissements SET est_demo = true WHERE id = bilal;
    rapport := rapport || E'\n[KO] est_demo pose hors service-role';
  EXCEPTION WHEN OTHERS THEN
    rapport := rapport || E'\n[OK] est_demo refuse hors service-role : ' || SQLERRM;
  END;

  RAISE EXCEPTION 'CONTROLE 09 (tout est annule)%', rapport;
END
$ctl$;
