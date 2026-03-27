-- Ajout des colonnes effective_from / effective_until sur schedule_slots
-- Permet de gérer l'historique des plannings : clôturer un ancien créneau
-- et en créer un nouveau lors d'une modification en cours d'année.

ALTER TABLE schedule_slots
  ADD COLUMN IF NOT EXISTS effective_from date,
  ADD COLUMN IF NOT EXISTS effective_until date;

-- Les créneaux existants sont actifs depuis toujours (null = pas de borne)
-- On ne touche pas aux données existantes.

COMMENT ON COLUMN schedule_slots.effective_from IS 'Date à partir de laquelle le créneau récurrent est actif (inclus)';
COMMENT ON COLUMN schedule_slots.effective_until IS 'Date jusqu''à laquelle le créneau récurrent est actif (inclus). NULL = actif jusqu''à fin d''année';
