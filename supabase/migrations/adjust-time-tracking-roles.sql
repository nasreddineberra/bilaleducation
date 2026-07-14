-- ============================================================================
-- Ajustement des roles d'ecriture sur staff_time_entries (module Temps de presence).
--
-- Decisions (14/07/2026) :
--   - comptable      : ecriture COMPLETE (comme admin / direction).
--   - responsable_pedagogique : ecriture UNIQUEMENT sur les enseignants (ou soi).
--   - secretaire     : inchange (ecriture complete).
--   - enseignant     : inchange (sa propre presence).
--
-- Rappel : la version precedente (harden-time-tracking-rls.sql) mettait
-- responsable_pedagogique dans le lot « manage » (tout le staff) et n'incluait pas
-- comptable → incoherent avec l'UI. On corrige ici.
--
-- SELECT reste au niveau etablissement (inchange). schedule_validations NON touchee.
-- Idempotent (DROP POLICY IF EXISTS avant CREATE).
-- ============================================================================

-- Gestionnaires « tout le staff » : comptable ajoute, responsable_pedagogique retire.
DROP POLICY IF EXISTS "staff_time_entries_manage" ON staff_time_entries;
CREATE POLICY "staff_time_entries_manage"
  ON staff_time_entries FOR ALL
  USING (
    etablissement_id = current_etablissement_id()
    AND get_user_role() IN ('admin', 'direction', 'comptable', 'secretaire')
  )
  WITH CHECK (
    etablissement_id = current_etablissement_id()
    AND get_user_role() IN ('admin', 'direction', 'comptable', 'secretaire')
  );

-- Responsable pedagogique : ecriture uniquement sur une saisie dont la cible est
-- un enseignant (ou sa propre saisie).
DROP POLICY IF EXISTS "staff_time_entries_resp_pedago" ON staff_time_entries;
CREATE POLICY "staff_time_entries_resp_pedago"
  ON staff_time_entries FOR ALL
  USING (
    etablissement_id = current_etablissement_id()
    AND get_user_role() = 'responsable_pedagogique'
    AND (
      profile_id = auth.uid()
      OR profile_id IN (
        SELECT id FROM profiles
        WHERE role = 'enseignant' AND etablissement_id = current_etablissement_id()
      )
    )
  )
  WITH CHECK (
    etablissement_id = current_etablissement_id()
    AND get_user_role() = 'responsable_pedagogique'
    AND (
      profile_id = auth.uid()
      OR profile_id IN (
        SELECT id FROM profiles
        WHERE role = 'enseignant' AND etablissement_id = current_etablissement_id()
      )
    )
  );

-- Les policies staff_time_entries_select + staff_time_entries_teacher_own_*
-- restent inchangees (definies dans harden-time-tracking-rls.sql).
