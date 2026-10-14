-- ============================================================================
-- ECOLE DE DEMONSTRATION (console de l'editeur)
--
-- Une ecole COMME LES AUTRES (meme cloisonnement, memes ecrans), marquee
-- `est_demo`, que l'editeur montre aux prospects et remet a zero d'un bouton.
--
--   * `etablissements.est_demo` : marqueur. Pose et retire en SERVICE-ROLE
--     seulement (une ecole qui se marquerait « demo » sortirait de la
--     facturation) ; l'ecole est exclue du releve mensuel.
--   * `reinitialiser_ecole_demo(id)` : vide les donnees de l'ecole puis la
--     repeuple, en UNE transaction. REFUSEE sur toute ecole non marquee : un
--     mauvais clic ne peut jamais toucher un client.
--   * Les COMPTES de connexion sont CONSERVES (decision du 14/10) : les profils
--     et leur 2FA survivent a la remise a zero, on n'enrole qu'une fois. Les
--     fiches enseignant, elles, sont des donnees et sont recreees.
--   * Les donnees sont DATEES depuis le jour de la remise a zero : l'annee
--     scolaire est toujours l'annee en cours, les notes et absences tombent
--     dans le passe proche — la demonstration parait toujours vivante.
--   * Pendant le travail, le marqueur `app.effacement_etablissement` (pose par
--     `add-effacement-etablissement.sql`) desarme les gardes de suppression et le
--     journal d'activite : une remise a zero n'ecrit pas des milliers de traces.
--
-- Idempotent.
-- ============================================================================

-- ── 1. Marqueur ──────────────────────────────────────────────────────────────
ALTER TABLE public.etablissements ADD COLUMN IF NOT EXISTS est_demo boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.fn_guard_est_demo()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $fn$
BEGIN
  IF coalesce(auth.jwt() ->> 'role', '') <> 'service_role'
     AND ((TG_OP = 'INSERT' AND NEW.est_demo)
          OR (TG_OP = 'UPDATE' AND NEW.est_demo IS DISTINCT FROM OLD.est_demo)) THEN
    RAISE EXCEPTION 'Le marqueur d''ecole de demonstration se pose depuis la console de l''editeur.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END
$fn$;

DROP TRIGGER IF EXISTS trg_guard_est_demo ON public.etablissements;
CREATE TRIGGER trg_guard_est_demo
  BEFORE INSERT OR UPDATE ON public.etablissements
  FOR EACH ROW EXECUTE FUNCTION public.fn_guard_est_demo();

-- ── 2. Le releve mensuel ignore l'ecole de demonstration ─────────────────────
DO $do$
DECLARE
  v_def text;
  v_new text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_def
    FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname = 'fn_releve_facturation';
  IF position('est_demo' IN v_def) = 0 THEN
    v_new := replace(v_def, 'WHERE e.donnees_effacees_le IS NULL', 'WHERE e.donnees_effacees_le IS NULL AND NOT e.est_demo');
    IF v_new = v_def THEN
      RAISE EXCEPTION 'fn_releve_facturation : ancrage introuvable (jouer rework-effacement-etablissement.sql d''abord).';
    END IF;
    EXECUTE v_new;
  END IF;
END
$do$;

-- ── 3. Vider les donnees d'une ecole, comptes CONSERVES ──────────────────────
-- Interne (aucun droit d'execution accorde). Reprend la mecanique de
-- `effacer_etablissement` sans toucher a `profiles` ni a `auth.users`.
CREATE OR REPLACE FUNCTION public.fn_demo_vider(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  r       record;
  v_passe integer;
  v_reste boolean;
  n       bigint;
BEGIN
  DELETE FROM expenses       WHERE etablissement_id = p_id;
  DELETE FROM other_revenues WHERE etablissement_id = p_id;
  DELETE FROM evaluation_order_config WHERE class_id IN (SELECT id FROM classes WHERE etablissement_id = p_id);
  DELETE FROM students       WHERE etablissement_id = p_id;
  DELETE FROM cours          WHERE unite_enseignement_id IN (SELECT id FROM unites_enseignement WHERE etablissement_id = p_id);
  DELETE FROM cours_modules  WHERE unite_enseignement_id IN (SELECT id FROM unites_enseignement WHERE etablissement_id = p_id);

  FOR v_passe IN 1..10 LOOP
    v_reste := false;
    FOR r IN SELECT * FROM fn_depart_tables() WHERE efface AND filtre IS NOT NULL AND nom <> 'profiles' LOOP
      BEGIN
        EXECUTE format('DELETE FROM public.%I WHERE %s', r.nom, r.filtre) USING p_id;
      EXCEPTION WHEN foreign_key_violation OR restrict_violation THEN
        v_reste := true;
      END;
    END LOOP;
    EXIT WHEN NOT v_reste;
  END LOOP;

  -- Plus rien de l'ecole, hors comptes.
  FOR r IN SELECT * FROM fn_depart_tables() WHERE efface AND filtre IS NOT NULL AND nom <> 'profiles' LOOP
    EXECUTE format('SELECT count(*) FROM public.%I WHERE %s', r.nom, r.filtre) INTO n USING p_id;
    IF n > 0 THEN
      RAISE EXCEPTION 'Remise a zero incomplete : % ligne(s) restent dans %.', n, r.nom;
    END IF;
  END LOOP;
END
$fn$;
REVOKE ALL ON FUNCTION public.fn_demo_vider(uuid) FROM public, anon, authenticated;

-- ── 4. Peupler ───────────────────────────────────────────────────────────────
-- Interne. Suppose les comptes en place (profils : 3 enseignants au moins).
CREATE OR REPLACE FUNCTION public.fn_demo_peupler(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_today   date := (now() AT TIME ZONE 'Europe/Paris')::date;
  v_an      integer;
  v_debut   date;
  v_fin     date;
  v_label   text;
  v_sy      uuid;
  v_per     uuid[] := '{}';
  v_per_deb date[];
  v_per_fin date[];
  v_cur     integer;
  v_cot_enf uuid;
  v_cot_adu uuid;
  v_ue1 uuid; v_ue2 uuid; v_mod1 uuid; v_mod2 uuid;
  v_cours   uuid[] := '{}';
  v_ens     uuid[] := '{}';
  v_ens_nom text[] := '{}';
  v_cls     uuid[] := '{}';
  v_par     uuid[] := '{}';
  v_stu     uuid[] := '{}';
  v_stu_cls integer[] := '{}';
  v_prof    record;
  v_id      uuid;
  i integer; j integer; k integer;
  v_ev      uuid;
  v_date    date;
  v_paid    numeric;
  v_due     numeric;
  v_samedi  date;
  -- Noms FICTIFS, credibles pour la communaute desservie.
  v_noms text[] := ARRAY['BENALI','HADDAD','MANSOURI','CHERIF','AMRANI','BOUZID','KACI','SAIDI','RAHMANI','TOUATI',
                         'MESSAOUDI','BELKACEM','ZIANI','OUALI','HAMIDI','LARBI','NACERI','FERHAT','MEZIANE','BRAHIMI',
                         'SLIMANI','YAHIAOUI','KHELIFI','BENSALEM','DJEBBAR','AOUDIA','LOUNIS','TALEB','GUERFI','REBAI'];
  v_peres text[] := ARRAY['Karim','Mourad','Rachid','Nabil','Farid','Samir','Hakim','Mehdi','Youcef','Djamel'];
  v_meres text[] := ARRAY['Nadia','Samira','Leila','Karima','Fatima','Soraya','Houria','Rachida','Amina','Malika'];
  v_garcons text[] := ARRAY['Adam','Yanis','Ilyes','Rayan','Amine','Nassim','Ayoub','Idris','Younes','Bilal','Sami','Hamza','Ismail','Anas','Ibrahim'];
  v_filles text[] := ARRAY['Ines','Lina','Sarah','Maryam','Yasmine','Nour','Assia','Malak','Hiba','Aya','Salma','Imane','Sofia','Rania','Amel'];
  v_villes text[] := ARRAY['Neuville-sur-Saone','Fontaines-sur-Saone','Rillieux-la-Pape','Caluire-et-Cuire','Genay'];
BEGIN
  -- ── Annee scolaire EN COURS, calculee depuis aujourd'hui (sept. -> juin) ──
  v_an    := CASE WHEN extract(month FROM v_today) >= 9 THEN extract(year FROM v_today)::int ELSE extract(year FROM v_today)::int - 1 END;
  v_debut := make_date(v_an, 9, 1);
  v_fin   := make_date(v_an + 1, 6, 30);
  v_label := v_an || '-' || (v_an + 1);

  UPDATE school_years SET is_current = false WHERE etablissement_id = p_id;  -- (aucune : l'ecole vient d'etre videe)
  INSERT INTO school_years (etablissement_id, label, is_current, period_type, start_date, end_date)
  VALUES (p_id, v_label, true, 'trimestrial', v_debut, v_fin) RETURNING id INTO v_sy;

  v_per_deb := ARRAY[v_debut, make_date(v_an + 1, 1, 1), make_date(v_an + 1, 4, 1)];
  v_per_fin := ARRAY[make_date(v_an, 12, 31), make_date(v_an + 1, 3, 31), v_fin];
  v_cur := CASE WHEN v_today >= v_per_deb[3] THEN 3 WHEN v_today >= v_per_deb[2] THEN 2 ELSE 1 END;
  FOR i IN 1..3 LOOP
    INSERT INTO periods (school_year_id, label, order_index, is_current)
    VALUES (v_sy, 'T' || i, i, i = v_cur) RETURNING id INTO v_id;
    v_per := v_per || v_id;
  END LOOP;

  INSERT INTO eval_type_configs (school_year_id, eval_type, is_active, max_score, diagnostic_options) VALUES
    (v_sy, 'scored', true, 20, NULL),
    (v_sy, 'diagnostic', true, NULL, '[{"acronym": "AC", "comment": "ACQUIS"}, {"acronym": "EC", "comment": "EN COURS D''ACQUISITION"}, {"acronym": "NA", "comment": "NON ACQUIS"}]'::jsonb);

  INSERT INTO cotisation_types (etablissement_id, school_year_id, label, amount, registration_fee, sibling_discount, max_installments, order_index, is_adult)
  VALUES (p_id, v_sy, 'ARABE ENFANTS', 250, 20, 10, 3, 1, false) RETURNING id INTO v_cot_enf;
  INSERT INTO cotisation_types (etablissement_id, school_year_id, label, amount, registration_fee, sibling_discount, max_installments, order_index, is_adult)
  VALUES (p_id, v_sy, 'ARABE ADULTES', 180, 0, 0, 2, 2, true) RETURNING id INTO v_cot_adu;

  -- ── Referentiel ──
  INSERT INTO unites_enseignement (etablissement_id, nom_fr, nom_ar, code, order_index)
  VALUES (p_id, 'Langue arabe', 'اللغة العربية', 'LA', 1) RETURNING id INTO v_ue1;
  INSERT INTO unites_enseignement (etablissement_id, nom_fr, nom_ar, code, order_index)
  VALUES (p_id, 'Culture et civilisation', 'الثقافة والحضارة', 'CC', 2) RETURNING id INTO v_ue2;
  INSERT INTO cours_modules (unite_enseignement_id, nom_fr, nom_ar, code, order_index)
  VALUES (v_ue1, 'Lecture', 'القراءة', 'LEC', 1) RETURNING id INTO v_mod1;
  INSERT INTO cours_modules (unite_enseignement_id, nom_fr, nom_ar, code, order_index)
  VALUES (v_ue1, 'Ecriture', 'الكتابة', 'ECR', 2) RETURNING id INTO v_mod2;
  INSERT INTO cours (unite_enseignement_id, module_id, nom_fr, nom_ar, code, order_index) VALUES (v_ue1, v_mod1, 'Lecture a voix haute', 'القراءة الجهرية', 'LEC1', 1) RETURNING id INTO v_id; v_cours := v_cours || v_id;
  INSERT INTO cours (unite_enseignement_id, module_id, nom_fr, nom_ar, code, order_index) VALUES (v_ue1, v_mod1, 'Comprehension', 'الفهم', 'LEC2', 2) RETURNING id INTO v_id; v_cours := v_cours || v_id;
  INSERT INTO cours (unite_enseignement_id, module_id, nom_fr, nom_ar, code, order_index) VALUES (v_ue1, v_mod2, 'Dictee', 'الإملاء', 'ECR1', 1) RETURNING id INTO v_id; v_cours := v_cours || v_id;
  INSERT INTO cours (unite_enseignement_id, module_id, nom_fr, nom_ar, code, order_index) VALUES (v_ue1, v_mod2, 'Expression ecrite', 'التعبير الكتابي', 'ECR2', 2) RETURNING id INTO v_id; v_cours := v_cours || v_id;
  INSERT INTO cours (unite_enseignement_id, module_id, nom_fr, nom_ar, code, order_index) VALUES (v_ue2, NULL, 'Recitation', 'الاستظهار', 'REC', 1) RETURNING id INTO v_id; v_cours := v_cours || v_id;

  -- ── Enseignants : une fiche par compte enseignant ──
  i := 0;
  FOR v_prof IN SELECT * FROM profiles WHERE etablissement_id = p_id AND role = 'enseignant' ORDER BY last_name LOOP
    i := i + 1;
    INSERT INTO teachers (etablissement_id, user_id, first_name, last_name, civilite, employee_number, email, hire_date, specialization, is_active)
    VALUES (p_id, v_prof.id, v_prof.first_name, v_prof.last_name, v_prof.civilite,
            'ENS-' || to_char(v_debut, 'YYYYMM') || '-' || lpad(i::text, 3, '0'), v_prof.email, v_debut, 'Langue arabe', true)
    RETURNING id INTO v_id;
    v_ens := v_ens || v_id;
    v_ens_nom := v_ens_nom || (v_prof.last_name || ' ' || v_prof.first_name);
  END LOOP;
  IF coalesce(array_length(v_ens, 1), 0) < 3 THEN
    RAISE EXCEPTION 'Il faut 3 comptes enseignants dans l''ecole de demonstration (trouves : %).', coalesce(array_length(v_ens, 1), 0);
  END IF;

  -- ── Classes : 3 classes d'enfants (un titulaire chacune) + 1 classe adulte ──
  FOR i IN 1..4 LOOP
    INSERT INTO classes (etablissement_id, name, level, academic_year, cotisation_type_id, teaching_mode, max_students,
                         day_of_week, start_time, end_time, is_active)
    VALUES (p_id,
            (ARRAY['CP-ARABE','CE1-ARABE','CM1-ARABE','ADULTES-ARABE'])[i],
            (ARRAY['CP','CE1','CM1','Adultes'])[i],
            v_label,
            CASE WHEN i = 4 THEN v_cot_adu ELSE v_cot_enf END,
            'single', 22,
            'saturday',
            CASE WHEN i = 4 THEN '14:00'::time ELSE '09:00'::time END,
            CASE WHEN i = 4 THEN '16:00'::time ELSE '12:00'::time END,
            true)
    RETURNING id INTO v_id;
    v_cls := v_cls || v_id;
    INSERT INTO class_teachers (class_id, teacher_id, is_main_teacher, effective_from)
    VALUES (v_id, v_ens[CASE WHEN i = 4 THEN 1 ELSE i END], true, v_debut);
    -- Samedi pour toutes ; mercredi apres-midi en plus pour les enfants.
    INSERT INTO schedule_slots (etablissement_id, school_year_id, class_id, teacher_id, is_recurring, day_of_week, start_time, end_time, slot_type, effective_from)
    VALUES (p_id, v_sy, v_id, v_ens[CASE WHEN i = 4 THEN 1 ELSE i END], true, 6,
            CASE WHEN i = 4 THEN '14:00'::time ELSE '09:00'::time END,
            CASE WHEN i = 4 THEN '16:00'::time ELSE '12:00'::time END, 'cours', v_debut);
    IF i < 4 THEN
      INSERT INTO schedule_slots (etablissement_id, school_year_id, class_id, teacher_id, is_recurring, day_of_week, start_time, end_time, slot_type, effective_from)
      VALUES (p_id, v_sy, v_id, v_ens[i], true, 3,
              (ARRAY['14:00','15:00','16:00'])[i]::time, (ARRAY['15:00','16:00','17:00'])[i]::time, 'activite', v_debut);
    END IF;
  END LOOP;

  -- ── 30 foyers ──
  FOR i IN 1..30 LOOP
    INSERT INTO parents (etablissement_id, tutor1_last_name, tutor1_first_name, tutor1_relationship, tutor1_phone, tutor1_email,
                         tutor1_address, tutor1_city, tutor1_postal_code,
                         tutor2_last_name, tutor2_first_name, tutor2_relationship, tutor2_phone, tutor2_email,
                         situation_familiale, tutor1_adult_courses, tutor2_adult_courses)
    VALUES (p_id, v_noms[i], v_peres[1 + (i - 1) % 10], 'père', '+3361234' || lpad(i::text, 4, '0'),
            lower(v_noms[i]) || '.pere@demonstration.invalid',
            (10 + i) || ' rue des Tilleuls', v_villes[1 + (i - 1) % 5], '69250',
            v_noms[i], v_meres[1 + (i + 2) % 10], 'mère', '+3361235' || lpad(i::text, 4, '0'),
            lower(v_noms[i]) || '.mere@demonstration.invalid',
            'mariés', false, i <= 6)
    RETURNING id INTO v_id;
    v_par := v_par || v_id;
  END LOOP;

  -- ── 60 apprenants, 20 par classe : l'enfant s est dans la classe (s-1)/20+1,
  --    du foyer ((s-1) % 30) + 1 — chaque foyer a deux enfants, dans deux classes ──
  FOR i IN 1..60 LOOP
    j := (i - 1) / 20 + 1;                 -- classe
    k := ((i - 1) % 30) + 1;               -- foyer
    INSERT INTO students (etablissement_id, parent_id, student_number, first_name, last_name, date_of_birth, gender,
                          address, city, postal_code, enrollment_date, is_active, exit_authorization, media_authorization)
    VALUES (p_id, v_par[k], 'ELV-' || to_char(v_debut, 'YYYYMM') || '-' || lpad(i::text, 3, '0'),
            CASE WHEN i % 2 = 0 THEN v_filles[1 + (i - 1) % 15] ELSE v_garcons[1 + (i - 1) % 15] END,
            v_noms[k],
            make_date(v_an - (ARRAY[6, 7, 9])[j], 1 + (i % 12), 1 + (i % 27)),
            CASE WHEN i % 2 = 0 THEN 'female' ELSE 'male' END,
            (10 + k) || ' rue des Tilleuls', v_villes[1 + (k - 1) % 5], '69250', v_debut, true, j = 3, i % 5 <> 0)
    RETURNING id INTO v_id;
    v_stu := v_stu || v_id;
    v_stu_cls := v_stu_cls || j;
    INSERT INTO enrollments (student_id, class_id, enrollment_date, status) VALUES (v_id, v_cls[j], v_debut, 'active');
  END LOOP;

  -- Adultes : la mere des 6 premiers foyers, en classe adulte.
  FOR i IN 1..6 LOOP
    INSERT INTO parent_class_enrollments (etablissement_id, parent_id, class_id, tutor_number, enrollment_date, status)
    VALUES (p_id, v_par[i], v_cls[4], 2, v_debut, 'active');
  END LOOP;

  -- ── Evaluations et notes, sur les periodes deja commencees ──
  FOR i IN 1..4 LOOP
    FOR j IN 1..v_cur LOOP
      FOR k IN 1..3 LOOP
        v_date := v_per_deb[j] + (k * 11);
        CONTINUE WHEN v_date > v_today;
        INSERT INTO evaluations (etablissement_id, class_id, teacher_id, title, evaluation_type, max_score, coefficient,
                                 evaluation_date, cours_id, period_id, eval_kind, sort_order)
        VALUES (p_id, v_cls[i], v_ens[CASE WHEN i = 4 THEN 1 ELSE i END],
                (ARRAY['Lecture', 'Dictee', 'Recitation'])[k], 'test',
                CASE WHEN k = 3 THEN NULL ELSE 20 END, 1, v_date,
                v_cours[(ARRAY[1, 3, 5])[k]], v_per[j],
                CASE WHEN k = 3 THEN 'diagnostic' ELSE 'scored' END, k)
        RETURNING id INTO v_ev;
        IF i < 4 THEN
          INSERT INTO grades (student_id, evaluation_id, score, comment, is_absent, graded_at)
          SELECT s.sid,
                 v_ev,
                 CASE WHEN k = 3 THEN NULL ELSE round((8 + ((abs(hashtext(s.sid::text || v_ev::text)) % 23) * 0.5))::numeric, 1) END,
                 CASE WHEN k = 3 THEN (ARRAY['AC', 'EC', 'NA'])[1 + abs(hashtext(s.sid::text || v_ev::text)) % 3] END,
                 false, now()
            FROM unnest(v_stu, v_stu_cls) AS s(sid, cls)
           WHERE s.cls = i;
        ELSE
          INSERT INTO adult_grades (etablissement_id, parent_id, tutor_number, evaluation_id, score, comment, is_absent, graded_at)
          SELECT p_id, v_par[n], 2, v_ev,
                 CASE WHEN k = 3 THEN NULL ELSE round((10 + ((abs(hashtext(n::text || v_ev::text)) % 19) * 0.5))::numeric, 1) END,
                 CASE WHEN k = 3 THEN (ARRAY['AC', 'EC', 'NA'])[1 + abs(hashtext(n::text || v_ev::text)) % 3] END,
                 false, now()
            FROM generate_series(1, 6) AS n;
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;

  -- ── Absences : quelques samedis passes ──
  v_samedi := v_today - ((extract(dow FROM v_today)::int + 1) % 7);   -- dernier samedi (aujourd'hui compris)
  FOR i IN 1..12 LOOP
    v_date := v_samedi - ((i % 4) * 7);
    CONTINUE WHEN v_date < v_debut;
    j := 1 + (i * 7) % 60;
    INSERT INTO absences (etablissement_id, student_id, class_id, period_id, absence_date, absence_type, is_justified, comment)
    VALUES (p_id, v_stu[j], v_cls[v_stu_cls[j]],
            v_per[CASE WHEN v_date >= v_per_deb[3] THEN 3 WHEN v_date >= v_per_deb[2] THEN 2 ELSE 1 END],
            v_date, CASE WHEN i % 4 = 0 THEN 'retard' ELSE 'absence' END, i % 3 = 0,
            CASE WHEN i % 3 = 0 THEN 'Certificat medical' END)
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- ── Cahier de texte : 3 seances passees et 1 devoir a venir par classe d'enfants ──
  FOR i IN 1..3 LOOP
    FOR k IN 0..2 LOOP
      v_date := v_samedi - k * 7;
      CONTINUE WHEN v_date < v_debut;
      INSERT INTO class_journal (etablissement_id, class_id, teacher_id, subject, session_date, title, content_html)
      VALUES (p_id, v_cls[i], v_ens[i], NULL, v_date,
              (ARRAY['Les lettres solaires', 'Lecture du texte « Le marche »', 'Revision des voyelles longues'])[k + 1],
              '<p>Travail en classe sur la lecture et l''ecriture, exercices au tableau puis en binome.</p>');
    END LOOP;
    INSERT INTO homework (etablissement_id, class_id, teacher_id, subject, title, description_html, homework_type, due_date)
    VALUES (p_id, v_cls[i], v_ens[i], 'General', 'Recopier la lecon', '<p>Recopier trois fois la lecon du jour et la lire a voix haute.</p>',
            'lecon', v_samedi + 7);
  END LOOP;

  -- ── Reglements : un tiers solde, un tiers partiel, un tiers sans versement ──
  FOR i IN 1..30 LOOP
    v_due := 500 + CASE WHEN i <= 6 THEN 180 ELSE 0 END;
    v_paid := CASE i % 3 WHEN 1 THEN v_due WHEN 2 THEN 250 ELSE 0 END;
    INSERT INTO family_fees (etablissement_id, parent_id, school_year_id, subtotal, adjustments_total, total_due, num_installments, status)
    VALUES (p_id, v_par[i], v_sy, v_due, 0, v_due, CASE WHEN v_paid = 0 THEN 0 ELSE 1 END, fin_statut_dossier(v_paid, v_due))
    RETURNING id INTO v_id;
    IF v_paid > 0 THEN
      INSERT INTO fee_installments (etablissement_id, family_fee_id, installment_number, due_date, amount_due, amount_paid, paid_date, payment_method, status)
      VALUES (p_id, v_id, 1, least(v_today, v_debut + 20), v_paid, v_paid, least(v_today, v_debut + 20),
              (ARRAY['cash', 'check', 'transfer'])[1 + i % 3], 'paid');
    END IF;
  END LOOP;

  RETURN jsonb_build_object('annee', v_label, 'classes', 4, 'apprenants', 60, 'foyers', 30, 'enseignants', array_length(v_ens, 1));
END
$fn$;
REVOKE ALL ON FUNCTION public.fn_demo_peupler(uuid) FROM public, anon, authenticated;

-- ── 5. Point d'entree : la remise a zero, en une transaction ─────────────────
CREATE OR REPLACE FUNCTION public.reinitialiser_ecole_demo(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_res      jsonb;
  v_fichiers jsonb;
BEGIN
  IF coalesce(auth.jwt() ->> 'role', '') <> 'service_role' THEN
    RAISE EXCEPTION 'Reserve a la console de l''editeur.' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM etablissements WHERE id = p_id AND est_demo AND donnees_effacees_le IS NULL) THEN
    RAISE EXCEPTION 'Remise a zero refusee : ce n''est pas l''ecole de demonstration.';
  END IF;
  IF EXISTS (SELECT 1 FROM support_interventions WHERE etablissement_id = p_id AND closed_at IS NULL) THEN
    RAISE EXCEPTION 'Une intervention de support est en cours dans cette ecole : quittez-la d''abord.';
  END IF;

  -- Les fichiers deposes pendant une demonstration (bulletins, documents...) :
  -- le SQL ne peut pas les effacer, la console s'en charge avec cette liste.
  -- Le logo reste : c'est l'identite de la fiche.
  SELECT coalesce(jsonb_agg(jsonb_build_object('bucket', bucket_id, 'nom', name)), '[]'::jsonb) INTO v_fichiers
    FROM storage.objects
   WHERE name LIKE p_id::text || '/%' AND bucket_id <> 'etablissement-logos';

  PERFORM set_config('app.effacement_etablissement', p_id::text, true);
  PERFORM fn_demo_vider(p_id);
  v_res := fn_demo_peupler(p_id);
  PERFORM set_config('app.effacement_etablissement', '', true);
  RETURN v_res || jsonb_build_object('fichiers', v_fichiers);
END
$fn$;
REVOKE ALL ON FUNCTION public.reinitialiser_ecole_demo(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reinitialiser_ecole_demo(uuid) TO service_role;

-- ── 6. Verification ──────────────────────────────────────────────────────────
DO $verif$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'fn_releve_facturation' AND prosrc LIKE '%NOT e.est_demo%') THEN
    RAISE EXCEPTION 'Verification : le releve compte encore l''ecole de demonstration.';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.routine_privileges
              WHERE routine_name IN ('reinitialiser_ecole_demo', 'fn_demo_vider', 'fn_demo_peupler')
                AND grantee IN ('anon', 'authenticated', 'PUBLIC')) THEN
    RAISE EXCEPTION 'Verification : une fonction de demonstration est executable hors service-role.';
  END IF;
END
$verif$;

-- Registre des migrations (voir supabase/migrations/README.md).
SELECT enregistrer_migration('add-ecole-demo.sql', 'aeb17d1ef628b77f5eee4f73e03dabf5525d6128cd498b79ec29e1f2c290629f');
