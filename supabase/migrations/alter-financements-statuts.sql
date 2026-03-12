-- Migration : modifier les statuts de paiement
-- Retirer 'overdue', ajouter 'overpaid'

-- family_fees
ALTER TABLE family_fees DROP CONSTRAINT IF EXISTS family_fees_status_check;
ALTER TABLE family_fees ADD CONSTRAINT family_fees_status_check
  CHECK (status IN ('pending', 'partial', 'paid', 'overpaid'));

-- fee_installments
ALTER TABLE fee_installments DROP CONSTRAINT IF EXISTS fee_installments_status_check;
ALTER TABLE fee_installments ADD CONSTRAINT fee_installments_status_check
  CHECK (status IN ('pending', 'partial', 'paid', 'overpaid'));
