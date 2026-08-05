-- ============================================================================
-- RLS des tables centrales : ajout du contrôle de RÔLE
--
-- CONSTAT (5 août 2026, confirmé par pg_policies) : les tables centrales
-- n'avaient qu'UNE policy, en `FOR ALL`, pour `{public}`, dont l'unique
-- condition était l'établissement. Le cloisonnement multi-tenant était correct,
-- mais il avait REMPLACÉ le contrôle de rôle au lieu de s'y ajouter.
--
-- Conséquence : tout compte authentifié de l'établissement disposait des quatre
-- droits. Un enseignant pouvait supprimer un élève ou réécrire les notes d'une
-- classe qui n'est pas la sienne. Les contrôles de l'application (sidebar,
-- server actions) ne protègent rien : le navigateur détient un jeton valide et
-- peut appeler l'API REST directement.
--
-- C'est le défaut déjà corrigé le 17 juillet sur `expenses` / `other_revenues`,
-- jamais étendu aux tables centrales.
--
-- Matrice appliquée : celle de l'utilisateur (5 août), avec trois précisions
-- arbitrées le même jour — l'enseignant est limité à SES CLASSES, le comptable
-- passe en lecture seule sur les élèves et parents, et la secrétaire conserve
-- ses écritures (les écrans correspondants lui sont ouverts côté application).
--
-- Prérequis : `harden-security-definer-functions.sql`.
-- Idempotent : rejouable sans effet.
-- ============================================================================

-- ── Helpers de périmètre enseignant ─────────────────────────────────────────
--
-- SECURITY DEFINER indispensable : ces fonctions lisent `class_teachers`,
-- `teachers`, `enrollments` et `students`, toutes sous RLS. Sans l'élévation,
-- une policy qui les appelle dépendrait des droits de lecture de l'appelant sur
-- ces tables — et pour `students`, la policy s'appellerait elle-même.
--
-- STABLE : évaluées une fois par valeur d'argument dans une même requête, et
-- inlinables. Une fonction VOLATILE dans une policy est rejouée à chaque ligne.

-- L'enseignant connecté est-il affecté à cette classe AUJOURD'HUI ?
-- La fenêtre d'effet est respectée (`effective_from` / `effective_until`,
-- NULL = borne ouverte), comme le fait déjà la RLS du cahier de texte : un
-- remplaçant dont la mission est terminée n'écrit plus.
CREATE OR REPLACE FUNCTION public.teaches_class(p_class_id uuid)
  RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = public, pg_temp
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM class_teachers ct
    JOIN teachers t ON t.id = ct.teacher_id
    WHERE ct.class_id = p_class_id
      AND t.user_id = auth.uid()
      AND (ct.effective_from  IS NULL OR ct.effective_from  <= CURRENT_DATE)
      AND (ct.effective_until IS NULL OR ct.effective_until >= CURRENT_DATE)
  )
$function$;

-- Cet élève est-il inscrit (activement) dans l'une de mes classes ?
CREATE OR REPLACE FUNCTION public.teaches_student(p_student_id uuid)
  RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = public, pg_temp
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM enrollments e
    WHERE e.student_id = p_student_id
      AND e.status = 'active'
      AND teaches_class(e.class_id)
  )
$function$;

-- Ce foyer est-il celui d'un de mes élèves ?
CREATE OR REPLACE FUNCTION public.teaches_parent(p_parent_id uuid)
  RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = public, pg_temp
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM students s
    WHERE s.parent_id = p_parent_id
      AND teaches_student(s.id)
  )
$function$;

-- ── Conventions ─────────────────────────────────────────────────────────────
--
-- Deux policies par table : `<table>_select` et `<table>_write` (FOR ALL). Les
-- policies PERMISSIVE se combinent en OU : la lecture reste donc régie par
-- `_select`, tandis que INSERT / UPDATE / DELETE ne sont couverts que par
-- `_write`.
--
-- `coalesce(get_user_role(), '')` : un rôle NULL donnerait NULL, donc un refus.
-- On l'écrit quand même — règle du projet pour toute garde de rôle.
--
-- `parent` est absent de toutes les listes : comptes suspendus en V1, leurs
-- policies dédiées attendent commentées dans `policies.sql`. La policy
-- `*_tenant` leur donnait pourtant les quatre droits.

