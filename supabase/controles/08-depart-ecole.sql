-- ============================================================================
-- CONTROLE 08 — Depart d'une ecole : export et effacement des DONNEES
--
-- Modele du 13/10 (rework-effacement-etablissement.sql) : la FICHE reste, grisee
-- et rouvrable ; les donnees de l'ecole, ses comptes et ses fichiers partent.
--
-- Cree une ECOLE JETABLE contenant au moins une ligne de chaque piege connu :
--   foyer + apprenant (cle RESTRICT), referentiel cours/module/unite (RESTRICT,
--   et cours servant un gabarit de l'annee en cours), note d'une periode dont les
--   bulletins sont ARCHIVES (garde de periode), affectation avec note (garde de
--   desaffectation), type de presence reserve, depense (NO ACTION),
--   `evaluation_order_config` (sans cle etrangere), compte de connexion, archive
--   de bulletin ADULTE (garde de periode sur la mise a jour qu'entraine la
--   suppression d'un cours), et les donnees de l'editeur qui doivent RESTER :
--   releve de facturation, action, note interne.
-- Puis : refus (ecole active, mauvaise adresse), export, simulation, effacement
-- reel, et verification que plus rien n'en reste ET que rien d'autre n'a bouge.
--
-- LECTURE SEULE : le bloc se termine par une exception volontaire qui annule
-- TOUT. Le bandeau rouge final EST le rapport. Jamais sur une vraie ecole.
-- ============================================================================
DO $ctl$
DECLARE
  e   uuid := gen_random_uuid();
  u   uuid := gen_random_uuid();
  sy  uuid; p1 uuid; ct uuid; cl uuid; t uuid; pa uuid; st uuid;
  ue  uuid; mo uuid; co uuid; ev uuid; ff uuid;
  r   jsonb;
  x   json;
  n   bigint;
  tot_avant bigint := 0;
  tot_apres bigint := 0;
  tb  record;
  rapport text := '';
  ok  boolean;
BEGIN
  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true);

  -- ── Ecole jetable ──
  INSERT INTO etablissements (id, slug, nom, is_active) VALUES (e, 'ctl-depart-' || left(e::text, 8), 'CONTROLE DEPART', true);
  INSERT INTO auth.users (id, email, aud, role) VALUES (u, 'ctl-depart-' || left(e::text, 8) || '@exemple.invalid', 'authenticated', 'authenticated');
  INSERT INTO profiles (id, email, role, first_name, last_name, etablissement_id)
    VALUES (u, 'ctl-depart-' || left(e::text, 8) || '@exemple.invalid', 'direction', 'Ctl', 'DEPART', e)
    ON CONFLICT (id) DO UPDATE SET etablissement_id = e, role = 'direction';
  INSERT INTO school_years (etablissement_id, label, is_current, start_date, end_date)
    VALUES (e, '2099-2100', true, '2099-09-01', '2100-06-30') RETURNING id INTO sy;
  INSERT INTO periods (school_year_id, label, order_index) VALUES (sy, 'S1', 1) RETURNING id INTO p1;
  INSERT INTO cotisation_types (etablissement_id, school_year_id, label) VALUES (e, sy, 'CTL') RETURNING id INTO ct;
  INSERT INTO classes (etablissement_id, name, level, academic_year, cotisation_type_id)
    VALUES (e, 'CTL-1', 'CP', '2099-2100', ct) RETURNING id INTO cl;
  INSERT INTO teachers (etablissement_id, first_name, last_name, employee_number, email, user_id)
    VALUES (e, 'Ens', 'CTL', 'ENS-CTL-1', 'ens-ctl@exemple.invalid', u) RETURNING id INTO t;
  INSERT INTO class_teachers (class_id, teacher_id, is_main_teacher) VALUES (cl, t, true);
  INSERT INTO parents (etablissement_id, tutor1_last_name, tutor1_first_name, tutor1_email)
    VALUES (e, 'CTL', 'Parent', 'parent-ctl@exemple.invalid') RETURNING id INTO pa;
  INSERT INTO students (etablissement_id, student_number, first_name, last_name, date_of_birth, parent_id, gender, is_active)
    VALUES (e, 'ELV-CTL-001', 'Eleve', 'CTL', '2090-01-01', pa, 'male', true) RETURNING id INTO st;
  INSERT INTO enrollments (student_id, class_id) VALUES (st, cl);
  INSERT INTO unites_enseignement (etablissement_id, nom_fr) VALUES (e, 'UE CTL') RETURNING id INTO ue;
  INSERT INTO cours_modules (unite_enseignement_id, nom_fr) VALUES (ue, 'Module CTL') RETURNING id INTO mo;
  INSERT INTO cours (unite_enseignement_id, module_id, nom_fr) VALUES (ue, mo, 'Cours CTL') RETURNING id INTO co;
  INSERT INTO evaluations (etablissement_id, class_id, period_id, cours_id, title, teacher_id)
    VALUES (e, cl, p1, co, 'Eval CTL', t) RETURNING id INTO ev;
  INSERT INTO grades (student_id, evaluation_id, score) VALUES (st, ev, 10);
  INSERT INTO bulletin_archives (etablissement_id, student_id, class_id, period_id, file_path)
    VALUES (e, st, cl, p1, e::text || '/ctl.pdf');
  -- Le declencheur d'audit de cette table lit `NEW.id`, colonne qu'elle n'a pas :
  -- toute ecriture y echoue (defaut releve le 13/10). Neutralise le temps d'une
  -- insertion, dans cette transaction annulee.
  ALTER TABLE evaluation_order_config DISABLE TRIGGER audit_evaluation_order_config;
  INSERT INTO evaluation_order_config (class_id, period_id) VALUES (cl, p1);
  ALTER TABLE evaluation_order_config ENABLE TRIGGER audit_evaluation_order_config;
  INSERT INTO expenses (etablissement_id, school_year_id, label, amount) VALUES (e, sy, 'Depense CTL', 1);
  INSERT INTO family_fees (etablissement_id, parent_id, school_year_id) VALUES (e, pa, sy) RETURNING id INTO ff;
  INSERT INTO fee_installments (etablissement_id, family_fee_id, installment_number, due_date, amount_due)
    VALUES (e, ff, 1, '2099-10-01', 10);
  INSERT INTO releves_facturation (etablissement_id, mois, eleves_actifs, adultes_inscrits) VALUES (e, '2099-09-01', 1, 0);
  INSERT INTO actions_editeur (etablissement_id, description) VALUES (e, 'Action CTL');
  INSERT INTO etablissement_notes (etablissement_id, notes) VALUES (e, 'Note CTL');
  INSERT INTO adult_bulletin_archives (etablissement_id, parent_id, tutor_number, class_id, period_id, file_path)
    VALUES (e, pa, 1, cl, p1, e::text || '/adulte.pdf');

  -- ── Refus attendus ──
  BEGIN
    PERFORM effacer_etablissement(e, (SELECT slug FROM etablissements WHERE id = e), false, NULL);
    rapport := rapport || E'\n[KO] ecole ACTIVE acceptee';
  EXCEPTION WHEN OTHERS THEN
    rapport := rapport || E'\n[OK] ecole active refusee : ' || SQLERRM;
  END;
  UPDATE etablissements SET is_active = false WHERE id = e;
  BEGIN
    PERFORM effacer_etablissement(e, 'mauvaise-adresse', false, NULL);
    rapport := rapport || E'\n[KO] mauvaise adresse acceptee';
  EXCEPTION WHEN OTHERS THEN
    rapport := rapport || E'\n[OK] mauvaise adresse refusee : ' || SQLERRM;
  END;

  -- ── Export ──
  x := exporter_etablissement(e);
  rapport := rapport || E'\n[' || CASE WHEN json_array_length(x->'tables'->'students') = 1
                                       AND json_array_length(x->'tables'->'cours') = 1
                                       AND (x->'tables') ->> 'audit_logs' IS NULL
                                       AND (x->'tables') ->> 'etablissement_smtp' IS NULL
                                  THEN 'OK' ELSE 'KO' END
     || '] export : ' || (SELECT count(*) FROM json_object_keys(x->'tables')) || ' tables, '
     || 'apprenants=' || json_array_length(x->'tables'->'students')
     || ', cours=' || json_array_length(x->'tables'->'cours')
     || ', journal absent=' || ((x->'tables') ->> 'audit_logs' IS NULL);
  -- Rien d'une autre ecole dans l'export.
  SELECT bool_and(v->>'etablissement_id' = e::text) INTO ok
    FROM json_each(x->'tables') j, json_array_elements(j.value) v
   WHERE v::jsonb ? 'etablissement_id';
  rapport := rapport || E'\n[' || CASE WHEN ok THEN 'OK' ELSE 'KO' END || '] export limite a cette ecole';

  -- ── Simulation : rien ne doit bouger ──
  r := effacer_etablissement(e, (SELECT slug FROM etablissements WHERE id = e), false, NULL);
  rapport := rapport || E'\n[' || CASE WHEN EXISTS (SELECT 1 FROM students WHERE id = st) AND NOT (r->>'reel')::boolean
                                  THEN 'OK' ELSE 'KO' END || '] simulation sans effet : ' || (r->'lignes')::text;

  -- ── Effacement reel ──
  FOR tb IN SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' LOOP
    EXECUTE format('SELECT count(*) FROM public.%I', tb.table_name) INTO n;
    tot_avant := tot_avant + n;
  END LOOP;

  r := effacer_etablissement(e, (SELECT slug FROM etablissements WHERE id = e), true, NULL);

  FOR tb IN SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' LOOP
    EXECUTE format('SELECT count(*) FROM public.%I', tb.table_name) INTO n;
    tot_apres := tot_apres + n;
  END LOOP;

  SELECT sum(value::bigint) INTO n FROM jsonb_each_text(r->'lignes');
  -- +1 : la ligne ajoutee a `etablissement_departs`.
  rapport := rapport || E'\n[' || CASE WHEN tot_avant - tot_apres + 1 = n THEN 'OK' ELSE 'KO' END
     || '] lignes : ' || (tot_avant - tot_apres + 1) || ' disparues, ' || n || ' annoncees';

  ok := NOT EXISTS (SELECT 1 FROM students WHERE id = st)
    AND NOT EXISTS (SELECT 1 FROM adult_bulletin_archives WHERE etablissement_id = e)
    AND NOT EXISTS (SELECT 1 FROM school_years WHERE etablissement_id = e)
    AND NOT EXISTS (SELECT 1 FROM parents WHERE id = pa)
    AND NOT EXISTS (SELECT 1 FROM cours WHERE id = co)
    AND NOT EXISTS (SELECT 1 FROM cours_modules WHERE id = mo)
    AND NOT EXISTS (SELECT 1 FROM grades WHERE evaluation_id = ev)
    AND NOT EXISTS (SELECT 1 FROM evaluation_order_config WHERE class_id = cl)
    AND NOT EXISTS (SELECT 1 FROM expenses WHERE etablissement_id = e)
    AND NOT EXISTS (SELECT 1 FROM auth.users WHERE id = u)
    AND NOT EXISTS (SELECT 1 FROM profiles WHERE id = u);
  rapport := rapport || E'\n[' || CASE WHEN ok THEN 'OK' ELSE 'KO' END || '] plus rien de l''ecole (compte de connexion compris)';

  SELECT donnees_effacees_le IS NOT NULL AND nom = 'CONTROLE DEPART' INTO ok FROM etablissements WHERE id = e;
  rapport := rapport || E'\n[' || CASE WHEN coalesce(ok, false) THEN 'OK' ELSE 'KO' END || '] la fiche reste, marquee effacee';

  ok := EXISTS (SELECT 1 FROM releves_facturation WHERE etablissement_id = e)
    AND EXISTS (SELECT 1 FROM actions_editeur WHERE etablissement_id = e)
    AND EXISTS (SELECT 1 FROM etablissement_notes WHERE etablissement_id = e)
    AND EXISTS (SELECT 1 FROM etablissement_departs WHERE etablissement_id = e AND comptes = 1);
  rapport := rapport || E'\n[' || CASE WHEN ok THEN 'OK' ELSE 'KO' END || '] donnees de l''editeur conservees, depart trace';

  BEGIN
    PERFORM effacer_etablissement(e, (SELECT slug FROM etablissements WHERE id = e), false, NULL);
    rapport := rapport || E'\n[KO] second effacement accepte';
  EXCEPTION WHEN OTHERS THEN
    rapport := rapport || E'\n[OK] second effacement refuse : ' || SQLERRM;
  END;

  RAISE EXCEPTION 'CONTROLE 08 (tout est annule)%', rapport;
END
$ctl$;
