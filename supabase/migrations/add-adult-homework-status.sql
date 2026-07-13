-- ============================================================================
-- Suivi vu/effectué des devoirs pour les CLASSES ADULTES.
-- Les participants d'un cours adulte sont des tuteurs (parent_class_enrollments),
-- pas des élèves → homework_status (FK students) ne convient pas. Table parallèle
-- clé (homework_id, parent_id, tutor_number), calquée sur homework_status.
-- Idempotent.
-- ============================================================================

CREATE TABLE IF NOT EXISTS adult_homework_status (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  homework_id  uuid NOT NULL REFERENCES homework(id) ON DELETE CASCADE,
  parent_id    uuid NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  tutor_number smallint NOT NULL CHECK (tutor_number = ANY (ARRAY[1, 2])),
  is_seen      boolean NOT NULL DEFAULT false,
  seen_at      timestamptz,
  is_done      boolean NOT NULL DEFAULT false,
  done_at      timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (homework_id, parent_id, tutor_number)
);

CREATE INDEX IF NOT EXISTS idx_adult_hwstatus_homework ON adult_homework_status(homework_id);
CREATE INDEX IF NOT EXISTS idx_adult_hwstatus_parent   ON adult_homework_status(parent_id);

ALTER TABLE adult_homework_status ENABLE ROW LEVEL SECURITY;

-- Participant (tuteur adulte) : CRUD sur ses propres lignes.
DROP POLICY IF EXISTS "adult_hwstatus_participant" ON adult_homework_status;
CREATE POLICY "adult_hwstatus_participant" ON adult_homework_status
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM parents p WHERE p.id = adult_homework_status.parent_id
      AND ((adult_homework_status.tutor_number = 1 AND p.tutor1_user_id = auth.uid())
        OR (adult_homework_status.tutor_number = 2 AND p.tutor2_user_id = auth.uid())))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM parents p WHERE p.id = adult_homework_status.parent_id
      AND ((adult_homework_status.tutor_number = 1 AND p.tutor1_user_id = auth.uid())
        OR (adult_homework_status.tutor_number = 2 AND p.tutor2_user_id = auth.uid())))
  );

-- Enseignant affecté à la classe (fenêtre de préparation 7 j) : lecture.
DROP POLICY IF EXISTS "adult_hwstatus_teacher_select" ON adult_homework_status;
CREATE POLICY "adult_hwstatus_teacher_select" ON adult_homework_status
  FOR SELECT USING (
    homework_id IN (
      SELECT h.id FROM homework h WHERE h.class_id IN (
        SELECT ct.class_id FROM class_teachers ct
        JOIN teachers t ON t.id = ct.teacher_id
        WHERE t.user_id = auth.uid()
          AND (ct.effective_from  IS NULL OR ct.effective_from - INTERVAL '7 days' <= CURRENT_DATE)
          AND (ct.effective_until IS NULL OR ct.effective_until >= CURRENT_DATE)
      )
    )
  );

-- Staff (admin / direction / resp. pédagogique) : lecture sur l'établissement.
DROP POLICY IF EXISTS "adult_hwstatus_staff_select" ON adult_homework_status;
CREATE POLICY "adult_hwstatus_staff_select" ON adult_homework_status
  FOR SELECT USING (
    homework_id IN (
      SELECT h.id FROM homework h WHERE h.etablissement_id IN (
        SELECT etablissement_id FROM profiles WHERE id = auth.uid()
          AND role IN ('admin', 'direction', 'responsable_pedagogique')
      )
    )
  );
