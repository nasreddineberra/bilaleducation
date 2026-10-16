-- ============================================================================
-- ECOLE DE DEMONSTRATION : COUPER LES SESSIONS D'UN COMPTE (16 octobre 2026)
--
-- Acces prospect : l'editeur donne a un prospect l'usage d'un compte de la
-- demonstration en y mettant son adresse, puis le « Retablit ». Retablir remet
-- l'adresse, le mot de passe et retire la 2FA — mais une session OUVERTE
-- survivrait : son jeton de rafraichissement reste valable. L'API
-- d'authentification ne sait fermer que les sessions de l'appelant lui-meme
-- (`signOut` exige le jeton de la personne), d'ou cette fonction.
--
-- Supprimer la session suffit : `auth.refresh_tokens` est en ON DELETE CASCADE,
-- et `getUser()` (middleware) refuse un jeton dont la session n'existe plus.
--
-- DOUBLE GARDE : service-role uniquement (la console, deja gardee par
-- `requireEditor`), et compte d'une ecole MARQUEE demonstration — jamais un
-- compte d'une vraie ecole, meme sur un identifiant forge.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.demo_couper_sessions(p_user uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  n integer;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Réservé à la console de l''éditeur.' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM profiles p JOIN etablissements e ON e.id = p.etablissement_id
     WHERE p.id = p_user AND e.est_demo
  ) THEN
    RAISE EXCEPTION 'Ce compte n''appartient pas à l''école de démonstration.' USING ERRCODE = '42501';
  END IF;

  DELETE FROM auth.sessions WHERE user_id = p_user;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END
$fn$;

REVOKE ALL ON FUNCTION public.demo_couper_sessions(uuid) FROM public;
REVOKE ALL ON FUNCTION public.demo_couper_sessions(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.demo_couper_sessions(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.demo_couper_sessions(uuid) TO service_role;

-- Registre des migrations (voir supabase/migrations/README.md).
SELECT enregistrer_migration('add-demo-couper-sessions.sql', '988dbdce49b4382744edce26ca229deb41586ad980c4a841c68d5ee46caa895d');
