-- ============================================
-- Migration : ajout du champ is_absence sur presence_types
-- ============================================

ALTER TABLE presence_types
  ADD COLUMN IF NOT EXISTS is_absence BOOLEAN NOT NULL DEFAULT FALSE;

-- Migration des données existantes : tout type dont le code ou le libellé
-- contient "absence" (insensible à la casse) est marqué is_absence = TRUE
UPDATE presence_types
  SET is_absence = TRUE
  WHERE code ILIKE '%absence%'
     OR label ILIKE '%absence%';

SELECT 'Champ is_absence ajouté à presence_types.' AS status;
