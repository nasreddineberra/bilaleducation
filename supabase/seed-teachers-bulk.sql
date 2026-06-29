-- ============================================
-- BILAL EDUCATION - 10 fiches enseignants (établissement demo)
-- Format numéro : ENS-YYYYMM-NNN (mois d'embauche, incrément annuel)
-- Noms distincts du seed existant (pas de doublon nom+prénom).
-- Numéros calculés dynamiquement (aucune collision avec l'existant).
-- NB : crée des fiches sans compte de connexion (l'auth se crée via l'app).
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

  -- Numéro de départ : après le max des enseignants de l'année 2024
  SELECT COALESCE(MAX((regexp_match(employee_number, 'ENS-\d{6}-(\d+)'))[1]::int), 0)
    INTO base_num
    FROM teachers
   WHERE employee_number LIKE 'ENS-2024%';

  WITH data(civilite, last_name, first_name, email, phone, specialization, ord) AS (
    VALUES
      ('M.',  'ZAHIR',     'Omar',    'o.zahir@bilaleducation.fr',     '06 60 01 02 03', 'Langue arabe',           1),
      ('Mme', 'HADDAD',    'Salma',   's.haddad@bilaleducation.fr',    '06 60 02 03 04', 'Mathématiques',          2),
      ('M.',  'NACERI',    'Bilal',   'b.naceri@bilaleducation.fr',    '06 60 03 04 05', 'Récitation du Coran',    3),
      ('Mme', 'TOUATI',    'Amina',   'a.touati@bilaleducation.fr',    '06 60 04 05 06', 'Français',               4),
      ('M.',  'BELHADJ',   'Rachid',  'r.belhadj@bilaleducation.fr',   '06 60 05 06 07', 'Sciences islamiques',    5),
      ('Mme', 'KHALDI',    'Leila',   'l.khaldi@bilaleducation.fr',    '06 60 06 07 08', 'Anglais',                6),
      ('M.',  'SAADAOUI',  'Idriss',  'i.saadaoui@bilaleducation.fr',  '06 60 07 08 09', 'Histoire-Géographie',    7),
      ('Mme', 'MEKKAOUI',  'Yasmina', 'y.mekkaoui@bilaleducation.fr',  '06 60 08 09 10', 'Sciences de la vie',     8),
      ('M.',  'CHADLI',    'Tarek',   't.chadli@bilaleducation.fr',    '06 60 09 10 11', 'Éducation physique',     9),
      ('Mme', 'FARES',     'Nawal',   'n.fares@bilaleducation.fr',     '06 60 10 11 12', 'Arts plastiques',       10)
  )
  INSERT INTO teachers (
    etablissement_id, employee_number,
    last_name, first_name, civilite,
    email, phone,
    hire_date, specialization, is_active
  )
  SELECT
    demo_id,
    'ENS-202409-' || lpad((base_num + row_number() OVER (ORDER BY d.ord))::text, 3, '0'),
    d.last_name, d.first_name, d.civilite,
    d.email, d.phone,
    '2024-09-01', d.specialization, true
  FROM data d;

  RAISE NOTICE '10 enseignants créés pour l''établissement demo (id: %). Numéros à partir de %.', demo_id, base_num + 1;
END $$;
