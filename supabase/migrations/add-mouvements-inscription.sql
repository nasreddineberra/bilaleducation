-- ============================================================================
-- MOUVEMENTS D'INSCRIPTION : TRACE DE CHAQUE AFFECTATION ET DESAFFECTATION
-- (26 octobre 2026)
--
-- Constat : retirer un enfant de sa classe SUPPRIME son inscription. Sa
-- cotisation disparait du du du foyer, en totalite, sans que rien ne le dise :
-- l'application tranchait seule une question qui appartient a l'etablissement
-- (que doit un foyer dont un enfant part, ou arrive, en cours d'annee ?).
--
-- Decisions de l'utilisateur (26/10) :
--   - reglage PAR ETABLISSEMENT, quatre choix : sans ajustement (defaut, le
--     comportement actuel : l'enfant present doit l'annee, l'enfant parti ne
--     doit plus rien), due en totalite, au prorata (mois commence), au cas par
--     cas ; meme regle pour les arrivees et les departs ;
--   - TOUT mouvement est trace (affectation, desaffectation), avec date, heure
--     et auteur ; la regle en vigueur est FIGEE sur le mouvement ;
--   - la regle ne s'applique qu'APRES la date de rentree (`date_effet`) ;
--   - frais d'inscription dus dans tous les cas ; un enfant parti garde sa
--     place dans l'ordre de la remise fratrie ; changement de classe le meme
--     jour = transfert.
--
-- CE LOT N'A AUCUN EFFET SUR LES MONTANTS. Il pose le reglage (valeur par
-- defaut seulement, aucun ecran ne le modifie encore) et commence a accumuler
-- la trace. Le calcul (`lib/financements/compute.ts`) viendra au lot suivant.
--
-- POURQUOI DES DECLENCHEURS : un mouvement se fait par Affectations, par les
-- statuts en lot (eleve rendu inactif), par la fiche foyer ou par une RPC. La
-- base est le seul point par lequel ils passent TOUS ; la trace est ecrite dans
-- la meme transaction que le mouvement, aucun ne peut lui echapper.
--
-- POURQUOI UNE TABLE A PART, ET NON `audit_logs` : le journal ne trace jamais
-- les comptes `admin` ni l'editeur (16/10). Une trace financiere ne peut pas
-- avoir de trous : ici, l'auteur est enregistre quel que soit son role.
--
-- CE QUI N'EST PAS TRACE, a dessein :
--   - l'effacement d'une ecole (`fn_effacement_en_cours`) ;
--   - les cascades de suppression (eleve, foyer ou classe qui disparait :
--     seule une fiche VIERGE se supprime, et la remise a zero de la
--     demonstration passe par la) ;
--   - une annee CLOSE (verrouillee).
--
-- Ecriture : SECURITY DEFINER, la table n'a AUCUNE policy d'ecriture (seuls les
-- declencheurs l'ecrivent). Lecture : direction, admin, comptable de l'ecole.
-- Depart d'une ecole : la colonne `etablissement_id` la classe d'office
-- (exportee et effacee, `fn_depart_tables`).
--
-- Changement ADDITIF : migration d'abord.
-- Controle : supabase/controles/21-mouvements-inscription.sql.
-- ============================================================================

-- ── 1. Le reglage de l'etablissement ──────────────────────────────────────────
ALTER TABLE public.etablissements
  ADD COLUMN IF NOT EXISTS regle_ajustement text NOT NULL DEFAULT 'sans_ajustement',
  ADD COLUMN IF NOT EXISTS regle_ajustement_par uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS regle_ajustement_le  timestamptz;

DO $chk$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'etablissements_regle_ajustement_check') THEN
    ALTER TABLE public.etablissements
      ADD CONSTRAINT etablissements_regle_ajustement_check
      CHECK (regle_ajustement IN ('sans_ajustement', 'due', 'prorata', 'cas_par_cas'));
  END IF;
END
$chk$;

