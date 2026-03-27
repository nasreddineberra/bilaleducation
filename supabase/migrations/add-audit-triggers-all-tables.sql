-- ============================================
-- AUDIT TRIGGERS : toutes les tables manquantes
-- Prerequis : fn_audit_log() deja creee (create-audit-logs.sql)
-- ============================================

-- ---- ANNEE SCOLAIRE ----
CREATE TRIGGER audit_school_years
  AFTER INSERT OR UPDATE OR DELETE ON school_years
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

-- ---- ETABLISSEMENT ----
CREATE TRIGGER audit_etablissements
  AFTER INSERT OR UPDATE OR DELETE ON etablissements
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

-- ---- COTISATIONS ----
CREATE TRIGGER audit_cotisation_types
  AFTER INSERT OR UPDATE OR DELETE ON cotisation_types
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

-- ---- FINANCE ----
CREATE TRIGGER audit_family_fees
  AFTER INSERT OR UPDATE OR DELETE ON family_fees
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

CREATE TRIGGER audit_fee_adjustments
  AFTER INSERT OR UPDATE OR DELETE ON fee_adjustments
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

CREATE TRIGGER audit_fee_installments
  AFTER INSERT OR UPDATE OR DELETE ON fee_installments
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

CREATE TRIGGER audit_expenses
  AFTER INSERT OR UPDATE OR DELETE ON expenses
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

CREATE TRIGGER audit_other_revenues
  AFTER INSERT OR UPDATE OR DELETE ON other_revenues
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

-- ---- COMMUNICATIONS / ANNONCES ----
CREATE TRIGGER audit_announcements
  AFTER INSERT OR UPDATE OR DELETE ON announcements
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

CREATE TRIGGER audit_announcement_attachments
  AFTER INSERT OR UPDATE OR DELETE ON announcement_attachments
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

-- ---- CAHIER DE TEXTE ----
-- Note : decommenter ces triggers quand les tables seront creees dans Supabase
-- CREATE TRIGGER audit_class_journal
--   AFTER INSERT OR UPDATE OR DELETE ON class_journal
--   FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

-- CREATE TRIGGER audit_homework
--   AFTER INSERT OR UPDATE OR DELETE ON homework
--   FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

-- CREATE TRIGGER audit_homework_status
--   AFTER INSERT OR UPDATE OR DELETE ON homework_status
--   FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

-- ---- RESSOURCES ----
CREATE TRIGGER audit_rooms
  AFTER INSERT OR UPDATE OR DELETE ON rooms
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

CREATE TRIGGER audit_materials
  AFTER INSERT OR UPDATE OR DELETE ON materials
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

-- ---- CURRICULUM / COURS ----
CREATE TRIGGER audit_unites_enseignement
  AFTER INSERT OR UPDATE OR DELETE ON unites_enseignement
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

CREATE TRIGGER audit_cours_modules
  AFTER INSERT OR UPDATE OR DELETE ON cours_modules
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

CREATE TRIGGER audit_cours
  AFTER INSERT OR UPDATE OR DELETE ON cours
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

-- ---- DOCUMENTS ELEVES ----
CREATE TRIGGER audit_student_documents
  AFTER INSERT OR UPDATE OR DELETE ON student_documents
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

CREATE TRIGGER audit_student_warnings
  AFTER INSERT OR UPDATE OR DELETE ON student_warnings
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

CREATE TRIGGER audit_student_warning_attachments
  AFTER INSERT OR UPDATE OR DELETE ON student_warning_attachments
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

-- ---- BULLETINS ----
CREATE TRIGGER audit_bulletin_archives
  AFTER INSERT OR UPDATE OR DELETE ON bulletin_archives
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

-- ---- TEMPS DE PRESENCE / PERSONNEL ----
CREATE TRIGGER audit_staff_time_entries
  AFTER INSERT OR UPDATE OR DELETE ON staff_time_entries
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

CREATE TRIGGER audit_staff_hourly_rates
  AFTER INSERT OR UPDATE OR DELETE ON staff_hourly_rates
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

CREATE TRIGGER audit_schedule_validations
  AFTER INSERT OR UPDATE OR DELETE ON schedule_validations
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

-- ---- AFFECTATION ADULTES ----
CREATE TRIGGER audit_parent_class_enrollments
  AFTER INSERT OR UPDATE OR DELETE ON parent_class_enrollments
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

-- ---- CONFIG DOCUMENTS ----
CREATE TRIGGER audit_document_type_configs
  AFTER INSERT OR UPDATE OR DELETE ON document_type_configs
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

-- ---- CONFIG EVALUATIONS ----
CREATE TRIGGER audit_evaluation_order_config
  AFTER INSERT OR UPDATE OR DELETE ON evaluation_order_config
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();
