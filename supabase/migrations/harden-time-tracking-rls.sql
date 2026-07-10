-- ============================================================================
-- Durcissement RLS : temps de presence & validations EDT.
--
-- Avant : une seule policy « tenant » (FOR ALL, USING = meme etablissement) sur
-- staff_time_entries et schedule_validations → n'importe quel membre de
-- l'etablissement (dont un ENSEIGNANT) pouvait creer/supprimer une entree de
-- presence ou une validation AU NOM D'UN AUTRE.
--
-- Apres :
--   - SELECT : reste au niveau etablissement (affichage EDT + module Temps de
--     presence inchanges).
--   - ECRITURE (INSERT/UPDATE/DELETE) :
--       * personnel gestionnaire (admin / direction / responsable_pedagogique /
--         secretaire) : tout, dans son etablissement ;
--       * enseignant : uniquement SA propre presence (profile_id = auth.uid()).
--
-- Rappel : profiles.id = auth.uid() ; staff_time_entries.profile_id /
-- schedule_validations.profile_id referencent profiles(id).
-- get_user_role() NULL (anonyme) → toutes les conditions valent false (deny).
--
-- Idempotent : reexecutable sans erreur.
-- ============================================================================

-- ─── staff_time_entries ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "staff_time_entries_tenant"              ON staff_time_entries;
DROP POLICY IF EXISTS "staff_time_entries_select"             ON staff_time_entries;
DROP POLICY IF EXISTS "staff_time_entries_manage"             ON staff_time_entries;
DROP POLICY IF EXISTS "staff_time_entries_teacher_own_insert" ON staff_time_entries;
DROP POLICY IF EXISTS "staff_time_entries_teacher_own_update" ON staff_time_entries;
DROP POLICY IF EXISTS "staff_time_entries_teacher_own_delete" ON staff_time_entries;

CREATE POLICY "staff_time_entries_select"
  ON staff_time_entries FOR SELECT
  USING (etablissement_id = current_etablissement_id());

CREATE POLICY "staff_time_entries_manage"
  ON staff_time_entries FOR ALL
  USING (
    etablissement_id = current_etablissement_id()
    AND get_user_role() IN ('admin', 'direction', 'responsable_pedagogique', 'secretaire')
  )
  WITH CHECK (
    etablissement_id = current_etablissement_id()
    AND get_user_role() IN ('admin', 'direction', 'responsable_pedagogique', 'secretaire')
  );

CREATE POLICY "staff_time_entries_teacher_own_insert"
  ON staff_time_entries FOR INSERT
  WITH CHECK (
    etablissement_id = current_etablissement_id()
    AND get_user_role() = 'enseignant'
    AND profile_id = auth.uid()
  );

CREATE POLICY "staff_time_entries_teacher_own_update"
  ON staff_time_entries FOR UPDATE
  USING (
    etablissement_id = current_etablissement_id()
    AND get_user_role() = 'enseignant'
    AND profile_id = auth.uid()
  )
  WITH CHECK (
    etablissement_id = current_etablissement_id()
    AND get_user_role() = 'enseignant'
    AND profile_id = auth.uid()
  );

CREATE POLICY "staff_time_entries_teacher_own_delete"
  ON staff_time_entries FOR DELETE
  USING (
    etablissement_id = current_etablissement_id()
    AND get_user_role() = 'enseignant'
    AND profile_id = auth.uid()
  );

-- ─── schedule_validations (pas d'UPDATE : insert / delete uniquement) ────────
DROP POLICY IF EXISTS "schedule_validations_tenant"              ON schedule_validations;
DROP POLICY IF EXISTS "schedule_validations_select"             ON schedule_validations;
DROP POLICY IF EXISTS "schedule_validations_manage"             ON schedule_validations;
DROP POLICY IF EXISTS "schedule_validations_teacher_own_insert" ON schedule_validations;
DROP POLICY IF EXISTS "schedule_validations_teacher_own_delete" ON schedule_validations;

CREATE POLICY "schedule_validations_select"
  ON schedule_validations FOR SELECT
  USING (etablissement_id = current_etablissement_id());

CREATE POLICY "schedule_validations_manage"
  ON schedule_validations FOR ALL
  USING (
    etablissement_id = current_etablissement_id()
    AND get_user_role() IN ('admin', 'direction', 'responsable_pedagogique', 'secretaire')
  )
  WITH CHECK (
    etablissement_id = current_etablissement_id()
    AND get_user_role() IN ('admin', 'direction', 'responsable_pedagogique', 'secretaire')
  );

CREATE POLICY "schedule_validations_teacher_own_insert"
  ON schedule_validations FOR INSERT
  WITH CHECK (
    etablissement_id = current_etablissement_id()
    AND get_user_role() = 'enseignant'
    AND profile_id = auth.uid()
  );

CREATE POLICY "schedule_validations_teacher_own_delete"
  ON schedule_validations FOR DELETE
  USING (
    etablissement_id = current_etablissement_id()
    AND get_user_role() = 'enseignant'
    AND profile_id = auth.uid()
  );
