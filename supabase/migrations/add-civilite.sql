-- Ajout du champ civilite sur les enseignants et les profils utilisateurs
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS civilite text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS civilite text;
