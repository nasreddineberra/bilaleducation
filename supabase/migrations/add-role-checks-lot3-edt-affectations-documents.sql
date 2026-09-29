-- ============================================================================
-- BILAL EDUCATION — CHANTIER RLS, LOT 3 : EDT, affectations, documents,
--                   discipline
-- ----------------------------------------------------------------------------
-- Sept tables, chacune avec UNE policy `FOR ALL` dont l'unique condition est
-- l'etablissement (releve du 29 septembre). Meme defaut que les lots
-- precedents : le cloisonnement a REMPLACE le controle de role.
--
-- CE QUE CELA PERMET AUJOURD'HUI, par un appel a l'API REST, depuis n'importe
-- quel compte de l'ecole :
--   . reecrire l'emploi du temps de toutes les classes ;
--   . S'AFFECTER SOI-MEME a une classe (`class_teachers`) — et donc, par
--     ricochet, obtenir tout ce que `teaches_class` accorde : notes, absences,
--     cahier de texte, bulletins de cette classe. C'est le trou le plus
--     interessant du lot : il ne donne pas un acces, il donne le MOYEN de s'en
--     donner d'autres ;
--   . inscrire ou desinscrire des adultes ;
--   . lire et supprimer les documents d'identite d'un eleve ou le contrat d'un
--     enseignant ;
--   . effacer un avertissement disciplinaire.
--
-- Ces ecrans ecrivent DIRECTEMENT depuis le navigateur : la RLS est le seul
-- rempart.
--
-- ── MATRICES — toutes RELEVEES DANS LE CODE, aucune inventee ───────────────
--
-- EDT (`schedule_slots`, `schedule_exceptions`)
--   ecriture = les quatre roles de `canEdit` (emploi-du-temps/page.tsx:23) :
--   admin, direction, resp. pedagogique, secretaire.
--   lecture  = tout le personnel : l'enseignant consulte son planning, et la
--   vue globale sert a tous. Pas de bornage par classe — l'EDT est un document
--   d'organisation collective, chacun doit voir ou sont les autres.
--
-- `class_teachers`
--   ecriture = matrice de `classes` (5 aout) : admin, direction, resp.
--   pedagogique, secretaire — ceux qui editent une fiche classe.
--   lecture  = tout le personnel : SEIZE fichiers la lisent (feuille d'appel,
--   bulletins, cahier de texte, communications, liste des enseignants...).
--   La fermer viderait la moitie des ecrans.
--
-- `parent_class_enrollments`
--   ecriture = garde de `saveParentEnrollments` (affectation/actions.ts:13) :
--   admin, direction, resp. pedagogique, secretaire.
--   lecture  = tout le personnel : VINGT fichiers, dont la feuille d'appel
--   adultes, les bulletins, les devoirs et les financements.
--
-- `student_documents`
--   ecriture = `ROLES_ECRITURE` de la fiche eleve (students/[id]/page.tsx:39) :
--   admin, direction, resp. pedagogique, secretaire. L'enseignant a la fiche en
--   LECTURE SEULE depuis le 24 septembre — c'est la meme regle, en base cette
--   fois, donc incontournable.
--   lecture  = encadrement + enseignant borne a SES eleves (`teaches_student`),
--   exactement comme `students` depuis le 5 aout.
--
-- `teacher_documents`
--   ecriture = garde de `teachers/actions.ts` : admin, direction, secretaire.
--   lecture  = les memes. L'enseignant n'atteint pas sa propre fiche (l'entree
--   « Enseignants » ne lui est pas ouverte) ; lui accorder la lecture serait un
--   droit que rien n'exerce — le motif qu'on vient de corriger sur les
--   bulletins, a ne pas reproduire a l'envers.
--
-- `student_warnings`
--   ecriture = fiche eleve, onglet discipline : admin, direction, resp.
--   pedagogique, secretaire.
--   lecture  = encadrement + enseignant borne a SES eleves : la colonne
--   « Discipline » de la liste Apprenants lui est ouverte, elle serait vide
--   sans cela.
--
-- `parent` reste EXCLU de tout, comme depuis le 5 aout.
--
-- ── FORME ──────────────────────────────────────────────────────────────────
--
-- Deux policies par table, `_select` et `_write` (FOR ALL), portant tenant ET
-- role. Les anciennes `*_tenant` sont SUPPRIMEES et non completees : les
-- policies permissives s'additionnent, en laisser une annulerait tout le reste.
--
-- `student_documents`, `teacher_documents` et `student_warnings` avaient DEJA
-- quatre policies separees par commande (select/insert/update/delete), toutes
-- sans role : elles sont remplacees par le couple habituel. Elles ecrivaient en
-- outre leur cloisonnement AU LONG (`profiles.etablissement_id WHERE
-- profiles.id = auth.uid()`) au lieu d'appeler `current_etablissement_id()` :
-- correct, mais cela se privait de la fonction STABLE inlinable du 5 aout, qui
-- evite de rejouer la sous-requete ligne par ligne.
--
-- Idempotent.
-- ============================================================================