-- ── 2. La trace ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mouvements_inscription (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  etablissement_id   uuid NOT NULL REFERENCES public.etablissements(id) ON DELETE CASCADE,
  school_year_id     uuid REFERENCES public.school_years(id) ON DELETE CASCADE,
  parent_id          uuid REFERENCES public.parents(id) ON DELETE CASCADE,
  -- Un eleve OU un adulte (tuteur `parent_id` + `tutor_number`), jamais les deux.
  student_id         uuid REFERENCES public.students(id) ON DELETE CASCADE,
  tutor_number       smallint CHECK (tutor_number IN (1, 2)),
  class_id           uuid REFERENCES public.classes(id) ON DELETE SET NULL,
  sens               text NOT NULL CHECK (sens IN ('arrivee', 'depart')),
  -- `affectation` : ecran Affectations, fiche foyer, RPC ; `statut` : eleve
  -- rendu inactif ou reactive.
  motif              text NOT NULL CHECK (motif IN ('affectation', 'statut')),
  survenu_le         timestamptz NOT NULL DEFAULT now(),
  -- Date a laquelle le mouvement PREND EFFET : la date d'inscription pour une
  -- arrivee (la demonstration et l'import la posent a la rentree), le jour meme
  -- pour un depart. C'est elle que la regle compare a la rentree.
  date_effet         date NOT NULL,
  -- Pour un depart : depuis quand l'inscription courait.
  date_arrivee       date,
  auteur_id          uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  auteur_nom         text,
  -- Instantane : le libelle et les montants AU MOMENT du mouvement.
  classe_nom         text,
  cotisation_type_id uuid REFERENCES public.cotisation_types(id) ON DELETE SET NULL,
  cotisation_libelle text,
  cotisation_montant numeric(10,2),
  frais_inscription  numeric(10,2),
  -- La regle de l'etablissement, FIGEE au mouvement.
  regle              text NOT NULL CHECK (regle IN ('sans_ajustement', 'due', 'prorata', 'cas_par_cas')),
  -- Au cas par cas : ce que l'ecole a decide, par qui, quand (lot suivant).
  decision           text CHECK (decision IN ('sans_ajustement', 'due', 'prorata')),
  decide_par         uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  decide_le          timestamptz,
  CONSTRAINT mouvements_inscription_eleve_ou_adulte
    CHECK ((student_id IS NOT NULL) <> (tutor_number IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_mouvements_inscription_foyer
  ON public.mouvements_inscription (etablissement_id, school_year_id, parent_id);
CREATE INDEX IF NOT EXISTS idx_mouvements_inscription_eleve
  ON public.mouvements_inscription (student_id);

ALTER TABLE public.mouvements_inscription ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mouvements_inscription_select ON public.mouvements_inscription;
CREATE POLICY mouvements_inscription_select ON public.mouvements_inscription FOR SELECT
  USING (etablissement_id = current_etablissement_id()
         AND coalesce(get_user_role(), '') IN ('admin', 'direction', 'comptable'));

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.mouvements_inscription FROM public, anon, authenticated;
GRANT SELECT ON public.mouvements_inscription TO authenticated;

-- ── 3. L'ecriture d'un mouvement ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_mouvement_inscrire(
  p_student_id   uuid,
  p_parent_id    uuid,
  p_tutor_number smallint,
  p_class_id     uuid,
  p_sens         text,
  p_motif        text,
  p_date_effet   date,
  p_date_arrivee date
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_classe record;
  v_annee  record;
  v_parent uuid := p_parent_id;
  v_regle  text;
  v_auteur text;
BEGIN
  IF public.fn_effacement_en_cours() THEN RETURN; END IF;

  -- Cascade de suppression : la fiche qui portait l'inscription n'existe plus.
  SELECT c.id, c.etablissement_id, c.name, c.academic_year,
         ct.id AS ct_id, ct.label AS ct_label, ct.amount, ct.registration_fee
    INTO v_classe
    FROM classes c
    LEFT JOIN cotisation_types ct ON ct.id = c.cotisation_type_id
   WHERE c.id = p_class_id;
  IF NOT FOUND THEN RETURN; END IF;

  IF p_student_id IS NOT NULL THEN
    SELECT parent_id INTO v_parent FROM students WHERE id = p_student_id;
    IF NOT FOUND THEN RETURN; END IF;
  ELSIF NOT EXISTS (SELECT 1 FROM parents WHERE id = p_parent_id) THEN
    RETURN;
  END IF;

  SELECT id, closed_at INTO v_annee
    FROM school_years
   WHERE etablissement_id = v_classe.etablissement_id AND label = v_classe.academic_year;
  IF FOUND AND v_annee.closed_at IS NOT NULL THEN RETURN; END IF;

  SELECT regle_ajustement INTO v_regle FROM etablissements WHERE id = v_classe.etablissement_id;

  SELECT nullif(btrim(concat_ws(' ', upper(last_name), first_name)), '') INTO v_auteur
    FROM profiles WHERE id = auth.uid();

  INSERT INTO mouvements_inscription (
    etablissement_id, school_year_id, parent_id, student_id, tutor_number, class_id,
    sens, motif, date_effet, date_arrivee, auteur_id, auteur_nom,
    classe_nom, cotisation_type_id, cotisation_libelle, cotisation_montant, frais_inscription, regle)
  VALUES (
    v_classe.etablissement_id, v_annee.id, v_parent, p_student_id, p_tutor_number, p_class_id,
    p_sens, p_motif, coalesce(p_date_effet, current_date), p_date_arrivee,
    -- `auth.uid()` est NULL depuis l'editeur SQL : l'auteur reste vide, rien n'est invente.
    (SELECT id FROM profiles WHERE id = auth.uid()), v_auteur,
    v_classe.name, v_classe.ct_id, v_classe.ct_label, v_classe.amount, v_classe.registration_fee,
    coalesce(v_regle, 'sans_ajustement'));
END
$fn$;

REVOKE EXECUTE ON FUNCTION public.fn_mouvement_inscrire(uuid, uuid, smallint, uuid, text, text, date, date)
  FROM public, anon, authenticated;

-- ── 4. Les declencheurs ───────────────────────────────────────────────────────
-- Une inscription compte quand elle est `active`. Toute transition de cet etat
-- (ajout, retrait, changement de statut ou de classe) est un mouvement ; une
-- mise a jour qui ne change ni l'un ni l'autre n'en est pas un.

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
    PERFORM fn_mouvement_inscrire(OLD.student_id, NULL, NULL, OLD.class_id,
                                  'depart', 'affectation', current_date, OLD.enrollment_date);
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
    PERFORM fn_mouvement_inscrire(NULL, OLD.parent_id, OLD.tutor_number, OLD.class_id,
                                  'depart', 'affectation', current_date, OLD.enrollment_date);
  END IF;
  IF v_est AND NOT (v_etait AND v_meme) THEN
    PERFORM fn_mouvement_inscrire(NULL, NEW.parent_id, NEW.tutor_number, NEW.class_id,
                                  'arrivee', 'affectation', NEW.enrollment_date, NULL);
  END IF;
  RETURN NULL;
END
$fn$;

-- Eleve rendu inactif / reactive : chacune de ses inscriptions actives part ou
-- revient (l'ecran Reglements ne compte que les eleves actifs).
CREATE OR REPLACE FUNCTION public.fn_mouvement_students()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  r record;
BEGIN
  IF coalesce(OLD.is_active, false) = coalesce(NEW.is_active, false) THEN RETURN NULL; END IF;
  FOR r IN SELECT class_id, enrollment_date FROM enrollments
            WHERE student_id = NEW.id AND status = 'active' LOOP
    IF coalesce(NEW.is_active, false) THEN
      PERFORM fn_mouvement_inscrire(NEW.id, NULL, NULL, r.class_id, 'arrivee', 'statut', current_date, NULL);
    ELSE
      PERFORM fn_mouvement_inscrire(NEW.id, NULL, NULL, r.class_id, 'depart', 'statut', current_date, r.enrollment_date);
    END IF;
  END LOOP;
  RETURN NULL;
END
$fn$;

REVOKE EXECUTE ON FUNCTION public.fn_mouvement_enrollments() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_mouvement_parent_class_enrollments() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_mouvement_students() FROM public, anon, authenticated;

DROP TRIGGER IF EXISTS trg_mouvement_enrollments ON public.enrollments;
CREATE TRIGGER trg_mouvement_enrollments
  AFTER INSERT OR DELETE OR UPDATE OF status, class_id, student_id ON public.enrollments
  FOR EACH ROW EXECUTE FUNCTION public.fn_mouvement_enrollments();

DROP TRIGGER IF EXISTS trg_mouvement_parent_class_enrollments ON public.parent_class_enrollments;
CREATE TRIGGER trg_mouvement_parent_class_enrollments
  AFTER INSERT OR DELETE OR UPDATE OF status, class_id, parent_id, tutor_number ON public.parent_class_enrollments
  FOR EACH ROW EXECUTE FUNCTION public.fn_mouvement_parent_class_enrollments();

DROP TRIGGER IF EXISTS trg_mouvement_students ON public.students;
CREATE TRIGGER trg_mouvement_students
  AFTER UPDATE OF is_active ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.fn_mouvement_students();

SELECT enregistrer_migration('add-mouvements-inscription.sql', 'b8d21d5e4609213b69a6604e45ff73e693c2298407c04d45e8ca05282df3bd4c');
