-- ============================================================================
-- JOURNAL D'ACTIVITE : NOM ET EMAIL DE L'AUTEUR LUS EN BASE (18 octobre 2026)
--
-- Depuis `secure-journal-registre-notifications.sql`, une ligne du journal
-- porte forcement l'ecole et l'identifiant (`user_id`) de l'appelant. Mais
-- `user_name` et `user_email` restaient des textes envoyes par le navigateur :
-- un compte de l'ecole pouvait, par l'API, ecrire une ligne a son vrai `user_id`
-- en affichant le nom d'un autre.
--
-- Un declencheur BEFORE INSERT les reecrit depuis la fiche `profiles` de
-- `user_id`, au format deja produit par `fn_audit_log` et `logAudit` :
-- « NOM Prenom » et l'email du profil. Sans `user_id` ou sans profil, la ligne
-- est laissee telle quelle. Aucun changement de code.
--
-- `description` reste libre (option 2 ecartee : elle demandait de faire passer
-- toutes les traces manuelles par une fonction serveur).
--
-- Controle : supabase/controles/18-journal-auteur-verifie.sql.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_audit_logs_auteur()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_email text;
  v_name  text;
BEGIN
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT p.email, trim(coalesce(p.last_name, '') || ' ' || coalesce(p.first_name, ''))
    INTO v_email, v_name
    FROM profiles p
   WHERE p.id = NEW.user_id;

  IF FOUND THEN
    NEW.user_email := coalesce(v_email, NEW.user_email);
    NEW.user_name  := v_name;
  END IF;
  RETURN NEW;
END
$fn$;

REVOKE ALL ON FUNCTION public.fn_audit_logs_auteur() FROM public;
REVOKE ALL ON FUNCTION public.fn_audit_logs_auteur() FROM anon;
REVOKE ALL ON FUNCTION public.fn_audit_logs_auteur() FROM authenticated;

DROP TRIGGER IF EXISTS trg_audit_logs_auteur ON public.audit_logs;
CREATE TRIGGER trg_audit_logs_auteur
  BEFORE INSERT ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_logs_auteur();

-- Registre des migrations (voir supabase/migrations/README.md).
SELECT enregistrer_migration('add-journal-auteur-verifie.sql', 'e546b2a80edefc63b909368cbf8ba78f897c8c6a7b68b5046d3bfd5e539e062b');
