-- Recréation complète : schedule_slots + schedule_exceptions + schedule_validations
-- Support récurrent (day_of_week) ET ponctuel (slot_date) + exceptions sur récurrents

DROP TABLE IF EXISTS schedule_validations CASCADE;
DROP TABLE IF EXISTS schedule_exceptions CASCADE;
DROP TABLE IF EXISTS schedule_slots CASCADE;

-- ============================================
-- TABLE : schedule_slots (créneaux horaires)
-- ============================================

CREATE TABLE schedule_slots (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  etablissement_id  uuid NOT NULL REFERENCES etablissements(id) ON DELETE CASCADE,
  school_year_id    uuid NOT NULL REFERENCES school_years(id) ON DELETE CASCADE,
  class_id          uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  teacher_id        uuid NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  cours_id          uuid REFERENCES cours(id) ON DELETE SET NULL,
  room_id           uuid REFERENCES rooms(id) ON DELETE SET NULL,

  -- Récurrent OU Ponctuel
  is_recurring      boolean NOT NULL DEFAULT true,
  day_of_week       smallint CHECK (day_of_week BETWEEN 0 AND 6),
  slot_date         date,

  start_time        time NOT NULL,
  end_time          time NOT NULL,
  slot_type         text NOT NULL DEFAULT 'cours'
                    CHECK (slot_type IN ('cours', 'activite')),
  color             text,
  is_active         boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  -- Cohérence : récurrent => day_of_week requis, ponctuel => slot_date requis
  CHECK (
    (is_recurring = true AND day_of_week IS NOT NULL AND slot_date IS NULL)
    OR
    (is_recurring = false AND slot_date IS NOT NULL AND day_of_week IS NULL)
  ),
  CHECK (end_time > start_time)
);

CREATE INDEX idx_schedule_slots_year ON schedule_slots (etablissement_id, school_year_id);
CREATE INDEX idx_schedule_slots_class ON schedule_slots (class_id, day_of_week);
CREATE INDEX idx_schedule_slots_teacher ON schedule_slots (teacher_id, day_of_week);
CREATE INDEX idx_schedule_slots_date ON schedule_slots (slot_date) WHERE slot_date IS NOT NULL;

-- Pas de double créneau pour la même classe au même moment (récurrent)
CREATE UNIQUE INDEX idx_schedule_no_class_overlap_recurring
  ON schedule_slots (class_id, day_of_week, start_time, end_time)
  WHERE is_active = true AND is_recurring = true;

-- Pas de double créneau pour la même classe au même moment (ponctuel)
CREATE UNIQUE INDEX idx_schedule_no_class_overlap_oneoff
  ON schedule_slots (class_id, slot_date, start_time, end_time)
  WHERE is_active = true AND is_recurring = false;

CREATE TRIGGER update_schedule_slots_updated_at
  BEFORE UPDATE ON schedule_slots FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER schedule_slots_auto_etablissement
  BEFORE INSERT ON schedule_slots FOR EACH ROW EXECUTE FUNCTION set_etablissement_id();

ALTER TABLE schedule_slots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "schedule_slots_tenant" ON schedule_slots
  USING (etablissement_id = current_etablissement_id());

-- ============================================
-- TABLE : schedule_exceptions (annulations / modifications ponctuelles sur récurrents)
-- ============================================

CREATE TABLE schedule_exceptions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  etablissement_id  uuid NOT NULL REFERENCES etablissements(id) ON DELETE CASCADE,
  schedule_slot_id  uuid NOT NULL REFERENCES schedule_slots(id) ON DELETE CASCADE,
  exception_date    date NOT NULL,
  exception_type    text NOT NULL CHECK (exception_type IN ('cancelled', 'modified')),

  -- Champs de remplacement (uniquement si modified)
  override_start_time  time,
  override_end_time    time,
  override_teacher_id  uuid REFERENCES teachers(id) ON DELETE SET NULL,
  override_room_id     uuid REFERENCES rooms(id) ON DELETE SET NULL,

  created_at        timestamptz NOT NULL DEFAULT now(),

  -- Une seule exception par créneau par date
  UNIQUE (schedule_slot_id, exception_date)
);

CREATE INDEX idx_schedule_exceptions_date ON schedule_exceptions (exception_date);
CREATE INDEX idx_schedule_exceptions_slot ON schedule_exceptions (schedule_slot_id);

CREATE TRIGGER schedule_exceptions_auto_etablissement
  BEFORE INSERT ON schedule_exceptions FOR EACH ROW EXECUTE FUNCTION set_etablissement_id();

ALTER TABLE schedule_exceptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "schedule_exceptions_tenant" ON schedule_exceptions
  USING (etablissement_id = current_etablissement_id());

-- ============================================
-- TABLE : schedule_validations (validation présence enseignant)
-- ============================================

CREATE TABLE schedule_validations (
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

ALTER TABLE schedule_validations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "schedule_validations_tenant" ON schedule_validations
  USING (etablissement_id = current_etablissement_id());
