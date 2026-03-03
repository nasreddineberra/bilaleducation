-- Ajoute les colonnes horaire sur la table classes
ALTER TABLE classes
  ADD COLUMN IF NOT EXISTS day_of_week text,
  ADD COLUMN IF NOT EXISTS start_time  time,
  ADD COLUMN IF NOT EXISTS end_time    time;
