-- Migration : cotisation_types + classes.cotisation_type_id
-- Types de scolarité (maternelle, primaire, secondaire, adulte…)
-- avec cotisation annuelle, frais de dossier, réduction fratrie,
-- et nombre max d'échéances par établissement/année.

-- 1. Table cotisation_types
CREATE TABLE IF NOT EXISTS cotisation_types (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  etablissement_id   uuid NOT NULL REFERENCES etablissements(id) ON DELETE CASCADE,
  school_year_id     uuid NOT NULL REFERENCES school_years(id) ON DELETE CASCADE,
  label              text NOT NULL,
  amount             numeric(10,2) NOT NULL DEFAULT 0,       -- cotisation annuelle
  registration_fee   numeric(10,2) NOT NULL DEFAULT 0,       -- frais de dossier
  sibling_discount   numeric(10,2) NOT NULL DEFAULT 0,       -- réduction fratrie (par enfant supplémentaire)
  max_installments   int  NOT NULL DEFAULT 1,
  order_index        int  NOT NULL DEFAULT 0,
  created_at         timestamptz NOT NULL DEFAULT now(),

  -- Pas deux types avec le même nom pour la même année
  UNIQUE (etablissement_id, school_year_id, label)
);

-- Index pour les requêtes filtrées par année
CREATE INDEX IF NOT EXISTS idx_cotisation_types_year
  ON cotisation_types (etablissement_id, school_year_id);

-- RLS (même pattern que classes, parents, etc.)
ALTER TABLE cotisation_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cotisation_types_tenant" ON cotisation_types
  USING (etablissement_id = current_etablissement_id());

-- Trigger auto-remplissage etablissement_id
CREATE TRIGGER cotisation_types_auto_etablissement
  BEFORE INSERT ON cotisation_types
  FOR EACH ROW EXECUTE FUNCTION set_etablissement_id();

-- 2. Colonne FK sur classes
ALTER TABLE classes
  ADD COLUMN IF NOT EXISTS cotisation_type_id uuid REFERENCES cotisation_types(id) ON DELETE SET NULL;
