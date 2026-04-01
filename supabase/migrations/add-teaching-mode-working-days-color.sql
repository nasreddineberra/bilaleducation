-- ============================================================
-- Migration : teaching_mode, working_days, couleur matiere
-- A executer dans Supabase SQL Editor
-- ============================================================

-- 1. Mode d'enseignement par classe (single = primaire, multi = secondaire)
ALTER TABLE classes ADD COLUMN IF NOT EXISTS teaching_mode TEXT NOT NULL DEFAULT 'single'
  CHECK (teaching_mode IN ('single', 'multi'));

-- 2. Jours travailles par etablissement (5 = lun-ven, 7 = lun-dim)
ALTER TABLE etablissements ADD COLUMN IF NOT EXISTS working_days INTEGER NOT NULL DEFAULT 5
  CHECK (working_days IN (5, 7));

-- 3. Couleur par matiere (referentiel UE)
ALTER TABLE unites_enseignement ADD COLUMN IF NOT EXISTS color TEXT DEFAULT NULL;
