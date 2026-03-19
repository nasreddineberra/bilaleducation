-- ╔══════════════════════════════════════════════════════════════════════════════╗
-- ║  Migration : Tables rooms & materials                                      ║
-- ╚══════════════════════════════════════════════════════════════════════════════╝

-- ─── Salles ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS rooms (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  etablissement_id UUID NOT NULL REFERENCES etablissements(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  room_type       TEXT NOT NULL DEFAULT 'salle_cours'
                  CHECK (room_type IN ('salle_cours','salle_informatique','bibliotheque','salle_reunion','salle_sport','administration','autre')),
  capacity        INT,
  floor           TEXT,
  description     TEXT,
  is_available    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rooms_select" ON rooms FOR SELECT
  USING (etablissement_id IN (SELECT etablissement_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "rooms_insert" ON rooms FOR INSERT
  WITH CHECK (etablissement_id IN (
    SELECT etablissement_id FROM profiles WHERE id = auth.uid() AND role IN ('admin','direction','secretaire')
  ));

CREATE POLICY "rooms_update" ON rooms FOR UPDATE
  USING (etablissement_id IN (
    SELECT etablissement_id FROM profiles WHERE id = auth.uid() AND role IN ('admin','direction','secretaire')
  ));

CREATE POLICY "rooms_delete" ON rooms FOR DELETE
  USING (etablissement_id IN (
    SELECT etablissement_id FROM profiles WHERE id = auth.uid() AND role IN ('admin','direction','secretaire')
  ));

-- ─── Ressources matérielles ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS materials (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  etablissement_id   UUID NOT NULL REFERENCES etablissements(id) ON DELETE CASCADE,
  name               TEXT NOT NULL,
  category           TEXT NOT NULL DEFAULT 'autre'
                     CHECK (category IN ('informatique','audiovisuel','mobilier','sport','fournitures','autre')),
  quantity           INT NOT NULL DEFAULT 1,
  room_id            UUID REFERENCES rooms(id) ON DELETE SET NULL,
  condition          TEXT NOT NULL DEFAULT 'bon'
                     CHECK (condition IN ('neuf','bon','use','hors_service')),
  serial_number      TEXT,
  purchase_date      DATE,
  notes              TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Suppression de la colonne quantity_available (plus utilisée)
ALTER TABLE materials DROP COLUMN IF EXISTS quantity_available;

ALTER TABLE materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "materials_select" ON materials FOR SELECT
  USING (etablissement_id IN (SELECT etablissement_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "materials_insert" ON materials FOR INSERT
  WITH CHECK (etablissement_id IN (
    SELECT etablissement_id FROM profiles WHERE id = auth.uid() AND role IN ('admin','direction','secretaire')
  ));

CREATE POLICY "materials_update" ON materials FOR UPDATE
  USING (etablissement_id IN (
    SELECT etablissement_id FROM profiles WHERE id = auth.uid() AND role IN ('admin','direction','secretaire')
  ));

CREATE POLICY "materials_delete" ON materials FOR DELETE
  USING (etablissement_id IN (
    SELECT etablissement_id FROM profiles WHERE id = auth.uid() AND role IN ('admin','direction','secretaire')
  ));