-- Garde : `etablissement_id` doit exister sur les sept tables.
DO $$
DECLARE manquantes text := ''; t text;
BEGIN
  -- `class_teachers` EXCLUE a dessein : elle n'a pas de colonne propre et se
  -- cloisonne par `classes` (constate le 29/09 — la garde l'a attrapee, c'etait
  -- son role). Meme cas que `periods`, qui passe par `school_years`.
  FOREACH t IN ARRAY ARRAY['schedule_slots','schedule_exceptions',
                           'parent_class_enrollments','student_documents',
                           'teacher_documents','student_warnings']
  LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema='public' AND table_name=t
                      AND column_name='etablissement_id') THEN
      manquantes := manquantes || ' ' || t;
    END IF;
  END LOOP;
  IF manquantes <> '' THEN
    RAISE EXCEPTION 'Colonne etablissement_id absente sur :%. Migration interrompue.', manquantes;
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
--  EMPLOI DU TEMPS
-- ═══════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS schedule_slots_tenant ON public.schedule_slots;
DROP POLICY IF EXISTS schedule_slots_select ON public.schedule_slots;
DROP POLICY IF EXISTS schedule_slots_write  ON public.schedule_slots;

CREATE POLICY schedule_slots_select ON public.schedule_slots FOR SELECT
  USING (etablissement_id = current_etablissement_id()
         AND coalesce(get_user_role(), '') = ANY (ARRAY['admin','direction','comptable',
                                                        'responsable_pedagogique','secretaire','enseignant']));

CREATE POLICY schedule_slots_write ON public.schedule_slots FOR ALL
  USING (etablissement_id = current_etablissement_id()
         AND coalesce(get_user_role(), '') = ANY (ARRAY['admin','direction','responsable_pedagogique','secretaire']))
  WITH CHECK (etablissement_id = current_etablissement_id()
         AND coalesce(get_user_role(), '') = ANY (ARRAY['admin','direction','responsable_pedagogique','secretaire']));

DROP POLICY IF EXISTS schedule_exceptions_tenant ON public.schedule_exceptions;
DROP POLICY IF EXISTS schedule_exceptions_select ON public.schedule_exceptions;
DROP POLICY IF EXISTS schedule_exceptions_write  ON public.schedule_exceptions;

CREATE POLICY schedule_exceptions_select ON public.schedule_exceptions FOR SELECT
  USING (etablissement_id = current_etablissement_id()
         AND coalesce(get_user_role(), '') = ANY (ARRAY['admin','direction','comptable',
                                                        'responsable_pedagogique','secretaire','enseignant']));

CREATE POLICY schedule_exceptions_write ON public.schedule_exceptions FOR ALL
  USING (etablissement_id = current_etablissement_id()
         AND coalesce(get_user_role(), '') = ANY (ARRAY['admin','direction','responsable_pedagogique','secretaire']))
  WITH CHECK (etablissement_id = current_etablissement_id()
         AND coalesce(get_user_role(), '') = ANY (ARRAY['admin','direction','responsable_pedagogique','secretaire']));

-- ═══════════════════════════════════════════════════════════════════════════
--  AFFECTATIONS — `class_teachers` est la table qui donne le MOYEN d'obtenir
--  d'autres acces : s'y inscrire, c'est satisfaire `teaches_class` partout.
-- ═══════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS class_teachers_tenant ON public.class_teachers;
DROP POLICY IF EXISTS class_teachers_select ON public.class_teachers;
DROP POLICY IF EXISTS class_teachers_write  ON public.class_teachers;

-- `class_teachers` n'a PAS de colonne `etablissement_id` : son cloisonnement
-- CASCADE par `classes`, exactement comme la policy d'origine le faisait.
CREATE POLICY class_teachers_select ON public.class_teachers FOR SELECT
  USING (
    class_id IN (SELECT id FROM public.classes WHERE etablissement_id = current_etablissement_id())
    AND coalesce(get_user_role(), '') = ANY (ARRAY['admin','direction','comptable',
                                                   'responsable_pedagogique','secretaire','enseignant'])
  );

CREATE POLICY class_teachers_write ON public.class_teachers FOR ALL
  USING (
    class_id IN (SELECT id FROM public.classes WHERE etablissement_id = current_etablissement_id())
    AND coalesce(get_user_role(), '') = ANY (ARRAY['admin','direction','responsable_pedagogique','secretaire'])
  )
  WITH CHECK (
    class_id IN (SELECT id FROM public.classes WHERE etablissement_id = current_etablissement_id())
    AND coalesce(get_user_role(), '') = ANY (ARRAY['admin','direction','responsable_pedagogique','secretaire'])
  );

