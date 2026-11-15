-- ============================================================================
-- CONTROLE 44 — Secretaire : Reglements, Cahier de texte, Referentiel (15/11)
--
-- E1 : secretaire, enseignant (fiche T1), classe C, foyer F1 (eleve S1 avec une
-- absence), dossier de reglement FEE1, impayes anterieurs, devoir HW1 suivi par
-- F1, regle de depart « au cas par cas ». E2 : une autre ecole et son dossier.
-- Verifie que la secretaire :
--   - lit les dossiers de SON ecole seulement, enregistre et supprime un
--     paiement, ajoute une reduction, enregistre une relance, lit les impayes
--     anterieurs sans les ecrire, lit les mouvements et decide d'un depart ;
--   - ne touche ni la regle de depart, ni les depenses, ni les cotisations ;
--   - ecrit seances et devoirs, lit le suivi des familles ;
--   - ecrit le referentiel (unite, module, cours).
-- Et que l'enseignant reste refuse sur l'argent (garde `fin_garde_dossier`).
-- Migration : supabase/migrations/secretaire-ecrans.sql.
-- LECTURE SEULE : exception volontaire finale, tout est annule.
-- ============================================================================

CREATE OR REPLACE FUNCTION pg_temp.ctl44(p_compte uuid, p_sql text)
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
      RETURN SQLERRM;
  END;
END
$f$;

DO $ctl$
DECLARE
  e1 uuid := gen_random_uuid();  e2 uuid := gen_random_uuid();
  y1 uuid := gen_random_uuid();  y2 uuid := gen_random_uuid();
  pe uuid := gen_random_uuid();  ct uuid := gen_random_uuid();  c uuid := gen_random_uuid();
  f1 uuid := gen_random_uuid();  f2 uuid := gen_random_uuid();  s1 uuid := gen_random_uuid();
  t1 uuid := gen_random_uuid();  hw1 uuid := gen_random_uuid(); ue uuid := gen_random_uuid();
  fee1 uuid := gen_random_uuid(); fee2 uuid := gen_random_uuid();
  sec uuid := gen_random_uuid(); ens uuid := gen_random_uuid();
  sx text := left(e1::text, 8);
  paiement text := format($p$jsonb_build_object('installment_number', 1, 'due_date', current_date, 'amount_due', 50,
    'amount_paid', 50, 'paid_date', current_date, 'payment_method', 'cash', 'payment_reference', NULL,
    'receipt_number', NULL, 'status', 'paid', 'notes', 'Controle 44 (annule)')$p$);
  i integer;
  rapport text := '';
  nb_ko integer := 0;
  attendus constant integer := 20;
  essais text[][] := '{}';
