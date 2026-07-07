-- Migration : suppression complète d'un compte enseignant
-- Permet à `auth.admin.deleteUser()` de nettoyer le profil, tout en préservant
-- les logs d'audit (l'utilisateur y est simplement détaché).
--
-- 1. profiles.id -> auth.users(id) : ON DELETE CASCADE
--    (supprimer l'utilisateur auth supprime automatiquement son profil)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_id_fkey
  FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. audit_logs.user_id -> profiles(id) : ON DELETE SET NULL
--    (on conserve les entrées du journal, l'utilisateur est détaché)
ALTER TABLE public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_user_id_fkey;
ALTER TABLE public.audit_logs
  ADD CONSTRAINT audit_logs_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
