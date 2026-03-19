-- Ajout de room_id (FK vers rooms) sur la table classes
ALTER TABLE classes ADD COLUMN IF NOT EXISTS room_id UUID REFERENCES rooms(id) ON DELETE SET NULL;

-- Migration des données existantes : matcher room_number avec rooms.name
UPDATE classes c
SET room_id = r.id
FROM rooms r
WHERE c.room_number IS NOT NULL
  AND c.room_number != ''
  AND r.name = c.room_number
  AND r.etablissement_id = c.etablissement_id;
