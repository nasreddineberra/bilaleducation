-- ============================================================================
-- Espace famille, lot 5b : liste des comptes parents (03/11)
--
-- Utilisateurs > Parents (decision 15) : statut de chaque compte (invite le,
-- acces configure, desactive) et DERNIERE CONNEXION, qui ne vit que dans
-- `auth.users`. Fonction SECURITY DEFINER reservee a l'admin et a la direction
-- (ecran Utilisateurs), bornee a l'ecole de l'appelant ; meme principe que
-- `get_verified_totp_user_ids`.
--
-- Additive. Controle : supabase/controles/41-espace-famille-comptes-parents.sql.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.comptes_parents_ecole()
 RETURNS TABLE (profile_id uuid, parent_id uuid, tutor_number smallint, last_name text, first_name text,
                email text, is_active boolean, invite_le timestamptz, configure_le timestamptz,
                invitation_expire_le timestamptz, derniere_connexion timestamptz)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $fn$
BEGIN
  IF coalesce(get_user_role(), '') NOT IN ('admin', 'direction') THEN
    RAISE EXCEPTION 'Acces refuse' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN QUERY
  SELECT pr.id, p.id, t.n, pr.last_name, pr.first_name, pr.email, pr.is_active,
         CASE t.n WHEN 1 THEN p.tutor1_invite_le ELSE p.tutor2_invite_le END,
         CASE t.n WHEN 1 THEN p.tutor1_acces_configure_le ELSE p.tutor2_acces_configure_le END,
         (SELECT max(i.expire_le) FROM invitations_famille i
           WHERE i.parent_id = p.id AND i.tutor_number = t.n AND i.utilise_le IS NULL AND i.annule_le IS NULL),
         u.last_sign_in_at
    FROM parents p
    CROSS JOIN LATERAL (VALUES (1::smallint, p.tutor1_user_id), (2::smallint, p.tutor2_user_id)) AS t(n, uid)
    JOIN profiles pr ON pr.id = t.uid
    LEFT JOIN auth.users u ON u.id = pr.id
   WHERE p.etablissement_id = current_etablissement_id()
   ORDER BY pr.last_name, pr.first_name;
END;
$fn$;

REVOKE ALL ON FUNCTION public.comptes_parents_ecole() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.comptes_parents_ecole() TO authenticated;

DO $verif$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.routine_privileges
              WHERE routine_schema = 'public' AND grantee IN ('anon', 'PUBLIC')
                AND routine_name = 'comptes_parents_ecole') THEN
    RAISE EXCEPTION 'comptes_parents_ecole executable par anon ou PUBLIC';
  END IF;
END
$verif$;
SELECT enregistrer_migration('espace-famille-comptes-parents.sql', '2e062aea279000a8f83f259c83e12db599c059f7ea7a52c51471a62fddf5cc56');
