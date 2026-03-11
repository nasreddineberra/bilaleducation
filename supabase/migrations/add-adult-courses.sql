-- Migration : cours adultes
-- 1. Colonne is_adult sur cotisation_types
-- 2. Table parent_class_enrollments pour les inscriptions adultes

ALTER TABLE cotisation_types
  ADD COLUMN IF NOT EXISTS is_adult boolean NOT NULL DEFAULT false;

-- Table d'inscription des parents (tuteurs) aux cours adultes
CREATE TABLE IF NOT EXISTS parent_class_enrollments (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  etablissement_id uuid        NOT NULL REFERENCES etablissements(id) ON DELETE CASCADE,
  parent_id        uuid        NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  class_id         uuid        NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  tutor_number     smallint    NOT NULL CHECK (tutor_number IN (1, 2)),
  enrollment_date  date        NOT NULL DEFAULT CURRENT_DATE,
  status           text        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'withdrawn')),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (parent_id, class_id, tutor_number)
);

ALTER TABLE parent_class_enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "parent_class_enrollments_tenant" ON parent_class_enrollments
  USING  (etablissement_id = current_etablissement_id())
  WITH CHECK (etablissement_id = current_etablissement_id());

CREATE TRIGGER set_etablissement_id_parent_class_enrollments
  BEFORE INSERT ON parent_class_enrollments
  FOR EACH ROW EXECUTE FUNCTION set_etablissement_id();
