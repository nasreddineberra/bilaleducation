-- Migration : staff_hourly_rates + staff_time_entries
-- Gestion du temps de presence du personnel

-- ============================================
-- TABLE : staff_hourly_rates (taux horaires par annee scolaire)
-- ============================================

CREATE TABLE IF NOT EXISTS staff_hourly_rates (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  etablissement_id   uuid NOT NULL REFERENCES etablissements(id) ON DELETE CASCADE,
  school_year_id     uuid NOT NULL REFERENCES school_years(id) ON DELETE CASCADE,
  rate_cours         numeric(10,2) NOT NULL DEFAULT 0,
  rate_activite      numeric(10,2) NOT NULL DEFAULT 0,
  rate_menage        numeric(10,2) NOT NULL DEFAULT 0,
  created_by         uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),

  UNIQUE (etablissement_id, school_year_id)
);

CREATE TRIGGER update_staff_hourly_rates_updated_at
  BEFORE UPDATE ON staff_hourly_rates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER staff_hourly_rates_auto_etablissement
  BEFORE INSERT ON staff_hourly_rates FOR EACH ROW EXECUTE FUNCTION set_etablissement_id();

ALTER TABLE staff_hourly_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff_hourly_rates_tenant" ON staff_hourly_rates
  USING (etablissement_id = current_etablissement_id());

-- ============================================
-- TABLE : staff_time_entries (saisies de temps)
-- ============================================

CREATE TABLE IF NOT EXISTS staff_time_entries (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  etablissement_id      uuid NOT NULL REFERENCES etablissements(id) ON DELETE CASCADE,
  profile_id            uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  entry_date            date NOT NULL,
  entry_type            text NOT NULL CHECK (entry_type IN ('cours', 'activite', 'menage', 'absence')),
  start_time            time,
  end_time              time,
  duration_minutes      int NOT NULL DEFAULT 0,
  is_replacement        boolean NOT NULL DEFAULT false,
  replaced_profile_id   uuid REFERENCES profiles(id) ON DELETE SET NULL,
  absence_reason        text,
  notes                 text,
  recorded_by           uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_staff_time_entries_profile ON staff_time_entries (profile_id, entry_date);
CREATE INDEX idx_staff_time_entries_date    ON staff_time_entries (etablissement_id, entry_date);

CREATE TRIGGER update_staff_time_entries_updated_at
  BEFORE UPDATE ON staff_time_entries FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER staff_time_entries_auto_etablissement
  BEFORE INSERT ON staff_time_entries FOR EACH ROW EXECUTE FUNCTION set_etablissement_id();

ALTER TABLE staff_time_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff_time_entries_tenant" ON staff_time_entries
  USING (etablissement_id = current_etablissement_id());
