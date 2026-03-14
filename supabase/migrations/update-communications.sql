-- ============================================
-- Migration : Communications (email + notif)
-- ============================================

-- 1. Adapter la table announcements pour les communications
ALTER TABLE announcements
  ADD COLUMN IF NOT EXISTS body_html       TEXT,
  ADD COLUMN IF NOT EXISTS channel         TEXT DEFAULT 'email' CHECK (channel IN ('email', 'notification', 'both')),
  ADD COLUMN IF NOT EXISTS sender_email    TEXT,
  ADD COLUMN IF NOT EXISTS recipient_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sent_at         TIMESTAMPTZ;

-- Elargir le type d'annonce pour couvrir tous les cas
ALTER TABLE announcements DROP CONSTRAINT IF EXISTS announcements_announcement_type_check;
ALTER TABLE announcements ADD CONSTRAINT announcements_announcement_type_check
  CHECK (announcement_type IN ('all_active', 'all_registered', 'class', 'selected', 'staff'));

-- 2. Ajouter le suivi email dans announcement_recipients
ALTER TABLE announcement_recipients
  ADD COLUMN IF NOT EXISTS email        TEXT,
  ADD COLUMN IF NOT EXISTS email_status TEXT DEFAULT 'pending' CHECK (email_status IN ('pending', 'sent', 'delivered', 'failed')),
  ADD COLUMN IF NOT EXISTS sent_at      TIMESTAMPTZ;

-- 3. Ajouter le suivi email dans announcement_staff_recipients
ALTER TABLE announcement_staff_recipients
  ADD COLUMN IF NOT EXISTS email        TEXT,
  ADD COLUMN IF NOT EXISTS email_status TEXT DEFAULT 'pending' CHECK (email_status IN ('pending', 'sent', 'delivered', 'failed')),
  ADD COLUMN IF NOT EXISTS sent_at      TIMESTAMPTZ;

-- 4. Table des pieces jointes
CREATE TABLE IF NOT EXISTS announcement_attachments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  announcement_id UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  file_url        TEXT NOT NULL,
  file_name       TEXT NOT NULL,
  file_size       INTEGER,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ann_attachments_announcement ON announcement_attachments(announcement_id);

ALTER TABLE announcement_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ann_attachments_tenant" ON announcement_attachments
  USING (announcement_id IN (
    SELECT id FROM announcements WHERE etablissement_id = current_etablissement_id()
  ));

-- ============================================
-- 5. Bucket Storage pour les pieces jointes
-- ============================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('communication-attachments', 'communication-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Lecture publique (PJ accessibles via getPublicUrl)
CREATE POLICY "Communication PJ publiques en lecture"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'communication-attachments');

-- Upload reserve aux utilisateurs authentifies
CREATE POLICY "Communication PJ upload authentifie"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'communication-attachments'
    AND auth.role() = 'authenticated'
  );

-- Suppression par l'auteur uniquement
CREATE POLICY "Communication PJ suppression authentifie"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'communication-attachments'
    AND auth.role() = 'authenticated'
  );