DROP POLICY IF EXISTS parent_class_enrollments_tenant ON public.parent_class_enrollments;
DROP POLICY IF EXISTS parent_class_enrollments_select ON public.parent_class_enrollments;
DROP POLICY IF EXISTS parent_class_enrollments_write  ON public.parent_class_enrollments;

CREATE POLICY parent_class_enrollments_select ON public.parent_class_enrollments FOR SELECT
  USING (etablissement_id = current_etablissement_id()
         AND coalesce(get_user_role(), '') = ANY (ARRAY['admin','direction','comptable',
                                                        'responsable_pedagogique','secretaire','enseignant']));

CREATE POLICY parent_class_enrollments_write ON public.parent_class_enrollments FOR ALL
  USING (etablissement_id = current_etablissement_id()
         AND coalesce(get_user_role(), '') = ANY (ARRAY['admin','direction','responsable_pedagogique','secretaire']))
  WITH CHECK (etablissement_id = current_etablissement_id()
         AND coalesce(get_user_role(), '') = ANY (ARRAY['admin','direction','responsable_pedagogique','secretaire']));

-- ═══════════════════════════════════════════════════════════════════════════
--  DOCUMENTS
-- ═══════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS student_documents_select ON public.student_documents;
DROP POLICY IF EXISTS student_documents_insert ON public.student_documents;
DROP POLICY IF EXISTS student_documents_update ON public.student_documents;
DROP POLICY IF EXISTS student_documents_delete ON public.student_documents;
DROP POLICY IF EXISTS student_documents_write  ON public.student_documents;

CREATE POLICY student_documents_select ON public.student_documents FOR SELECT
  USING (
    etablissement_id = current_etablissement_id()
    AND (
      coalesce(get_user_role(), '') = ANY (ARRAY['admin','direction','responsable_pedagogique','secretaire'])
      OR (get_user_role() = 'enseignant' AND teaches_student(student_id))
    )
  );

CREATE POLICY student_documents_write ON public.student_documents FOR ALL
  USING (etablissement_id = current_etablissement_id()
         AND coalesce(get_user_role(), '') = ANY (ARRAY['admin','direction','responsable_pedagogique','secretaire']))
  WITH CHECK (etablissement_id = current_etablissement_id()
         AND coalesce(get_user_role(), '') = ANY (ARRAY['admin','direction','responsable_pedagogique','secretaire']));

DROP POLICY IF EXISTS teacher_documents_select ON public.teacher_documents;
DROP POLICY IF EXISTS teacher_documents_insert ON public.teacher_documents;
DROP POLICY IF EXISTS teacher_documents_update ON public.teacher_documents;
DROP POLICY IF EXISTS teacher_documents_delete ON public.teacher_documents;
DROP POLICY IF EXISTS teacher_documents_write  ON public.teacher_documents;

CREATE POLICY teacher_documents_select ON public.teacher_documents FOR SELECT
  USING (etablissement_id = current_etablissement_id()
         AND coalesce(get_user_role(), '') = ANY (ARRAY['admin','direction','secretaire']));

CREATE POLICY teacher_documents_write ON public.teacher_documents FOR ALL
  USING (etablissement_id = current_etablissement_id()
         AND coalesce(get_user_role(), '') = ANY (ARRAY['admin','direction','secretaire']))
  WITH CHECK (etablissement_id = current_etablissement_id()
         AND coalesce(get_user_role(), '') = ANY (ARRAY['admin','direction','secretaire']));

-- ═══════════════════════════════════════════════════════════════════════════
--  DISCIPLINE
-- ═══════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS student_warnings_select ON public.student_warnings;
DROP POLICY IF EXISTS student_warnings_insert ON public.student_warnings;
DROP POLICY IF EXISTS student_warnings_update ON public.student_warnings;
DROP POLICY IF EXISTS student_warnings_delete ON public.student_warnings;
DROP POLICY IF EXISTS student_warnings_write  ON public.student_warnings;

CREATE POLICY student_warnings_select ON public.student_warnings FOR SELECT
  USING (
    etablissement_id = current_etablissement_id()
    AND (
      coalesce(get_user_role(), '') = ANY (ARRAY['admin','direction','responsable_pedagogique','secretaire'])
      OR (get_user_role() = 'enseignant' AND teaches_student(student_id))
    )
  );

CREATE POLICY student_warnings_write ON public.student_warnings FOR ALL
  USING (etablissement_id = current_etablissement_id()
         AND coalesce(get_user_role(), '') = ANY (ARRAY['admin','direction','responsable_pedagogique','secretaire']))
  WITH CHECK (etablissement_id = current_etablissement_id()
         AND coalesce(get_user_role(), '') = ANY (ARRAY['admin','direction','responsable_pedagogique','secretaire']));

SELECT 'Lot 3 : EDT, affectations, documents et discipline portent role ET tenant.' AS status;
