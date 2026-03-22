-- ============================================
-- TABLE : audit_logs
-- ============================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  etablissement_id   uuid NOT NULL REFERENCES etablissements(id) ON DELETE CASCADE,
  user_id            uuid REFERENCES profiles(id) ON DELETE SET NULL,
  user_email         text,
  user_name          text,
  entity_type        text NOT NULL,
  entity_id          uuid,
  action             text NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT')),
  old_data           jsonb,
  new_data           jsonb,
  created_at         timestamptz NOT NULL DEFAULT now()
);

-- Index
CREATE INDEX idx_audit_logs_user_created ON audit_logs (user_id, created_at DESC);
CREATE INDEX idx_audit_logs_etablissement_created ON audit_logs (etablissement_id, created_at DESC);
CREATE INDEX idx_audit_logs_entity_type ON audit_logs (entity_type);

-- RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_logs_select" ON audit_logs
  FOR SELECT USING (
    etablissement_id = current_etablissement_id()
    AND get_user_role() IN ('admin', 'direction')
  );

CREATE POLICY "audit_logs_insert" ON audit_logs
  FOR INSERT WITH CHECK (true);

-- ============================================
-- TRIGGER FUNCTION : enregistrement automatique
-- ============================================

CREATE OR REPLACE FUNCTION fn_audit_log()
RETURNS TRIGGER AS $$
DECLARE
  v_action    text;
  v_entity_id uuid;
  v_old       jsonb;
  v_new       jsonb;
  v_user_id   uuid;
  v_email     text;
  v_name      text;
  v_etab_id   uuid;
BEGIN
  v_user_id := auth.uid();

  -- Snapshot infos utilisateur
  SELECT email, last_name || ' ' || first_name, etablissement_id
    INTO v_email, v_name, v_etab_id
    FROM profiles WHERE id = v_user_id;

  IF TG_OP = 'INSERT' THEN
    v_action    := 'INSERT';
    v_entity_id := NEW.id;
    v_old       := NULL;
    v_new       := to_jsonb(NEW);
    v_etab_id   := COALESCE(v_etab_id, (to_jsonb(NEW)->>'etablissement_id')::uuid);
  ELSIF TG_OP = 'UPDATE' THEN
    v_action    := 'UPDATE';
    v_entity_id := NEW.id;
    v_old       := to_jsonb(OLD);
    v_new       := to_jsonb(NEW);
    v_etab_id   := COALESCE(v_etab_id, (to_jsonb(NEW)->>'etablissement_id')::uuid);
  ELSIF TG_OP = 'DELETE' THEN
    v_action    := 'DELETE';
    v_entity_id := OLD.id;
    v_old       := to_jsonb(OLD);
    v_new       := NULL;
    v_etab_id   := COALESCE(v_etab_id, (to_jsonb(OLD)->>'etablissement_id')::uuid);
  END IF;

  INSERT INTO audit_logs (etablissement_id, user_id, user_email, user_name, entity_type, entity_id, action, old_data, new_data)
  VALUES (v_etab_id, v_user_id, v_email, v_name, TG_TABLE_NAME, v_entity_id, v_action, v_old, v_new);

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- TRIGGERS sur les tables principales
-- ============================================

CREATE TRIGGER audit_students
  AFTER INSERT OR UPDATE OR DELETE ON students
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

CREATE TRIGGER audit_parents
  AFTER INSERT OR UPDATE OR DELETE ON parents
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

CREATE TRIGGER audit_teachers
  AFTER INSERT OR UPDATE OR DELETE ON teachers
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

CREATE TRIGGER audit_classes
  AFTER INSERT OR UPDATE OR DELETE ON classes
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

CREATE TRIGGER audit_enrollments
  AFTER INSERT OR UPDATE OR DELETE ON enrollments
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

CREATE TRIGGER audit_evaluations
  AFTER INSERT OR UPDATE OR DELETE ON evaluations
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

CREATE TRIGGER audit_grades
  AFTER INSERT OR UPDATE OR DELETE ON grades
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

CREATE TRIGGER audit_absences
  AFTER INSERT OR UPDATE OR DELETE ON absences
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

CREATE TRIGGER audit_profiles
  AFTER INSERT OR UPDATE OR DELETE ON profiles
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

-- ============================================
-- PURGE AUTOMATIQUE : suppression > 1 mois
-- Pour activer : Dashboard Supabase > Database > Extensions > activer pg_cron
-- Puis executer :
--
-- SELECT cron.schedule(
--   'purge-audit-logs',
--   '0 3 * * *',
--   $$DELETE FROM audit_logs WHERE created_at < now() - interval '1 month'$$
-- );
--
-- En attendant, purge manuelle :
-- DELETE FROM audit_logs WHERE created_at < now() - interval '1 month';
-- ============================================
