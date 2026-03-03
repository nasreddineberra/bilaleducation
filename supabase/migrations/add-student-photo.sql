-- Ajout colonne photo identité élève
ALTER TABLE students ADD COLUMN IF NOT EXISTS photo_url TEXT;
