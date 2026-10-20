-- ============================================================================
-- CONTROLE 19 — Retrait d'une classe : une note vide ne bloque pas
--
-- Cree une ecole JETABLE : une classe, une evaluation, un eleve affecte, un
-- foyer dont le tuteur 1 est affecte. Pour chaque cas, une seule ligne de note
-- est posee, puis on tente de RETIRER l'affectation (DELETE, ce que fait
-- l'ecran Affectations) :
--   eleve  · note vide (rien saisi)  -> retrait ACCEPTE
--   eleve  · note 12                 -> refuse
--   eleve  · appreciation « Bien »   -> refuse
--   eleve  · absent                  -> refuse
--   adulte · note vide               -> retrait ACCEPTE
--   adulte · note 15                 -> refuse
-- Un retrait accepte est remis en place pour le cas suivant.
--
-- Migration : supabase/migrations/fix-retrait-notes-vides.sql.
-- LECTURE SEULE : exception volontaire finale, tout est annule.
-- ============================================================================
DO $ctl$
DECLARE
  e uuid := gen_random_uuid();
  c uuid := gen_random_uuid();
  ev uuid := gen_random_uuid();
  s uuid := gen_random_uuid();
  par uuid := gen_random_uuid();
  cas text;
  accepte boolean;
  attendu boolean;
  rapport text := '';
  nb_ko integer := 0;
BEGIN
  INSERT INTO etablissements (id, slug, nom, is_active)
  VALUES (e, 'ctl-retrait-' || left(e::text, 8), 'CONTROLE RETRAIT', true);
  INSERT INTO classes (id, etablissement_id, name, level, academic_year)
  VALUES (c, e, 'CTL', 'CTL', '2026-2027');
  INSERT INTO evaluations (id, etablissement_id, class_id, title) VALUES (ev, e, c, 'CTL');
  INSERT INTO students (id, etablissement_id, student_number, first_name, last_name, date_of_birth)
  VALUES (s, e, 'CTL-' || left(e::text, 8), 'Eleve', 'CTLRETRAIT', '2015-01-01');
  INSERT INTO enrollments (student_id, class_id, status) VALUES (s, c, 'active');
  INSERT INTO parents (id, etablissement_id, tutor1_last_name, tutor1_first_name, tutor1_email)
  VALUES (par, e, 'CTL' || left(e::text, 8), 'Adulte', 'ctl-retrait-' || left(e::text, 8) || '@exemple.invalid');
  INSERT INTO parent_class_enrollments (etablissement_id, parent_id, class_id, tutor_number, status)
  VALUES (e, par, c, 1, 'active');

  FOREACH cas IN ARRAY ARRAY['eleve · note vide', 'eleve · note 12', 'eleve · appreciation', 'eleve · absent',
                             'adulte · note vide', 'adulte · note 15'] LOOP
    DELETE FROM grades WHERE student_id = s;
    DELETE FROM adult_grades WHERE parent_id = par;

    IF cas = 'eleve · note vide'    THEN INSERT INTO grades (student_id, evaluation_id) VALUES (s, ev); END IF;
    IF cas = 'eleve · note 12'      THEN INSERT INTO grades (student_id, evaluation_id, score) VALUES (s, ev, 12); END IF;
    IF cas = 'eleve · appreciation' THEN INSERT INTO grades (student_id, evaluation_id, comment) VALUES (s, ev, 'Bien'); END IF;
    IF cas = 'eleve · absent'       THEN INSERT INTO grades (student_id, evaluation_id, is_absent) VALUES (s, ev, true); END IF;
    IF cas = 'adulte · note vide'   THEN INSERT INTO adult_grades (etablissement_id, parent_id, tutor_number, evaluation_id) VALUES (e, par, 1, ev); END IF;
    IF cas = 'adulte · note 15'     THEN INSERT INTO adult_grades (etablissement_id, parent_id, tutor_number, evaluation_id, score) VALUES (e, par, 1, ev, 15); END IF;

    BEGIN
      IF cas LIKE 'eleve%' THEN
        DELETE FROM enrollments WHERE student_id = s AND class_id = c;
      ELSE
        DELETE FROM parent_class_enrollments WHERE parent_id = par AND class_id = c AND tutor_number = 1;
      END IF;
      accepte := true;
    EXCEPTION WHEN raise_exception THEN
      accepte := false;   -- ENROLLMENT_HAS_DATA : le sous-bloc est annule, l'affectation reste
    END;

    -- Remettre l'affectation retiree pour le cas suivant.
    IF accepte THEN
      IF cas LIKE 'eleve%' THEN
        INSERT INTO enrollments (student_id, class_id, status) VALUES (s, c, 'active');
      ELSE
        INSERT INTO parent_class_enrollments (etablissement_id, parent_id, class_id, tutor_number, status)
        VALUES (e, par, c, 1, 'active');
      END IF;
    END IF;

    attendu := cas LIKE '%note vide';
    IF accepte <> attendu THEN nb_ko := nb_ko + 1; END IF;
    rapport := rapport || E'\n[' || CASE WHEN accepte = attendu THEN 'OK' ELSE 'KO' END || '] '
      || rpad(cas, 24) || CASE WHEN accepte THEN 'retrait accepte' ELSE 'retrait refuse' END
      || CASE WHEN accepte <> attendu THEN '   (attendu ' || CASE WHEN attendu THEN 'accepte' ELSE 'refuse' END || ')' ELSE '' END;
  END LOOP;

  RAISE EXCEPTION 'CONTROLE 19 : % KO (tout est annule)%', nb_ko, rapport;
END
$ctl$;
