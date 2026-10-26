-- ============================================================================
-- CONTROLE 21 — Mouvements d'inscription : chaque mouvement est trace, une fois
--
-- Cree une ecole JETABLE (annee 2026-2027 en cours, rentree le 01/09/2026),
-- une classe avec cotisation, un eleve, un foyer. Les gestes sont faits par une
-- SECRETAIRE (session simulee), comme a l'ecran Affectations :
--   affectation a la rentree          -> 1 arrivee, date d'effet = rentree, regle figee (defaut : due)
--   mise a jour sans changement       -> rien
--   reglage passe a « prorata »       -> le retrait (correction) porte « prorata », date d'arrivee
--   eleve rendu inactif puis reactive -> 1 depart puis 1 arrivee (motif statut)
--   adulte affecte puis retire        -> 2 mouvements, tuteur et non eleve
--   effacement d'ecole en cours       -> rien
--   annee close                       -> rien
--   auteur                            -> la secretaire, nom compris
-- Puis les droits : la comptable lit la trace, la secretaire ne la lit pas,
-- personne ne l'ecrit directement.
--
-- Migration : supabase/migrations/add-mouvements-inscription.sql.
-- LECTURE SEULE : exception volontaire finale, tout est annule.
-- ============================================================================
DO $ctl$
DECLARE
  e    uuid := gen_random_uuid();
  y    uuid := gen_random_uuid();
  ct   uuid := gen_random_uuid();
  c    uuid := gen_random_uuid();
  s    uuid := gen_random_uuid();
  par  uuid := gen_random_uuid();
  sec  uuid := gen_random_uuid();
  cpt  uuid := gen_random_uuid();
  n    integer;
  m    record;
  rapport text := '';
  nb_ko   integer := 0;

  -- Nombre de mouvements depuis le dernier point.
  vu   integer := 0;
