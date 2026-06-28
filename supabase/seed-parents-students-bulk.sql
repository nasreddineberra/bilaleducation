-- ============================================
-- BILAL EDUCATION - 30 fiches parents + 45 élèves rattachés
-- Établissement : demo
-- À exécuter APRÈS schema.sql et policies.sql
-- Noms de familles distincts des seeds existants (pas de doublon).
-- Les student_number sont calculés dynamiquement (aucune collision).
-- ============================================

DO $$
DECLARE
  demo_id UUID;
  base_num INT;
BEGIN
  SELECT id INTO demo_id FROM etablissements WHERE slug = 'demo';

  IF demo_id IS NULL THEN
    RAISE EXCEPTION 'Établissement "demo" introuvable. Vérifiez que le slug existe dans la table etablissements.';
  END IF;

  -- ─── 30 fiches parents ─────────────────────────────────────────────────────
  INSERT INTO parents (
    etablissement_id,
    tutor1_last_name, tutor1_first_name, tutor1_relationship,
    tutor1_phone, tutor1_email, tutor1_address, tutor1_city, tutor1_postal_code, tutor1_profession,
    tutor2_last_name, tutor2_first_name, tutor2_relationship,
    tutor2_phone, tutor2_email, tutor2_profession,
    tutor1_adult_courses, tutor2_adult_courses
  ) VALUES
  (demo_id, 'ABBASSI','Yacine','père','06 11 02 03 04','yacine.abbassi@email.fr','3 rue Pasteur','Lyon','69007','Ingénieur',
            'ABBASSI','Nawel','mère','06 11 02 03 05','nawel.abbassi@email.fr','Infirmière', true, false),
  (demo_id, 'AZIZI','Sofiane','père','06 12 03 04 05','sofiane.azizi@email.fr','11 avenue de la Gare','Paris','75012','Comptable',
            'AZIZI','Lamia','mère','06 12 03 04 06','lamia.azizi@email.fr','Pharmacienne', false, false),
  (demo_id, 'BELKACEM','Hind','mère','06 13 04 05 06','hind.belkacem@email.fr','7 rue des Lilas','Marseille','13006','Enseignante',
            'BELKACEM','Reda','père','06 13 04 05 07','reda.belkacem@email.fr','Technicien', true, true),
  (demo_id, 'BENNANI','Khalid','père','06 14 05 06 07','khalid.bennani@email.fr','2 boulevard Carnot','Bordeaux','33200','Médecin',
            NULL,NULL,NULL,NULL,NULL,NULL, false, false),
  (demo_id, 'BERRADA','Salima','mère','06 15 06 07 08','salima.berrada@email.fr','19 rue Nationale','Nantes','44100','Architecte',
            'BERRADA','Anas','père','06 15 06 07 09','anas.berrada@email.fr','Chef de projet', true, false),
  (demo_id, 'BOUAZIZ','Mounir','père','06 16 07 08 09','mounir.bouaziz@email.fr','5 place du Marché','Strasbourg','67100','Restaurateur',
            'BOUAZIZ','Farida','mère','06 16 07 08 10','farida.bouaziz@email.fr','Aide-soignante', false, true),
  (demo_id, 'CHERIF','Nabil','père','06 17 08 09 10','nabil.cherif@email.fr','8 allée Verte','Toulouse','31200','Commercial',
            NULL,NULL,NULL,NULL,NULL,NULL, false, false),
  (demo_id, 'DAHMANI','Sabrina','mère','06 18 09 10 11','sabrina.dahmani@email.fr','14 rue Gambetta','Lille','59000','Éducatrice',
            'DAHMANI','Fouad','père','06 18 09 10 12','fouad.dahmani@email.fr','Électricien', true, false),
  (demo_id, 'DJEBBAR','Rachid','père','06 19 10 11 12','rachid.djebbar@email.fr','22 rue du Stade','Lyon','69008','Gérant',
            'DJEBBAR','Karima','mère','06 19 10 11 13','karima.djebbar@email.fr','Sans emploi', false, false),
  (demo_id, 'FERHAT','Latifa','mère','06 20 11 12 13','latifa.ferhat@email.fr','6 chemin Neuf','Nice','06100','Diététicienne',
            NULL,NULL,NULL,NULL,NULL,NULL, true, false),
  (demo_id, 'GUERROUI','Samir','père','06 21 12 13 14','samir.guerroui@email.fr','30 avenue Foch','Grenoble','38100','Informaticien',
            'GUERROUI','Naima','mère','06 21 12 13 15','naima.guerroui@email.fr','Professeure', true, true),
  (demo_id, 'HAMDAOUI','Yassine','père','06 22 13 14 15','yassine.hamdaoui@email.fr','9 rue Jeanne d''Arc','Montpellier','34000','Kinésithérapeute',
            'HAMDAOUI','Souad','mère','06 22 13 14 16','souad.hamdaoui@email.fr','Orthophoniste', false, false),
  (demo_id, 'JABER','Walid','père','06 23 14 15 16','walid.jaber@email.fr','4 impasse des Vignes','Rennes','35200','Juriste',
            NULL,NULL,NULL,NULL,NULL,NULL, false, false),
  (demo_id, 'KABBAJ','Hayat','mère','06 24 15 16 17','hayat.kabbaj@email.fr','17 rue Clemenceau','Clermont-Ferrand','63000','Comptable',
            'KABBAJ','Driss','père','06 24 15 16 18','driss.kabbaj@email.fr','Chauffeur', true, false),
  (demo_id, 'KHELIFI','Aziz','père','06 25 16 17 18','aziz.khelifi@email.fr','25 rue de Verdun','Lille','59800','Responsable logistique',
            'KHELIFI','Wafa','mère','06 25 16 17 19','wafa.khelifi@email.fr','Secrétaire', false, true),
  (demo_id, 'LAMRANI','Othmane','père','06 26 17 18 19','othmane.lamrani@email.fr','1 rue du Pont','Lyon','69001','Banquier',
            'LAMRANI','Imane','mère','06 26 17 18 20','imane.lamrani@email.fr','Assistante RH', true, false),
  (demo_id, 'MAHROUG','Djamila','mère','06 27 18 19 20','djamila.mahroug@email.fr','13 rue Voltaire','Paris','75011','Coiffeuse',
            NULL,NULL,NULL,NULL,NULL,NULL, false, false),
  (demo_id, 'MEKKI','Brahim','père','06 28 19 20 21','brahim.mekki@email.fr','10 avenue Jean Moulin','Marseille','13010','Maçon',
            'MEKKI','Saida','mère','06 28 19 20 22','saida.mekki@email.fr','Femme au foyer', false, false),
  (demo_id, 'NACIRI','Zohra','mère','06 29 20 21 22','zohra.naciri@email.fr','18 rue de la Liberté','Bordeaux','33000','Avocate',
            'NACIRI','Hicham','père','06 29 20 21 23','hicham.naciri@email.fr','Dentiste', true, true),
  (demo_id, 'OUALI','Madjid','père','06 30 21 22 23','madjid.ouali@email.fr','7 rue Diderot','Nantes','44000','Cuisinier',
            NULL,NULL,NULL,NULL,NULL,NULL, false, false),
  (demo_id, 'QASMI','Nadia','mère','06 31 22 23 24','nadia.qasmi@email.fr','21 rue Molière','Strasbourg','67000','Sage-femme',
            'QASMI','Tewfik','père','06 31 22 23 25','tewfik.qasmi@email.fr','Plombier', true, false),
  (demo_id, 'RIAHI','Adel','père','06 32 23 24 25','adel.riahi@email.fr','3 allée des Chênes','Toulouse','31000','Pompier',
            'RIAHI','Leïla','mère','06 32 23 24 26','leila.riahi@email.fr','Caissière', false, false),
  (demo_id, 'SAIDI','Mustapha','père','06 33 24 25 26','mustapha.saidi@email.fr','15 rue du Commerce','Lille','59100','Vendeur',
            'SAIDI','Halima','mère','06 33 24 25 27','halima.saidi@email.fr','Auxiliaire de vie', false, true),
  (demo_id, 'SLIMANI','Fatih','père','06 34 25 26 27','fatih.slimani@email.fr','28 boulevard Gambetta','Nice','06000','Carreleur',
            NULL,NULL,NULL,NULL,NULL,NULL, true, false),
  (demo_id, 'TAZI','Amel','mère','06 35 26 27 28','amel.tazi@email.fr','6 rue Berthelot','Grenoble','38000','Médecin',
            'TAZI','Riad','père','06 35 26 27 29','riad.tazi@email.fr','Notaire', true, true),
  (demo_id, 'TOUMI','Karim','père','06 36 27 28 29','karim.toumi@email.fr','12 rue Lafayette','Montpellier','34070','Agent immobilier',
            'TOUMI','Sihem','mère','06 36 27 28 30','sihem.toumi@email.fr','Esthéticienne', false, false),
  (demo_id, 'WAHBI','Naoual','mère','06 37 28 29 30','naoual.wahbi@email.fr','9 rue Carnot','Rennes','35000','Bibliothécaire',
            NULL,NULL,NULL,NULL,NULL,NULL, false, false),
  (demo_id, 'YAHIAOUI','Slimane','père','06 38 29 30 31','slimane.yahiaoui@email.fr','4 rue de l''Église','Clermont-Ferrand','63100','Soudeur',
            'YAHIAOUI','Malika','mère','06 38 29 30 32','malika.yahiaoui@email.fr','Couturière', true, false),
  (demo_id, 'ZAGHOUANI','Faycal','père','06 39 30 31 32','faycal.zaghouani@email.fr','20 avenue de la République','Lyon','69003','Pharmacien',
            'ZAGHOUANI','Asma','mère','06 39 30 31 33','asma.zaghouani@email.fr','Biologiste', false, true),
  (demo_id, 'ZERROUKI','Tahar','père','06 40 31 32 33','tahar.zerrouki@email.fr','2 rue des Écoles','Paris','75019','Boulanger',
            'ZERROUKI','Yamina','mère','06 40 31 32 34','yamina.zerrouki@email.fr','Vendeuse', false, false);

  -- ─── Numéro de départ : après le max des élèves de l'année 2024 ─────────────
  SELECT COALESCE(MAX((regexp_match(student_number, 'ELV-\d{6}-(\d+)'))[1]::int), 0)
    INTO base_num
    FROM students
   WHERE student_number LIKE 'ELV-2024%';

  -- ─── 45 élèves rattachés (15 familles × 2 enfants + 15 familles × 1) ────────
  WITH data(famille, first_name, gender, dob, ord) AS (
    VALUES
      ('ABBASSI','Adam','male','2014-02-11', 1),  ('ABBASSI','Maya','female','2017-06-23', 2),
      ('AZIZI','Sami','male','2013-09-05', 3),     ('AZIZI','Lina','female','2016-12-19', 4),
      ('BELKACEM','Rayan','male','2015-03-30', 5), ('BELKACEM','Nour','female','2018-08-14', 6),
      ('BENNANI','Yanis','male','2014-07-21', 7),  ('BENNANI','Sara','female','2019-01-09', 8),
      ('BERRADA','Ilyes','male','2012-11-02', 9),  ('BERRADA','Aya','female','2015-05-27', 10),
      ('BOUAZIZ','Adam','male','2016-04-16', 11),  ('BOUAZIZ','Salma','female','2018-10-03', 12),
      ('CHERIF','Bilal','male','2013-12-12', 13),  ('CHERIF','Maryam','female','2017-02-28', 14),
      ('DAHMANI','Imran','male','2015-08-08', 15), ('DAHMANI','Ines','female','2019-03-22', 16),
      ('DJEBBAR','Wassim','male','2014-01-25', 17),('DJEBBAR','Yasmine','female','2016-09-17', 18),
      ('FERHAT','Nael','male','2017-05-06', 19),   ('FERHAT','Kenza','female','2012-07-30', 20),
      ('GUERROUI','Ayoub','male','2013-10-14', 21),('GUERROUI','Rania','female','2018-12-01', 22),
      ('HAMDAOUI','Hamza','male','2015-06-19', 23),('HAMDAOUI','Sirine','female','2017-11-11', 24),
      ('JABER','Younes','male','2014-03-03', 25),  ('JABER','Lana','female','2016-08-25', 26),
      ('KABBAJ','Idris','male','2012-09-09', 27),  ('KABBAJ','Amira','female','2019-04-13', 28),
      ('KHELIFI','Zakaria','male','2016-01-29', 29),('KHELIFI','Soraya','female','2018-06-07', 30),
      ('LAMRANI','Mehdi','male','2015-02-18', 31),
      ('MAHROUG','Lyna','female','2017-07-04', 32),
      ('MEKKI','Anir','male','2014-10-22', 33),
      ('NACIRI','Selma','female','2016-05-15', 34),
      ('OUALI','Tariq','male','2013-08-19', 35),
      ('QASMI','Nada','female','2018-03-28', 36),
      ('RIAHI','Sofiane','male','2015-11-06', 37),
      ('SAIDI','Houda','female','2017-01-12', 38),
      ('SLIMANI','Walid','male','2014-04-09', 39),
      ('TAZI','Meryem','female','2019-09-21', 40),
      ('TOUMI','Sami','male','2013-06-02', 41),
      ('WAHBI','Dounia','female','2016-10-30', 42),
      ('YAHIAOUI','Ramy','male','2015-12-24', 43),
      ('ZAGHOUANI','Lina','female','2017-08-08', 44),
      ('ZERROUKI','Nabil','male','2014-05-17', 45)
  )
  INSERT INTO students (
    etablissement_id, parent_id, student_number,
    last_name, first_name, gender, date_of_birth,
    enrollment_date, is_active,
    exit_authorization, media_authorization, has_pai
  )
  SELECT
    demo_id,
    (SELECT id FROM parents
       WHERE etablissement_id = demo_id AND tutor1_last_name = d.famille
       ORDER BY created_at DESC LIMIT 1),
    'ELV-202409-' || lpad((base_num + row_number() OVER (ORDER BY d.ord))::text, 3, '0'),
    d.famille, d.first_name, d.gender, d.dob::date,
    '2024-09-02', true,
    false, true, false
  FROM data d;

  RAISE NOTICE '30 parents + 45 élèves créés pour l''établissement demo (id: %). Numéros élèves à partir de %.', demo_id, base_num + 1;
END $$;
