-- ============================================================================
-- CONTROLE 23 — Regle de depart appliquee aux departs deja declares
--
-- Ecole JETABLE : une annee en cours (2026-2027) et une annee CLOSE (2025-2026),
-- deux eleves partis cette annee (l'un en « due », l'autre au cas par cas avec
-- une decision), un retrait « correction », un depart de l'annee close ; une
-- SECONDE ecole jetable avec un depart. Comptes : comptable, secretaire.
--   changement sans retroactivite            -> 0 depart touche
--   retroactivite par la secretaire          -> refusee, rien ne bouge
--   retroactivite « cas par cas »            -> 1 depart (le « due »), trace
--                                               (regle initiale, auteur, date)
--   retroactivite « due »                    -> 2 departs ; regle initiale gardee
--                                               a la premiere modification ;
--                                               decision conservee
--   annee close, correction, autre ecole     -> jamais touchees
--
-- Migration : supabase/migrations/regle-ajustement-retroactive.sql.
-- LECTURE SEULE : exception volontaire finale, tout est annule.
-- ============================================================================
DO $ctl$
DECLARE
  e    uuid := gen_random_uuid();
  e2   uuid := gen_random_uuid();
  y    uuid := gen_random_uuid();
  y0   uuid := gen_random_uuid();
  y2   uuid := gen_random_uuid();
  c    uuid := gen_random_uuid();
  c2   uuid := gen_random_uuid();
  par  uuid := gen_random_uuid();
  par2 uuid := gen_random_uuid();
  s1   uuid := gen_random_uuid();   -- parti en « due »
  s2   uuid := gen_random_uuid();   -- parti au cas par cas, decision « prorata »
  s3   uuid := gen_random_uuid();   -- retrait (correction) et depart de l'annee close
  s4   uuid := gen_random_uuid();   -- autre ecole
  m1   uuid := gen_random_uuid();
  m2   uuid := gen_random_uuid();
  m3   uuid := gen_random_uuid();
  m4   uuid := gen_random_uuid();
  m5   uuid := gen_random_uuid();
  cpt  uuid := gen_random_uuid();
  sec  uuid := gen_random_uuid();
  n    integer;
  m    record;
  ok   boolean;
  msg  text;
  rapport text := '';
  nb_ko   integer := 0;
