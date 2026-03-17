-- ============================================================================
-- Notifications automatiques parents + Push subscriptions
-- ============================================================================

-- Table unifiée des notifications parents
CREATE TABLE IF NOT EXISTS notifications (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  etablissement_id UUID NOT NULL REFERENCES etablissements(id) ON DELETE CASCADE,
  type             TEXT NOT NULL CHECK (type IN ('absence', 'retard', 'payment', 'announcement')),
  parent_id        UUID NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  student_id       UUID REFERENCES students(id) ON DELETE SET NULL,
  title            TEXT NOT NULL,
  body             TEXT NOT NULL,
  metadata         JSONB DEFAULT '{}',
  email_status     TEXT DEFAULT 'pending' CHECK (email_status IN ('pending','sent','failed','skipped')),
  push_status      TEXT DEFAULT 'pending' CHECK (push_status IN ('pending','sent','failed','no_sub')),
  is_read          BOOLEAN DEFAULT FALSE,
  read_at          TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_parent ON notifications(parent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_etablissement ON notifications(etablissement_id);

-- Abonnements push navigateur
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          UUID NOT NULL,
  etablissement_id UUID NOT NULL REFERENCES etablissements(id) ON DELETE CASCADE,
  endpoint         TEXT NOT NULL,
  p256dh           TEXT NOT NULL,
  auth_key         TEXT NOT NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id);

-- RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Parents voient leurs propres notifications
CREATE POLICY "notifications_select_parent" ON notifications
  FOR SELECT USING (
    parent_id IN (SELECT id FROM parents WHERE user_id = auth.uid())
  );

-- Staff voit toutes les notifications de son etablissement
CREATE POLICY "notifications_select_staff" ON notifications
  FOR SELECT USING (
    etablissement_id IN (SELECT etablissement_id FROM profiles WHERE id = auth.uid())
  );

-- Push subscriptions : chaque user gere les siennes
CREATE POLICY "push_own_select" ON push_subscriptions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "push_own_insert" ON push_subscriptions
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "push_own_delete" ON push_subscriptions
  FOR DELETE USING (user_id = auth.uid());
