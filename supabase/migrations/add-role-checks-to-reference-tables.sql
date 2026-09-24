-- ============================================================================
-- BILAL EDUCATION — Tables de reference : controle de ROLE *et* de TENANT
-- ----------------------------------------------------------------------------
-- DEFAUT CONSTATE (24 septembre 2026), en ouvrant le tableau de bord d'un
-- COMPTABLE : tous les montants a zero, « 0 dossiers », mais les derniers
-- paiements bien affiches avec de vrais noms. Le contraste disait tout — la
-- liste des paiements n'est bornee par aucune annee, le reste l'est.
--
-- Mesure sous identite reelle (`SET LOCAL ROLE authenticated` + claims JWT) :
--
--   Table                reel  adm  dir  cpt  sec  rpe  ens
--   school_years            3    3    3    0    0    0    0
--   periods                 2    2    2    0    0    0    0
--   eval_type_configs       1    1    1    0    0    0    0
--   adult_grades            6    6    6    0    0    6    6
--
-- `school_years` n'avait qu'UNE policy, `FOR ALL`, reservee a admin/direction.
-- Quatre roles sur six ne voyaient donc AUCUNE annee scolaire — et **40
-- fichiers** lisent cette table : affectations, feuille d'appel, bulletins,
-- saisie de notes, emploi du temps, cahier de texte, communications, les trois
-- ecrans de Financements. `getCurrentYear()` rendait `null`, chaque ecran se
-- vidait SANS LE MOINDRE MESSAGE. C'est exactement le scenario annonce le
-- 5 aout : une policy trop stricte ne leve pas d'erreur, elle vide l'ecran.
--
-- ── CE QUE CETTE MIGRATION FERME EN PLUS DU SYMPTOME ───────────────────────
--
-- 1. QUATRE TROUS MULTI-TENANT. Les policies portaient le ROLE sans
--    l'ETABLISSEMENT (`get_user_role() = ANY (ARRAY['admin','direction'])`,
--    rien d'autre) : un admin de l'ecole A lisait et ECRIVAIT les annees, les
--    periodes et les types d'evaluation de l'ecole B. Defaut identique a celui
--    du referentiel des cours, corrige le 5 aout — le role sans le tenant.
--    . Consequence concrete deja presente dans le code : a l'activation d'une
--      annee, `SchoolYearForm` fait `.update({ is_current: false })` pour
--      desactiver les autres, SANS filtre d'etablissement. Aujourd'hui, activer
--      une annee dans l'ecole A desactive l'annee en cours de TOUTES les
--      ecoles. Invisible a un seul client, destructeur au second. La clause de
--      tenant posee ici borne cette ecriture a sa propre ecole.
--
-- 2. `adult_grades` N'AVAIT JAMAIS ETE REPRISE. Elle date du 10 juillet et a
--    garde son modele d'origine, ou `adult_grades_teacher_select` accordait la
--    lecture a TOUT enseignant **sans aucune restriction de classe** — alors
--    que ses propres policies d'ecriture, elles, verifiaient qu'il enseignait
--    bien la classe. Elle est desormais le calque exact de `grades`, son
--    miroir eleve : meme matrice, meme bornage a `teaches_class`.
--    . Effet de bord repare : la SECRETAIRE lisait `grades` (ouvert le 5 aout)
--      mais pas `adult_grades`. Sur une classe adulte, sa grille de saisie de
--      notes etait vide — et l'ecran Saisie notes lui est bien ouvert.
--
-- ── CE QUE CETTE MIGRATION N'OUVRE PAS ─────────────────────────────────────
--
-- Aucune ecriture nouvelle. Le comptable gagne la LECTURE des annees et des
-- periodes, rien de plus : il reste a zero sur `grades`, `absences` et
-- `evaluations`, conformement a la matrice du 5 aout.
--
-- `parent` reste EXCLU, comme des huit tables centrales. Les comptes parents
-- sont suspendus en V1, et leur tableau de bord lit aussi `grades` et
-- `absences`, qui leur sont fermees : ouvrir `school_years` seule ne les
-- reparerait pas. Le jour de leur activation, c'est une passe RLS complete
-- qu'il faudra, pas une ligne.
--
-- ── FORME ──────────────────────────────────────────────────────────────────
--
-- Motif du 5 aout : DEUX policies par table, `_select` et `_write` (FOR ALL),
-- portant tenant ET role. Les policies permissives s'additionnent (OR) : le
-- staff lit, seuls admin et direction ecrivent.
--
-- `periods` et `eval_type_configs` n'ont pas de colonne `etablissement_id` —
-- elles pendent a `school_year_id`. Leur cloisonnement CASCADE donc par
-- `school_years`, comme `cours_modules` passe par `unites_enseignement`.
--
-- Idempotent.
-- ============================================================================

-- ── school_years ────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Admin and direction can manage school years" ON public.school_years;
DROP POLICY IF EXISTS school_years_select ON public.school_years;
DROP POLICY IF EXISTS school_years_write  ON public.school_years;

CREATE POLICY school_years_select ON public.school_years FOR SELECT
  USING (
    etablissement_id = current_etablissement_id()
    AND coalesce(get_user_role(), '') = ANY (ARRAY['admin','direction','comptable',
                                                   'responsable_pedagogique','secretaire','enseignant'])
  );