-- ── students ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS students_tenant ON students;
DROP POLICY IF EXISTS students_select ON students;
DROP POLICY IF EXISTS students_write  ON students;

CREATE POLICY students_select ON students FOR SELECT
  USING (
    etablissement_id = current_etablissement_id()
    AND (
      coalesce(get_user_role(), '') = ANY (ARRAY['admin','direction','comptable','responsable_pedagogique','secretaire'])
      -- L'enseignant ne voit QUE les élèves de ses classes. Sans cette clause,
      -- sa feuille d'appel et sa saisie de notes afficheraient une classe vide,
      -- et sans le moindre message : la RLS ne refuse pas, elle ne renvoie rien.
      OR (get_user_role() = 'enseignant' AND teaches_student(id))
    )
  );

CREATE POLICY students_write ON students FOR ALL
  USING (
    etablissement_id = current_etablissement_id()
    AND coalesce(get_user_role(), '') = ANY (ARRAY['admin','direction','responsable_pedagogique','secretaire'])
  )
  WITH CHECK (
    etablissement_id = current_etablissement_id()
    AND coalesce(get_user_role(), '') = ANY (ARRAY['admin','direction','responsable_pedagogique','secretaire'])
  );

-- ── parents ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS parents_tenant ON parents;
DROP POLICY IF EXISTS parents_select ON parents;
DROP POLICY IF EXISTS parents_write  ON parents;

CREATE POLICY parents_select ON parents FOR SELECT
  USING (
    etablissement_id = current_etablissement_id()
    AND (
      coalesce(get_user_role(), '') = ANY (ARRAY['admin','direction','comptable','responsable_pedagogique','secretaire'])
      OR (get_user_role() = 'enseignant' AND teaches_parent(id))
    )
  );

CREATE POLICY parents_write ON parents FOR ALL
  USING (
    etablissement_id = current_etablissement_id()
    AND coalesce(get_user_role(), '') = ANY (ARRAY['admin','direction','responsable_pedagogique','secretaire'])
  )
  WITH CHECK (
    etablissement_id = current_etablissement_id()
    AND coalesce(get_user_role(), '') = ANY (ARRAY['admin','direction','responsable_pedagogique','secretaire'])
  );

-- ── teachers ────────────────────────────────────────────────────────────────
-- EXCEPTION ASSUMÉE à la matrice, qui n'accorde pas la lecture à l'enseignant.
-- L'emploi du temps résout l'utilisateur connecté par
-- `teachers.find(t => t.user_id === currentUserId)` : sans accès à SA PROPRE
-- ligne, `ownTeacherId` reste indéfini et son planning s'affiche VIDE — c'est
-- exactement le bug corrigé le 10 juillet. On lui ouvre donc sa seule ligne,
-- rien de plus.
DROP POLICY IF EXISTS teachers_tenant ON teachers;
DROP POLICY IF EXISTS teachers_select ON teachers;
DROP POLICY IF EXISTS teachers_write  ON teachers;

CREATE POLICY teachers_select ON teachers FOR SELECT
  USING (
    etablissement_id = current_etablissement_id()
    AND (
      coalesce(get_user_role(), '') = ANY (ARRAY['admin','direction','comptable','responsable_pedagogique','secretaire'])
      OR (get_user_role() = 'enseignant' AND user_id = auth.uid())
    )
  );

CREATE POLICY teachers_write ON teachers FOR ALL
  USING (
    etablissement_id = current_etablissement_id()
    AND coalesce(get_user_role(), '') = ANY (ARRAY['admin','direction','secretaire'])
  )
  WITH CHECK (
    etablissement_id = current_etablissement_id()
    AND coalesce(get_user_role(), '') = ANY (ARRAY['admin','direction','secretaire'])
  );

