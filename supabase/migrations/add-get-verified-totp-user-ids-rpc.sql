-- ============================================================================
-- BILAL EDUCATION — Statut 2FA visible côté admin
-- ----------------------------------------------------------------------------
-- Les facteurs 2FA vivent dans auth.mfa_factors (schéma auth, service-role only).
-- RPC SECURITY DEFINER, gardée admin/direction, qui renvoie les user_id ayant un
-- TOTP vérifié → l'espace Utilisateurs peut afficher un indicateur « 2FA activée ».
-- Idempotent. À exécuter dans Supabase SQL Editor.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_verified_totp_user_ids()
RETURNS TABLE (user_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF coalesce(get_user_role(), '') NOT IN ('admin', 'direction') THEN
    RAISE EXCEPTION 'Acces refuse';
  END IF;

  RETURN QUERY
    SELECT f.user_id
    FROM auth.mfa_factors f
    WHERE f.factor_type = 'totp'
      AND f.status = 'verified';
END;
$$;

NOTIFY pgrst, 'reload schema';

SELECT 'RPC get_verified_totp_user_ids creee (statut 2FA visible admin).' AS status;
