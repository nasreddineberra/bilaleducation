-- ============================================================================
-- BILAL EDUCATION — Integrite : retrait d'un participant d'une classe
-- ----------------------------------------------------------------------------
-- PROBLEME : retirer un participant d'une classe (DELETE de enrollments /
-- parent_class_enrollments) laissait ses NOTES orphelines (aucune cascade entre
-- les notes et l'inscription) → compteurs faux (« 13/2 »), donnees fantomes.
--
-- REGLE (decision utilisateur) : on NE PEUT PAS retirer un participant d'une
-- classe tant qu'il reste QUOI QUE CE SOIT sur le duo participant/classe
-- (notes, absences/retards, appreciations, bulletins). Le duo doit etre vierge.
--
-- Ce script :
--   1) triggers BEFORE DELETE qui BLOQUENT le retrait si des donnees existent ;
--   2) purge unique des orphelins deja presents (notes + appreciations).
--
-- Garde anti-cascade : si l'ELEVE / le PARENT lui-meme est supprime (cascade FK),
-- il n'existe plus au moment ou le trigger d'inscription se declenche → on ne
-- bloque pas (sinon on ne pourrait jamais supprimer une fiche).
--
-- Idempotent. A executer dans Supabase SQL Editor.
-- ============================================================================

-- ─── 1a. Eleves : blocage du retrait si donnees sur le duo eleve/classe ─────
CREATE OR REPLACE FUNCTION fn_block_student_unenroll() RETURNS trigger AS $$
BEGIN
  -- Cascade depuis la suppression de l'eleve : il n'existe plus → ne pas bloquer.
  IF NOT EXISTS (SELECT 1 FROM students WHERE id = OLD.student_id) THEN
    RETURN OLD;
  END IF;

  IF EXISTS (SELECT 1 FROM grades g JOIN evaluations e ON g.evaluation_id = e.id
             WHERE e.class_id = OLD.class_id AND g.student_id = OLD.student_id)
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
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_block_student_unenroll ON enrollments;
CREATE TRIGGER trg_block_student_unenroll
  BEFORE DELETE ON enrollments
  FOR EACH ROW EXECUTE FUNCTION fn_block_student_unenroll();

-- ─── 1b. Adultes : blocage du retrait si donnees sur le duo participant/classe ─
CREATE OR REPLACE FUNCTION fn_block_adult_unenroll() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM parents WHERE id = OLD.parent_id) THEN
    RETURN OLD;
  END IF;

  IF EXISTS (SELECT 1 FROM adult_grades g JOIN evaluations e ON g.evaluation_id = e.id
             WHERE e.class_id = OLD.class_id
               AND g.parent_id = OLD.parent_id AND g.tutor_number = OLD.tutor_number)
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
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_block_adult_unenroll ON parent_class_enrollments;
CREATE TRIGGER trg_block_adult_unenroll
  BEFORE DELETE ON parent_class_enrollments
  FOR EACH ROW EXECUTE FUNCTION fn_block_adult_unenroll();

-- ─── 2. Purge unique des orphelins existants ────────────────────────────────
-- Orphelin = note/appreciation dont le participant n'a PLUS AUCUNE inscription
-- (active ou non) dans la classe de l'evaluation. Les archives de bulletins
-- (PDF dans le bucket) ne sont PAS touchees ici (traitement au passage d'annee).

DELETE FROM grades g USING evaluations e
  WHERE g.evaluation_id = e.id
    AND NOT EXISTS (SELECT 1 FROM enrollments en
                    WHERE en.student_id = g.student_id AND en.class_id = e.class_id);

DELETE FROM adult_grades ag USING evaluations e
  WHERE ag.evaluation_id = e.id
    AND NOT EXISTS (SELECT 1 FROM parent_class_enrollments pce
                    WHERE pce.parent_id = ag.parent_id
                      AND pce.tutor_number = ag.tutor_number
                      AND pce.class_id = e.class_id);

DELETE FROM bulletin_appreciations ba
  WHERE NOT EXISTS (SELECT 1 FROM enrollments en
                    WHERE en.student_id = ba.student_id AND en.class_id = ba.class_id);

DELETE FROM adult_bulletin_appreciations aba
  WHERE NOT EXISTS (SELECT 1 FROM parent_class_enrollments pce
                    WHERE pce.parent_id = aba.parent_id
                      AND pce.tutor_number = aba.tutor_number
                      AND pce.class_id = aba.class_id);

SELECT 'Triggers de blocage poses (eleves + adultes) + orphelins purges (notes + appreciations).' AS status;
