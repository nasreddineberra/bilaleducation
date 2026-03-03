-- ============================================
-- BILAL EDUCATION - 5 enseignants (établissement demo)
-- Format numéro : ENS-YYYYMM-NNN (mois d'embauche, incrément annuel)
-- ============================================

DO $$
DECLARE
  demo_id UUID;
BEGIN
  SELECT id INTO demo_id FROM etablissements WHERE slug = 'demo';

  IF demo_id IS NULL THEN
    RAISE EXCEPTION 'Établissement "demo" introuvable. Vérifiez que le slug existe dans la table etablissements.';
  END IF;

  INSERT INTO teachers (
    etablissement_id,
    employee_number,
    last_name, first_name,
    email, phone,
    hire_date,
    specialization,
    is_active
  ) VALUES

  (demo_id,
   'ENS-202409-001',
   'MANSOURI', 'Karim',
   'k.mansouri@bilaleducation.fr', '06 11 22 33 44',
   '2024-09-01',
   'Langue arabe',
   true),

  (demo_id,
   'ENS-202409-002',
   'BENSAID', 'Nadia',
   'n.bensaid@bilaleducation.fr', '06 22 33 44 55',
   '2024-09-01',
   'Mathématiques',
   true),

  (demo_id,
   'ENS-202409-003',
   'EL-HAKIM', 'Youssef',
   'y.elhakim@bilaleducation.fr', '06 33 44 55 66',
   '2024-09-01',
   'Sciences islamiques',
   true),

  (demo_id,
   'ENS-202409-004',
   'RACHIDI', 'Fatima',
   'f.rachidi@bilaleducation.fr', '06 44 55 66 77',
   '2024-09-01',
   'Français',
   true),

  (demo_id,
   'ENS-202603-005',
   'BOUAZZA', 'Hamid',
   'h.bouazza@bilaleducation.fr', '06 55 66 77 88',
   '2026-03-01',
   'Éducation physique',
   true);

  RAISE NOTICE '5 enseignants créés pour l''établissement demo (id: %)', demo_id;
END $$;
