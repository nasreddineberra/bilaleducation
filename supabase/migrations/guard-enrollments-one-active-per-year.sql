-- ============================================================================
-- BILAL EDUCATION — Un apprenant n'a qu'UNE classe a la fois, par annee
-- ----------------------------------------------------------------------------
-- La regle metier « un eleve, une classe a la fois » (enoncee le 4 aout) n'etait
-- imposee NULLE PART en base : `enrollments` n'a qu'une unicite sur
-- `(student_id, class_id)` — un eleve ne peut pas etre deux fois dans la MEME
-- classe, rien ne l'empeche d'etre dans deux classes.
--
-- L'ecran Affectations respecte la regle (un eleve affecte ailleurs est grise
-- dans le vivier), mais il ecrit depuis une server action que rien n'empeche
-- d'appeler autrement, et plusieurs calculs SUPPOSENT l'unicite : effectifs,
-- palmares d'absences, moyenne rattachee a une inscription. Un eleve en double
-- fausserait tout cela EN SILENCE — c'est la nature du defaut, il ne leve pas
-- d'erreur.
--
-- ── POURQUOI UN DECLENCHEUR ET NON L'INDEX PARTIEL ENVISAGE ────────────────
--
-- `CREATE UNIQUE INDEX ... (student_id) WHERE status = 'active'` etait la
-- premiere idee, et elle aurait CASSE LA RENTREE :
--   . retirer une affectation est un DELETE, jamais un changement de statut,
--     donc `status` vaut toujours 'active' ;
--   . la purge de fin d'annee CONSERVE les inscriptions (c'est voulu, elles
--     portent l'historique).
-- Un eleve garde donc son affectation active de l'an passe. A la rentree, celle
-- de la nouvelle classe serait la SECONDE : l'index l'aurait refusee pour chaque
-- eleve qui revient.
--
-- La vraie regle est « une classe a la fois PAR ANNEE SCOLAIRE ». Or l'annee
-- n'est pas sur `enrollments` mais sur `classes.academic_year` — un index ne
-- sait pas joindre. D'ou le declencheur.
--
-- SECURITY DEFINER : la garde lit `enrollments` et `classes` ; sous la RLS de
-- l'appelant, une ligne masquee la rendrait aveugle (motif des tuteurs).
--
-- Aucune sortie de secours necessaire : c'est une garde d'INSERTION, aucune
-- cascade ne la traverse.
--
-- Idempotent.
-- ============================================================================

-- ── 1. Refus AVANT toute garde : les doublons existants, NOMMES ────────────

DO $$
DECLARE
  v_liste text;
BEGIN
  SELECT string_agg(txt, ' · ') INTO v_liste
  FROM (
    SELECT format('%s %s (%s : %s)',
                  s.last_name, s.first_name, c.academic_year,
                  string_agg(c.name, ' + ' ORDER BY c.name)) AS txt
    FROM public.enrollments e
    JOIN public.students s ON s.id = e.student_id
    JOIN public.classes  c ON c.id = e.class_id
    WHERE e.status = 'active'
    GROUP BY s.id, s.last_name, s.first_name, c.academic_year
    HAVING count(*) > 1
  ) d;

  IF v_liste IS NOT NULL THEN
    RAISE EXCEPTION
      'Des apprenants sont affectes a deux classes de la meme annee, la garde ne peut pas etre posee. A corriger avant : %',
      v_liste;
  END IF;
END $$;

-- ── 2. La garde ───────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_guard_enrollment_one_active_per_year()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_annee  text;
  v_classe text;
BEGIN
  IF NEW.status IS DISTINCT FROM 'active' THEN
    RETURN NEW;
  END IF;

  SELECT academic_year INTO v_annee FROM classes WHERE id = NEW.class_id;

  SELECT c.name INTO v_classe
  FROM enrollments e
  JOIN classes c ON c.id = e.class_id
  WHERE e.student_id = NEW.student_id
    AND e.status = 'active'
    AND e.id IS DISTINCT FROM NEW.id
    AND c.academic_year = v_annee
  LIMIT 1;

  IF v_classe IS NOT NULL THEN
    RAISE EXCEPTION
      'Cet apprenant est deja affecte a la classe « % » pour l''annee % : un apprenant n''a qu''une classe a la fois. Retirez-le de sa classe avant de l''affecter ailleurs.',
      v_classe, v_annee
      USING ERRCODE = 'unique_violation';
  END IF;

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_guard_enrollment_one_active_per_year ON public.enrollments;
CREATE TRIGGER trg_guard_enrollment_one_active_per_year
  BEFORE INSERT OR UPDATE OF student_id, class_id, status ON public.enrollments
  FOR EACH ROW EXECUTE FUNCTION public.fn_guard_enrollment_one_active_per_year();

SELECT 'enrollments : un apprenant n''a plus qu''une classe active par annee scolaire.' AS status;
