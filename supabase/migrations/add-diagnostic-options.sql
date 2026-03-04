-- Ajout des options configurables pour l'évaluation diagnostique
-- Par défaut : ['AC', 'EC', 'NA']
ALTER TABLE eval_type_configs
  ADD COLUMN IF NOT EXISTS diagnostic_options text[];