CREATE POLICY school_years_write ON public.school_years FOR ALL
  USING (
    etablissement_id = current_etablissement_id()
    AND coalesce(get_user_role(), '') = ANY (ARRAY['admin','direction'])
  )
  WITH CHECK (
    etablissement_id = current_etablissement_id()
    AND coalesce(get_user_role(), '') = ANY (ARRAY['admin','direction'])
  );

-- ── periods (tenant en cascade par school_years) ─────────────────────────────

DROP POLICY IF EXISTS "Admin and direction can manage periods" ON public.periods;
DROP POLICY IF EXISTS periods_select ON public.periods;
DROP POLICY IF EXISTS periods_write  ON public.periods;

CREATE POLICY periods_select ON public.periods FOR SELECT
  USING (
    school_year_id IN (SELECT id FROM public.school_years
                        WHERE etablissement_id = current_etablissement_id())
    AND coalesce(get_user_role(), '') = ANY (ARRAY['admin','direction','comptable',
                                                   'responsable_pedagogique','secretaire','enseignant'])
  );

CREATE POLICY periods_write ON public.periods FOR ALL
  USING (
    school_year_id IN (SELECT id FROM public.school_years
                        WHERE etablissement_id = current_etablissement_id())
    AND coalesce(get_user_role(), '') = ANY (ARRAY['admin','direction'])
  )
  WITH CHECK (
    school_year_id IN (SELECT id FROM public.school_years
                        WHERE etablissement_id = current_etablissement_id())
    AND coalesce(get_user_role(), '') = ANY (ARRAY['admin','direction'])
  );

-- ── eval_type_configs (tenant en cascade par school_years) ───────────────────

DROP POLICY IF EXISTS "Admin and direction can manage eval type configs" ON public.eval_type_configs;
DROP POLICY IF EXISTS eval_type_configs_select ON public.eval_type_configs;
DROP POLICY IF EXISTS eval_type_configs_write  ON public.eval_type_configs;

CREATE POLICY eval_type_configs_select ON public.eval_type_configs FOR SELECT
  USING (
    school_year_id IN (SELECT id FROM public.school_years
                        WHERE etablissement_id = current_etablissement_id())
    AND coalesce(get_user_role(), '') = ANY (ARRAY['admin','direction','comptable',
                                                   'responsable_pedagogique','secretaire','enseignant'])
  );

CREATE POLICY eval_type_configs_write ON public.eval_type_configs FOR ALL
  USING (
    school_year_id IN (SELECT id FROM public.school_years
                        WHERE etablissement_id = current_etablissement_id())
    AND coalesce(get_user_role(), '') = ANY (ARRAY['admin','direction'])
  )
  WITH CHECK (
    school_year_id IN (SELECT id FROM public.school_years
                        WHERE etablissement_id = current_etablissement_id())
    AND coalesce(get_user_role(), '') = ANY (ARRAY['admin','direction'])
  );

-- ── adult_grades : calque exact de `grades`, son miroir eleve ────────────────
-- `adult_grades` porte `etablissement_id` en propre : le cloisonnement est
-- direct, la ou `grades` doit passer par `students`.

DROP POLICY IF EXISTS adult_grades_admin_all      ON public.adult_grades;
DROP POLICY IF EXISTS adult_grades_teacher_select ON public.adult_grades;
DROP POLICY IF EXISTS adult_grades_teacher_insert ON public.adult_grades;
DROP POLICY IF EXISTS adult_grades_teacher_update ON public.adult_grades;
DROP POLICY IF EXISTS adult_grades_teacher_delete ON public.adult_grades;
DROP POLICY IF EXISTS adult_grades_select         ON public.adult_grades;
DROP POLICY IF EXISTS adult_grades_write          ON public.adult_grades;

CREATE POLICY adult_grades_select ON public.adult_grades FOR SELECT
  USING (
    etablissement_id = current_etablissement_id()
    AND (
      coalesce(get_user_role(), '') = ANY (ARRAY['admin','direction','responsable_pedagogique','secretaire'])
      OR (
        get_user_role() = 'enseignant'
        AND EXISTS (SELECT 1 FROM public.evaluations e
                     WHERE e.id = adult_grades.evaluation_id AND teaches_class(e.class_id))
      )
    )
  );

CREATE POLICY adult_grades_write ON public.adult_grades FOR ALL
  USING (
    etablissement_id = current_etablissement_id()
    AND (
      coalesce(get_user_role(), '') = ANY (ARRAY['admin','direction','responsable_pedagogique','secretaire'])
      OR (
        get_user_role() = 'enseignant'
        AND EXISTS (SELECT 1 FROM public.evaluations e
                     WHERE e.id = adult_grades.evaluation_id AND teaches_class(e.class_id))
      )
    )
  )
  WITH CHECK (
    etablissement_id = current_etablissement_id()
    AND (
      coalesce(get_user_role(), '') = ANY (ARRAY['admin','direction','responsable_pedagogique','secretaire'])
      OR (
        get_user_role() = 'enseignant'
        AND EXISTS (SELECT 1 FROM public.evaluations e
                     WHERE e.id = adult_grades.evaluation_id AND teaches_class(e.class_id))
      )
    )
  );

SELECT 'Tables de reference : lecture ouverte au staff, ecriture admin/direction, tenant pose sur les 4.' AS status;
