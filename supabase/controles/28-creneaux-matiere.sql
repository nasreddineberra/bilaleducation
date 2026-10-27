-- ============================================================================
-- CONTROLE 28 — Creneaux : matiere d'un cours, nom d'une activite
--
-- Cree deux ecoles JETABLES (annee, classe, une unite d'enseignement chacune),
-- puis tente chaque ecriture et note si la base l'ACCEPTE ou la REFUSE :
-- cours avec matiere de l'ecole (accepte), cours avec matiere d'une AUTRE ecole
-- (refuse), activite avec matiere (refuse), cours avec nom (refuse), activite
-- avec nom (accepte), nom vide ou de plus de 60 caracteres (refuse), passage de
-- la matiere a celle d'une autre ecole par UPDATE (refuse), suppression d'une
-- unite qui sert a un creneau (refusee).
-- Migration : supabase/migrations/schedule-slots-matiere-libelle.sql.
-- LECTURE SEULE : exception volontaire finale, tout est annule.
-- ============================================================================
DO $ctl$
DECLARE
  e   uuid := gen_random_uuid();
  e2  uuid := gen_random_uuid();
  y   uuid := gen_random_uuid();
  y2  uuid := gen_random_uuid();
  c   uuid := gen_random_uuid();
  ue  uuid := gen_random_uuid();
  ue2 uuid := gen_random_uuid();
  s_cours uuid := gen_random_uuid();
  t record;
  accepte boolean;
  h integer := 0;
  ok boolean;
  rapport text := '';
  nb_ko integer := 0;
BEGIN
  INSERT INTO etablissements (id, slug, nom, is_active) VALUES
    (e,  'ctl-matiere-'   || left(e::text, 8),  'CONTROLE MATIERE', true),
    (e2, 'ctl-matiere-b-' || left(e2::text, 8), 'CONTROLE MATIERE B', true);
  INSERT INTO school_years (id, etablissement_id, label) VALUES (y, e, 'CTL-1'), (y2, e2, 'CTL-2');
  INSERT INTO classes (id, etablissement_id, name, level, academic_year) VALUES (c, e, 'CTL', 'CTL', 'CTL-1');
  INSERT INTO unites_enseignement (id, etablissement_id, nom_fr) VALUES (ue, e, 'Arabe'), (ue2, e2, 'Coran');

  FOR t IN SELECT * FROM (VALUES
    ('cours + matiere de l''ecole',   'cours',    ue::text,  NULL::text,       true),
    ('cours + matiere autre ecole',   'cours',    ue2::text, NULL,             false),
    ('activite + matiere',            'activite', ue::text,  NULL,             false),
    ('cours + nom',                   'cours',    NULL,      'Sortie',         false),
    ('activite + nom',                'activite', NULL,      'Sortie musée',   true),
    ('activite sans nom',             'activite', NULL,      NULL,             true),
    ('activite + nom vide',           'activite', NULL,      '   ',            false),
    ('activite + nom de 61 car.',     'activite', NULL,      repeat('x', 61),  false)
  ) AS v(cas, type_, matiere, nom, attendu) LOOP
    h := h + 1;   -- un horaire par cas : la base refuse deux creneaux superposes
    BEGIN
      INSERT INTO schedule_slots (etablissement_id, school_year_id, class_id, start_time, end_time,
                                  slot_type, unite_enseignement_id, libelle, day_of_week)
      VALUES (e, y, c, make_time(7 + h, 0, 0), make_time(7 + h, 30, 0), t.type_, t.matiere::uuid, t.nom, 6);
      accepte := true;
    EXCEPTION WHEN check_violation OR foreign_key_violation THEN accepte := false;
    END;
    ok := accepte = t.attendu;
    rapport := rapport || E'\n[' || CASE WHEN ok THEN 'OK' ELSE 'KO' END || '] '
      || rpad(t.cas, 30) || CASE WHEN accepte THEN 'accepte' ELSE 'refuse' END;
    IF NOT ok THEN nb_ko := nb_ko + 1; END IF;
  END LOOP;

  -- UPDATE vers la matiere d'une autre ecole.
  INSERT INTO schedule_slots (id, etablissement_id, school_year_id, class_id, start_time, end_time,
                              slot_type, unite_enseignement_id, day_of_week)
  VALUES (s_cours, e, y, c, '18:00', '18:30', 'cours', ue, 6);
  BEGIN
    UPDATE schedule_slots SET unite_enseignement_id = ue2 WHERE id = s_cours;
    accepte := true;
  EXCEPTION WHEN check_violation THEN accepte := false;
  END;
  ok := NOT accepte;
  rapport := rapport || E'\n[' || CASE WHEN ok THEN 'OK' ELSE 'KO' END || '] '
    || rpad('update vers autre ecole', 30) || CASE WHEN accepte THEN 'accepte' ELSE 'refuse' END;
  IF NOT ok THEN nb_ko := nb_ko + 1; END IF;

  -- Suppression d'une unite qui sert a un creneau.
  BEGIN
    DELETE FROM unites_enseignement WHERE id = ue;
    accepte := true;
  EXCEPTION WHEN foreign_key_violation THEN accepte := false;
  END;
  ok := NOT accepte;
  rapport := rapport || E'\n[' || CASE WHEN ok THEN 'OK' ELSE 'KO' END || '] '
    || rpad('suppression unite utilisee', 30) || CASE WHEN accepte THEN 'accepte' ELSE 'refuse' END;
  IF NOT ok THEN nb_ko := nb_ko + 1; END IF;

  RAISE EXCEPTION 'CONTROLE 28 : % KO (tout est annule)%', nb_ko, rapport;
END
$ctl$;
