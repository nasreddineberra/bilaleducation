-- Ajout du champ "code" (référence) sur les modules et les cours
ALTER TABLE cours_modules ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE cours         ADD COLUMN IF NOT EXISTS code TEXT;
