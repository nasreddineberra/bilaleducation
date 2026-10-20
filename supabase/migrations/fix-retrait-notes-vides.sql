-- ============================================================================
-- RETRAIT D'UNE CLASSE : UNE NOTE VIDE NE BLOQUE PLUS (20 octobre 2026)
--
-- Signale par l'utilisateur : CHEN Hao (ecole de demonstration) ne pouvait pas
-- etre retire du CE1 alors que ses trois notes avaient ete effacees. La Saisie
-- des notes enregistrait une note effacee en `upsert` : la ligne restait, VIDE
-- (score NULL, commentaire NULL, is_absent false). Les garde-fous comptaient les
-- LIGNES : une note effacee bloquait comme une vraie.
--
-- 1. `fn_block_student_unenroll` / `fn_block_adult_unenroll` : ne bloquent plus
--    que sur une NOTE REELLE (une note, une appreciation non vide ou « absent »),
--    la regle de l'avancement de la saisie (`lib/dashboard/notes.ts`). Le reste
--    des deux fonctions est inchange (absences, appreciations, archives,
--    effacement d'ecole, cascade de suppression).
-- 2. Nettoyage : les lignes de notes entierement VIDES existantes sont
--    supprimees (3 au 20/10, toutes de l'ecole de demonstration ; 0 adulte).
--
-- Cote application (meme livraison) : la Saisie des notes SUPPRIME une note
-- ramenee a vide ; le diagnostic de retrait (`affectation/actions.ts`) applique
-- la meme regle.
--
-- Changement PERMISSIF (un retrait de plus devient possible) : migration d'abord.
-- Controle : supabase/controles/19-retrait-notes-vides.sql.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_block_student_unenroll()
RETURNS trigger
LANGUAGE plpgsql
AS $fn$
BEGIN
  -- Effacement d'une ecole (effacer_etablissement) : tout part, rien a proteger.
  IF TG_OP = 'DELETE' AND public.fn_effacement_en_cours() THEN RETURN OLD; END IF;
  -- Cascade depuis la suppression de l'eleve : il n'existe plus → ne pas bloquer.
  IF NOT EXISTS (SELECT 1 FROM students WHERE id = OLD.student_id) THEN
    RETURN OLD;
  END IF;

  IF EXISTS (SELECT 1 FROM grades g JOIN evaluations e ON g.evaluation_id = e.id
             WHERE e.class_id = OLD.class_id AND g.student_id = OLD.student_id
               -- Note REELLE seulement : une ligne vide ne protege rien.
               AND (g.score IS NOT NULL OR btrim(coalesce(g.comment, '')) <> '' OR coalesce(g.is_absent, false)))
     OR EXISTS (SELECT 1 FROM absences
                WHERE class_id = OLD.class_id AND student_id = OLD.student_id)
     OR EXISTS (SELECT 1 FROM bulletin_appreciations
                WHERE class_id = OLD.class_id AND student_id = OLD.student_id)
     OR EXISTS (SELECT 1 FROM bulletin_archives
                WHERE class_id = OLD.class_id AND student_id = OLD.student_id)
  THEN
    RAISE EXCEPTION 'ENROLLMENT_HAS_DATA'
      USING HINT = 'Des notes, absences ou bulletins existent pour cet eleve dans cette classe.';
  END IF;

  RETURN OLD;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.fn_block_adult_unenroll()
RETURNS trigger
LANGUAGE plpgsql
AS $fn$
BEGIN
  -- Effacement d'une ecole (effacer_etablissement) : tout part, rien a proteger.
  IF TG_OP = 'DELETE' AND public.fn_effacement_en_cours() THEN RETURN OLD; END IF;
  IF NOT EXISTS (SELECT 1 FROM parents WHERE id = OLD.parent_id) THEN
    RETURN OLD;
  END IF;

  IF EXISTS (SELECT 1 FROM adult_grades g JOIN evaluations e ON g.evaluation_id = e.id
             WHERE e.class_id = OLD.class_id
               AND g.parent_id = OLD.parent_id AND g.tutor_number = OLD.tutor_number
               -- Note REELLE seulement : une ligne vide ne protege rien.
               AND (g.score IS NOT NULL OR btrim(coalesce(g.comment, '')) <> '' OR coalesce(g.is_absent, false)))
     OR EXISTS (SELECT 1 FROM adult_bulletin_appreciations
                WHERE class_id = OLD.class_id
                  AND parent_id = OLD.parent_id AND tutor_number = OLD.tutor_number)
     OR EXISTS (SELECT 1 FROM adult_bulletin_archives
                WHERE class_id = OLD.class_id
                  AND parent_id = OLD.parent_id AND tutor_number = OLD.tutor_number)
  THEN
    RAISE EXCEPTION 'ENROLLMENT_HAS_DATA'
      USING HINT = 'Des notes ou bulletins existent pour ce participant dans cette classe.';
  END IF;

  RETURN OLD;
END;
$fn$;

-- ── Nettoyage des lignes de notes vides ────────────────────────────────────
DELETE FROM public.grades
 WHERE score IS NULL AND btrim(coalesce(comment, '')) = '' AND NOT coalesce(is_absent, false);
DELETE FROM public.adult_grades
 WHERE score IS NULL AND btrim(coalesce(comment, '')) = '' AND NOT coalesce(is_absent, false);

-- Registre des migrations (voir supabase/migrations/README.md).
SELECT enregistrer_migration('fix-retrait-notes-vides.sql', '996253e87160bdc7b6928274e7d5341214d523ef403c2c07f982ba3d3fc60691');
