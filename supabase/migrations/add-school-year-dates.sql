-- Ajout des dates de rentrée et de fin d'année scolaire + vacances
-- start_date et end_date déjà ajoutés précédemment
ALTER TABLE school_years
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS end_date   date,
  ADD COLUMN IF NOT EXISTS vacations  jsonb DEFAULT '[]';
