-- ============================================================================
-- Cahier de texte numérique : Journal de séance + Devoirs + Suivi parent
-- ============================================================================

-- Journal de séance : ce qui a été fait en classe
CREATE TABLE IF NOT EXISTS class_journal (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  etablissement_id UUID NOT NULL REFERENCES etablissements(id) ON DELETE CASCADE,
  class_id         UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  teacher_id       UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  subject          TEXT,  -- NULL pour prof principal (séance générale)
  session_date     DATE NOT NULL,
  title            TEXT NOT NULL,
  content_html     TEXT NOT NULL DEFAULT '',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_class_journal_class ON class_journal(class_id, session_date DESC);
CREATE INDEX IF NOT EXISTS idx_class_journal_etab ON class_journal(etablissement_id);
CREATE INDEX IF NOT EXISTS idx_class_journal_teacher ON class_journal(teacher_id);

-- Devoirs assignés
CREATE TABLE IF NOT EXISTS homework (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  etablissement_id UUID NOT NULL REFERENCES etablissements(id) ON DELETE CASCADE,
  class_id         UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  teacher_id       UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  subject          TEXT NOT NULL,
  journal_entry_id UUID REFERENCES class_journal(id) ON DELETE SET NULL,
  title            TEXT NOT NULL,
  description_html TEXT NOT NULL DEFAULT '',
  homework_type    TEXT NOT NULL CHECK (homework_type IN ('exercice', 'lecon', 'expose', 'autre')),
  due_date         DATE NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_homework_class ON homework(class_id, due_date);
CREATE INDEX IF NOT EXISTS idx_homework_due ON homework(due_date);
CREATE INDEX IF NOT EXISTS idx_homework_etab ON homework(etablissement_id);

-- Suivi parent par élève (vu / effectué)
CREATE TABLE IF NOT EXISTS homework_status (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  homework_id  UUID NOT NULL REFERENCES homework(id) ON DELETE CASCADE,
  student_id   UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  parent_id    UUID NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  is_seen      BOOLEAN NOT NULL DEFAULT false,
  seen_at      TIMESTAMPTZ,
  is_done      BOOLEAN NOT NULL DEFAULT false,
  done_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(homework_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_homework_status_homework ON homework_status(homework_id);
CREATE INDEX IF NOT EXISTS idx_homework_status_parent ON homework_status(parent_id);

-- ============================================================================
-- RLS : class_journal
-- ============================================================================
ALTER TABLE class_journal ENABLE ROW LEVEL SECURITY;

-- Enseignant : CRUD sur ses propres entrées
CREATE POLICY "journal_teacher_select" ON class_journal
  FOR SELECT USING (
    teacher_id IN (SELECT id FROM teachers WHERE user_id = auth.uid())
  );
CREATE POLICY "journal_teacher_insert" ON class_journal
  FOR INSERT WITH CHECK (
    teacher_id IN (SELECT id FROM teachers WHERE user_id = auth.uid())
  );
CREATE POLICY "journal_teacher_update" ON class_journal
  FOR UPDATE USING (
    teacher_id IN (SELECT id FROM teachers WHERE user_id = auth.uid())
  );
CREATE POLICY "journal_teacher_delete" ON class_journal
  FOR DELETE USING (
    teacher_id IN (SELECT id FROM teachers WHERE user_id = auth.uid())
  );

-- Direction / Resp. pédagogique : CRUD sur tout l'établissement
CREATE POLICY "journal_staff_crud" ON class_journal
  FOR ALL USING (
    etablissement_id IN (
      SELECT etablissement_id FROM profiles
      WHERE id = auth.uid() AND role IN ('direction', 'responsable_pedagogique')
    )
  );

-- Admin : lecture seule
CREATE POLICY "journal_admin_select" ON class_journal
  FOR SELECT USING (
    etablissement_id IN (
      SELECT etablissement_id FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Parent : lecture sur les classes de ses enfants
CREATE POLICY "journal_parent_select" ON class_journal
  FOR SELECT USING (
    class_id IN (
      SELECT e.class_id FROM enrollments e
      JOIN students s ON s.id = e.student_id
      JOIN parents p ON p.id = s.parent_id
      WHERE p.user_id = auth.uid() AND e.status = 'active'
    )
  );

-- ============================================================================
-- RLS : homework
-- ============================================================================
ALTER TABLE homework ENABLE ROW LEVEL SECURITY;

-- Enseignant : CRUD sur ses propres devoirs
CREATE POLICY "homework_teacher_select" ON homework
  FOR SELECT USING (
    teacher_id IN (SELECT id FROM teachers WHERE user_id = auth.uid())
  );
CREATE POLICY "homework_teacher_insert" ON homework
  FOR INSERT WITH CHECK (
    teacher_id IN (SELECT id FROM teachers WHERE user_id = auth.uid())
  );
CREATE POLICY "homework_teacher_update" ON homework
  FOR UPDATE USING (
    teacher_id IN (SELECT id FROM teachers WHERE user_id = auth.uid())
  );
CREATE POLICY "homework_teacher_delete" ON homework
  FOR DELETE USING (
    teacher_id IN (SELECT id FROM teachers WHERE user_id = auth.uid())
  );

-- Direction / Resp. pédagogique : CRUD sur tout l'établissement
CREATE POLICY "homework_staff_crud" ON homework
  FOR ALL USING (
    etablissement_id IN (
      SELECT etablissement_id FROM profiles
      WHERE id = auth.uid() AND role IN ('direction', 'responsable_pedagogique')
    )
  );

-- Admin : lecture seule
CREATE POLICY "homework_admin_select" ON homework
  FOR SELECT USING (
    etablissement_id IN (
      SELECT etablissement_id FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Parent : lecture sur les classes de ses enfants
CREATE POLICY "homework_parent_select" ON homework
  FOR SELECT USING (
    class_id IN (
      SELECT e.class_id FROM enrollments e
      JOIN students s ON s.id = e.student_id
      JOIN parents p ON p.id = s.parent_id
      WHERE p.user_id = auth.uid() AND e.status = 'active'
    )
  );

-- ============================================================================
-- RLS : homework_status
-- ============================================================================
ALTER TABLE homework_status ENABLE ROW LEVEL SECURITY;

-- Parent : CRUD sur ses propres enfants
CREATE POLICY "hwstatus_parent_select" ON homework_status
  FOR SELECT USING (
    parent_id IN (SELECT id FROM parents WHERE user_id = auth.uid())
  );
CREATE POLICY "hwstatus_parent_insert" ON homework_status
  FOR INSERT WITH CHECK (
    parent_id IN (SELECT id FROM parents WHERE user_id = auth.uid())
  );
CREATE POLICY "hwstatus_parent_update" ON homework_status
  FOR UPDATE USING (
    parent_id IN (SELECT id FROM parents WHERE user_id = auth.uid())
  );

-- Enseignant : lecture sur les devoirs qu'il a créés
CREATE POLICY "hwstatus_teacher_select" ON homework_status
  FOR SELECT USING (
    homework_id IN (
      SELECT id FROM homework
      WHERE teacher_id IN (SELECT id FROM teachers WHERE user_id = auth.uid())
    )
  );

-- Direction / Resp. pédagogique : lecture sur tout l'établissement
CREATE POLICY "hwstatus_staff_select" ON homework_status
  FOR SELECT USING (
    homework_id IN (
      SELECT id FROM homework
      WHERE etablissement_id IN (
        SELECT etablissement_id FROM profiles
        WHERE id = auth.uid() AND role IN ('direction', 'responsable_pedagogique', 'admin')
      )
    )
  );

-- ============================================================================
-- Mise à jour contrainte notifications pour inclure 'homework'
-- ============================================================================
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('absence', 'retard', 'payment', 'announcement', 'homework'));