BEGIN
  INSERT INTO etablissements (id, slug, nom, is_active) VALUES
    (e1, 'ctl44-a-' || sx, 'CONTROLE 44 A', true), (e2, 'ctl44-b-' || sx, 'CONTROLE 44 B', true);
  UPDATE etablissements SET regle_ajustement = 'cas_par_cas' WHERE id = e1;
  INSERT INTO school_years (id, etablissement_id, label, is_current, start_date, end_date) VALUES
    (y1, e1, '2026-2027', true, '2026-09-01', '2027-06-30'), (y2, e2, '2026-2027', true, '2026-09-01', '2027-06-30');
  INSERT INTO periods (id, school_year_id, label, order_index) VALUES (pe, y1, 'T1', 1);
  INSERT INTO cotisation_types (id, etablissement_id, school_year_id, label, amount, registration_fee)
  VALUES (ct, e1, y1, 'CTL44', 300, 20);
  INSERT INTO classes (id, etablissement_id, name, level, academic_year, cotisation_type_id)
  VALUES (c, e1, 'CTL44', 'CTL', '2026-2027', ct);
  INSERT INTO parents (id, etablissement_id, tutor1_last_name, tutor1_first_name, tutor1_email) VALUES
    (f1, e1, 'CTL44A' || sx, 'Un', 'ctl44-a-' || sx || '@exemple.invalid'),
    (f2, e2, 'CTL44B' || sx, 'Deux', 'ctl44-b-' || sx || '@exemple.invalid');
  INSERT INTO students (id, etablissement_id, parent_id, student_number, first_name, last_name, date_of_birth)
  VALUES (s1, e1, f1, 'CTL44-' || sx, 'Un', 'CTL44', '2016-01-01');
  INSERT INTO enrollments (student_id, class_id, status, enrollment_date) VALUES (s1, c, 'active', '2026-09-01');
  INSERT INTO absences (etablissement_id, student_id, class_id, period_id, absence_date, absence_type)
  VALUES (e1, s1, c, pe, '2026-10-03', 'absence');
  INSERT INTO teachers (id, etablissement_id, first_name, last_name, employee_number, email)
  VALUES (t1, e1, 'Eric', 'CTL44', 'ENS-CTL44-' || sx, 'ctl44-t-' || sx || '@exemple.invalid');
  INSERT INTO homework (id, etablissement_id, class_id, teacher_id, subject, title, homework_type, due_date)
  VALUES (hw1, e1, c, t1, 'General', 'CTL44', 'lecon', '2026-11-21');
  INSERT INTO homework_status (homework_id, student_id, parent_id, is_seen) VALUES (hw1, s1, f1, true);
  INSERT INTO family_fees (id, etablissement_id, parent_id, school_year_id, subtotal, adjustments_total, total_due, status)
  VALUES (fee1, e1, f1, y1, 300, 0, 300, 'pending'), (fee2, e2, f2, y2, 300, 0, 300, 'pending');
  INSERT INTO family_year_finance (etablissement_id, parent_id, year_label) VALUES (e1, f1, '2025-2026');
  INSERT INTO unites_enseignement (id, etablissement_id, nom_fr) VALUES (ue, e1, 'CTL44');

  INSERT INTO auth.users (id, email, aud, role) VALUES
    (sec, 'ctl44-sec-' || sx || '@exemple.invalid', 'authenticated', 'authenticated'),
    (ens, 'ctl44-ens-' || sx || '@exemple.invalid', 'authenticated', 'authenticated');
  INSERT INTO profiles (id, email, role, first_name, last_name, etablissement_id) VALUES
    (sec, 'ctl44-sec-' || sx || '@exemple.invalid', 'secretaire', 'Sophie', 'Ctl44', e1),
    (ens, 'ctl44-ens-' || sx || '@exemple.invalid', 'enseignant', 'Eric', 'Ctl44', e1);

  -- ── Reglements ──
  essais := essais || ARRAY[['sec : dossiers de son ecole seulement', 'ok:1',
    pg_temp.ctl44(sec, 'SELECT count(*)::text FROM family_fees')]];
  essais := essais || ARRAY[['sec : dossier d''une autre ecole', 'ok:0',
    pg_temp.ctl44(sec, format('SELECT count(*)::text FROM family_fees WHERE id = %L', fee2))]];
  essais := essais || ARRAY[['sec : enregistrer un paiement', 'ok:paid',
    pg_temp.ctl44(sec, format('SELECT fin_enregistrer_paiement(%L, 300, %s) -> ''paiement'' ->> ''status''', fee1, paiement))]];
  essais := essais || ARRAY[['sec : supprimer ce paiement', 'ok:fait',
    pg_temp.ctl44(sec, format('SELECT ''fait'' FROM (SELECT fin_supprimer_paiement((SELECT id FROM fee_installments WHERE family_fee_id = %L), 300)) x', fee1))]];
  essais := essais || ARRAY[['sec : ajouter une reduction', 'ok:reduction',
    pg_temp.ctl44(sec, format($q$SELECT fin_ajouter_reduction(%L, 300, jsonb_build_object('adjustment_date', current_date,
      'adjustment_type', 'reduction', 'label', 'CTL44', 'amount', -30)) -> 'reduction' ->> 'adjustment_type'$q$, fee1))]];
  essais := essais || ARRAY[['sec : enregistrer une relance', 'ok:1',
    pg_temp.ctl44(sec, format($q$WITH i AS (INSERT INTO financement_communications (etablissement_id, parent_id, type, subject)
      VALUES (%L, %L, 'relance', 'CTL44') RETURNING 1) SELECT count(*)::text FROM i$q$, e1, f1))]];
  essais := essais || ARRAY[['sec : lire les impayes anterieurs', 'ok:1',
    pg_temp.ctl44(sec, 'SELECT count(*)::text FROM family_year_finance')]];
  essais := essais || ARRAY[['sec : ecrire les impayes anterieurs', 'droits',
    pg_temp.ctl44(sec, format($q$WITH i AS (INSERT INTO family_year_finance (etablissement_id, parent_id, year_label)
      VALUES (%L, %L, '2024-2025') RETURNING 1) SELECT count(*)::text FROM i$q$, e1, f1))]];
  essais := essais || ARRAY[['sec : declarer un depart (cas par cas)', 'ok',
    pg_temp.ctl44(sec, format('SELECT declarer_depart_eleve(%L, %L)::text', s1, '2026-11-10'))]];
  essais := essais || ARRAY[['sec : lire les mouvements', 'ok:1',
    pg_temp.ctl44(sec, 'SELECT count(*)::text FROM mouvements_inscription WHERE motif = ''depart''')]];
  essais := essais || ARRAY[['sec : decider du depart', 'ok:fait',
    pg_temp.ctl44(sec, format($q$SELECT 'fait' FROM (SELECT decider_mouvement((SELECT id FROM mouvements_inscription
      WHERE student_id = %L AND motif = 'depart'), 'due')) x$q$, s1))]];
  essais := essais || ARRAY[['sec : regle de depart (refusee)', 'REGLE_REFUSEE',
    pg_temp.ctl44(sec, 'SELECT definir_regle_ajustement(''due'')::text')]];
  essais := essais || ARRAY[['sec : depense (refusee)', 'droits',
    pg_temp.ctl44(sec, format($q$WITH i AS (INSERT INTO expenses (etablissement_id, school_year_id, label)
      VALUES (%L, %L, 'CTL44') RETURNING 1) SELECT count(*)::text FROM i$q$, e1, y1))]];
  essais := essais || ARRAY[['sec : cotisation (rien modifie)', 'ok:0',
    pg_temp.ctl44(sec, format('WITH u AS (UPDATE cotisation_types SET amount = 1 WHERE id = %L RETURNING 1) SELECT count(*)::text FROM u', ct))]];
  essais := essais || ARRAY[['ens : paiement (refuse)', 'droits',
    pg_temp.ctl44(ens, format('SELECT fin_enregistrer_paiement(%L, 300, %s)::text', fee1, paiement))]];

  -- ── Cahier de texte ──
  essais := essais || ARRAY[['sec : ecrire une seance', 'ok:1',
    pg_temp.ctl44(sec, format($q$WITH i AS (INSERT INTO class_journal (etablissement_id, class_id, teacher_id, session_date, title)
      VALUES (%L, %L, %L, '2026-11-14', 'CTL44') RETURNING 1) SELECT count(*)::text FROM i$q$, e1, c, t1))]];
  essais := essais || ARRAY[['sec : ecrire un devoir', 'ok:1',
    pg_temp.ctl44(sec, format($q$WITH i AS (INSERT INTO homework (etablissement_id, class_id, teacher_id, subject, title, homework_type, due_date)
      VALUES (%L, %L, %L, 'General', 'CTL44 bis', 'exercice', '2026-11-28') RETURNING 1) SELECT count(*)::text FROM i$q$, e1, c, t1))]];
  essais := essais || ARRAY[['sec : lire le suivi des familles', 'ok:1',
    pg_temp.ctl44(sec, 'SELECT count(*)::text FROM homework_status')]];

  -- ── Referentiel ──
  essais := essais || ARRAY[['sec : ecrire une unite', 'ok:1',
    pg_temp.ctl44(sec, format($q$WITH i AS (INSERT INTO unites_enseignement (etablissement_id, nom_fr)
      VALUES (%L, 'CTL44 bis') RETURNING 1) SELECT count(*)::text FROM i$q$, e1))]];
  essais := essais || ARRAY[['sec : ecrire un module puis un cours', 'ok:1',
    pg_temp.ctl44(sec, format($q$WITH m AS (INSERT INTO cours_modules (unite_enseignement_id, nom_fr) VALUES (%L, 'CTL44') RETURNING id),
      i AS (INSERT INTO cours (unite_enseignement_id, module_id, nom_fr) SELECT %L, m.id, 'CTL44' FROM m RETURNING 1)
      SELECT count(*)::text FROM i$q$, ue, ue))]];

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

  RAISE EXCEPTION 'CONTROLE 44 : % KO (tout est annule)%', nb_ko, rapport;
END
$ctl$;
