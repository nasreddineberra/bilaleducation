-- ============================================================================
-- BILAL EDUCATION — Une classe qui a des inscrits ne se supprime pas
-- ----------------------------------------------------------------------------
-- DEFAUT CORRIGE (constate le 9 aout 2026). Le garde-fou de suppression de
-- classe ne comptait que `enrollments`, donc ZERO pour une classe ADULTE, dont
-- les participants vivent dans `parent_class_enrollments`. Une classe adulte
-- pleine se supprimait donc sans le moindre avertissement — et les cles
-- etrangeres etant en ON DELETE CASCADE, la suppression emportait dans son
-- sillage :
--     parent_class_enrollments  (inscriptions des adultes)
--     evaluations               → adult_grades  (leurs notes)
--     adult_bulletin_archives   (leurs bulletins)
--
-- LE GARDE-FOU APPLICATIF NE SUFFIT PAS : cette suppression part directement du
-- NAVIGATEUR (client Supabase), elle se contourne par un appel a l'API REST.
-- L'application donne le message, ce trigger donne la garantie.
--
-- Idempotent. A RELIRE puis executer dans Supabase SQL Editor.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_guard_class_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n_eleves  integer;
  n_adultes integer;
BEGIN
  -- SORTIE DE SECOURS. Si l'etablissement n'existe plus, c'est une CASCADE
  -- (suppression de l'etablissement) : on laisse passer, sinon la garde
  -- bloquerait un menage legitime. Meme precaution que sur les types de presence.
  IF NOT EXISTS (SELECT 1 FROM etablissements WHERE id = OLD.etablissement_id) THEN
    RETURN OLD;
  END IF;

  SELECT count(*) INTO n_eleves
  FROM enrollments WHERE class_id = OLD.id AND status = 'active';

  SELECT count(*) INTO n_adultes
  FROM parent_class_enrollments WHERE class_id = OLD.id AND status = 'active';

  -- VOCABULAIRE : dans cette application « inscrit » veut dire ACTIF, et le
  -- rattachement a une classe se dit « affecte ». Le message parle donc
  -- d'affectations, pas d'inscriptions.
  IF n_eleves + n_adultes > 0 THEN
    RAISE EXCEPTION
      'La classe « % » compte encore % affectation(s) active(s) (% eleve(s), % adulte(s)) : retirez-les avant de la supprimer.',
      OLD.name, n_eleves + n_adultes, n_eleves, n_adultes
      USING ERRCODE = 'restrict_violation';
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_class_delete ON public.classes;
CREATE TRIGGER trg_guard_class_delete
  BEFORE DELETE ON public.classes
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_guard_class_delete();

SELECT 'Garde posee : une classe avec des inscrits actifs (eleves OU adultes) ne peut plus etre supprimee.' AS status;
