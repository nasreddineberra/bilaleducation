-- ============================================
-- ENRICHISSEMENT AUDIT LOGS
-- 1. Colonne description pour messages lisibles
-- 2. Triggers sur schedule_slots et schedule_exceptions
-- ============================================

-- Colonne description (optionnelle, pour messages humains)
ALTER TABLE audit_logs
  ADD COLUMN IF NOT EXISTS description text;

-- Trigger sur schedule_slots
CREATE TRIGGER audit_schedule_slots
  AFTER INSERT OR UPDATE OR DELETE ON schedule_slots
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

-- Trigger sur schedule_exceptions
CREATE TRIGGER audit_schedule_exceptions
  AFTER INSERT OR UPDATE OR DELETE ON schedule_exceptions
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();