-- ── classes ─────────────────────────────────────────────────────────────────
-- Lecture ouverte à TOUT le personnel (matrice) : le nom d'une classe apparaît
-- dans des dizaines d'écrans, la restreindre casserait des affichages en silence.
DROP POLICY IF EXISTS classes_tenant ON classes;
DROP POLICY IF EXISTS classes_select ON classes;
DROP POLICY IF EXISTS classes_write  ON classes;

CREATE POLICY classes_select ON classes FOR SELECT
  USING (
    etablissement_id = current_etablissement_id()
    AND coalesce(get_user_role(), '') = ANY (ARRAY['admin','direction','comptable','responsable_pedagogique','enseignant','secretaire'])
  );

CREATE POLICY classes_write ON classes FOR ALL
  USING (
    etablissement_id = current_etablissement_id()
    AND coalesce(get_user_role(), '') = ANY (ARRAY['admin','direction','responsable_pedagogique','secretaire'])
  )
  WITH CHECK (
    etablissement_id = current_etablissement_id()
    AND coalesce(get_user_role(), '') = ANY (ARRAY['admin','direction','responsable_pedagogique','secretaire'])
  );

-- ── enrollments ─────────────────────────────────────────────────────────────
-- Pas de colonne `etablissement_id` : cloisonnement par l'élève, comme le
-- faisait déjà `enrollments_tenant`.
DROP POLICY IF EXISTS enrollments_tenant ON enrollments;
DROP POLICY IF EXISTS enrollments_select ON enrollments;
DROP POLICY IF EXISTS enrollments_write  ON enrollments;

CREATE POLICY enrollments_select ON enrollments FOR SELECT
  USING (
    student_id IN (SELECT id FROM students WHERE etablissement_id = current_etablissement_id())
    AND (
      coalesce(get_user_role(), '') = ANY (ARRAY['admin','direction','comptable','responsable_pedagogique','secretaire'])
      OR (get_user_role() = 'enseignant' AND teaches_class(class_id))
    )
  );

CREATE POLICY enrollments_write ON enrollments FOR ALL
  USING (
    student_id IN (SELECT id FROM students WHERE etablissement_id = current_etablissement_id())
    AND coalesce(get_user_role(), '') = ANY (ARRAY['admin','direction','responsable_pedagogique','secretaire'])
  )
  WITH CHECK (
    student_id IN (SELECT id FROM students WHERE etablissement_id = current_etablissement_id())
    AND coalesce(get_user_role(), '') = ANY (ARRAY['admin','direction','responsable_pedagogique','secretaire'])
  );

-- ── evaluations ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS evaluations_tenant ON evaluations;
DROP POLICY IF EXISTS evaluations_select ON evaluations;
DROP POLICY IF EXISTS evaluations_write  ON evaluations;

CREATE POLICY evaluations_select ON evaluations FOR SELECT
  USING (
    etablissement_id = current_etablissement_id()
    AND (
      coalesce(get_user_role(), '') = ANY (ARRAY['admin','direction','responsable_pedagogique','secretaire'])
      OR (get_user_role() = 'enseignant' AND teaches_class(class_id))
    )
  );

CREATE POLICY evaluations_write ON evaluations FOR ALL
  USING (
    etablissement_id = current_etablissement_id()
    AND (
      coalesce(get_user_role(), '') = ANY (ARRAY['admin','direction','responsable_pedagogique','secretaire'])
      OR (get_user_role() = 'enseignant' AND teaches_class(class_id))
    )
  )
  WITH CHECK (
    etablissement_id = current_etablissement_id()
    AND (
      coalesce(get_user_role(), '') = ANY (ARRAY['admin','direction','responsable_pedagogique','secretaire'])
      OR (get_user_role() = 'enseignant' AND teaches_class(class_id))
    )
  );

-- ── grades ──────────────────────────────────────────────────────────────────
-- Cloisonnement par l'élève, comme `grades_tenant`. Le périmètre de
-- l'enseignant se lit par l'évaluation, qui porte la classe.
DROP POLICY IF EXISTS grades_tenant ON grades;
DROP POLICY IF EXISTS grades_select ON grades;
DROP POLICY IF EXISTS grades_write  ON grades;

