-- ============================================================================
-- BILAL EDUCATION — Garde anti auto-escalade sur profiles
-- ----------------------------------------------------------------------------
-- Problème : la policy RLS « Users can update own profile » (USING auth.uid() = id)
-- autorise un utilisateur à modifier N'IMPORTE QUELLE colonne de sa propre ligne,
-- y compris `role`, `is_active`, `etablissement_id`. Un non-admin pouvait donc
-- s'auto-promouvoir admin (get_user_role() pilote la RLS). Escalade de privilèges.
--
-- Correctif : trigger BEFORE UPDATE qui interdit toute modification de ces colonnes
-- protégées, SAUF :
--   - appel service-role (client admin des server actions) ;
--   - utilisateur admin/direction (gestion des comptes).
-- Idempotent. À exécuter dans Supabase SQL Editor.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_guard_profile_sensitive_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Backend de confiance (service-role) ou admin/direction : autorisé
  IF coalesce(auth.jwt() ->> 'role', '') = 'service_role'
     OR coalesce(get_user_role(), '') IN ('admin', 'direction') THEN
    RETURN NEW;
  END IF;

  -- Sinon : les colonnes sensibles ne doivent pas changer
  IF NEW.role             IS DISTINCT FROM OLD.role
     OR NEW.is_active         IS DISTINCT FROM OLD.is_active
     OR NEW.etablissement_id  IS DISTINCT FROM OLD.etablissement_id THEN
    RAISE EXCEPTION 'Modification non autorisee des colonnes protegees du profil (role / is_active / etablissement).';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_profile_sensitive ON public.profiles;
CREATE TRIGGER trg_guard_profile_sensitive
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_guard_profile_sensitive_columns();

NOTIFY pgrst, 'reload schema';

SELECT 'Garde anti auto-escalade posee sur profiles (role / is_active / etablissement_id).' AS status;
