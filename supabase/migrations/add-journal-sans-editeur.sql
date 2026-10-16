-- ============================================================================
-- JOURNAL D'ACTIVITE : NI LES COMPTES ADMIN, NI L'EDITEUR (16 octobre 2026)
--
-- Decision utilisateur : le role `admin` et l'editeur (`super_admin`, en
-- intervention de support comme depuis sa console) ne laissent AUCUNE trace
-- dans le journal d'une ecole. L'editeur garde son propre historique
-- (`support_interventions`, console > Interventions), non touche ici.
--
-- UNE SEULE REGLE, EN BASE, sur la table du journal elle-meme. Deux chemins y
-- ecrivent — le declencheur generique `fn_audit_log` (38 tables) et `logAudit`
-- cote application — et tout chemin futur passera aussi par cette insertion.
-- Filtrer dans chacun aurait laisse un oubli possible au prochain.
--
-- On renonce a la TRACE, jamais a l'ACTION : `RETURN NULL` dans un BEFORE
-- INSERT abandonne la ligne du journal sans erreur ; l'ecriture observee, elle,
-- est deja faite (elle a declenche `fn_audit_log`) et n'est pas touchee.
--
-- L'auteur est lu dans `user_id`, repli sur `auth.uid()` : les deux chemins
-- renseignent `user_id`, le repli couvre une insertion qui l'oublierait.
--
-- Controle : supabase/controles/10-journal-sans-editeur.sql.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_audit_logs_sans_editeur()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
BEGIN
  IF EXISTS (
    SELECT 1 FROM profiles
     WHERE id = coalesce(NEW.user_id, auth.uid())
       AND role IN ('admin', 'super_admin')
  ) THEN
    RETURN NULL;
  END IF;
  RETURN NEW;
END
$fn$;

REVOKE ALL ON FUNCTION public.fn_audit_logs_sans_editeur() FROM public;
REVOKE ALL ON FUNCTION public.fn_audit_logs_sans_editeur() FROM anon;

DROP TRIGGER IF EXISTS trg_audit_logs_sans_editeur ON public.audit_logs;
CREATE TRIGGER trg_audit_logs_sans_editeur
  BEFORE INSERT ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_logs_sans_editeur();

-- Traces deja ecrites par ces comptes : supprimees (decision utilisateur).
-- Bornee par le role de l'auteur ; au rejeu, il n'en reste aucune.
DELETE FROM public.audit_logs a
 USING public.profiles p
 WHERE p.id = a.user_id
   AND p.role IN ('admin', 'super_admin');

-- Registre des migrations (voir supabase/migrations/README.md).
SELECT enregistrer_migration('add-journal-sans-editeur.sql', 'a176c77a547920367f97ee6657d02e48a03a1fa44b861ca4e5c87d8a4bcc7572');
