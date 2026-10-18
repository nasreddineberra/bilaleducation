-- ============================================================================
-- JOURNAL, REGISTRE DES MIGRATIONS, NOTIFICATIONS (18 octobre 2026)
--
-- 1. `audit_logs_insert` etait en WITH CHECK (true) : tout compte connecte
--    ecrivait une ligne dans le journal de N'IMPORTE QUELLE ecole, au nom de
--    n'importe qui. Une ligne doit desormais porter l'ecole de l'appelant ET
--    son propre identifiant. `logAudit` et les traces de connexion /
--    deconnexion ecrivent deja ces valeurs ; le declencheur `fn_audit_log`
--    (SECURITY DEFINER) n'est pas soumis a la RLS. Le nom et l'email de la
--    ligne restent declaratifs.
--
-- 2. `migrations_appliquees` (registre COMMUN a toutes les ecoles) etait lu
--    par admin / direction et ecrit par l'admin de n'importe quelle ecole.
--    Aucun ecran ne le lit : psql et `enregistrer_migration` (SECURITY
--    DEFINER, garde service) seuls y touchent. Table « serveur uniquement » :
--    RLS sans policy + REVOKE, comme `etablissement_smtp`.
--
-- 3. `notifications_select_staff` ouvrait les notifications des familles a
--    tout compte de l'ecole. Seule lecture staff : le comptage avant
--    suppression d'un foyer (admin / direction). Le parent garde les siennes
--    (`notifications_select_parent`, inchangee).
--
-- Controle : supabase/controles/17-journal-registre-notifications.sql.
-- ============================================================================

-- ── 1. Journal d'activite ──────────────────────────────────────────────────
DROP POLICY IF EXISTS audit_logs_insert ON public.audit_logs;
CREATE POLICY audit_logs_insert ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    etablissement_id = current_etablissement_id()
    AND user_id = auth.uid()
  );

-- ── 2. Registre des migrations ─────────────────────────────────────────────
DROP POLICY IF EXISTS migrations_registre_select ON public.migrations_appliquees;
DROP POLICY IF EXISTS migrations_registre_write  ON public.migrations_appliquees;
ALTER TABLE public.migrations_appliquees ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.migrations_appliquees FROM public;
REVOKE ALL ON public.migrations_appliquees FROM anon;
REVOKE ALL ON public.migrations_appliquees FROM authenticated;

-- ── 3. Notifications des familles ──────────────────────────────────────────
DROP POLICY IF EXISTS notifications_select_staff ON public.notifications;
CREATE POLICY notifications_select_staff ON public.notifications
  FOR SELECT TO authenticated
  USING (etablissement_id = current_etablissement_id()
         AND coalesce(get_user_role(), '') IN ('admin', 'direction'));

-- Registre des migrations (voir supabase/migrations/README.md).
SELECT enregistrer_migration('secure-journal-registre-notifications.sql', '4a1eda1a4879fa40bc9ccbd614fab1c57a2ce2cc0c3e680f4ec7e2b9536d7852');
