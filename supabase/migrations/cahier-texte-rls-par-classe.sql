-- ============================================================================
-- Phase B — Cahier de texte : visibilité PAR CLASSE (au lieu de « par auteur »).
--
-- Objectif : un enseignant (titulaire OU remplaçant) voit le journal + les devoirs
-- des classes où il est affecté (via class_teachers + dates d'effet), pas seulement
-- ses propres entrées. Permet à un remplaçant de consulter le cahier de texte de
-- l'enseignant absent.
--
-- Convention « inclus » : effective_until = dernier jour de remplacement.
--   Lecture  : effective_from − 7 jours <= aujourd'hui <= effective_until
--              (fenêtre de préparation : le remplaçant lit 7 j avant sa prise de poste).
--   Écriture : effective_from <= aujourd'hui <= effective_until  (période stricte).
--              L'auteur reste l'enseignant connecté (teacher_id = le sien).
--
-- Idempotent (DROP POLICY IF EXISTS avant CREATE).
-- ============================================================================

-- ─── class_journal ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "journal_teacher_select" ON class_journal;
DROP POLICY IF EXISTS "journal_teacher_insert" ON class_journal;
DROP POLICY IF EXISTS "journal_teacher_update" ON class_journal;
DROP POLICY IF EXISTS "journal_teacher_delete" ON class_journal;

-- Lecture : classes où je suis affecté (fenêtre de préparation 7 j avant le début).
CREATE POLICY "journal_teacher_select" ON class_journal
  FOR SELECT USING (
    class_id IN (
      SELECT ct.class_id FROM class_teachers ct
      JOIN teachers t ON t.id = ct.teacher_id
      WHERE t.user_id = auth.uid()
        AND (ct.effective_from  IS NULL OR ct.effective_from - INTERVAL '7 days' <= CURRENT_DATE)
        AND (ct.effective_until IS NULL OR ct.effective_until >= CURRENT_DATE)
    )
  );

-- Écriture : uniquement mes propres entrées, sur une classe où je suis affecté
-- pendant la période stricte.
CREATE POLICY "journal_teacher_insert" ON class_journal
  FOR INSERT WITH CHECK (
    teacher_id IN (SELECT id FROM teachers WHERE user_id = auth.uid())
    AND class_id IN (
      SELECT ct.class_id FROM class_teachers ct
      JOIN teachers t ON t.id = ct.teacher_id
      WHERE t.user_id = auth.uid()
        AND (ct.effective_from  IS NULL OR ct.effective_from  <= CURRENT_DATE)
        AND (ct.effective_until IS NULL OR ct.effective_until >= CURRENT_DATE)
    )
  );
CREATE POLICY "journal_teacher_update" ON class_journal
  FOR UPDATE USING (
    teacher_id IN (SELECT id FROM teachers WHERE user_id = auth.uid())
  );
CREATE POLICY "journal_teacher_delete" ON class_journal
  FOR DELETE USING (
    teacher_id IN (SELECT id FROM teachers WHERE user_id = auth.uid())
  );

-- ─── homework ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "homework_teacher_select" ON homework;
DROP POLICY IF EXISTS "homework_teacher_insert" ON homework;
DROP POLICY IF EXISTS "homework_teacher_update" ON homework;
DROP POLICY IF EXISTS "homework_teacher_delete" ON homework;

CREATE POLICY "homework_teacher_select" ON homework
  FOR SELECT USING (
    class_id IN (
      SELECT ct.class_id FROM class_teachers ct
      JOIN teachers t ON t.id = ct.teacher_id
      WHERE t.user_id = auth.uid()
        AND (ct.effective_from  IS NULL OR ct.effective_from - INTERVAL '7 days' <= CURRENT_DATE)
        AND (ct.effective_until IS NULL OR ct.effective_until >= CURRENT_DATE)
    )
  );
CREATE POLICY "homework_teacher_insert" ON homework
  FOR INSERT WITH CHECK (
    teacher_id IN (SELECT id FROM teachers WHERE user_id = auth.uid())
    AND class_id IN (
      SELECT ct.class_id FROM class_teachers ct
      JOIN teachers t ON t.id = ct.teacher_id
      WHERE t.user_id = auth.uid()
        AND (ct.effective_from  IS NULL OR ct.effective_from  <= CURRENT_DATE)
        AND (ct.effective_until IS NULL OR ct.effective_until >= CURRENT_DATE)
    )
  );
CREATE POLICY "homework_teacher_update" ON homework
  FOR UPDATE USING (
    teacher_id IN (SELECT id FROM teachers WHERE user_id = auth.uid())
  );
CREATE POLICY "homework_teacher_delete" ON homework
  FOR DELETE USING (
    teacher_id IN (SELECT id FROM teachers WHERE user_id = auth.uid())
  );

-- ─── homework_status (suivi parent) ─────────────────────────────────────────
-- L'enseignant affecté à la classe voit le suivi des devoirs de cette classe
-- (fenêtre de préparation identique).
DROP POLICY IF EXISTS "hwstatus_teacher_select" ON homework_status;
CREATE POLICY "hwstatus_teacher_select" ON homework_status
  FOR SELECT USING (
    homework_id IN (
      SELECT h.id FROM homework h
      WHERE h.class_id IN (
        SELECT ct.class_id FROM class_teachers ct
        JOIN teachers t ON t.id = ct.teacher_id
        WHERE t.user_id = auth.uid()
          AND (ct.effective_from  IS NULL OR ct.effective_from - INTERVAL '7 days' <= CURRENT_DATE)
          AND (ct.effective_until IS NULL OR ct.effective_until >= CURRENT_DATE)
      )
    )
  );

-- ─── Alignement « admin = direction » sur les policies staff (CRUD complet) ──
-- (staff_crud n'incluait que direction + resp. pédagogique → admin ne pouvait pas
--  créer/modifier. Règle projet : admin a les droits de direction.)
DROP POLICY IF EXISTS "journal_staff_crud" ON class_journal;
CREATE POLICY "journal_staff_crud" ON class_journal
  FOR ALL USING (
    etablissement_id IN (
      SELECT etablissement_id FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'direction', 'responsable_pedagogique')
    )
  );

DROP POLICY IF EXISTS "homework_staff_crud" ON homework;
CREATE POLICY "homework_staff_crud" ON homework
  FOR ALL USING (
    etablissement_id IN (
      SELECT etablissement_id FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'direction', 'responsable_pedagogique')
    )
  );

-- Les policies admin_select / parent_select restent inchangées (elles s'ajoutent en OR).

