-- ============================================================================
-- Tracabilite du journal d'activite sur l'ecran Utilisateurs.
--
-- Probleme : createUser / updateProfile / toggleActive ecrivaient dans `profiles`
-- via le client ADMIN (service-role). Le trigger d'audit fn_audit_log() lit
-- auth.uid() : en service-role il n'y a pas de session → user_id NULL → colonne
-- « Utilisateur » vide dans le journal. (Meme bug que celui corrige le 07/07 pour
-- updateTeacher / createTeacherWithAccount / createParentAccount.)
--
-- Pourquoi le service-role etait utilise ici : la RLS de `profiles` n'avait AUCUNE
-- policy UPDATE pour admin/direction (uniquement « Users can update own profile »,
-- auth.uid() = id) → impossible de modifier le profil d'autrui via le client session.
--
-- Correctif : ajouter la policy UPDATE manquante, pour que les server actions
-- puissent ecrire via le client SESSION (et donc que l'acteur soit trace).
--
-- NB : cela n'elargit AUCUN pouvoir — admin/direction pouvaient deja tout modifier
-- via les server actions (gardees par requireRoleServer). On ne fait que deplacer
-- l'application de la regle dans la base. Le trigger anti auto-escalade sur
-- role / is_active / etablissement_id reste actif.
--
-- Rappel INSERT/DELETE : les policies « Admin and direction can insert/delete
-- profiles » existent deja → create_profile_only (SECURITY INVOKER) passe via session.
--
-- Idempotent.
-- ============================================================================

DROP POLICY IF EXISTS "Admin and direction can update profiles" ON profiles;
CREATE POLICY "Admin and direction can update profiles"
  ON profiles FOR UPDATE
  USING (
    coalesce(get_user_role(), '') IN ('admin', 'direction')
    AND etablissement_id = current_etablissement_id()
  )
  WITH CHECK (
    coalesce(get_user_role(), '') IN ('admin', 'direction')
    AND etablissement_id = current_etablissement_id()
  );

SELECT 'profiles : policy UPDATE admin/direction ajoutee (tracabilite du journal).' AS status;
