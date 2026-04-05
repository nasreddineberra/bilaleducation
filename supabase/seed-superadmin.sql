-- ============================================
-- BILAL EDUCATION - Recréation profil super_admin
-- A executer dans Supabase SQL Editor
-- ============================================

-- Desactiver les triggers (audit_logs bloque NULL etablissement_id)
SET session_replication_role = 'replica';

INSERT INTO profiles (id, etablissement_id, email, role, first_name, last_name, is_active)
VALUES (
  'f32d0e90-73d3-45a0-9c30-cedd1bd94e36',
  NULL,
  'superadmin@bilaleducation.fr',
  'super_admin',
  'Nasr-Eddine',
  'BERRA',
  TRUE
)
ON CONFLICT (id) DO UPDATE SET
  email      = EXCLUDED.email,
  role       = EXCLUDED.role,
  first_name = EXCLUDED.first_name,
  last_name  = EXCLUDED.last_name,
  is_active  = TRUE;

-- Reactiver les triggers
SET session_replication_role = 'origin';

SELECT 'Profil super_admin recree avec succes.' AS status;
