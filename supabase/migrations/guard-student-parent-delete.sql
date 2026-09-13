-- ============================================================================
-- BILAL EDUCATION — On ne supprime qu'une fiche VIERGE (apprenant / foyer)
-- ----------------------------------------------------------------------------
-- DEFAUT CONSTATE (13 septembre 2026, verifie dans `pg_constraint`).
--
-- L'application affiche « Impossible de supprimer : des donnees sont
-- rattachees a cet eleve » — un message qui attend le code 23503. Or AUCUNE
-- des dix cles pointant vers `students` n'est en RESTRICT : huit sont en
-- CASCADE, deux en SET NULL. Une cle en cascade ne leve JAMAIS 23503, elle
-- SUPPRIME. Le message etait donc INATTEIGNABLE, et la suppression emportait
-- en silence :
--     enrollments             (affectations aux classes)
--     grades                  (notes)
--     bulletin_archives       (bulletins delivres aux familles)
--     bulletin_appreciations
--     absences
--     student_warnings        (avertissements)
--     homework_status         (suivi des devoirs)
--     student_documents       (+ les fichiers restes dans le bucket)
--
-- Cote `parents`, une seule barriere existait : `students.parent_id` est en
-- RESTRICT, donc un foyer AVEC enfants ne se supprime pas. Mais retirez les
-- enfants et le foyer emporte ses `family_fees` — les COTISATIONS —, ses
-- inscriptions aux cours adultes, les notes et bulletins de ces cours, et son
-- historique de relances et d'attestations. Onze tables.
--
-- ── DOCTRINE RETENUE (arbitrage utilisateur) : STRICTE ─────────────────────
--
-- La suppression n'est offerte que sur une fiche VIERGE. La moindre ligne
-- rattachee la refuse, et renvoie vers « Rendre inactif ».
--
-- Pourquoi pas une doctrine souple, ou une simple affectation serait emportee
-- avec l'apprenant : les deux ne different que sur UN cas — la fiche creee
-- puis affectee a une classe, reconnue ensuite comme doublon — et l'ecart s'y
-- mesure a un clic (la retirer de sa classe depuis Affectations). Ce cas est
-- rare : l'import ne cree JAMAIS d'affectation, donc un import rate laisse des
-- fiches a zero dependance, supprimables sans detour.
--
-- L'asymetrie tranche : trop strict coute un clic, trop permissif detruit des
-- bulletins et des notes, sans retour. Et « on ne supprime qu'une fiche
-- vierge » s'enonce en une phrase, la ou une regle a exceptions laisserait la
-- prochaine table dans le flou.
--
-- ── POURQUOI UN DECLENCHEUR ET NON DES CLES EN RESTRICT ────────────────────
--
-- Une cle n'a pas de sortie de secours : elle refuserait aussi une CASCADE
-- legitime, a commencer par la suppression d'un etablissement. Un declencheur
-- laisse passer ce cas. Meme choix que pour les classes (9 aout) et les types
-- de presence.
--
-- Verifie avant ecriture :
--   . la purge de fin d'annee (`purge_school_year`) ne supprime NI apprenant
--     NI foyer : elle ne touche que les donnees de l'annee ;
--   . `clean-all-data.sql` passe en `session_replication_role = 'replica'`,
--     donc hors declencheurs — le reset d'environnement n'est pas gene.
-- Le seul cas legitime a laisser passer est donc la disparition de
-- l'etablissement.
--
-- ── ET LE GARDE-FOU APPLICATIF NE SUFFIT PAS ───────────────────────────────
--
-- Ces deux suppressions partent DIRECTEMENT du navigateur (client Supabase) :
-- toute regle qui ne vit pas en base se contourne par un appel a l'API REST.
-- L'application donne le message, ce declencheur donne la garantie.
--
-- Idempotent.
-- ============================================================================

-- ── 1. APPRENANT ───────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_guard_student_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  n_affect  integer;
  n_eval    integer;
  n_vie     integer;
  n_docs    integer;
  v_details text;
