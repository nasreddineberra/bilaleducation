-- Premier jour de la semaine : 1=Lundi, 6=Samedi, 0=Dimanche
ALTER TABLE etablissements
  ADD COLUMN IF NOT EXISTS week_start_day smallint
  CHECK (week_start_day IN (0, 1, 6));
