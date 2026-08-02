-- ============================================================================
-- Suppression d'une ligne du journal des communications comptables.
--
-- La table etait volontairement APPEND-ONLY (voir
-- create-financement-communications.sql) : elle atteste qu'une relance est
-- partie ou qu'une attestation a ete delivree. On ouvre la suppression a la
-- demande de l'utilisateur (menage des essais, envoi errone), avec deux gardes :
--
--   1. Reservee aux ROLES FINANCE (admin / direction / comptable), soit le meme
--      perimetre que la lecture et l'ecriture : le comptable gere son journal.
--      La valeur probante repose alors sur audit_logs, pas sur l'immuabilite de
--      la table.
--   2. Cloisonnee par etablissement, comme les policies SELECT/INSERT.
--
-- La suppression elle-meme reste tracee : la server action ecrit un `logAudit`
-- avant de supprimer, donc le journal d'activite garde qui a efface quoi.
--
-- Idempotent.
-- ============================================================================

DROP POLICY IF EXISTS fin_comm_delete ON financement_communications;
CREATE POLICY fin_comm_delete ON financement_communications
  FOR DELETE
  USING (
    etablissement_id = current_etablissement_id()
    AND coalesce(get_user_role(), '') IN ('admin', 'direction', 'comptable')
  );

COMMENT ON TABLE financement_communications IS
  'Journal des communications comptables (relance / attestation) envoyees aux familles. Insertion par les roles finance ; suppression ouverte aux roles finance et tracee dans audit_logs.';

SELECT 'Policy fin_comm_delete creee (suppression ouverte aux roles finance).' AS status;
