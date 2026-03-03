-- ============================================
-- BILAL EDUCATION - 21 fiches élèves (établissement demo)
-- À exécuter APRÈS seed-parents-demo.sql
-- ============================================

DO $$
DECLARE
  demo_id UUID;
BEGIN
  SELECT id INTO demo_id FROM etablissements WHERE slug = 'demo';

  IF demo_id IS NULL THEN
    RAISE EXCEPTION 'Établissement "demo" introuvable. Vérifiez que le slug existe dans la table etablissements.';
  END IF;

  INSERT INTO students (
    etablissement_id,
    parent_id,
    student_number,
    last_name, first_name, gender,
    date_of_birth,
    address, city, postal_code,
    emergency_contact_name, emergency_contact_phone,
    enrollment_date,
    is_active,
    exit_authorization, media_authorization, has_pai
  ) VALUES

  -- ─── Famille AMRANI (2 enfants) ───────────────────────────────────────────
  (demo_id,
   (SELECT id FROM parents WHERE etablissement_id = demo_id AND tutor1_last_name = 'AMRANI' LIMIT 1),
   'ELV-202409-001',
   'AMRANI', 'Adam', 'male',
   '2015-03-14',
   '12 rue des Roses', 'Lyon', '69003',
   'Hassan AMRANI', '06 12 34 56 78',
   '2024-09-02',
   true, true, true, false),

  (demo_id,
   (SELECT id FROM parents WHERE etablissement_id = demo_id AND tutor1_last_name = 'AMRANI' LIMIT 1),
   'ELV-202409-002',
   'AMRANI', 'Sara', 'female',
   '2018-09-22',
   '12 rue des Roses', 'Lyon', '69003',
   'Hassan AMRANI', '06 12 34 56 78',
   '2024-09-02',
   true, true, true, false),

  -- ─── Famille BENALI (1 enfant) ────────────────────────────────────────────
  (demo_id,
   (SELECT id FROM parents WHERE etablissement_id = demo_id AND tutor1_last_name = 'BENALI' LIMIT 1),
   'ELV-202409-003',
   'BENALI', 'Yassine', 'male',
   '2016-06-05',
   '5 avenue Victor Hugo', 'Paris', '75015',
   'Mohamed BENALI', '06 34 56 78 90',
   '2024-09-02',
   true, true, false, false),

  -- ─── Famille CHOUAIBI (2 enfants) ────────────────────────────────────────
  (demo_id,
   (SELECT id FROM parents WHERE etablissement_id = demo_id AND tutor1_last_name = 'CHOUAIBI' LIMIT 1),
   'ELV-202409-004',
   'CHOUAIBI', 'Imane', 'female',
   '2017-04-18',
   '8 boulevard du Prado', 'Marseille', '13008',
   'Nadia CHOUAIBI', '06 45 67 89 01',
   '2024-09-02',
   true, false, true, false),

  (demo_id,
   (SELECT id FROM parents WHERE etablissement_id = demo_id AND tutor1_last_name = 'CHOUAIBI' LIMIT 1),
   'ELV-202409-005',
   'CHOUAIBI', 'Amine', 'male',
   '2019-11-30',
   '8 boulevard du Prado', 'Marseille', '13008',
   'Nadia CHOUAIBI', '06 45 67 89 01',
   '2024-09-02',
   true, false, false, false),

  -- ─── Famille DOUIEB (1 enfant) ────────────────────────────────────────────
  (demo_id,
   (SELECT id FROM parents WHERE etablissement_id = demo_id AND tutor1_last_name = 'DOUIEB' LIMIT 1),
   'ELV-202409-006',
   'DOUIEB', 'Lina', 'female',
   '2014-07-12',
   '3 rue Sainte-Catherine', 'Bordeaux', '33000',
   'Youssef DOUIEB', '06 67 89 01 23',
   '2024-09-02',
   true, true, true, false),

  -- ─── Famille EL-FATHI (2 enfants) ────────────────────────────────────────
  (demo_id,
   (SELECT id FROM parents WHERE etablissement_id = demo_id AND tutor1_last_name = 'EL-FATHI' LIMIT 1),
   'ELV-202409-007',
   'EL-FATHI', 'Ilyas', 'male',
   '2016-02-28',
   '17 rue de la Paix', 'Nantes', '44000',
   'Karim EL-FATHI', '06 89 01 23 45',
   '2024-09-02',
   true, true, false, false),

  (demo_id,
   (SELECT id FROM parents WHERE etablissement_id = demo_id AND tutor1_last_name = 'EL-FATHI' LIMIT 1),
   'ELV-202409-008',
   'EL-FATHI', 'Nour', 'female',
   '2018-08-17',
   '17 rue de la Paix', 'Nantes', '44000',
   'Karim EL-FATHI', '06 89 01 23 45',
   '2024-09-02',
   true, true, false, false),

  -- ─── Famille GHARBI (1 enfant) ────────────────────────────────────────────
  (demo_id,
   (SELECT id FROM parents WHERE etablissement_id = demo_id AND tutor1_last_name = 'GHARBI' LIMIT 1),
   'ELV-202409-009',
   'GHARBI', 'Rayan', 'male',
   '2017-05-09',
   '22 rue du Bain-aux-Plantes', 'Strasbourg', '67000',
   'Leila GHARBI', '06 90 12 34 56',
   '2024-09-02',
   true, false, true, false),

  -- ─── Famille HADJ (2 enfants) ─────────────────────────────────────────────
  (demo_id,
   (SELECT id FROM parents WHERE etablissement_id = demo_id AND tutor1_last_name = 'HADJ' LIMIT 1),
   'ELV-202409-010',
   'HADJ', 'Mariam', 'female',
   '2015-10-03',
   '9 allée Jean-Jaurès', 'Toulouse', '31000',
   'Abdelkader HADJ', '06 11 22 33 44',
   '2024-09-02',
   true, true, true, false),

  (demo_id,
   (SELECT id FROM parents WHERE etablissement_id = demo_id AND tutor1_last_name = 'HADJ' LIMIT 1),
   'ELV-202409-011',
   'HADJ', 'Hamza', 'male',
   '2017-12-21',
   '9 allée Jean-Jaurès', 'Toulouse', '31000',
   'Abdelkader HADJ', '06 11 22 33 44',
   '2024-09-02',
   true, true, false, false),

  -- ─── Famille IDRISSI (1 enfant) ───────────────────────────────────────────
  (demo_id,
   (SELECT id FROM parents WHERE etablissement_id = demo_id AND tutor1_last_name = 'IDRISSI' LIMIT 1),
   'ELV-202409-012',
   'IDRISSI', 'Kenza', 'female',
   '2016-01-15',
   '14 rue Faidherbe', 'Lille', '59000',
   'Zineb IDRISSI', '06 33 44 55 66',
   '2024-09-02',
   true, false, true, false),

  -- ─── Famille KADDOURI (1 enfant) ──────────────────────────────────────────
  (demo_id,
   (SELECT id FROM parents WHERE etablissement_id = demo_id AND tutor1_last_name = 'KADDOURI' LIMIT 1),
   'ELV-202409-013',
   'KADDOURI', 'Ayoub', 'male',
   '2018-07-08',
   '6 rue de la Barre', 'Lyon', '69002',
   'Ahmed KADDOURI', '06 44 55 66 77',
   '2024-09-02',
   true, false, false, false),

  -- ─── Famille LAHCEN (2 enfants) ───────────────────────────────────────────
  (demo_id,
   (SELECT id FROM parents WHERE etablissement_id = demo_id AND tutor1_last_name = 'LAHCEN' LIMIT 1),
   'ELV-202409-014',
   'LAHCEN', 'Salma', 'female',
   '2013-03-25',
   '31 avenue de la Californie', 'Nice', '06000',
   'Souad LAHCEN', '06 66 77 88 99',
   '2024-09-02',
   true, true, true, false),

  (demo_id,
   (SELECT id FROM parents WHERE etablissement_id = demo_id AND tutor1_last_name = 'LAHCEN' LIMIT 1),
   'ELV-202409-015',
   'LAHCEN', 'Youssef', 'male',
   '2016-09-14',
   '31 avenue de la Californie', 'Nice', '06000',
   'Souad LAHCEN', '06 66 77 88 99',
   '2024-09-02',
   true, true, false, false),

  -- ─── Famille MANSOURI (1 enfant) ──────────────────────────────────────────
  (demo_id,
   (SELECT id FROM parents WHERE etablissement_id = demo_id AND tutor1_last_name = 'MANSOURI' LIMIT 1),
   'ELV-202409-016',
   'MANSOURI', 'Rania', 'female',
   '2017-06-20',
   '2 avenue Alsace-Lorraine', 'Grenoble', '38000',
   'Tarik MANSOURI', '06 88 99 00 11',
   '2024-09-02',
   true, true, true, false),

  -- ─── Famille NAOURI (1 enfant) ────────────────────────────────────────────
  (demo_id,
   (SELECT id FROM parents WHERE etablissement_id = demo_id AND tutor1_last_name = 'NAOURI' LIMIT 1),
   'ELV-202409-017',
   'NAOURI', 'Yassin', 'male',
   '2015-11-08',
   '18 rue de l''Université', 'Montpellier', '34000',
   'Hakima NAOURI', '06 99 00 11 22',
   '2024-09-02',
   true, false, true, true),  -- has_pai = true

  -- ─── Famille RAHMANI (1 enfant) ───────────────────────────────────────────
  (demo_id,
   (SELECT id FROM parents WHERE etablissement_id = demo_id AND tutor1_last_name = 'RAHMANI' LIMIT 1),
   'ELV-202409-018',
   'RAHMANI', 'Malak', 'female',
   '2016-04-02',
   '4 rue Blatin', 'Clermont-Ferrand', '63000',
   'Ismail RAHMANI', '06 20 30 40 50',
   '2024-09-02',
   true, true, false, false),

  -- ─── Sans rattachement parent (3 élèves) ──────────────────────────────────
  (demo_id,
   NULL,
   'ELV-202409-019',
   'TAHIR', 'Bilal', 'male',
   '2015-08-16',
   NULL, NULL, NULL,
   NULL, NULL,
   '2024-09-02',
   true, false, false, false),

  (demo_id,
   NULL,
   'ELV-202409-020',
   'MEZIANE', 'Inès', 'female',
   '2017-03-11',
   NULL, NULL, NULL,
   NULL, NULL,
   '2024-09-02',
   true, false, false, false),

  (demo_id,
   NULL,
   'ELV-202409-021',
   'BOUALI', 'Nassim', 'male',
   '2018-12-05',
   NULL, NULL, NULL,
   NULL, NULL,
   '2024-09-02',
   true, false, false, false);

  RAISE NOTICE '21 fiches élèves créées pour l''établissement demo (id: %)', demo_id;
END $$;
