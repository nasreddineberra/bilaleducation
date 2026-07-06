-- ============================================================================
-- BILAL EDUCATION — Types de présence rattachés à l'année scolaire
-- Chaque type de présence appartient désormais à un établissement ET une année
-- scolaire. Le même code peut être réutilisé d'une année sur l'autre.
-- Idempotent. À exécuter dans Supabase SQL Editor.
-- ============================================================================

-- 1. Colonne school_year_id (nullable le temps du backfill)
ALTER TABLE presence_types
  ADD COLUMN IF NOT EXISTS school_year_id uuid REFERENCES school_years(id) ON DELETE CASCADE;

-- 2. Backfill : chaque type existant → année EN COURS de son établissement.
--    Fallback : année la plus récente (label desc) si pas d'année courante,
--    afin de ne laisser aucun type orphelin.
UPDATE presence_types pt
SET school_year_id = COALESCE(
  (SELECT sy.id FROM school_years sy
     WHERE sy.etablissement_id = pt.etablissement_id AND sy.is_current
     LIMIT 1),
  (SELECT sy.id FROM school_years sy
     WHERE sy.etablissement_id = pt.etablissement_id
     ORDER BY sy.label DESC
     LIMIT 1)
)
WHERE pt.school_year_id IS NULL;

-- 3. Unicité : (établissement, année, code) — le code peut réexister d'une année à l'autre
ALTER TABLE presence_types DROP CONSTRAINT IF EXISTS presence_types_etablissement_id_code_key;
ALTER TABLE presence_types DROP CONSTRAINT IF EXISTS presence_types_etab_year_code_key;
ALTER TABLE presence_types
  ADD CONSTRAINT presence_types_etab_year_code_key UNIQUE (etablissement_id, school_year_id, code);

-- 4. NOT NULL (après backfill).
--    ⚠️ Échoue volontairement s'il reste des types sans année (établissement sans
--    aucune année scolaire) : signale une incohérence à corriger avant de continuer.
ALTER TABLE presence_types ALTER COLUMN school_year_id SET NOT NULL;

-- 5. Index de filtrage par année
CREATE INDEX IF NOT EXISTS idx_presence_types_year ON presence_types (etablissement_id, school_year_id);

-- Recharge le cache de schéma PostgREST
NOTIFY pgrst, 'reload schema';

SELECT 'presence_types rattachés à school_year_id (établissement + année + code unique).' AS status;
