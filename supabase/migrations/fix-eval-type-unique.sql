-- Autoriser scored /10 ET scored /20 pour la même année scolaire
-- L'ancienne contrainte UNIQUE (school_year_id, eval_type) empêchait deux lignes 'scored'
ALTER TABLE eval_type_configs
  DROP CONSTRAINT IF EXISTS eval_type_configs_school_year_id_eval_type_key;

ALTER TABLE eval_type_configs
  ADD CONSTRAINT eval_type_configs_unique
  UNIQUE (school_year_id, eval_type, max_score);
