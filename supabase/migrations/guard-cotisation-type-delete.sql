-- ============================================================================
-- Un type de cotisation utilise par une classe de l'ANNEE EN COURS ne se supprime pas
--
-- PROBLEME. `classes.cotisation_type_id` est en ON DELETE SET NULL : supprimer un type
-- DETACHAIT ses classes sans erreur. Or ce que doit une famille se calcule a partir
-- de la cotisation de la classe : la classe detachee ne facture plus rien, sans qu'un
-- message ne le dise. L'ecran ecrit directement depuis le navigateur et ne controlait
-- rien avant le DELETE.
--
-- REGLE (decision utilisateur). Seules les classes de l'annee en cours comptent : les
-- types sont rattaches a une annee, et ceux des annees passees ne portent plus que de
-- l'historique.
--
-- DECLENCHEUR et non cle RESTRICT : une cle n'a pas de sortie de secours et refuserait
-- aussi une CASCADE legitime (suppression d'une annee ou d'un etablissement). Meme
-- raisonnement que `guard-class-delete-with-participants.sql`.
--
-- SECURITY DEFINER : sans elevation, la lecture des classes subirait la RLS de
-- l'appelant et un role qui ne les voit pas rendrait la garde aveugle.
--
-- Idempotent.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_guard_cotisation_type_delete()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_annee  text;
  v_nombre integer;
  v_noms   text;
BEGIN
  -- Sorties de secours : la CASCADE vient d'en haut (annee ou etablissement supprimes).
  IF NOT EXISTS (SELECT 1 FROM etablissements WHERE id = OLD.etablissement_id) THEN
    RETURN OLD;
  END IF;
  IF OLD.school_year_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM school_years WHERE id = OLD.school_year_id) THEN
    RETURN OLD;
  END IF;

  SELECT label INTO v_annee
    FROM school_years
   WHERE etablissement_id = OLD.etablissement_id AND is_current
   LIMIT 1;

  -- Pas d'annee en cours : rien a comparer.
  IF v_annee IS NULL THEN
    RETURN OLD;
  END IF;

  SELECT count(*), string_agg(name, ', ' ORDER BY name)
    INTO v_nombre, v_noms
    FROM classes
   WHERE cotisation_type_id = OLD.id
     AND academic_year = v_annee;

  IF v_nombre > 0 THEN
    RAISE EXCEPTION 'Suppression impossible : ce type de cotisation est utilise par % classe(s) de l''annee en cours (%). Changez d''abord leur cotisation.', v_nombre, v_noms
      USING ERRCODE = 'restrict_violation', HINT = 'cotisation_type_in_use';
  END IF;

  RETURN OLD;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_guard_cotisation_type_delete ON public.cotisation_types;
CREATE TRIGGER trg_guard_cotisation_type_delete
  BEFORE DELETE ON public.cotisation_types
  FOR EACH ROW EXECUTE FUNCTION public.fn_guard_cotisation_type_delete();

-- Verification : le declencheur est pose et actif.
DO $verif$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.cotisation_types'::regclass
      AND tgname = 'trg_guard_cotisation_type_delete' AND tgenabled = 'O'
  ) THEN
    RAISE EXCEPTION 'declencheur de garde des types de cotisation non pose';
  END IF;
END
$verif$;
SELECT enregistrer_migration('guard-cotisation-type-delete.sql', '9f3f36456455b59b87b51d7d866f5e68ef2b178eaf7d36fb30908909082bcf72');
