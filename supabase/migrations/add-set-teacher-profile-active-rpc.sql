-- Migration : RPC de synchronisation de l'état actif/inactif du compte de connexion
-- d'un enseignant avec sa fiche.
--
-- La RLS de `profiles` n'autorise l'UPDATE que sur son propre profil ; on passe donc
-- par une fonction SECURITY DEFINER, gardée par le rôle, appelée avec le client SESSION
-- (le trigger d'audit capte alors auth.uid()).
CREATE OR REPLACE FUNCTION public.set_teacher_profile_active(
  p_teacher_id uuid,
  p_active     boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- coalesce : un rôle NULL (appelant anonyme / sans profil) doit être refusé.
  -- Sans cela, `NULL NOT IN (...)` vaut NULL → la garde ne se déclencherait pas.
  IF coalesce(get_user_role(), '') NOT IN ('admin', 'direction') THEN
    RAISE EXCEPTION 'Permission refusée : rôle insuffisant.';
  END IF;

  UPDATE public.profiles p
  SET is_active = p_active,
      updated_at = now()
  FROM public.teachers t
  WHERE t.id = p_teacher_id
    AND p.id = t.user_id;
END;
$$;
