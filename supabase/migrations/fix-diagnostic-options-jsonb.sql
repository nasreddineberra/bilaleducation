-- Étape 1 : changer diagnostic_options de text[] à jsonb
-- (permet de stocker des objets {acronym, comment} au lieu de simples strings)
ALTER TABLE eval_type_configs
  ALTER COLUMN diagnostic_options TYPE jsonb
  USING to_jsonb(diagnostic_options);

-- Étape 2 : réassigner les gabarits orphelins (period_id IS NULL) à la première période
-- de l'année scolaire en cours.
-- Exécuter APRÈS avoir vérifié les IDs en base si besoin.
UPDATE evaluations e
SET period_id = (
  SELECT p.id
  FROM periods p
  JOIN school_years sy ON sy.id = p.school_year_id
  WHERE sy.is_current = true
    AND p.order_index = 1
  LIMIT 1
)
WHERE e.period_id IS NULL
  AND e.cours_id IS NOT NULL;

-- Étape 3 : vérification
SELECT COUNT(*) AS gabarits_sans_periode
FROM evaluations
WHERE period_id IS NULL AND cours_id IS NOT NULL;
