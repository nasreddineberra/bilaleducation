-- Migration : family_fees, fee_adjustments, fee_installments
-- Gestion des financements par famille / année scolaire

-- ============================================
-- TABLE : family_fees (frais par famille/année)
-- ============================================

CREATE TABLE IF NOT EXISTS family_fees (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  etablissement_id   uuid NOT NULL REFERENCES etablissements(id) ON DELETE CASCADE,
  parent_id          uuid NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  school_year_id     uuid NOT NULL REFERENCES school_years(id) ON DELETE CASCADE,
  subtotal           numeric(10,2) NOT NULL DEFAULT 0,       -- somme brute (cotisations + frais - fratrie)
  adjustments_total  numeric(10,2) NOT NULL DEFAULT 0,       -- somme des réductions/avoirs
  total_due          numeric(10,2) NOT NULL DEFAULT 0,       -- subtotal + adjustments_total
  num_installments   int NOT NULL DEFAULT 1,
  status             text NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'partial', 'paid', 'overdue')),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),

  UNIQUE (parent_id, school_year_id)
);

CREATE INDEX IF NOT EXISTS idx_family_fees_parent ON family_fees (parent_id);
CREATE INDEX IF NOT EXISTS idx_family_fees_year   ON family_fees (etablissement_id, school_year_id);

CREATE TRIGGER update_family_fees_updated_at
  BEFORE UPDATE ON family_fees FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER family_fees_auto_etablissement
  BEFORE INSERT ON family_fees FOR EACH ROW EXECUTE FUNCTION set_etablissement_id();

ALTER TABLE family_fees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "family_fees_tenant" ON family_fees
  USING (etablissement_id = current_etablissement_id());

-- ============================================
-- TABLE : fee_adjustments (réductions & avoirs)
-- ============================================

CREATE TABLE IF NOT EXISTS fee_adjustments (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  etablissement_id   uuid NOT NULL REFERENCES etablissements(id) ON DELETE CASCADE,
  family_fee_id      uuid NOT NULL REFERENCES family_fees(id) ON DELETE CASCADE,
  adjustment_date    date NOT NULL DEFAULT CURRENT_DATE,
  adjustment_type    text NOT NULL CHECK (adjustment_type IN ('reduction', 'avoir')),
  label              text NOT NULL,
  amount             numeric(10,2) NOT NULL,  -- négatif (ex: -50)
  recorded_by        uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fee_adjustments_family ON fee_adjustments (family_fee_id);

CREATE TRIGGER fee_adjustments_auto_etablissement
  BEFORE INSERT ON fee_adjustments FOR EACH ROW EXECUTE FUNCTION set_etablissement_id();

ALTER TABLE fee_adjustments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fee_adjustments_tenant" ON fee_adjustments
  USING (etablissement_id = current_etablissement_id());

-- ============================================
-- TABLE : fee_installments (échéancier)
-- ============================================

CREATE TABLE IF NOT EXISTS fee_installments (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  etablissement_id    uuid NOT NULL REFERENCES etablissements(id) ON DELETE CASCADE,
  family_fee_id       uuid NOT NULL REFERENCES family_fees(id) ON DELETE CASCADE,
  installment_number  int NOT NULL,
  due_date            date NOT NULL,
  amount_due          numeric(10,2) NOT NULL,
  amount_paid         numeric(10,2) NOT NULL DEFAULT 0,
  paid_date           date,
  payment_method      text CHECK (payment_method IN ('cash', 'check', 'card', 'transfer', 'online')),
  payment_reference   jsonb,       -- {check_number, bank} ou {transaction_id} etc.
  receipt_number      text,
  status              text NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'paid', 'overdue', 'partial')),
  notes               text,
  recorded_by         uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  UNIQUE (family_fee_id, installment_number)
);

CREATE INDEX IF NOT EXISTS idx_fee_installments_family ON fee_installments (family_fee_id);
CREATE INDEX IF NOT EXISTS idx_fee_installments_status ON fee_installments (status);

CREATE TRIGGER update_fee_installments_updated_at
  BEFORE UPDATE ON fee_installments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER fee_installments_auto_etablissement
  BEFORE INSERT ON fee_installments FOR EACH ROW EXECUTE FUNCTION set_etablissement_id();

ALTER TABLE fee_installments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fee_installments_tenant" ON fee_installments
  USING (etablissement_id = current_etablissement_id());
