-- Migration : Emploi du temps (schedule_slots + schedule_validations)
-- Planning hebdomadaire par classe/enseignant avec validation de présence

-- ============================================
-- TABLE : schedule_slots (créneaux horaires)
-- ============================================

CREATE TABLE IF NOT EXISTS schedule_slots (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  etablissement_id  uuid NOT NULL REFERENCES etablissements(id) ON DELETE CASCADE,
  school_year_id    uuid NOT NULL REFERENCES school_years(id) ON DELETE CASCADE,
  class_id          uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  teacher_id        uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  cours_id          uuid REFERENCES cours(id) ON DELETE SET NULL,
  room_id           uuid REFERENCES rooms(id) ON DELETE SET NULL,
  day_of_week       smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time        time NOT NULL,
  end_time          time NOT NULL,
  slot_type         text NOT NULL DEFAULT 'cours'
                    CHECK (slot_type IN ('cours', 'activite', 'pause', 'autre')),
  color             text,
  is_active         boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  CHECK (end_time > start_time)
);

-- Index pour requêtes fréquentes
CREATE INDEX idx_schedule_slots_year ON schedule_slots (etablissement_id, school_year_id);
CREATE INDEX idx_schedule_slots_class ON schedule_slots (class_id, day_of_week);
CREATE INDEX idx_schedule_slots_teacher ON schedule_slots (teacher_id, day_of_week);

-- Empêcher deux créneaux pour la même classe au même moment
CREATE UNIQUE INDEX idx_schedule_slots_no_class_overlap
  ON schedule_slots (class_id, day_of_week, start_time, end_time)
  WHERE is_active = true;

-- Triggers existants
CREATE TRIGGER update_schedule_slots_updated_at
  BEFORE UPDATE ON schedule_slots FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER schedule_slots_auto_etablissement
  BEFORE INSERT ON schedule_slots FOR EACH ROW EXECUTE FUNCTION set_etablissement_id();

-- RLS
ALTER TABLE schedule_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "schedule_slots_tenant" ON schedule_slots
  USING (etablissement_id = current_etablissement_id());

-- ============================================
-- TABLE : schedule_validations (validation présence enseignant)
-- ============================================

CREATE TABLE IF NOT EXISTS schedule_validations (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  etablissement_id  uuid NOT NULL REFERENCES etablissements(id) ON DELETE CASCADE,
  schedule_slot_id  uuid NOT NULL REFERENCES schedule_slots(id) ON DELETE CASCADE,
  profile_id        uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  validation_date   date NOT NULL,
  time_entry_id     uuid REFERENCES staff_time_entries(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),

  UNIQUE (schedule_slot_id, validation_date)
);

CREATE INDEX idx_schedule_validations_date ON schedule_validations (etablissement_id, validation_date);
CREATE INDEX idx_schedule_validations_teacher ON schedule_validations (profile_id, validation_date);

CREATE TRIGGER schedule_validations_auto_etablissement
  BEFORE INSERT ON schedule_validations FOR EACH ROW EXECUTE FUNCTION set_etablissement_id();

-- RLS
ALTER TABLE schedule_validations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "schedule_validations_tenant" ON schedule_validations
  USING (etablissement_id = current_etablissement_id());
