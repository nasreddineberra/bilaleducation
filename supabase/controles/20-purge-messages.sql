-- ============================================================================
-- CONTROLE 20 — La purge d'une annee emporte ses messages, et seulement eux
--
-- Dans l'ECOLE DE DEMONSTRATION (jamais ECOLE BILAL), deux annees JETABLES :
--   Y0  2018-09-01 -> 2019-07-05  (annee precedente, conservee)
--   Y1  2019-09-01 -> 2020-07-05  (archivee, non courante : celle qu'on purge)
-- Messages poses, et sort attendu a la purge de Y1 :
--   annonce 2019-06-01            (Y0)                    -> RESTE
--   annonce 2019-08-01 + 1 PJ     (ete : annee superieure) -> SUPPRIMEE
--   annonce 2020-07-05 23:30 Paris (dernier jour de Y1)   -> SUPPRIMEE
--   annonce 2020-07-06            (apres Y1)               -> RESTE
--   notification 2019-06-01 / 2020-01-15 / 2020-07-06     -> reste / supprimee / reste
--   relance Y1, foyer avec impaye conserve                -> RESTE
--   relance Y1, foyer sans dossier                        -> SUPPRIMEE
-- Le chemin de la PJ doit revenir dans `fichiers`.
--
-- La purge est appelee sous l'identite d'un compte admin / direction de la
-- demonstration (memes gardes qu'a l'ecran).
-- Migration : supabase/migrations/purge-messages-annee.sql.
-- LECTURE SEULE : exception volontaire finale, tout est annule.
-- ============================================================================
DO $ctl$
DECLARE
  e    uuid;
  moi  uuid;
  y0   uuid := gen_random_uuid();
  y1   uuid := gen_random_uuid();
  p1   uuid := gen_random_uuid();
  p2   uuid := gen_random_uuid();
  a0   uuid := gen_random_uuid();
  a1   uuid := gen_random_uuid();
  a2   uuid := gen_random_uuid();
  a3   uuid := gen_random_uuid();
  n0   uuid := gen_random_uuid();
  n1   uuid := gen_random_uuid();
  n3   uuid := gen_random_uuid();
  r1   uuid := gen_random_uuid();
  r2   uuid := gen_random_uuid();
  suf  text := left(gen_random_uuid()::text, 8);
  res  jsonb;
  rapport text := '';
  nb_ko integer := 0;
BEGIN
  SELECT id INTO e FROM etablissements WHERE est_demo;
  IF e IS NULL THEN RAISE EXCEPTION 'Ecole de demonstration introuvable.'; END IF;
  SELECT id INTO moi FROM profiles
   WHERE etablissement_id = e AND is_active AND role IN ('admin', 'direction')
   ORDER BY role LIMIT 1;
  IF moi IS NULL THEN RAISE EXCEPTION 'Aucun compte admin / direction actif dans la demonstration.'; END IF;

  INSERT INTO school_years (id, etablissement_id, label, start_date, end_date, is_current)
  VALUES (y0, e, 'CTL0-' || suf, '2018-09-01', '2019-07-05', false),
         (y1, e, 'CTL1-' || suf, '2019-09-01', '2020-07-05', false);
  UPDATE school_years SET closed_at = now(), archived_at = now() WHERE id = y1;

  INSERT INTO parents (id, etablissement_id, tutor1_last_name, tutor1_first_name, tutor1_email)
  VALUES (p1, e, 'CTLPURGEA' || suf, 'Un',   'ctl-purge-a-' || suf || '@exemple.invalid'),
         (p2, e, 'CTLPURGEB' || suf, 'Deux', 'ctl-purge-b-' || suf || '@exemple.invalid');
  -- Foyer 1 : impaye conserve par la purge (du 100, rien percu).
  INSERT INTO family_fees (etablissement_id, parent_id, school_year_id, subtotal, total_due)
  VALUES (e, p1, y1, 100, 100);

  INSERT INTO announcements (id, etablissement_id, title, content, sent_at) VALUES
    (a0, e, 'CTL a0', 'x', '2019-06-01 10:00+02'),
    (a1, e, 'CTL a1', 'x', '2019-08-01 10:00+02'),
    (a2, e, 'CTL a2', 'x', '2020-07-05 21:30+00'),
    (a3, e, 'CTL a3', 'x', '2020-07-06 10:00+02');
  INSERT INTO announcement_attachments (announcement_id, file_name, file_path)
  VALUES (a1, 'ctl.pdf', e::text || '/ctl-' || suf || '.pdf');

  INSERT INTO notifications (id, etablissement_id, type, parent_id, title, body, created_at) VALUES
    (n0, e, 'announcement', p1, 'CTL', 'x', '2019-06-01 10:00+02'),
    (n1, e, 'announcement', p1, 'CTL', 'x', '2020-01-15 10:00+01'),
    (n3, e, 'announcement', p1, 'CTL', 'x', '2020-07-06 10:00+02');

  INSERT INTO financement_communications (id, etablissement_id, parent_id, school_year_id, type, subject) VALUES
    (r1, e, p1, y1, 'relance', 'CTL'),
    (r2, e, p2, y1, 'relance', 'CTL');

  -- La purge, sous l'identite d'un gestionnaire de la demonstration.
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims',
                     json_build_object('sub', moi, 'role', 'authenticated')::text, true);
  res := purge_school_year(y1);
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', NULL, true);

  rapport := rapport || 'Resultat : ' || res::text || E'\n\n';

  -- Ce qui doit RESTER
  IF NOT EXISTS (SELECT 1 FROM announcements WHERE id = a0) THEN nb_ko := nb_ko + 1; rapport := rapport || 'KO  annonce 2019-06-01 (Y0) supprimee' || E'\n'; ELSE rapport := rapport || 'ok  annonce 2019-06-01 (Y0) conservee' || E'\n'; END IF;
  IF NOT EXISTS (SELECT 1 FROM announcements WHERE id = a3) THEN nb_ko := nb_ko + 1; rapport := rapport || 'KO  annonce 2020-07-06 (apres Y1) supprimee' || E'\n'; ELSE rapport := rapport || 'ok  annonce 2020-07-06 (apres Y1) conservee' || E'\n'; END IF;
  IF NOT EXISTS (SELECT 1 FROM notifications WHERE id = n0) THEN nb_ko := nb_ko + 1; rapport := rapport || 'KO  notification 2019-06-01 supprimee' || E'\n'; ELSE rapport := rapport || 'ok  notification 2019-06-01 conservee' || E'\n'; END IF;
  IF NOT EXISTS (SELECT 1 FROM notifications WHERE id = n3) THEN nb_ko := nb_ko + 1; rapport := rapport || 'KO  notification 2020-07-06 supprimee' || E'\n'; ELSE rapport := rapport || 'ok  notification 2020-07-06 conservee' || E'\n'; END IF;
  IF NOT EXISTS (SELECT 1 FROM financement_communications WHERE id = r1) THEN nb_ko := nb_ko + 1; rapport := rapport || 'KO  relance du foyer impaye supprimee' || E'\n'; ELSE rapport := rapport || 'ok  relance du foyer impaye conservee' || E'\n'; END IF;

  -- Ce qui doit PARTIR
  IF EXISTS (SELECT 1 FROM announcements WHERE id = a1) THEN nb_ko := nb_ko + 1; rapport := rapport || 'KO  annonce 2019-08-01 (ete) conservee' || E'\n'; ELSE rapport := rapport || 'ok  annonce 2019-08-01 (ete) supprimee' || E'\n'; END IF;
  IF EXISTS (SELECT 1 FROM announcement_attachments WHERE announcement_id = a1) THEN nb_ko := nb_ko + 1; rapport := rapport || 'KO  piece jointe conservee' || E'\n'; ELSE rapport := rapport || 'ok  piece jointe supprimee' || E'\n'; END IF;
  IF EXISTS (SELECT 1 FROM announcements WHERE id = a2) THEN nb_ko := nb_ko + 1; rapport := rapport || 'KO  annonce 2020-07-05 23:30 Paris conservee' || E'\n'; ELSE rapport := rapport || 'ok  annonce 2020-07-05 23:30 Paris supprimee' || E'\n'; END IF;
  IF EXISTS (SELECT 1 FROM notifications WHERE id = n1) THEN nb_ko := nb_ko + 1; rapport := rapport || 'KO  notification 2020-01-15 conservee' || E'\n'; ELSE rapport := rapport || 'ok  notification 2020-01-15 supprimee' || E'\n'; END IF;
  IF EXISTS (SELECT 1 FROM financement_communications WHERE id = r2) THEN nb_ko := nb_ko + 1; rapport := rapport || 'KO  relance du foyer sans dossier conservee' || E'\n'; ELSE rapport := rapport || 'ok  relance du foyer sans dossier supprimee' || E'\n'; END IF;

  -- Le resultat rend les compteurs et le chemin du fichier
  IF coalesce((res->>'messages')::int, -1) <> 2 OR coalesce((res->>'notifications')::int, -1) <> 1
     OR coalesce((res->>'relances')::int, -1) <> 1
     OR NOT coalesce(res->'fichiers' ? (e::text || '/ctl-' || suf || '.pdf'), false) THEN
    nb_ko := nb_ko + 1; rapport := rapport || 'KO  compteurs ou fichiers du resultat (attendu 2 / 1 / 1 + le chemin)' || E'\n';
  ELSE
    rapport := rapport || 'ok  compteurs 2 / 1 / 1 et chemin du fichier rendus' || E'\n';
  END IF;

  RAISE EXCEPTION E'\n%\n%  (exception volontaire : tout est annule)', rapport,
    CASE WHEN nb_ko = 0 THEN 'VERT : 11 / 11' ELSE 'ROUGE : ' || nb_ko || ' ecart(s)' END;
END
$ctl$;
