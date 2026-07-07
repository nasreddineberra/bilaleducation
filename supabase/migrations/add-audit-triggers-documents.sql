-- ============================================================================
-- BILAL EDUCATION — Audit des documents (enseignant + élève)
-- ----------------------------------------------------------------------------
-- Les tables *_documents n'avaient pas de trigger d'audit → les ajouts /
-- suppressions de documents n'apparaissaient pas dans le journal d'activité.
-- Les documents sont écrits côté client (session utilisateur), donc auth.uid()
-- est présent : le trigger fn_audit_log() renseignera bien l'utilisateur.
-- Idempotent. À exécuter dans Supabase SQL Editor.
-- ============================================================================

DROP TRIGGER IF EXISTS audit_teacher_documents ON teacher_documents;
CREATE TRIGGER audit_teacher_documents
  AFTER INSERT OR UPDATE OR DELETE ON teacher_documents
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

DROP TRIGGER IF EXISTS audit_student_documents ON student_documents;
CREATE TRIGGER audit_student_documents
  AFTER INSERT OR UPDATE OR DELETE ON student_documents
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

SELECT 'Triggers d''audit ajoutes sur teacher_documents et student_documents.' AS status;