BEGIN
  INSERT INTO etablissements (id, slug, nom, is_active) VALUES
    (e,  'ctl-ret-'  || left(e::text, 8),  'CONTROLE RETRO', true),
    (e2, 'ctl-ret2-' || left(e2::text, 8), 'CONTROLE RETRO 2', true);
  INSERT INTO school_years (id, etablissement_id, label, is_current, start_date, end_date, closed_at) VALUES
    (y,  e,  '2026-2027', true,  '2026-09-01', '2027-06-30', NULL),
    (y0, e,  '2025-2026', false, '2025-09-01', '2026-06-30', now()),
    (y2, e2, '2026-2027', true,  '2026-09-01', '2027-06-30', NULL);
  INSERT INTO classes (id, etablissement_id, name, level, academic_year) VALUES
    (c, e, 'CTL-RET', 'CTL', '2026-2027'), (c2, e2, 'CTL-RET2', 'CTL', '2026-2027');
  INSERT INTO parents (id, etablissement_id, tutor1_last_name, tutor1_first_name, tutor1_email) VALUES
    (par,  e,  'CTLRET'  || left(e::text, 8),  'Adulte', 'ctl-ret-'  || left(e::text, 8)  || '@exemple.invalid'),
    (par2, e2, 'CTLRET2' || left(e2::text, 8), 'Adulte', 'ctl-ret2-' || left(e2::text, 8) || '@exemple.invalid');
  INSERT INTO students (id, etablissement_id, parent_id, student_number, first_name, last_name, date_of_birth, is_active) VALUES
    (s1, e,  par,  'CTR1-' || left(e::text, 8), 'Un',     'CTLRET', '2015-01-01', false),
    (s2, e,  par,  'CTR2-' || left(e::text, 8), 'Deux',   'CTLRET', '2016-01-01', false),
    (s3, e,  par,  'CTR3-' || left(e::text, 8), 'Trois',  'CTLRET', '2017-01-01', false),
    (s4, e2, par2, 'CTR4-' || left(e::text, 8), 'Quatre', 'CTLRET', '2018-01-01', false);

  INSERT INTO mouvements_inscription (id, etablissement_id, school_year_id, parent_id, student_id, class_id, sens, motif, date_effet, regle, decision) VALUES
    (m1, e,  y,  par,  s1, c,  'depart', 'depart',     '2026-11-15', 'due',         NULL),
    (m2, e,  y,  par,  s2, c,  'depart', 'depart',     '2026-11-20', 'cas_par_cas', 'prorata'),
    (m3, e,  y,  par,  s3, c,  'depart', 'correction', '2026-10-01', 'due',         NULL),
    (m4, e,  y0, par,  s3, c,  'depart', 'depart',     '2026-03-01', 'due',         NULL),
    (m5, e2, y2, par2, s4, c2, 'depart', 'depart',     '2026-11-15', 'due',         NULL);

  INSERT INTO auth.users (id, email, aud, role) VALUES
    (cpt, 'ctl-ret-cpt-' || left(e::text, 8) || '@exemple.invalid', 'authenticated', 'authenticated'),
    (sec, 'ctl-ret-sec-' || left(e::text, 8) || '@exemple.invalid', 'authenticated', 'authenticated');
  INSERT INTO profiles (id, email, role, first_name, last_name, etablissement_id) VALUES
    (cpt, 'ctl-ret-cpt-' || left(e::text, 8) || '@exemple.invalid', 'comptable',  'Camille', 'Ctlcpt', e),
    (sec, 'ctl-ret-sec-' || left(e::text, 8) || '@exemple.invalid', 'secretaire', 'Sophie',  'Ctlsec', e);

  -- ── Sans retroactivite ──
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', cpt, 'role', 'authenticated')::text, true);
  n := definir_regle_ajustement('prorata');
  RESET ROLE;
  ok := n = 0 AND (SELECT regle_ajustement FROM etablissements WHERE id = e) = 'prorata'
        AND (SELECT regle FROM mouvements_inscription WHERE id = m1) = 'due';
  rapport := rapport || E'\n[' || CASE WHEN ok THEN 'OK' ELSE 'KO' END || '] sans retroactivite         ' || n || ' depart(s)';
  IF NOT ok THEN nb_ko := nb_ko + 1; END IF;

  -- ── Retroactivite par la secretaire ──
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', sec, 'role', 'authenticated')::text, true);
  BEGIN
    PERFORM definir_regle_ajustement('sans_ajustement', true);
    msg := 'acceptee';
  EXCEPTION WHEN raise_exception THEN msg := SQLERRM; END;
  RESET ROLE;
  ok := msg = 'REGLE_REFUSEE' AND (SELECT regle FROM mouvements_inscription WHERE id = m1) = 'due';
  rapport := rapport || E'\n[' || CASE WHEN ok THEN 'OK' ELSE 'KO' END || '] retro par la secretaire    ' || msg;
  IF NOT ok THEN nb_ko := nb_ko + 1; END IF;

  -- ── Retroactivite « cas par cas » par la comptable ──
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', cpt, 'role', 'authenticated')::text, true);
  n := definir_regle_ajustement('cas_par_cas', true);
  RESET ROLE;
  SELECT * INTO m FROM mouvements_inscription WHERE id = m1;
  ok := n = 1 AND m.regle = 'cas_par_cas' AND m.regle_initiale = 'due' AND m.decision IS NULL
        AND m.regle_modifiee_par = cpt AND m.regle_modifiee_par_nom = 'CTLCPT Camille' AND m.regle_modifiee_le IS NOT NULL
        AND (SELECT regle_initiale IS NULL AND decision = 'prorata' FROM mouvements_inscription WHERE id = m2);
  rapport := rapport || E'\n[' || CASE WHEN ok THEN 'OK' ELSE 'KO' END || '] retro cas par cas          ' || n || ' depart(s) · '
    || coalesce(m.regle_initiale, '?') || ' -> ' || coalesce(m.regle, '?') || ' · ' || coalesce(m.regle_modifiee_par_nom, '?');
  IF NOT ok THEN nb_ko := nb_ko + 1; END IF;

  -- ── Retroactivite « due » ──
  SET LOCAL ROLE authenticated;
  n := definir_regle_ajustement('due', true);
  RESET ROLE;
  ok := n = 2
        AND (SELECT regle = 'due' AND regle_initiale = 'due' FROM mouvements_inscription WHERE id = m1)
        AND (SELECT regle = 'due' AND regle_initiale = 'cas_par_cas' AND decision = 'prorata' FROM mouvements_inscription WHERE id = m2);
  rapport := rapport || E'\n[' || CASE WHEN ok THEN 'OK' ELSE 'KO' END || '] retro due                  ' || n || ' depart(s)';
  IF NOT ok THEN nb_ko := nb_ko + 1; END IF;

  -- ── Jamais touches ──
  ok := (SELECT regle = 'due' AND regle_modifiee_le IS NULL FROM mouvements_inscription WHERE id = m3)
        AND (SELECT regle = 'due' AND regle_modifiee_le IS NULL FROM mouvements_inscription WHERE id = m4)
        AND (SELECT regle = 'due' AND regle_modifiee_le IS NULL FROM mouvements_inscription WHERE id = m5);
  -- m4 et m5 restent « due » meme sous « cas par cas » : le passage par
  -- 'cas_par_cas' les aurait modifies s'ils etaient dans le perimetre.
  rapport := rapport || E'\n[' || CASE WHEN ok THEN 'OK' ELSE 'KO' END || '] close, correction, autre   intacts';
  IF NOT ok THEN nb_ko := nb_ko + 1; END IF;

  PERFORM set_config('request.jwt.claims', NULL, true);
  RAISE EXCEPTION 'CONTROLE 23 : % KO (tout est annule)%', nb_ko, rapport;
END
$ctl$;
