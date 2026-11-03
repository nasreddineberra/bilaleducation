-- ============================================================================
-- CONTROLE 38 — Espace famille, lecture « mon foyer » (03/11)
--
-- Deux ecoles JETABLES avec l'option : E1, E2.
--   F1 (E1) : P1A tuteur 1, P1B tuteur 2 (cours adulte CA) ; S1 actif en C1,
--             S1B parti (inactif, inscription retiree de C1)
--   F2 (E1) : P2 ; S2 actif en C2
--   F4 (E1) : P4 ; S4 parti (dernier enfant) : foyer NON ACTIF
--   F3 (E2) : P3 ; S3 actif en C3
--   DIR : direction de E1 (remplacant d'une seance)
-- Verifie, pour chaque table et chaque fonction de lecture : son foyer oui,
-- l'autre foyer non, l'autre ecole non ; foyer non actif = noms des enfants et
-- bulletins de l'annee seulement, jusqu'a la fin d'annee ; aucune colonne
-- interne rendue ; option coupee = rien ; le personnel lit comme avant.
-- Migration : supabase/migrations/espace-famille-lecture.sql.
-- LECTURE SEULE : exception volontaire finale, tout est annule.
-- ============================================================================

CREATE OR REPLACE FUNCTION pg_temp.ctl38(p_compte uuid, p_sql text)
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
  y1 uuid := gen_random_uuid();  y0 uuid := gen_random_uuid();  y2 uuid := gen_random_uuid();
  pe1 uuid := gen_random_uuid(); pe0 uuid := gen_random_uuid(); pe2 uuid := gen_random_uuid();
  c1 uuid := gen_random_uuid();  c2 uuid := gen_random_uuid();  ca uuid := gen_random_uuid();
  c3 uuid := gen_random_uuid();
  ct1 uuid := gen_random_uuid();
  t1 uuid := gen_random_uuid();  t2 uuid := gen_random_uuid();
  f1 uuid := gen_random_uuid();  f2 uuid := gen_random_uuid();
  f3 uuid := gen_random_uuid();  f4 uuid := gen_random_uuid();
  s1 uuid := gen_random_uuid();  s1b uuid := gen_random_uuid();
  s2 uuid := gen_random_uuid();  s3 uuid := gen_random_uuid();  s4 uuid := gen_random_uuid();
  sl1 uuid := gen_random_uuid(); sl2 uuid := gen_random_uuid(); sla uuid := gen_random_uuid();
  sl3 uuid := gen_random_uuid();
  ae uuid := gen_random_uuid();
  an1 uuid := gen_random_uuid(); an2 uuid := gen_random_uuid(); an4 uuid := gen_random_uuid();
  ff1 uuid := gen_random_uuid();
  p1a uuid := gen_random_uuid(); p1b uuid := gen_random_uuid();
  p2  uuid := gen_random_uuid(); p3  uuid := gen_random_uuid();
  p4  uuid := gen_random_uuid(); dir uuid := gen_random_uuid();
  t1u uuid := gen_random_uuid();
  sx text := left(e1::text, 8);
  eleves   text := 'SELECT string_agg(first_name, '','' ORDER BY first_name) FROM students';
  classes  text := 'SELECT string_agg(name, '','' ORDER BY name) FROM classes';
  bulletins text := 'SELECT string_agg(split_part(file_path, ''/'', 3), '','' ORDER BY file_path) FROM bulletin_archives';
  r text;
  i integer;
  rapport text := '';
  nb_ko integer := 0;
  attendus constant integer := 57;
  essais text[][] := '{}';
BEGIN
  -- ── Donnees ───────────────────────────────────────────────────────────────
  INSERT INTO etablissements (id, slug, nom, is_active) VALUES
    (e1, 'ctl-lecture-1-' || sx, 'CONTROLE LECTURE 1', true),
    (e2, 'ctl-lecture-2-' || sx, 'CONTROLE LECTURE 2', true);
  BEGIN
    EXECUTE format('UPDATE etablissements SET option_espace_famille = true WHERE id IN (%L, %L)', e1, e2);
  EXCEPTION WHEN others THEN NULL;
  END;
  INSERT INTO school_years (id, etablissement_id, label, is_current, start_date, end_date) VALUES
    (y1, e1, 'CTL-38', true, '2026-09-01', '2099-06-30'),
    (y0, e1, 'CTL-38-ANC', false, '2025-09-01', '2026-06-30'),
    (y2, e2, 'CTL-38', true, '2026-09-01', '2099-06-30');
  INSERT INTO periods (id, school_year_id, label, order_index) VALUES
    (pe1, y1, 'T1', 1), (pe0, y0, 'T1', 1), (pe2, y2, 'T1', 1);
  INSERT INTO cotisation_types (id, etablissement_id, school_year_id, label, amount)
  VALUES (ct1, e1, y1, 'Enfant', 300);
  INSERT INTO classes (id, etablissement_id, name, level, academic_year, cotisation_type_id) VALUES
    (c1, e1, 'C1', 'CTL', 'CTL-38', ct1), (c2, e1, 'C2', 'CTL', 'CTL-38', ct1),
    (ca, e1, 'CA', 'CTL', 'CTL-38', NULL), (c3, e2, 'C3', 'CTL', 'CTL-38', NULL);
  INSERT INTO teachers (id, etablissement_id, first_name, last_name, employee_number, email, phone, notes, civilite) VALUES
    (t1, e1, 'Prof', 'CTL38', 'CTL38-1-' || sx, 'prof-secret-' || sx || '@exemple.invalid', '0600000038', 'NOTE PROF', 'M.'),
    (t2, e2, 'Prof', 'CTL38B', 'CTL38-2-' || sx, 'prof2-' || sx || '@exemple.invalid', NULL, NULL, 'M.');
  INSERT INTO class_teachers (class_id, teacher_id, is_main_teacher) VALUES
    (c1, t1, true), (c2, t1, true), (ca, t1, true), (c3, t2, true);
  INSERT INTO rooms (etablissement_id, name) VALUES (e1, 'Salle 1');
  INSERT INTO unites_enseignement (etablissement_id, nom_fr) VALUES (e1, 'Langue');

  FOR i IN 1 .. 6 LOOP
    INSERT INTO auth.users (id, email, aud, role)
    VALUES ((ARRAY[p1a, p1b, p2, p3, p4, dir])[i], 'ctl38-' || i || '-' || sx || '@exemple.invalid', 'authenticated', 'authenticated');
    INSERT INTO profiles (id, email, role, first_name, last_name, etablissement_id, is_active)
    VALUES ((ARRAY[p1a, p1b, p2, p3, p4, dir])[i], 'ctl38-' || i || '-' || sx || '@exemple.invalid',
            CASE i WHEN 6 THEN 'direction' ELSE 'parent' END, 'Compte' || i,
            CASE i WHEN 6 THEN 'DIRNOM' ELSE 'CTL38' END,
            CASE i WHEN 4 THEN e2 ELSE e1 END, true);
  END LOOP;

  INSERT INTO auth.users (id, email, aud, role) VALUES (t1u, 'ctl38-ens-' || sx || '@exemple.invalid', 'authenticated', 'authenticated');
  INSERT INTO profiles (id, email, role, first_name, last_name, etablissement_id, is_active)
  VALUES (t1u, 'ctl38-ens-' || sx || '@exemple.invalid', 'enseignant', 'Prof', 'CTL38', e1, true);
  INSERT INTO materials (etablissement_id, name) VALUES (e1, 'Ressource');
  INSERT INTO parents (id, etablissement_id, tutor1_last_name, tutor1_first_name, tutor1_relationship, tutor1_email,
                       tutor2_last_name, tutor2_first_name, tutor2_relationship, tutor2_email, tutor2_adult_courses,
                       tutor1_user_id, tutor2_user_id, notes) VALUES
    (f1, e1, 'UN', 'Ctl', 'père', 'f1@exemple.invalid', 'UN', 'Ctlbis', 'mère', 'f1b@exemple.invalid', true, p1a, p1b, 'NOTE INTERNE'),
    (f2, e1, 'DEUX', 'Ctl', 'père', 'f2@exemple.invalid', NULL, NULL, NULL, NULL, false, p2, NULL, NULL),
    (f4, e1, 'QUATRE', 'Ctl', 'père', 'f4@exemple.invalid', NULL, NULL, NULL, NULL, false, p4, NULL, NULL),
    (f3, e2, 'TROIS', 'Ctl', 'père', 'f3@exemple.invalid', NULL, NULL, NULL, NULL, false, p3, NULL, NULL);

  INSERT INTO students (id, etablissement_id, student_number, first_name, last_name, date_of_birth, is_active, parent_id) VALUES
    (s1,  e1, 'CTL38-S1-'  || sx, 'S1',  'UN', '2018-01-01', true,  f1),
    (s1b, e1, 'CTL38-S1B-' || sx, 'S1B', 'UN', '2017-01-01', false, f1),
    (s2,  e1, 'CTL38-S2-'  || sx, 'S2',  'DEUX', '2018-01-01', true, f2),
    (s4,  e1, 'CTL38-S4-'  || sx, 'S4',  'QUATRE', '2018-01-01', false, f4),
    (s3,  e2, 'CTL38-S3-'  || sx, 'S3',  'TROIS', '2018-01-01', true, f3);
  INSERT INTO enrollments (student_id, class_id, status, date_depart) VALUES
    (s1, c1, 'active', NULL), (s1b, c1, 'withdrawn', '2026-10-15'),
    (s2, c2, 'active', NULL), (s4, c2, 'withdrawn', '2026-10-15'), (s3, c3, 'active', NULL);
  INSERT INTO parent_class_enrollments (etablissement_id, parent_id, class_id, tutor_number, status)
  VALUES (e1, f1, ca, 2, 'active');

  INSERT INTO schedule_slots (id, etablissement_id, school_year_id, class_id, is_recurring, day_of_week, start_time, end_time, slot_type, libelle) VALUES
    (sl1, e1, y1, c1, true, 3, '10:00', '12:00', 'activite', 'SL1'),
    (sl2, e1, y1, c2, true, 3, '10:00', '12:00', 'activite', 'SL2'),
    (sla, e1, y1, ca, true, 6, '10:00', '12:00', 'activite', 'SLA'),
    (sl3, e2, y2, c3, true, 3, '10:00', '12:00', 'activite', 'SL3');
  INSERT INTO schedule_exceptions (etablissement_id, schedule_slot_id, exception_date, exception_type) VALUES
    (e1, sl1, '2026-11-04', 'cancelled'), (e1, sl2, '2026-11-04', 'cancelled');
  INSERT INTO absences_enseignants (id, etablissement_id, teacher_id, debut, fin, motif)
  VALUES (ae, e1, t1, '2026-11-11 08:00', '2026-11-11 18:00', 'personnel');
  INSERT INTO absences_enseignants_seances (etablissement_id, absence_id, schedule_slot_id, seance_date, decision, remplacant_profile_id) VALUES
    (e1, ae, sl1, '2026-11-11', 'remplacee', dir),
    (e1, ae, sl2, '2026-11-11', 'annulee', NULL);

  INSERT INTO absences (etablissement_id, student_id, class_id, period_id, absence_date, absence_type, comment) VALUES
    (e1, s1, c1, pe1, '2026-10-01', 'absence', 'A1'),
    (e1, s1b, c1, pe1, '2026-10-01', 'absence', 'A1B'),
    (e1, s2, c2, pe1, '2026-10-01', 'absence', 'A2'),
    (e1, s4, c2, pe1, '2026-10-01', 'absence', 'A4'),
    (e2, s3, c3, pe2, '2026-10-01', 'absence', 'A3');
  INSERT INTO adult_absences (etablissement_id, parent_id, tutor_number, class_id, period_id, absence_date, absence_type)
  VALUES (e1, f1, 2, ca, pe1, '2026-10-03', 'absence');

  INSERT INTO bulletin_archives (etablissement_id, student_id, class_id, period_id, file_path) VALUES
    (e1, s1,  c1, pe1, e1 || '/CTL/B1'),
    (e1, s1,  c1, pe0, e1 || '/CTL/B1OLD'),
    (e1, s1b, c1, pe1, e1 || '/CTL/B1B'),
    (e1, s2,  c2, pe1, e1 || '/CTL/B2'),
    (e1, s4,  c2, pe1, e1 || '/CTL/B4'),
    (e2, s3,  c3, pe2, e2 || '/CTL/B3');
  INSERT INTO adult_bulletin_archives (etablissement_id, parent_id, tutor_number, class_id, period_id, file_path)
  VALUES (e1, f1, 2, ca, pe1, e1 || '/adultes/BA');

  INSERT INTO announcements (id, etablissement_id, title, content, announcement_type) VALUES
    (an1, e1, 'AN1', 'corps', 'selected'), (an2, e1, 'AN2', 'corps', 'selected'), (an4, e1, 'AN4', 'corps', 'selected');
  INSERT INTO announcement_recipients (announcement_id, parent_id) VALUES (an1, f1), (an2, f2), (an4, f4);
  INSERT INTO announcement_attachments (announcement_id, file_name, file_path)
  VALUES (an1, 'pj.pdf', e1 || '/PJ1'), (an2, 'pj.pdf', e1 || '/PJ2');
  INSERT INTO notifications (etablissement_id, type, parent_id, title, body) VALUES
    (e1, 'homework', f1, 'N1', 'corps'), (e1, 'homework', f4, 'N4', 'corps');

  INSERT INTO family_fees (id, etablissement_id, parent_id, school_year_id, subtotal, total_due)
  VALUES (ff1, e1, f1, y1, 300, 300);
  INSERT INTO fee_installments (etablissement_id, family_fee_id, installment_number, due_date, amount_due, amount_paid, notes)
  VALUES (e1, ff1, 1, '2026-10-01', 300, 100, 'NOTE PAIEMENT');
  INSERT INTO fee_adjustments (etablissement_id, family_fee_id, adjustment_type, label, amount)
  VALUES (e1, ff1, 'reduction', 'Geste', -10);

  -- ── Enfants et classes ────────────────────────────────────────────────────
  essais := essais || ARRAY[['eleves : P1A (actif + parti)', 'ok:S1,S1B', pg_temp.ctl38(p1a, eleves)]];
  essais := essais || ARRAY[['eleves : P1B, meme foyer', 'ok:S1,S1B', pg_temp.ctl38(p1b, eleves)]];
  essais := essais || ARRAY[['eleves : P2', 'ok:S2', pg_temp.ctl38(p2, eleves)]];
  essais := essais || ARRAY[['eleves : P4, foyer non actif', 'ok:S4', pg_temp.ctl38(p4, eleves)]];
  essais := essais || ARRAY[['eleves : P3, autre ecole', 'ok:S3', pg_temp.ctl38(p3, eleves)]];
  essais := essais || ARRAY[['classes : P1A', 'ok:C1', pg_temp.ctl38(p1a, classes)]];
  essais := essais || ARRAY[['classes : P1B (+ cours adulte)', 'ok:C1,CA', pg_temp.ctl38(p1b, classes)]];
  essais := essais || ARRAY[['classes : P4 (classe du bulletin)', 'ok:C2', pg_temp.ctl38(p4, classes)]];

  -- ── Emploi du temps ───────────────────────────────────────────────────────
  essais := essais || ARRAY[['creneaux : P1B', 'ok:SL1,SLA',
    pg_temp.ctl38(p1b, 'SELECT string_agg(libelle, '','' ORDER BY libelle) FROM schedule_slots')]];
  essais := essais || ARRAY[['creneaux : P4 non actif', 'ok', pg_temp.ctl38(p4, 'SELECT string_agg(libelle, '','') FROM schedule_slots')]];
  essais := essais || ARRAY[['exceptions : P1A', 'ok:1', pg_temp.ctl38(p1a, 'SELECT count(*)::text FROM schedule_exceptions')]];
  essais := essais || ARRAY[['salles : P1A', 'ok:1', pg_temp.ctl38(p1a, 'SELECT count(*)::text FROM rooms')]];
  essais := essais || ARRAY[['salles : P4 non actif', 'ok:0', pg_temp.ctl38(p4, 'SELECT count(*)::text FROM rooms')]];
  essais := essais || ARRAY[['matieres : P1A', 'ok:1', pg_temp.ctl38(p1a, 'SELECT count(*)::text FROM unites_enseignement')]];
  essais := essais || ARRAY[['annees : P1A', 'ok:2', pg_temp.ctl38(p1a, 'SELECT count(*)::text FROM school_years')]];
  essais := essais || ARRAY[['periodes : P3, autre ecole', 'ok:1', pg_temp.ctl38(p3, 'SELECT count(*)::text FROM periods')]];
  essais := essais || ARRAY[['enseignants : P1A, identite', 'ok:C1:CTL38',
    pg_temp.ctl38(p1a, format('SELECT string_agg(CASE class_id WHEN %L THEN ''C1'' ELSE ''?'' END || '':'' || last_name, '','') FROM famille_enseignants()', c1))]];
  essais := essais || ARRAY[['enseignants : ni telephone ni notes', 'ok:propre',
    pg_temp.ctl38(p1a, 'SELECT CASE WHEN string_agg(f::text, '''') ~ ''(0600000038|NOTE PROF|prof-secret)'' THEN ''fuite'' ELSE ''propre'' END FROM famille_enseignants() f')]];
  essais := essais || ARRAY[['seances : P1A remplacee', 'ok:remplacee:DIRNOM',
    pg_temp.ctl38(p1a, 'SELECT string_agg(decision || '':'' || remplacant_nom, '','') FROM famille_seances_modifiees(''2026-11-01'', ''2026-11-30'')')]];
  essais := essais || ARRAY[['seances : P2 annulee', 'ok:annulee',
    pg_temp.ctl38(p2, 'SELECT string_agg(decision, '','') FROM famille_seances_modifiees(''2026-11-01'', ''2026-11-30'')')]];
  essais := essais || ARRAY[['seances : jamais le motif', 'ok:propre',
    pg_temp.ctl38(p1a, 'SELECT CASE WHEN coalesce(string_agg(f::text, ''''), '''') ~ ''personnel'' THEN ''fuite'' ELSE ''propre'' END FROM famille_seances_modifiees(''2026-11-01'', ''2026-11-30'') f')]];
  essais := essais || ARRAY[['seances : P4 non actif', 'ok:0',
    pg_temp.ctl38(p4, 'SELECT count(*)::text FROM famille_seances_modifiees(''2026-11-01'', ''2026-11-30'')')]];
  essais := essais || ARRAY[['seances : plus de 100 jours', 'ok:0',
    pg_temp.ctl38(p1a, 'SELECT count(*)::text FROM famille_seances_modifiees(''2026-01-01'', ''2026-12-31'')')]];

  -- ── Absences ──────────────────────────────────────────────────────────────
  essais := essais || ARRAY[['absences : P1A (enfant actif, commentaire)', 'ok:A1',
    pg_temp.ctl38(p1a, 'SELECT string_agg(comment, '','' ORDER BY comment) FROM absences')]];
  essais := essais || ARRAY[['absences : P2', 'ok:A2', pg_temp.ctl38(p2, 'SELECT string_agg(comment, '','') FROM absences')]];
  essais := essais || ARRAY[['absences : P4 non actif', 'ok', pg_temp.ctl38(p4, 'SELECT string_agg(comment, '','') FROM absences')]];
  essais := essais || ARRAY[['absences adulte : P1B', 'ok:1', pg_temp.ctl38(p1b, 'SELECT count(*)::text FROM adult_absences')]];
  essais := essais || ARRAY[['absences adulte : P1A', 'ok:0', pg_temp.ctl38(p1a, 'SELECT count(*)::text FROM adult_absences')]];
  essais := essais || ARRAY[['inscriptions adulte : P1B / P1A', 'ok:1/0',
    pg_temp.ctl38(p1b, 'SELECT count(*)::text FROM parent_class_enrollments') || '/' || substr(pg_temp.ctl38(p1a, 'SELECT count(*)::text FROM parent_class_enrollments'), 4)]];

  -- ── Bulletins ─────────────────────────────────────────────────────────────
  essais := essais || ARRAY[['bulletins : P1A (annee en cours, parti compris)', 'ok:B1,B1B', pg_temp.ctl38(p1a, bulletins)]];
  essais := essais || ARRAY[['bulletins : P2', 'ok:B2', pg_temp.ctl38(p2, bulletins)]];
  essais := essais || ARRAY[['bulletins : P4 non actif', 'ok:B4', pg_temp.ctl38(p4, bulletins)]];
  essais := essais || ARRAY[['bulletins adulte : P1B / P1A', 'ok:1/0',
    pg_temp.ctl38(p1b, 'SELECT count(*)::text FROM adult_bulletin_archives') || '/' || substr(pg_temp.ctl38(p1a, 'SELECT count(*)::text FROM adult_bulletin_archives'), 4)]];
  essais := essais || ARRAY[['fichier : P1A, son bulletin', 'ok:true',
    pg_temp.ctl38(p1a, format('SELECT fichier_bulletin_lisible(%L)::text', e1 || '/CTL/B1'))]];
  essais := essais || ARRAY[['fichier : P1A, bulletin de F2', 'ok:false',
    pg_temp.ctl38(p1a, format('SELECT fichier_bulletin_lisible(%L)::text', e1 || '/CTL/B2'))]];
  essais := essais || ARRAY[['fichier : P1B, bulletin adulte', 'ok:true',
    pg_temp.ctl38(p1b, format('SELECT fichier_bulletin_lisible(%L)::text', e1 || '/adultes/BA'))]];
  UPDATE school_years SET end_date = '2026-10-31' WHERE id = y1;
  essais := essais || ARRAY[['fin d''annee passee : P1A', 'ok:B1', pg_temp.ctl38(p1a, bulletins)]];
  essais := essais || ARRAY[['fin d''annee passee : P4', 'ok', pg_temp.ctl38(p4, bulletins)]];
  UPDATE school_years SET end_date = '2099-06-30' WHERE id = y1;

  -- ── Fiche du foyer, finances ──────────────────────────────────────────────
  essais := essais || ARRAY[['foyer : P1B, deux tuteurs', 'ok:Ctl,Ctlbis',
    pg_temp.ctl38(p1b, 'SELECT string_agg(first_name, '','' ORDER BY tutor_number) FROM famille_foyer()')]];
  essais := essais || ARRAY[['foyer : jamais la note interne', 'ok:propre',
    pg_temp.ctl38(p1a, 'SELECT CASE WHEN string_agg(f::text, '''') ~ ''NOTE INTERNE'' THEN ''fuite'' ELSE ''propre'' END FROM famille_foyer() f')]];
  essais := essais || ARRAY[['foyer : P4 non actif (fiche)', 'ok:Ctl',
    pg_temp.ctl38(p4, 'SELECT string_agg(first_name, '','') FROM famille_foyer()')]];
  essais := essais || ARRAY[['finances : P1A du / echeance', 'ok:300.00/100.00',
    pg_temp.ctl38(p1a, 'SELECT (famille_finances()->''dossiers''->0->>''total_due'') || ''/'' || (famille_finances()->''dossiers''->0->''echeances''->0->>''amount_paid'')')]];
  essais := essais || ARRAY[['finances : enfants (actif + parti)', 'ok:2',
    pg_temp.ctl38(p1a, 'SELECT jsonb_array_length(famille_finances()->''enfants'')::text')]];
  essais := essais || ARRAY[['finances : ni note ni auteur', 'ok:propre',
    pg_temp.ctl38(p1a, 'SELECT CASE WHEN famille_finances()::text ~ ''(NOTE PAIEMENT|recorded_by|notes)'' THEN ''fuite'' ELSE ''propre'' END')]];
  essais := essais || ARRAY[['finances : P2 sans dossier', 'ok:0',
    pg_temp.ctl38(p2, 'SELECT jsonb_array_length(famille_finances()->''dossiers'')::text')]];
  essais := essais || ARRAY[['finances : P4 non actif', 'ok',
    pg_temp.ctl38(p4, 'SELECT famille_finances()::text')]];

  -- ── Messages, notifications ───────────────────────────────────────────────
  essais := essais || ARRAY[['messages : P1A', 'ok:AN1', pg_temp.ctl38(p1a, 'SELECT string_agg(title, '','') FROM announcements')]];
  essais := essais || ARRAY[['messages : P4 non actif', 'ok', pg_temp.ctl38(p4, 'SELECT string_agg(title, '','') FROM announcements')]];
  essais := essais || ARRAY[['pieces jointes : P1A / P2', 'ok:PJ1/PJ2',
    pg_temp.ctl38(p1a, 'SELECT string_agg(split_part(file_path, ''/'', 2), '','') FROM announcement_attachments') || '/'
    || substr(pg_temp.ctl38(p2, 'SELECT string_agg(split_part(file_path, ''/'', 2), '','') FROM announcement_attachments'), 4)]];
  essais := essais || ARRAY[['fichier joint : P1A, celui de F2', 'ok:false',
    pg_temp.ctl38(p1a, format('SELECT fichier_annonce_lisible(%L)::text', e1 || '/PJ2'))]];
  essais := essais || ARRAY[['notifications : P4 non actif', 'ok', pg_temp.ctl38(p4, 'SELECT string_agg(title, '','') FROM notifications')]];

  -- ── Option coupee, personnel, anon ────────────────────────────────────────
  BEGIN
    EXECUTE format('UPDATE etablissements SET option_espace_famille = false WHERE id = %L', e1);
  EXCEPTION WHEN others THEN NULL;
  END;
  essais := essais || ARRAY[['option coupee : eleves P1A', 'ok', pg_temp.ctl38(p1a, eleves)]];
  essais := essais || ARRAY[['option coupee : bulletins P1A', 'ok', pg_temp.ctl38(p1a, bulletins)]];
  essais := essais || ARRAY[['personnel : enseignant, salles', 'ok:1', pg_temp.ctl38(t1u, 'SELECT count(*)::text FROM rooms')]];
  essais := essais || ARRAY[['parent : ressources', 'ok:0',
    pg_temp.ctl38(p1a, 'SELECT count(*)::text FROM materials')]];
  essais := essais || ARRAY[['personnel : direction, eleves', 'ok:S1,S1B,S2,S4', pg_temp.ctl38(dir, eleves)]];
  BEGIN
    r := CASE WHEN EXISTS (SELECT 1 FROM information_schema.routine_privileges
                            WHERE routine_schema = 'public' AND grantee IN ('anon', 'PUBLIC')
                              AND routine_name IN ('foyer_actif', 'famille_foyer', 'famille_finances',
                                                   'famille_enseignants', 'famille_seances_modifiees',
                                                   'fichier_bulletin_lisible', 'fichier_annonce_lisible'))
              THEN 'permises'
              WHEN to_regprocedure('public.famille_finances()') IS NULL THEN 'absentes'
              ELSE 'refusees' END;
  EXCEPTION WHEN others THEN r := SQLERRM;
  END;
  essais := essais || ARRAY[['anon : fonctions famille', 'refusees', r]];

  -- ── Rapport ───────────────────────────────────────────────────────────────
  FOR i IN 1 .. array_length(essais, 1) LOOP
    IF essais[i][2] IS DISTINCT FROM essais[i][3] THEN nb_ko := nb_ko + 1; END IF;
    rapport := rapport || E'\n[' || CASE WHEN essais[i][2] IS NOT DISTINCT FROM essais[i][3] THEN 'OK' ELSE 'KO' END || '] '
      || rpad(essais[i][1], 46) || coalesce(essais[i][3], '(null)')
      || CASE WHEN essais[i][2] IS DISTINCT FROM essais[i][3] THEN E'\n     attendu' || repeat(' ', 42) || essais[i][2] ELSE '' END;
  END LOOP;
  IF array_length(essais, 1) IS DISTINCT FROM attendus THEN
    nb_ko := nb_ko + 1;
    rapport := rapport || E'\n[KO] ' || coalesce(array_length(essais, 1), 0) || ' essais menes, ' || attendus || ' attendus';
  END IF;

  RAISE EXCEPTION 'CONTROLE 38 : % KO (tout est annule)%', nb_ko, rapport;
END
$ctl$;
