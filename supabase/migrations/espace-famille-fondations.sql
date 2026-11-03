-- ============================================================================
-- Espace famille, lot 1 : fondations (03/11)
--
-- L'acces parent devient une OPTION PAYANTE par etablissement. Plan :
-- docs/ESPACE-FAMILLE.md.
--
-- CETTE MIGRATION :
--   1. `etablissements.option_espace_famille` (faux par defaut), ouverte sur la
--      demonstration seule.
--   2. Tarif propre a l'option (forfait + prix par inscrit) et releve mensuel
--      qui fige l'option et ce tarif (`fn_releve_facturation`).
--   3. Un compte = tuteur d'UN foyer, a UNE place : index uniques + declencheur.
--   4. `foyer_du_compte()`, `tuteur_du_compte()`, `classes_du_compte()`,
--      `devoir_de_mon_enfant()`, `devoir_de_mon_cours()` : SEUL chemin des
--      regles parent. Option coupee, ecole inactive ou expiree, role autre que
--      `parent` = NULL, donc rien a lire.
--   5. Regles parent existantes reecrites : elles lisaient `parents.user_id`,
--      que rien ne remplit (les comptes s'ecrivent en tutor1/2_user_id).
--      `journal_parent_select` SUPPRIMEE : les seances du cahier de texte sont
--      internes, jamais lues par une famille.
--
-- Additif dans les faits : aucun compte parent n'existe (0 au 03/11), aucune
-- regle reecrite ne retire un droit exerce. `parents.user_id` est retiree par
-- `espace-famille-retrait-user-id.sql`, APRES le deploiement du code.
-- Controle : supabase/controles/37-espace-famille-fondations.sql.
-- ============================================================================

-- ── 1. Option ───────────────────────────────────────────────────────────────
ALTER TABLE public.etablissements
  ADD COLUMN option_espace_famille boolean NOT NULL DEFAULT false;

UPDATE public.etablissements SET option_espace_famille = true WHERE est_demo;

-- ── 2. Tarif de l'option et releve mensuel ──────────────────────────────────
ALTER TABLE public.etablissement_facturation
  ADD COLUMN famille_forfait numeric,
  ADD COLUMN famille_prix_inscrit numeric,
  ADD CONSTRAINT etablissement_facturation_famille_forfait_check
    CHECK (famille_forfait IS NULL OR famille_forfait >= 0),
  ADD CONSTRAINT etablissement_facturation_famille_prix_inscrit_check
    CHECK (famille_prix_inscrit IS NULL OR famille_prix_inscrit >= 0);

ALTER TABLE public.releves_facturation
  ADD COLUMN option_espace_famille boolean NOT NULL DEFAULT false,
  ADD COLUMN famille_forfait numeric,
  ADD COLUMN famille_prix_inscrit numeric;

-- Reecriture d'une fonction COURTE, ancre verifiee : on leve si la definition
-- en base n'est plus celle relue le 03/11.
DO $ancre$
BEGIN
  IF (SELECT md5(prosrc) FROM pg_proc WHERE oid = 'public.fn_releve_facturation()'::regprocedure)
     <> '2d923655402cfd6360c0a63c81d7780d' THEN
    RAISE EXCEPTION 'fn_releve_facturation a change depuis le 03/11 : relire avant de reecrire';
  END IF;
END
$ancre$;

CREATE OR REPLACE FUNCTION public.fn_releve_facturation()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_mois date := date_trunc('month', now() AT TIME ZONE 'Europe/Paris')::date;
  v_n    integer;
BEGIN
  INSERT INTO releves_facturation
    (etablissement_id, mois, eleves_actifs, adultes_inscrits, limite, prix_inscrit, forfait,
     option_espace_famille, famille_forfait, famille_prix_inscrit)
  SELECT e.id, v_mois, b.eleves_actifs, b.adultes_inscrits, e.max_students, f.prix_inscrit, f.forfait,
         e.option_espace_famille, f.famille_forfait, f.famille_prix_inscrit
    FROM etablissements e
    CROSS JOIN LATERAL fn_base_facturable(e.id) b
    LEFT JOIN etablissement_facturation f ON f.etablissement_id = e.id
    WHERE e.donnees_effacees_le IS NULL AND NOT e.est_demo ON CONFLICT (etablissement_id, mois) DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$fn$;

-- ── 3. Un compte = tuteur d'un seul foyer, a une seule place ────────────────
DROP INDEX public.idx_parents_tutor1_user;
DROP INDEX public.idx_parents_tutor2_user;
CREATE UNIQUE INDEX parents_tutor1_user_unique ON public.parents (tutor1_user_id) WHERE tutor1_user_id IS NOT NULL;
CREATE UNIQUE INDEX parents_tutor2_user_unique ON public.parents (tutor2_user_id) WHERE tutor2_user_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.fn_guard_compte_tuteur_unique()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $fn$
BEGIN
  IF NEW.tutor1_user_id IS NOT NULL AND NEW.tutor1_user_id = NEW.tutor2_user_id THEN
    RAISE EXCEPTION 'Un meme compte ne peut pas etre tuteur 1 et tuteur 2 du foyer.'
      USING ERRCODE = 'unique_violation';
  END IF;
  -- Les index uniques couvrent une meme place ; ici les places croisees.
  IF NEW.tutor1_user_id IS NOT NULL AND EXISTS (
       SELECT 1 FROM parents p WHERE p.id <> NEW.id AND p.tutor2_user_id = NEW.tutor1_user_id) THEN
    RAISE EXCEPTION 'Ce compte est deja tuteur 2 d''un autre foyer.' USING ERRCODE = 'unique_violation';
  END IF;
  IF NEW.tutor2_user_id IS NOT NULL AND EXISTS (
       SELECT 1 FROM parents p WHERE p.id <> NEW.id AND p.tutor1_user_id = NEW.tutor2_user_id) THEN
    RAISE EXCEPTION 'Ce compte est deja tuteur 1 d''un autre foyer.' USING ERRCODE = 'unique_violation';
  END IF;
  RETURN NEW;
END;
$fn$;

CREATE TRIGGER trg_guard_compte_tuteur_unique
  BEFORE INSERT OR UPDATE OF tutor1_user_id, tutor2_user_id ON public.parents
  FOR EACH ROW EXECUTE FUNCTION public.fn_guard_compte_tuteur_unique();

-- ── 4. Fonctions des regles parent ──────────────────────────────────────────

-- Le foyer du compte connecte, ou NULL. Seul juge de l'acces famille.
CREATE OR REPLACE FUNCTION public.foyer_du_compte()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $fn$
  SELECT p.id
    FROM parents p
    JOIN etablissements e ON e.id = p.etablissement_id
   WHERE (p.tutor1_user_id = auth.uid() OR p.tutor2_user_id = auth.uid())
     AND p.etablissement_id = current_etablissement_id()
     AND e.option_espace_famille
     AND coalesce(get_user_role(), '') = 'parent'
$fn$;

-- 1 ou 2 : la place du compte connecte dans son foyer (NULL hors acces).
CREATE OR REPLACE FUNCTION public.tuteur_du_compte()
 RETURNS smallint
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $fn$
  SELECT CASE WHEN p.tutor1_user_id = auth.uid() THEN 1 ELSE 2 END::smallint
    FROM parents p
   WHERE p.id = foyer_du_compte()
$fn$;

-- Classes de l'ANNEE EN COURS : celles des enfants actifs du foyer, et les
-- cours adultes ou CE tuteur est inscrit. Jamais une classe d'une annee passee.
CREATE OR REPLACE FUNCTION public.classes_du_compte()
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $fn$
  SELECT en.class_id
    FROM enrollments en
    JOIN students s ON s.id = en.student_id
    JOIN classes c ON c.id = en.class_id
    JOIN school_years y ON y.etablissement_id = c.etablissement_id AND y.is_current AND y.label = c.academic_year
   WHERE s.parent_id = foyer_du_compte() AND s.is_active AND en.status = 'active'
  UNION
  SELECT pce.class_id
    FROM parent_class_enrollments pce
    JOIN classes c ON c.id = pce.class_id
    JOIN school_years y ON y.etablissement_id = c.etablissement_id AND y.is_current AND y.label = c.academic_year
   WHERE pce.parent_id = foyer_du_compte() AND pce.tutor_number = tuteur_du_compte() AND pce.status = 'active'
$fn$;

-- Le devoir est-il celui d'un enfant du foyer, dans sa classe de l'annee ?
-- Fonction et non sous-requete : la regle d'acces de `students` ne laisse
-- rien lire au parent, une sous-requete y verrait une table vide.
CREATE OR REPLACE FUNCTION public.devoir_de_mon_enfant(p_homework_id uuid, p_student_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $fn$
  SELECT EXISTS (
    SELECT 1
      FROM homework h
      JOIN enrollments en ON en.class_id = h.class_id AND en.status = 'active'
      JOIN students s ON s.id = en.student_id
     WHERE h.id = p_homework_id
       AND s.id = p_student_id
       AND s.parent_id = foyer_du_compte()
       AND s.is_active
       AND h.class_id IN (SELECT classes_du_compte())
  )
$fn$;

-- Le devoir est-il celui d'un cours adulte suivi par CE tuteur ?
CREATE OR REPLACE FUNCTION public.devoir_de_mon_cours(p_homework_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $fn$
  SELECT EXISTS (
    SELECT 1
      FROM homework h
      JOIN parent_class_enrollments pce ON pce.class_id = h.class_id AND pce.status = 'active'
     WHERE h.id = p_homework_id
       AND pce.parent_id = foyer_du_compte()
       AND pce.tutor_number = tuteur_du_compte()
       AND h.class_id IN (SELECT classes_du_compte())
  )
$fn$;

REVOKE ALL ON FUNCTION public.foyer_du_compte() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.tuteur_du_compte() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.classes_du_compte() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.devoir_de_mon_enfant(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.devoir_de_mon_cours(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_guard_compte_tuteur_unique() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.foyer_du_compte() TO authenticated;
GRANT EXECUTE ON FUNCTION public.tuteur_du_compte() TO authenticated;
GRANT EXECUTE ON FUNCTION public.classes_du_compte() TO authenticated;
GRANT EXECUTE ON FUNCTION public.devoir_de_mon_enfant(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.devoir_de_mon_cours(uuid) TO authenticated;

-- ── 5. Regles parent reecrites ──────────────────────────────────────────────
DROP POLICY journal_parent_select ON public.class_journal;

DROP POLICY homework_parent_select ON public.homework;
CREATE POLICY homework_parent_select ON public.homework
  FOR SELECT TO authenticated
  USING (etablissement_id = current_etablissement_id()
         AND class_id IN (SELECT classes_du_compte()));

DROP POLICY notifications_select_parent ON public.notifications;
CREATE POLICY notifications_select_parent ON public.notifications
  FOR SELECT TO authenticated
  USING (etablissement_id = current_etablissement_id()
         AND parent_id = foyer_du_compte());

DROP POLICY hwstatus_parent_select ON public.homework_status;
DROP POLICY hwstatus_parent_insert ON public.homework_status;
DROP POLICY hwstatus_parent_update ON public.homework_status;
CREATE POLICY hwstatus_parent_select ON public.homework_status
  FOR SELECT TO authenticated
  USING (parent_id = foyer_du_compte() AND devoir_de_mon_enfant(homework_id, student_id));
CREATE POLICY hwstatus_parent_insert ON public.homework_status
  FOR INSERT TO authenticated
  WITH CHECK (parent_id = foyer_du_compte() AND devoir_de_mon_enfant(homework_id, student_id));
CREATE POLICY hwstatus_parent_update ON public.homework_status
  FOR UPDATE TO authenticated
  USING (parent_id = foyer_du_compte() AND devoir_de_mon_enfant(homework_id, student_id))
  WITH CHECK (parent_id = foyer_du_compte() AND devoir_de_mon_enfant(homework_id, student_id));

DROP POLICY adult_hwstatus_participant ON public.adult_homework_status;
CREATE POLICY adult_hwstatus_participant ON public.adult_homework_status
  FOR ALL TO authenticated
  USING (parent_id = foyer_du_compte() AND tutor_number = tuteur_du_compte() AND devoir_de_mon_cours(homework_id))
  WITH CHECK (parent_id = foyer_du_compte() AND tutor_number = tuteur_du_compte() AND devoir_de_mon_cours(homework_id));

-- ── Verification ────────────────────────────────────────────────────────────
DO $verif$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
              AND coalesce(qual, '') || coalesce(with_check, '') ~ '\mp\.user_id\M') THEN
    RAISE EXCEPTION 'une regle d''acces lit encore parents.user_id';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'journal_parent_select') THEN
    RAISE EXCEPTION 'journal_parent_select toujours presente';
  END IF;
  IF (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND policyname IN
      ('homework_parent_select', 'notifications_select_parent', 'hwstatus_parent_select',
       'hwstatus_parent_insert', 'hwstatus_parent_update', 'adult_hwstatus_participant')) <> 6 THEN
    RAISE EXCEPTION 'regles parent : 6 attendues';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.routine_privileges
              WHERE routine_schema = 'public' AND grantee IN ('anon', 'PUBLIC')
                AND routine_name IN ('foyer_du_compte', 'tuteur_du_compte', 'classes_du_compte',
                                     'devoir_de_mon_enfant', 'devoir_de_mon_cours',
                                     'fn_guard_compte_tuteur_unique')) THEN
    RAISE EXCEPTION 'fonctions espace famille executables par anon ou PUBLIC';
  END IF;
  IF EXISTS (SELECT 1 FROM etablissements WHERE option_espace_famille AND NOT est_demo) THEN
    RAISE EXCEPTION 'option ouverte hors demonstration';
  END IF;
END
$verif$;
SELECT enregistrer_migration('espace-famille-fondations.sql', '682cf08aded84d9ee063af9b5d4bc829b57a94f9adcae4f03be7a72359fed620');
