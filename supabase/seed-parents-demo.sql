-- ============================================
-- BILAL EDUCATION - 15 fiches parents (établissement demo)
-- À exécuter APRÈS schema.sql et policies.sql
-- ============================================

DO $$
DECLARE
  demo_id UUID;
BEGIN
  SELECT id INTO demo_id FROM etablissements WHERE slug = 'demo';

  IF demo_id IS NULL THEN
    RAISE EXCEPTION 'Établissement "demo" introuvable. Vérifiez que le slug existe dans la table etablissements.';
  END IF;

  INSERT INTO parents (
    etablissement_id,
    tutor1_last_name, tutor1_first_name, tutor1_relationship,
    tutor1_phone, tutor1_email, tutor1_address, tutor1_city, tutor1_postal_code, tutor1_profession,
    tutor2_last_name, tutor2_first_name, tutor2_relationship,
    tutor2_phone, tutor2_email, tutor2_profession,
    tutor1_adult_courses, tutor2_adult_courses
  ) VALUES

  -- 1. Famille AMRANI
  (demo_id,
   'AMRANI', 'Hassan', 'père',
   '06 12 34 56 78', 'hassan.amrani@email.fr', '12 rue des Roses', 'Lyon', '69003', 'Ingénieur',
   'AMRANI', 'Fatima', 'mère',
   '06 23 45 67 89', 'fatima.amrani@email.fr', 'Infirmière',
   true, false),

  -- 2. Famille BENALI
  (demo_id,
   'BENALI', 'Mohamed', 'père',
   '06 34 56 78 90', 'mohamed.benali@email.fr', '5 avenue Victor Hugo', 'Paris', '75015', 'Comptable',
   NULL, NULL, NULL,
   NULL, NULL, NULL,
   false, false),

  -- 3. Famille CHOUAIBI
  (demo_id,
   'CHOUAIBI', 'Nadia', 'mère',
   '06 45 67 89 01', 'nadia.chouaibi@email.fr', '8 boulevard du Prado', 'Marseille', '13008', 'Enseignante',
   'CHOUAIBI', 'Rachid', 'père',
   '06 56 78 90 12', 'rachid.chouaibi@email.fr', 'Technicien',
   true, true),

  -- 4. Famille DOUIEB
  (demo_id,
   'DOUIEB', 'Youssef', 'père',
   '06 67 89 01 23', 'youssef.douieb@email.fr', '3 rue Sainte-Catherine', 'Bordeaux', '33000', 'Médecin',
   'DOUIEB', 'Samira', 'mère',
   '06 78 90 12 34', 'samira.douieb@email.fr', 'Pharmacienne',
   false, false),

  -- 5. Famille EL-FATHI
  (demo_id,
   'EL-FATHI', 'Karim', 'père',
   '06 89 01 23 45', 'karim.elfathi@email.fr', '17 rue de la Paix', 'Nantes', '44000', 'Architecte',
   NULL, NULL, NULL,
   NULL, NULL, NULL,
   true, false),

  -- 6. Famille GHARBI
  (demo_id,
   'GHARBI', 'Leila', 'mère',
   '06 90 12 34 56', 'leila.gharbi@email.fr', '22 rue du Bain-aux-Plantes', 'Strasbourg', '67000', 'Assistante sociale',
   'GHARBI', 'Omar', 'père',
   '06 01 23 45 67', 'omar.gharbi@email.fr', 'Chauffeur',
   false, false),

  -- 7. Famille HADJ
  (demo_id,
   'HADJ', 'Abdelkader', 'père',
   '06 11 22 33 44', 'abdelkader.hadj@email.fr', '9 allée Jean-Jaurès', 'Toulouse', '31000', 'Commercial',
   'HADJ', 'Houda', 'mère',
   '06 22 33 44 55', 'houda.hadj@email.fr', 'Secrétaire médicale',
   true, false),

  -- 8. Famille IDRISSI
  (demo_id,
   'IDRISSI', 'Zineb', 'mère',
   '06 33 44 55 66', 'zineb.idrissi@email.fr', '14 rue Faidherbe', 'Lille', '59000', 'Éducatrice',
   NULL, NULL, NULL,
   NULL, NULL, NULL,
   false, false),

  -- 9. Famille KADDOURI
  (demo_id,
   'KADDOURI', 'Ahmed', 'père',
   '06 44 55 66 77', 'ahmed.kaddouri@email.fr', '6 rue de la Barre', 'Lyon', '69002', 'Gérant',
   'KADDOURI', 'Meryem', 'mère',
   '06 55 66 77 88', 'meryem.kaddouri@email.fr', 'Sans emploi',
   true, true),

  -- 10. Famille LAHCEN
  (demo_id,
   'LAHCEN', 'Souad', 'mère',
   '06 66 77 88 99', 'souad.lahcen@email.fr', '31 avenue de la Californie', 'Nice', '06000', 'Aide-soignante',
   'LAHCEN', 'Bilal', 'père',
   '06 77 88 99 00', 'bilal.lahcen@email.fr', 'Plombier',
   false, false),

  -- 11. Famille MANSOURI
  (demo_id,
   'MANSOURI', 'Tarik', 'père',
   '06 88 99 00 11', 'tarik.mansouri@email.fr', '2 avenue Alsace-Lorraine', 'Grenoble', '38000', 'Informaticien',
   NULL, NULL, NULL,
   NULL, NULL, NULL,
   true, false),

  -- 12. Famille NAOURI
  (demo_id,
   'NAOURI', 'Hakima', 'mère',
   '06 99 00 11 22', 'hakima.naouri@email.fr', '18 rue de l''Université', 'Montpellier', '34000', 'Professeure',
   'NAOURI', 'Mourad', 'père',
   '06 00 11 22 33', 'mourad.naouri@email.fr', 'Électricien',
   true, false),

  -- 13. Famille OUBELLA
  (demo_id,
   'OUBELLA', 'Safia', 'mère',
   '06 10 20 30 40', 'safia.oubella@email.fr', '7 quai Saint-Cast', 'Rennes', '35000', 'Juriste',
   NULL, NULL, NULL,
   NULL, NULL, NULL,
   false, false),

  -- 14. Famille RAHMANI
  (demo_id,
   'RAHMANI', 'Ismail', 'père',
   '06 20 30 40 50', 'ismail.rahmani@email.fr', '4 rue Blatin', 'Clermont-Ferrand', '63000', 'Kinésithérapeute',
   'RAHMANI', 'Yasmine', 'mère',
   '06 30 40 50 60', 'yasmine.rahmani@email.fr', 'Orthophoniste',
   true, true),

  -- 15. Famille ZOUAOUI
  (demo_id,
   'ZOUAOUI', 'Hamid', 'père',
   '06 40 50 60 70', 'hamid.zouaoui@email.fr', '25 rue Nationale', 'Lille', '59800', 'Responsable logistique',
   'ZOUAOUI', 'Amina', 'mère',
   '06 50 60 70 80', 'amina.zouaoui@email.fr', 'Diététicienne',
   false, true);

  RAISE NOTICE '15 fiches parents créées pour l''établissement demo (id: %)', demo_id;
END $$;
