-- ─── ÉTAPE 1 : Diagnostic ─────────────────────────────────────────────────────
-- Vérifier les lignes ciblées (format STU + 3 chiffres)
SELECT id, student_number, enrollment_date
FROM students
WHERE student_number LIKE 'STU%'
ORDER BY student_number;

-- ─── ÉTAPE 2 : Migration ──────────────────────────────────────────────────────
-- Ancien format : STU001
-- Nouveau format : ELV-202409-001 (mois extrait de enrollment_date, séquence conservée)
--
-- SUBSTRING(student_number FROM 4) extrait les chiffres après "STU"
-- LPAD assure le padding à 3 chiffres

UPDATE students
SET student_number =
  'ELV-' ||
  TO_CHAR(enrollment_date, 'YYYYMM') ||
  '-' ||
  LPAD(SUBSTRING(student_number FROM 4), 3, '0')
WHERE student_number LIKE 'STU%';

-- ─── ÉTAPE 3 : Vérification ───────────────────────────────────────────────────
SELECT student_number, enrollment_date
FROM students
ORDER BY student_number;
