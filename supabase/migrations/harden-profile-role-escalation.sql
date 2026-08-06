-- ============================================================================
-- Escalade inter-établissements : un admin d'école pouvait devenir super-admin
--
-- CONSTAT, DÉMONTRÉ ET NON SUPPOSÉ. En prenant l'identité de l'admin d'une école
-- — même rôle base de données et mêmes revendications de jeton que ce que
-- PostgREST fabrique à partir du sien — cette requête aboutissait :
--
--   UPDATE profiles SET role = 'super_admin' WHERE id = <admin de l'école>;
--   → UPDATE 1
--
-- Le garde-fou autorisait `admin` et `direction` à modifier `role`, `is_active`
-- et `etablissement_id` sans restriction. C'était défendable tant que ces
-- colonnes ne servaient qu'à administrer les employés de LEUR école.
--
-- CE QUI A CHANGÉ. Depuis l'accès support, `super_admin` ouvre la console, et la
-- console permet d'entrer dans N'IMPORTE QUELLE école. L'escalade existait déjà ;
-- sa portée passe de « voit la liste des écoles » à « lit et écrit les données de
-- tous les clients ». L'interface ne propose pas ce rôle — mais le navigateur
-- détient un jeton valide et peut appeler l'API directement.
--
-- CE QUE CETTE MIGRATION AJOUTE, deux interdits qui ne souffrent aucune exception
-- hors service-role :
--   1. `super_admin` ne s'attribue ni ne se retire depuis l'application. Créer un
--      éditeur n'est pas une opération d'école.
--   2. `etablissement_id` ne se modifie pas. Déplacer un profil d'une école à une
--      autre n'a aucun sens pour un employé ; les deux seules écritures de cette
--      colonne — entrée et sortie de support — passent par le service-role.
--      Vérifié : aucun autre chemin applicatif ne l'écrit.
--
-- INCHANGÉ : admin et direction continuent d'activer, désactiver et changer les
-- rôles internes de leur établissement.
--
-- Idempotent.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_guard_profile_sensitive_columns()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  v_role text := coalesce(get_user_role(), '');
BEGIN
  -- Backend de confiance : seul chemin par lequel un éditeur se crée et par
  -- lequel une intervention de support s'ouvre et se referme.
  IF coalesce(auth.jwt() ->> 'role', '') = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- ── Interdits ABSOLUS, quel que soit le rôle de l'appelant ────────────────
  --
  -- Le rôle d'éditeur ne se distribue pas depuis une école. On refuse dans les
  -- DEUX sens : l'attribuer est une escalade, le retirer serait un déni de
  -- service contre l'éditeur.
  IF 'super_admin' IN (NEW.role, OLD.role) AND NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Le role super_admin ne peut pas etre attribue ni retire depuis l''application.';
  END IF;

  -- Le rattachement décide de TOUT ce que la RLS accorde : le changer, c'est
  -- déplacer quelqu'un chez un autre client.
  IF NEW.etablissement_id IS DISTINCT FROM OLD.etablissement_id THEN
    RAISE EXCEPTION 'Le rattachement a un etablissement ne peut pas etre modifie depuis l''application.';
  END IF;

  -- ── Reste de la matrice, inchangé ─────────────────────────────────────────
  IF v_role IN ('admin', 'direction') THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role
     OR NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    RAISE EXCEPTION 'Modification non autorisee des colonnes protegees du profil (role / is_active / etablissement).';
  END IF;

  RETURN NEW;
END;
$function$;

-- ── Vérification (à jouer sous l'identité d'un admin d'école) ───────────────
--   BEGIN;
--   SET LOCAL ROLE authenticated;
--   SELECT set_config('request.jwt.claims',
--     json_build_object('sub', '<id admin>', 'role', 'authenticated')::text, true);
--   UPDATE profiles SET role = 'super_admin' WHERE id = '<id admin>';   -- refusé
--   UPDATE profiles SET etablissement_id = NULL WHERE id = '<id admin>'; -- refusé
--   UPDATE profiles SET role = 'secretaire' WHERE id = '<un employe>';   -- accepté
--   ROLLBACK;