BEGIN
  -- SORTIE DE SECOURS : l'etablissement n'existe plus, c'est une CASCADE
  -- legitime. Sans elle, la garde bloquerait un menage regulier.
  IF NOT EXISTS (SELECT 1 FROM etablissements WHERE id = OLD.etablissement_id) THEN
    RETURN OLD;
  END IF;

  SELECT count(*) INTO n_affect FROM enrollments WHERE student_id = OLD.id;

  SELECT (SELECT count(*) FROM grades                 WHERE student_id = OLD.id)
       + (SELECT count(*) FROM bulletin_archives      WHERE student_id = OLD.id)
       + (SELECT count(*) FROM bulletin_appreciations WHERE student_id = OLD.id)
    INTO n_eval;

  SELECT (SELECT count(*) FROM absences         WHERE student_id = OLD.id)
       + (SELECT count(*) FROM student_warnings WHERE student_id = OLD.id)
       + (SELECT count(*) FROM homework_status  WHERE student_id = OLD.id)
    INTO n_vie;

  SELECT count(*) INTO n_docs FROM student_documents WHERE student_id = OLD.id;

  IF n_affect + n_eval + n_vie + n_docs > 0 THEN
    v_details := concat_ws(', ',
      CASE WHEN n_affect > 0 THEN n_affect || ' affectation(s)'            END,
      CASE WHEN n_eval   > 0 THEN n_eval   || ' donnee(s) d''evaluation'   END,
      CASE WHEN n_vie    > 0 THEN n_vie    || ' donnee(s) de vie scolaire' END,
      CASE WHEN n_docs   > 0 THEN n_docs   || ' document(s)'               END
    );
    RAISE EXCEPTION
      'L''apprenant « % % » ne peut pas etre supprime. Donnees rattachees : %. Rendez-le inactif plutot que de le supprimer.',
      OLD.last_name, OLD.first_name, v_details
      USING ERRCODE = 'restrict_violation';
  END IF;

  RETURN OLD;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_guard_student_delete ON public.students;
CREATE TRIGGER trg_guard_student_delete
  BEFORE DELETE ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.fn_guard_student_delete();

-- ── 2. FOYER ───────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_guard_parent_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  n_enfants integer;
  n_finance integer;
  n_adultes integer;
  n_comm    integer;
  v_details text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM etablissements WHERE id = OLD.etablissement_id) THEN
    RETURN OLD;
  END IF;

  -- Les enfants sont DEJA bloques par la cle `students.parent_id` (RESTRICT).
  -- On les compte quand meme ici pour que le message soit UNIQUE et complet :
  -- sans cela l'utilisateur verrait tantot notre texte, tantot une erreur de
  -- cle etrangere brute, selon ce qui echoue en premier.
  SELECT count(*) INTO n_enfants FROM students WHERE parent_id = OLD.id;

  SELECT (SELECT count(*) FROM family_fees                WHERE parent_id = OLD.id)
       + (SELECT count(*) FROM financement_communications WHERE parent_id = OLD.id)
    INTO n_finance;

  SELECT (SELECT count(*) FROM parent_class_enrollments     WHERE parent_id = OLD.id)
       + (SELECT count(*) FROM adult_grades                 WHERE parent_id = OLD.id)
       + (SELECT count(*) FROM adult_absences               WHERE parent_id = OLD.id)
       + (SELECT count(*) FROM adult_bulletin_archives      WHERE parent_id = OLD.id)
       + (SELECT count(*) FROM adult_bulletin_appreciations WHERE parent_id = OLD.id)
       + (SELECT count(*) FROM adult_homework_status        WHERE parent_id = OLD.id)
    INTO n_adultes;

  SELECT (SELECT count(*) FROM announcement_recipients WHERE parent_id = OLD.id)
       + (SELECT count(*) FROM notifications           WHERE parent_id = OLD.id)
    INTO n_comm;

  IF n_enfants + n_finance + n_adultes + n_comm > 0 THEN
    v_details := concat_ws(', ',
      CASE WHEN n_enfants > 0 THEN n_enfants || ' apprenant(s)'               END,
      CASE WHEN n_finance > 0 THEN n_finance || ' donnee(s) financiere(s)'    END,
      CASE WHEN n_adultes > 0 THEN n_adultes || ' donnee(s) de cours adultes' END,
      CASE WHEN n_comm    > 0 THEN n_comm    || ' communication(s)'           END
    );
    RAISE EXCEPTION
      'Le foyer « % % » ne peut pas etre supprime. Donnees rattachees : %.',
      OLD.tutor1_last_name, OLD.tutor1_first_name, v_details
      USING ERRCODE = 'restrict_violation';
  END IF;

  RETURN OLD;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_guard_parent_delete ON public.parents;
CREATE TRIGGER trg_guard_parent_delete
  BEFORE DELETE ON public.parents
  FOR EACH ROW EXECUTE FUNCTION public.fn_guard_parent_delete();

SELECT 'Suppression d''un apprenant ou d''un foyer : refusee des qu''une donnee est rattachee.' AS status;
