-- Ajoute 'non_specified' comme valeur valide pour le genre des élèves
ALTER TABLE students
  DROP CONSTRAINT IF EXISTS students_gender_check;

ALTER TABLE students
  ADD CONSTRAINT students_gender_check
  CHECK (gender IN ('male', 'female', 'non_specified'));