CREATE POLICY grades_select ON grades FOR SELECT
  USING (
    student_id IN (SELECT id FROM students WHERE etablissement_id = current_etablissement_id())
    AND (
      coalesce(get_user_role(), '') = ANY (ARRAY['admin','direction','responsable_pedagogique','secretaire'])
      OR (
        get_user_role() = 'enseignant'
        AND EXISTS (SELECT 1 FROM evaluations e WHERE e.id = grades.evaluation_id AND teaches_class(e.class_id))
      )
    )
  );

CREATE POLICY grades_write ON grades FOR ALL
  USING (
    student_id IN (SELECT id FROM students WHERE etablissement_id = current_etablissement_id())
    AND (
      coalesce(get_user_role(), '') = ANY (ARRAY['admin','direction','responsable_pedagogique','secretaire'])
      OR (
        get_user_role() = 'enseignant'
        AND EXISTS (SELECT 1 FROM evaluations e WHERE e.id = grades.evaluation_id AND teaches_class(e.class_id))
      )
    )
  )
  WITH CHECK (
    student_id IN (SELECT id FROM students WHERE etablissement_id = current_etablissement_id())
    AND (
      coalesce(get_user_role(), '') = ANY (ARRAY['admin','direction','responsable_pedagogique','secretaire'])
      OR (
        get_user_role() = 'enseignant'
        AND EXISTS (SELECT 1 FROM evaluations e WHERE e.id = grades.evaluation_id AND teaches_class(e.class_id))
      )
    )
  );

-- ── absences ────────────────────────────────────────────────────────────────
-- Les quatre policies d'origine utilisaient une sous-requête `profiles` en
-- ligne là où le reste du schéma appelle `current_etablissement_id()` : deux
-- idiomes pour la même chose, dont l'un ne bénéficie pas du STABLE. On unifie.
DROP POLICY IF EXISTS "Absences visibles par etablissement"     ON absences;
DROP POLICY IF EXISTS "Absences inserables par etablissement"   ON absences;
DROP POLICY IF EXISTS "Absences modifiables par etablissement"  ON absences;
DROP POLICY IF EXISTS "Absences supprimables par etablissement" ON absences;
DROP POLICY IF EXISTS absences_select ON absences;
DROP POLICY IF EXISTS absences_write  ON absences;

CREATE POLICY absences_select ON absences FOR SELECT
  USING (
    etablissement_id = current_etablissement_id()
    AND (
      coalesce(get_user_role(), '') = ANY (ARRAY['admin','direction','responsable_pedagogique','secretaire'])
      OR (get_user_role() = 'enseignant' AND teaches_class(class_id))
    )
  );

CREATE POLICY absences_write ON absences FOR ALL
  USING (
    etablissement_id = current_etablissement_id()
    AND (
      coalesce(get_user_role(), '') = ANY (ARRAY['admin','direction','responsable_pedagogique','secretaire'])
      OR (get_user_role() = 'enseignant' AND teaches_class(class_id))
    )
  )
  WITH CHECK (
    etablissement_id = current_etablissement_id()
    AND (
      coalesce(get_user_role(), '') = ANY (ARRAY['admin','direction','responsable_pedagogique','secretaire'])
      OR (get_user_role() = 'enseignant' AND teaches_class(class_id))
    )
  );

-- NB : `payments` et `schedules` ne figurent pas ici — tables mortes et vides,
-- supprimées par `drop-dead-tables-payments-schedules.sql`.

-- ── Vérification ────────────────────────────────────────────────────────────
--   select tablename, policyname, cmd
--   from pg_policies
--   where schemaname = 'public'
--     and tablename in ('students','parents','teachers','classes',
--                       'enrollments','evaluations','grades','absences')
--   order by tablename, cmd, policyname;
--
-- Attendu : deux policies par table, `_select` (SELECT) et `_write` (ALL).