BEGIN
  INSERT INTO etablissements (id, slug, nom, is_active)
  VALUES (e, 'ctl-mvt-' || left(e::text, 8), 'CONTROLE MOUVEMENTS', true);
  INSERT INTO school_years (id, etablissement_id, label, is_current, start_date, end_date)
  VALUES (y, e, '2026-2027', true, '2026-09-01', '2027-06-30');
  INSERT INTO cotisation_types (id, etablissement_id, school_year_id, label, amount, registration_fee)
  VALUES (ct, e, y, 'CTL Enfant', 300, 20);
  INSERT INTO classes (id, etablissement_id, name, level, academic_year, cotisation_type_id)
  VALUES (c, e, 'CTL-MVT', 'CTL', '2026-2027', ct);
  INSERT INTO parents (id, etablissement_id, tutor1_last_name, tutor1_first_name, tutor1_email)
  VALUES (par, e, 'CTLMVT' || left(e::text, 8), 'Adulte', 'ctl-mvt-' || left(e::text, 8) || '@exemple.invalid');
  INSERT INTO students (id, etablissement_id, parent_id, student_number, first_name, last_name, date_of_birth)
  VALUES (s, e, par, 'CTL-' || left(e::text, 8), 'Eleve', 'CTLMVT', '2015-01-01');

  INSERT INTO auth.users (id, email, aud, role) VALUES
    (sec, 'ctl-mvt-sec-' || left(e::text, 8) || '@exemple.invalid', 'authenticated', 'authenticated'),
    (cpt, 'ctl-mvt-cpt-' || left(e::text, 8) || '@exemple.invalid', 'authenticated', 'authenticated');
  INSERT INTO profiles (id, email, role, first_name, last_name, etablissement_id) VALUES
    (sec, 'ctl-mvt-sec-' || left(e::text, 8) || '@exemple.invalid', 'secretaire', 'Sophie', 'Ctlsecretaire', e),
    (cpt, 'ctl-mvt-cpt-' || left(e::text, 8) || '@exemple.invalid', 'comptable', 'Camille', 'Ctlcomptable', e);

  -- ── Les gestes, par la secretaire ──
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', sec, 'role', 'authenticated')::text, true);

  INSERT INTO enrollments (student_id, class_id, status, enrollment_date) VALUES (s, c, 'active', '2026-09-01');
  RESET ROLE;
  SELECT count(*) INTO n FROM mouvements_inscription WHERE etablissement_id = e;
  SELECT * INTO m FROM mouvements_inscription WHERE etablissement_id = e ORDER BY survenu_le DESC, sens LIMIT 1;
  rapport := rapport || E'\n[' || CASE WHEN n = 1 AND m.sens = 'arrivee' AND m.date_effet = '2026-09-01'
                                         AND m.regle = 'due' AND m.school_year_id = y
                                         AND m.parent_id = par AND m.cotisation_montant = 300
                                         AND m.frais_inscription = 20 AND m.classe_nom = 'CTL-MVT'
                                       THEN 'OK' ELSE 'KO' END
    || '] affectation a la rentree   ' || n || ' mvt · ' || coalesce(m.sens, '?') || ' · effet ' || coalesce(m.date_effet::text, '?')
    || ' · ' || coalesce(m.regle, '?') || ' · ' || coalesce(m.cotisation_montant::text, '?') || '+' || coalesce(m.frais_inscription::text, '?');
  IF NOT (n = 1 AND m.sens = 'arrivee' AND m.date_effet = '2026-09-01' AND m.regle = 'due') THEN nb_ko := nb_ko + 1; END IF;
  rapport := rapport || E'\n[' || CASE WHEN m.auteur_id = sec AND m.auteur_nom = 'CTLSECRETAIRE Sophie' THEN 'OK' ELSE 'KO' END
    || '] auteur                     ' || coalesce(m.auteur_nom, '(vide)');
  IF NOT (m.auteur_id = sec AND m.auteur_nom = 'CTLSECRETAIRE Sophie') THEN nb_ko := nb_ko + 1; END IF;
  vu := n;

  SET LOCAL ROLE authenticated;
  UPDATE enrollments SET status = 'active', notes = 'x' WHERE student_id = s AND class_id = c;
  RESET ROLE;
  SELECT count(*) INTO n FROM mouvements_inscription WHERE etablissement_id = e;
  rapport := rapport || E'\n[' || CASE WHEN n = vu THEN 'OK' ELSE 'KO' END
    || '] mise a jour sans changement ' || (n - vu) || ' mvt';
  IF n <> vu THEN nb_ko := nb_ko + 1; END IF;
  vu := n;

  UPDATE etablissements SET regle_ajustement = 'prorata' WHERE id = e;
  SET LOCAL ROLE authenticated;
  DELETE FROM enrollments WHERE student_id = s AND class_id = c;
  RESET ROLE;
  SELECT count(*) INTO n FROM mouvements_inscription WHERE etablissement_id = e;
  SELECT * INTO m FROM mouvements_inscription WHERE etablissement_id = e AND sens = 'depart' ORDER BY survenu_le DESC LIMIT 1;
  rapport := rapport || E'\n[' || CASE WHEN n = vu + 1 AND m.regle = 'prorata' AND m.date_arrivee = '2026-09-01'
                                         AND m.date_effet = current_date AND m.motif = 'correction'
                                       THEN 'OK' ELSE 'KO' END
    || '] retrait (prorata)          ' || (n - vu) || ' mvt · ' || coalesce(m.regle, '?') || ' · arrivee ' || coalesce(m.date_arrivee::text, '?');
  IF NOT (n = vu + 1 AND m.regle = 'prorata' AND m.date_arrivee = '2026-09-01') THEN nb_ko := nb_ko + 1; END IF;
  vu := n;

  -- Statut : reinscrire, puis rendre inactif et reactiver.
  INSERT INTO enrollments (student_id, class_id, status, enrollment_date) VALUES (s, c, 'active', '2026-09-01');
  vu := vu + 1;
  SET LOCAL ROLE authenticated;
  UPDATE students SET is_active = false WHERE id = s;
  UPDATE students SET is_active = true  WHERE id = s;
  RESET ROLE;
  SELECT count(*) INTO n FROM mouvements_inscription WHERE etablissement_id = e AND motif = 'statut';
  rapport := rapport || E'\n[' || CASE WHEN n = 2
                                         AND EXISTS (SELECT 1 FROM mouvements_inscription WHERE etablissement_id = e AND motif = 'statut' AND sens = 'depart')
                                         AND EXISTS (SELECT 1 FROM mouvements_inscription WHERE etablissement_id = e AND motif = 'statut' AND sens = 'arrivee')
                                       THEN 'OK' ELSE 'KO' END
    || '] inactif puis reactive      ' || n || ' mvt (statut)';
  IF n <> 2 THEN nb_ko := nb_ko + 1; END IF;
  SELECT count(*) INTO vu FROM mouvements_inscription WHERE etablissement_id = e;

  -- Adulte.
  SET LOCAL ROLE authenticated;
  INSERT INTO parent_class_enrollments (etablissement_id, parent_id, class_id, tutor_number, status)
  VALUES (e, par, c, 1, 'active');
  DELETE FROM parent_class_enrollments WHERE parent_id = par AND class_id = c AND tutor_number = 1;
  RESET ROLE;
  SELECT count(*) INTO n FROM mouvements_inscription
   WHERE etablissement_id = e AND tutor_number = 1 AND student_id IS NULL AND parent_id = par;
  rapport := rapport || E'\n[' || CASE WHEN n = 2 THEN 'OK' ELSE 'KO' END
    || '] adulte affecte puis retire ' || n || ' mvt (tuteur 1)';
  IF n <> 2 THEN nb_ko := nb_ko + 1; END IF;
  SELECT count(*) INTO vu FROM mouvements_inscription WHERE etablissement_id = e;

  -- Effacement d'ecole en cours : rien.
  PERFORM set_config('app.effacement_etablissement', e::text, true);
  DELETE FROM enrollments WHERE student_id = s AND class_id = c;
  PERFORM set_config('app.effacement_etablissement', '', true);
  SELECT count(*) INTO n FROM mouvements_inscription WHERE etablissement_id = e;
  rapport := rapport || E'\n[' || CASE WHEN n = vu THEN 'OK' ELSE 'KO' END
    || '] effacement en cours        ' || (n - vu) || ' mvt';
  IF n <> vu THEN nb_ko := nb_ko + 1; END IF;

  -- Annee close : rien.
  UPDATE school_years SET closed_at = now() WHERE id = y;
  INSERT INTO enrollments (student_id, class_id, status, enrollment_date) VALUES (s, c, 'active', '2026-09-01');
  SELECT count(*) INTO n FROM mouvements_inscription WHERE etablissement_id = e;
  rapport := rapport || E'\n[' || CASE WHEN n = vu THEN 'OK' ELSE 'KO' END
    || '] annee close                ' || (n - vu) || ' mvt';
  IF n <> vu THEN nb_ko := nb_ko + 1; END IF;

  -- ── Les droits ──
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', cpt, 'role', 'authenticated')::text, true);
  SELECT count(*) INTO n FROM mouvements_inscription WHERE etablissement_id = e;
  RESET ROLE;
  rapport := rapport || E'\n[' || CASE WHEN n = vu AND n > 0 THEN 'OK' ELSE 'KO' END
    || '] comptable lit              ' || n || '/' || vu;
  IF NOT (n = vu AND n > 0) THEN nb_ko := nb_ko + 1; END IF;

  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', sec, 'role', 'authenticated')::text, true);
  SELECT count(*) INTO n FROM mouvements_inscription WHERE etablissement_id = e;
  RESET ROLE;
  rapport := rapport || E'\n[' || CASE WHEN n = 0 THEN 'OK' ELSE 'KO' END
    || '] secretaire ne lit pas      ' || n;
  IF n <> 0 THEN nb_ko := nb_ko + 1; END IF;

  BEGIN
    SET LOCAL ROLE authenticated;
    INSERT INTO mouvements_inscription (etablissement_id, sens, motif, date_effet, regle, student_id)
    VALUES (e, 'arrivee', 'affectation', current_date, 'due', s);
    RESET ROLE;
    rapport := rapport || E'\n[KO] ecriture directe         acceptee';
    nb_ko := nb_ko + 1;
  EXCEPTION WHEN insufficient_privilege THEN
    RESET ROLE;
    rapport := rapport || E'\n[OK] ecriture directe         refusee';
  END;

  PERFORM set_config('request.jwt.claims', NULL, true);
  RAISE EXCEPTION 'CONTROLE 21 : % KO (tout est annule)%', nb_ko, rapport;
END
$ctl$;
