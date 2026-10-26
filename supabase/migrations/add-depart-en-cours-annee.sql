-- ============================================================================
-- DEPART EN COURS D'ANNEE : DECLARATION, REGLE DE L'ETABLISSEMENT, DECISIONS
-- (26 octobre 2026) · lot 2 de `add-mouvements-inscription.sql`
--
-- Constat du lot 1 : un enfant qui a frequente sa classe ne pouvait PAS partir.
-- Le retrait (DELETE) est refuse des qu'il porte une note, une absence ou un
-- bulletin (`fn_block_student_unenroll`), et « Rendre inactif » exige qu'il ne
-- soit plus affecte. Le seul retrait possible etait celui d'un enfant sans
-- aucune donnee : une affectation faite PAR ERREUR, pas un depart.
--
-- Decisions de l'utilisateur (26/10) :
--   - deux gestes qui ne se recouvrent pas :
--       CORRECTION : retrait dans Affectations, enfant SANS donnees ; inscription
--                    supprimee, tracee sans montant (motif `correction`) ;
--       DEPART     : « Declarer un depart », enfant AVEC donnees (celles qui
--                    bloquent le retrait : notes reelles, absences, retards,
--                    bulletins archives) ; inscription passee en `withdrawn`
--                    avec sa date, eleve rendu inactif, regle appliquee ;
--   - la regle ne concerne que les DEPARTS (une arrivee doit l'annee) ;
--   - prorata au mois commence, compte depuis la rentree ; frais d'inscription
--     toujours dus ; « au cas par cas » : l'ecole decide sur chaque depart.
--
-- AUCUN GARDE-FOU N'EST CONTOURNE : rien n'est supprime (les notes, absences et
-- bulletins restent rattaches a l'eleve et a la classe) ; l'eleve n'est rendu
-- inactif qu'une fois son inscription sortie de l'etat `active`, dans la meme
-- transaction.
--
-- Changement ADDITIF (colonnes, fonctions, valeurs de CHECK elargies) :
-- migration d'abord. Controle : supabase/controles/22-depart-en-cours-annee.sql.
-- ============================================================================

-- ── 1. Colonnes ───────────────────────────────────────────────────────────────
ALTER TABLE public.enrollments              ADD COLUMN IF NOT EXISTS date_depart date;
ALTER TABLE public.parent_class_enrollments ADD COLUMN IF NOT EXISTS date_depart date;
-- L'historique de cloture garde la trace d'un enfant parti en cours d'annee.
ALTER TABLE public.student_year_history     ADD COLUMN IF NOT EXISTS date_depart date;

-- Un adulte parti : meme etat que cote eleve (la contrainte n'avait que deux valeurs).
ALTER TABLE public.mouvements_inscription DROP CONSTRAINT IF EXISTS mouvements_inscription_motif_check;
ALTER TABLE public.mouvements_inscription
  ADD CONSTRAINT mouvements_inscription_motif_check
  CHECK (motif IN ('affectation', 'correction', 'depart', 'statut'));

-- Les retraits traces par le lot 1 etaient des suppressions : des corrections.
UPDATE public.mouvements_inscription SET motif = 'correction'
 WHERE sens = 'depart' AND motif = 'affectation';

-- ── 2. Le declencheur distingue correction et depart ──────────────────────────
CREATE OR REPLACE FUNCTION public.fn_mouvement_enrollments()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_etait boolean := TG_OP <> 'INSERT' AND OLD.status = 'active';
  v_est   boolean := TG_OP <> 'DELETE' AND NEW.status = 'active';
  v_meme  boolean := TG_OP = 'UPDATE' AND OLD.class_id = NEW.class_id AND OLD.student_id = NEW.student_id;
BEGIN
  IF v_etait AND NOT (v_est AND v_meme) THEN
    IF TG_OP = 'UPDATE' AND v_meme THEN
      -- L'inscription reste, elle sort de l'etat actif : un DEPART.
      PERFORM fn_mouvement_inscrire(OLD.student_id, NULL, NULL, OLD.class_id,
                                    'depart', 'depart', coalesce(NEW.date_depart, current_date), OLD.enrollment_date);
    ELSE
      PERFORM fn_mouvement_inscrire(OLD.student_id, NULL, NULL, OLD.class_id,
                                    'depart', 'correction', current_date, OLD.enrollment_date);
    END IF;
  END IF;
  IF v_est AND NOT (v_etait AND v_meme) THEN
    PERFORM fn_mouvement_inscrire(NEW.student_id, NULL, NULL, NEW.class_id,
                                  'arrivee', 'affectation', NEW.enrollment_date, NULL);
  END IF;
  RETURN NULL;
END
$fn$;

CREATE OR REPLACE FUNCTION public.fn_mouvement_parent_class_enrollments()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_etait boolean := TG_OP <> 'INSERT' AND OLD.status = 'active';
  v_est   boolean := TG_OP <> 'DELETE' AND NEW.status = 'active';
  v_meme  boolean := TG_OP = 'UPDATE' AND OLD.class_id = NEW.class_id
                     AND OLD.parent_id = NEW.parent_id AND OLD.tutor_number = NEW.tutor_number;
BEGIN
  IF v_etait AND NOT (v_est AND v_meme) THEN
    IF TG_OP = 'UPDATE' AND v_meme THEN
      PERFORM fn_mouvement_inscrire(NULL, OLD.parent_id, OLD.tutor_number, OLD.class_id,
                                    'depart', 'depart', coalesce(NEW.date_depart, current_date), OLD.enrollment_date);
    ELSE
      PERFORM fn_mouvement_inscrire(NULL, OLD.parent_id, OLD.tutor_number, OLD.class_id,
                                    'depart', 'correction', current_date, OLD.enrollment_date);
    END IF;
  END IF;
  IF v_est AND NOT (v_etait AND v_meme) THEN
    PERFORM fn_mouvement_inscrire(NULL, NEW.parent_id, NEW.tutor_number, NEW.class_id,
                                  'arrivee', 'affectation', NEW.enrollment_date, NULL);
  END IF;
  RETURN NULL;
END
$fn$;

-- La date de depart compte dans la transition (mise a jour du declencheur).
DROP TRIGGER IF EXISTS trg_mouvement_enrollments ON public.enrollments;
CREATE TRIGGER trg_mouvement_enrollments
  AFTER INSERT OR DELETE OR UPDATE OF status, class_id, student_id ON public.enrollments
  FOR EACH ROW EXECUTE FUNCTION public.fn_mouvement_enrollments();

-- ── 3. « A des donnees » : la regle qui separe correction et depart ───────────
-- Meme liste que le diagnostic de retrait (`affectation/actions.ts`, `bloquants`) :
-- ce qui empeche le retrait AUTORISE le depart, et reciproquement. Les
-- appreciations seules n'en font pas partie (le retrait les supprime apres
-- confirmation).
CREATE OR REPLACE FUNCTION public.fn_eleve_a_donnees(p_student_id uuid, p_class_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
  SELECT EXISTS (SELECT 1 FROM grades g JOIN evaluations e ON e.id = g.evaluation_id
                  WHERE e.class_id = p_class_id AND g.student_id = p_student_id
                    AND (g.score IS NOT NULL OR btrim(coalesce(g.comment, '')) <> '' OR coalesce(g.is_absent, false)))
      OR EXISTS (SELECT 1 FROM absences WHERE class_id = p_class_id AND student_id = p_student_id)
      OR EXISTS (SELECT 1 FROM bulletin_archives WHERE class_id = p_class_id AND student_id = p_student_id)
$fn$;

CREATE OR REPLACE FUNCTION public.fn_adulte_a_donnees(p_parent_id uuid, p_tutor_number smallint, p_class_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
  SELECT EXISTS (SELECT 1 FROM adult_grades g JOIN evaluations e ON e.id = g.evaluation_id
                  WHERE e.class_id = p_class_id AND g.parent_id = p_parent_id AND g.tutor_number = p_tutor_number
                    AND (g.score IS NOT NULL OR btrim(coalesce(g.comment, '')) <> '' OR coalesce(g.is_absent, false)))
      OR EXISTS (SELECT 1 FROM adult_bulletin_archives
                  WHERE class_id = p_class_id AND parent_id = p_parent_id AND tutor_number = p_tutor_number)
$fn$;

REVOKE EXECUTE ON FUNCTION public.fn_eleve_a_donnees(uuid, uuid) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.fn_adulte_a_donnees(uuid, smallint, uuid) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.fn_eleve_a_donnees(uuid, uuid) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.fn_adulte_a_donnees(uuid, smallint, uuid) TO authenticated;

-- ── 4. Declarer un depart ─────────────────────────────────────────────────────
-- SECURITY INVOKER : la RLS d'`enrollments` et de `students` s'applique, et le
-- journal capte l'appelant. Les deux ecritures sont dans la meme transaction.
CREATE OR REPLACE FUNCTION public.fn_annee_courante_bornes(p_date date)
RETURNS void
LANGUAGE plpgsql
STABLE
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_annee record;
BEGIN
  SELECT start_date, end_date, closed_at INTO v_annee
    FROM school_years WHERE etablissement_id = current_etablissement_id() AND is_current;
  IF NOT FOUND THEN RAISE EXCEPTION 'DEPART_SANS_ANNEE' USING HINT = 'Aucune annee scolaire en cours.'; END IF;
  IF v_annee.closed_at IS NOT NULL THEN
    RAISE EXCEPTION 'DEPART_ANNEE_CLOSE' USING HINT = 'L''annee scolaire est close.';
  END IF;
  IF p_date IS NULL
     OR (v_annee.start_date IS NOT NULL AND p_date < v_annee.start_date)
     OR (v_annee.end_date   IS NOT NULL AND p_date > v_annee.end_date) THEN
    RAISE EXCEPTION 'DEPART_DATE_HORS_ANNEE'
      USING HINT = format('La date de depart doit etre comprise entre le %s et le %s.',
                          to_char(v_annee.start_date, 'DD/MM/YYYY'), to_char(v_annee.end_date, 'DD/MM/YYYY'));
  END IF;
END
$fn$;

CREATE OR REPLACE FUNCTION public.declarer_depart_eleve(p_student_id uuid, p_date date)
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_enr uuid;
  v_cls uuid;
  n     integer;
BEGIN
  IF coalesce(get_user_role(), '') NOT IN ('admin', 'direction', 'responsable_pedagogique', 'secretaire') THEN
    RAISE EXCEPTION 'DEPART_REFUSE' USING HINT = 'Votre role ne permet pas de declarer un depart.';
  END IF;
  PERFORM fn_annee_courante_bornes(p_date);

  SELECT e.id, e.class_id INTO v_enr, v_cls
    FROM enrollments e
    JOIN classes c ON c.id = e.class_id
    JOIN school_years sy ON sy.etablissement_id = c.etablissement_id AND sy.label = c.academic_year AND sy.is_current
   WHERE e.student_id = p_student_id AND e.status = 'active'
     AND c.etablissement_id = current_etablissement_id();
  IF v_enr IS NULL THEN
    RAISE EXCEPTION 'DEPART_SANS_CLASSE' USING HINT = 'Cet apprenant n''est affecte a aucune classe cette annee.';
  END IF;
  IF NOT fn_eleve_a_donnees(p_student_id, v_cls) THEN
    RAISE EXCEPTION 'DEPART_SANS_DONNEES'
      USING HINT = 'Aucune note ni absence : retirez-le de sa classe depuis Affectations.';
  END IF;

  UPDATE enrollments SET status = 'withdrawn', date_depart = p_date WHERE id = v_enr;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'DEPART_REFUSE' USING HINT = 'L''inscription n''a pas pu etre modifiee.'; END IF;

  UPDATE students SET is_active = false WHERE id = p_student_id;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'DEPART_REFUSE' USING HINT = 'L''apprenant n''a pas pu etre rendu inactif.'; END IF;
END
$fn$;

CREATE OR REPLACE FUNCTION public.declarer_depart_adulte(p_parent_id uuid, p_tutor_number smallint, p_class_id uuid, p_date date)
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  n integer;
BEGIN
  IF coalesce(get_user_role(), '') NOT IN ('admin', 'direction', 'responsable_pedagogique', 'secretaire') THEN
    RAISE EXCEPTION 'DEPART_REFUSE' USING HINT = 'Votre role ne permet pas de declarer un depart.';
  END IF;
  PERFORM fn_annee_courante_bornes(p_date);

  IF NOT EXISTS (
    SELECT 1 FROM parent_class_enrollments pce
      JOIN classes c ON c.id = pce.class_id
      JOIN school_years sy ON sy.etablissement_id = c.etablissement_id AND sy.label = c.academic_year AND sy.is_current
     WHERE pce.parent_id = p_parent_id AND pce.tutor_number = p_tutor_number AND pce.class_id = p_class_id
       AND pce.status = 'active' AND pce.etablissement_id = current_etablissement_id()
  ) THEN
    RAISE EXCEPTION 'DEPART_SANS_CLASSE' USING HINT = 'Ce tuteur n''est pas inscrit a cette classe cette annee.';
  END IF;
  IF NOT fn_adulte_a_donnees(p_parent_id, p_tutor_number, p_class_id) THEN
    RAISE EXCEPTION 'DEPART_SANS_DONNEES'
      USING HINT = 'Aucune note ni bulletin : retirez-le de sa classe depuis Affectations.';
  END IF;

  UPDATE parent_class_enrollments SET status = 'withdrawn', date_depart = p_date
   WHERE parent_id = p_parent_id AND tutor_number = p_tutor_number AND class_id = p_class_id AND status = 'active';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'DEPART_REFUSE' USING HINT = 'L''inscription n''a pas pu etre modifiee.'; END IF;
END
$fn$;

REVOKE EXECUTE ON FUNCTION public.fn_annee_courante_bornes(date) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.declarer_depart_eleve(uuid, date) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.declarer_depart_adulte(uuid, smallint, uuid, date) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.fn_annee_courante_bornes(date) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.declarer_depart_eleve(uuid, date) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.declarer_depart_adulte(uuid, smallint, uuid, date) TO authenticated;

-- ── 5. Le reglage de l'etablissement ──────────────────────────────────────────
-- DEFINER : la policy d'`etablissements` reserve l'ecriture a admin / direction,
-- le reglage est aussi ouvert a la comptabilite (memes roles que les cotisations).
-- La fonction n'ecrit QUE ces trois colonnes, de l'ecole de l'appelant.
CREATE OR REPLACE FUNCTION public.definir_regle_ajustement(p_regle text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  n integer;
BEGIN
  IF coalesce(get_user_role(), '') NOT IN ('admin', 'direction', 'comptable') THEN
    RAISE EXCEPTION 'REGLE_REFUSEE' USING HINT = 'Votre role ne permet pas de modifier ce reglage.';
  END IF;
  IF p_regle NOT IN ('sans_ajustement', 'due', 'prorata', 'cas_par_cas') THEN
    RAISE EXCEPTION 'REGLE_INCONNUE';
  END IF;
  UPDATE etablissements
     SET regle_ajustement = p_regle, regle_ajustement_par = auth.uid(), regle_ajustement_le = now()
   WHERE id = current_etablissement_id();
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'REGLE_REFUSEE' USING HINT = 'Etablissement introuvable.'; END IF;
END
$fn$;

-- ── 6. Au cas par cas : la decision de l'ecole sur un depart ──────────────────
CREATE OR REPLACE FUNCTION public.decider_mouvement(p_id uuid, p_decision text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  n integer;
BEGIN
  IF coalesce(get_user_role(), '') NOT IN ('admin', 'direction', 'comptable') THEN
    RAISE EXCEPTION 'DECISION_REFUSEE' USING HINT = 'Votre role ne permet pas de decider d''un depart.';
  END IF;
  IF p_decision NOT IN ('sans_ajustement', 'due', 'prorata') THEN
    RAISE EXCEPTION 'DECISION_INCONNUE';
  END IF;
  UPDATE mouvements_inscription m
     SET decision = p_decision, decide_par = auth.uid(), decide_le = now()
    FROM school_years sy
   WHERE m.id = p_id
     AND m.etablissement_id = current_etablissement_id()
     AND m.sens = 'depart' AND m.motif = 'depart' AND m.regle = 'cas_par_cas'
     AND sy.id = m.school_year_id AND sy.closed_at IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN
    RAISE EXCEPTION 'DECISION_REFUSEE' USING HINT = 'Ce mouvement n''attend pas de decision, ou son annee est close.';
  END IF;
END
$fn$;

REVOKE EXECUTE ON FUNCTION public.definir_regle_ajustement(text) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.decider_mouvement(uuid, text) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.definir_regle_ajustement(text) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.decider_mouvement(uuid, text) TO authenticated;

SELECT enregistrer_migration('add-depart-en-cours-annee.sql', 'b31843cbf19cd276c81710978b0a9edd93a6cb80e5bba8b2e828167f133d8475');
