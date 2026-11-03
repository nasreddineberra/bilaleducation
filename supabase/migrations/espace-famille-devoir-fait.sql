-- ============================================================================
-- Espace famille, lot 3 : devoir fait (03/11)
--
-- Decision 6 : « Effectue » est reversible jusqu'a la date de rendu incluse,
-- fige ensuite. Plan : docs/ESPACE-FAMILLE.md.
--
-- CETTE MIGRATION :
--   1. `fn_statut_devoir` (BEFORE INSERT OR UPDATE) sur `homework_status` et
--      `adult_homework_status` :
--        - gel : `is_done` ne change plus apres la date de rendu (jour de Paris) ;
--          `is_seen` reste libre (ouvrir un devoir passe n'est pas tricher) ;
--        - horodatage par la base : `done_at` / `seen_at` = now() a la bascule
--          vers vrai, NULL vers faux, conserve sinon ; la valeur envoyee par le
--          navigateur est ignoree ;
--        - identite figee : devoir, foyer, enfant ou numero de tuteur ne
--          changent pas a la modification.
--   2. `adult_hwstatus_participant` (FOR ALL) remplacee par lecture, creation et
--      modification : la suppression contournait le gel.
--
-- RESTRICTIVE : code d'abord (l'ecran ecrit par upsert et lit l'horodatage
-- rendu par la base). Sans effet sur les ecoles : aucun compte parent.
-- Declencheur generique : colonnes propres a une table lues par to_jsonb.
-- Controle : supabase/controles/39-espace-famille-devoir-fait.sql.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_statut_devoir()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_rendu date;
  v_jour  date := (now() AT TIME ZONE 'Europe/Paris')::date;
  v_avant jsonb;
  v_apres jsonb := to_jsonb(NEW);
BEGIN
  SELECT h.due_date INTO v_rendu FROM homework h WHERE h.id = NEW.homework_id;

  IF TG_OP = 'UPDATE' THEN
    v_avant := to_jsonb(OLD);
    IF NEW.homework_id IS DISTINCT FROM OLD.homework_id
       OR NEW.parent_id IS DISTINCT FROM OLD.parent_id
       OR (v_apres->>'student_id') IS DISTINCT FROM (v_avant->>'student_id')
       OR (v_apres->>'tutor_number') IS DISTINCT FROM (v_avant->>'tutor_number') THEN
      RAISE EXCEPTION 'Un suivi de devoir ne change ni de devoir ni de participant.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  IF ((TG_OP = 'INSERT' AND NEW.is_done)
      OR (TG_OP = 'UPDATE' AND NEW.is_done IS DISTINCT FROM OLD.is_done))
     AND v_jour > v_rendu THEN
    RAISE EXCEPTION 'La date de rendu est passée : « Effectué » ne peut plus être modifié.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.done_at := CASE WHEN NEW.is_done THEN now() END;
    NEW.seen_at := CASE WHEN NEW.is_seen THEN now() END;
  ELSE
    NEW.done_at := CASE WHEN NOT NEW.is_done THEN NULL WHEN OLD.is_done THEN OLD.done_at ELSE now() END;
    NEW.seen_at := CASE WHEN NOT NEW.is_seen THEN NULL WHEN OLD.is_seen THEN OLD.seen_at ELSE now() END;
  END IF;
  RETURN NEW;
END;
$fn$;

REVOKE ALL ON FUNCTION public.fn_statut_devoir() FROM PUBLIC, anon;

CREATE TRIGGER trg_statut_devoir
  BEFORE INSERT OR UPDATE ON public.homework_status
  FOR EACH ROW EXECUTE FUNCTION public.fn_statut_devoir();

CREATE TRIGGER trg_statut_devoir
  BEFORE INSERT OR UPDATE ON public.adult_homework_status
  FOR EACH ROW EXECUTE FUNCTION public.fn_statut_devoir();

DROP POLICY adult_hwstatus_participant ON public.adult_homework_status;
CREATE POLICY adult_hwstatus_participant_select ON public.adult_homework_status
  FOR SELECT TO authenticated
  USING (parent_id = (SELECT foyer_du_compte()) AND tutor_number = (SELECT tuteur_du_compte())
         AND devoir_de_mon_cours(homework_id));
CREATE POLICY adult_hwstatus_participant_insert ON public.adult_homework_status
  FOR INSERT TO authenticated
  WITH CHECK (parent_id = (SELECT foyer_du_compte()) AND tutor_number = (SELECT tuteur_du_compte())
              AND devoir_de_mon_cours(homework_id));
CREATE POLICY adult_hwstatus_participant_update ON public.adult_homework_status
  FOR UPDATE TO authenticated
  USING (parent_id = (SELECT foyer_du_compte()) AND tutor_number = (SELECT tuteur_du_compte())
         AND devoir_de_mon_cours(homework_id))
  WITH CHECK (parent_id = (SELECT foyer_du_compte()) AND tutor_number = (SELECT tuteur_du_compte())
              AND devoir_de_mon_cours(homework_id));

-- ── Verification ────────────────────────────────────────────────────────────
DO $verif$
BEGIN
  IF (SELECT count(*) FROM pg_trigger WHERE tgname = 'trg_statut_devoir' AND NOT tgisinternal) <> 2 THEN
    RAISE EXCEPTION 'trg_statut_devoir : 2 declencheurs attendus';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'adult_homework_status'
              AND cmd IN ('ALL', 'DELETE')) THEN
    RAISE EXCEPTION 'adult_homework_status : suppression encore ouverte';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.routine_privileges
              WHERE routine_schema = 'public' AND grantee IN ('anon', 'PUBLIC')
                AND routine_name = 'fn_statut_devoir') THEN
    RAISE EXCEPTION 'fn_statut_devoir executable par anon ou PUBLIC';
  END IF;
END
$verif$;
SELECT enregistrer_migration('espace-famille-devoir-fait.sql', 'e82afdb42a4a6b272bd040502a81079f3f91f349ed4178e784fdfeba5e6190c1');
