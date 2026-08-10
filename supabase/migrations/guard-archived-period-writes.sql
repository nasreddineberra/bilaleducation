-- ============================================================================
-- Un bulletin archive n'est plus modifiable — NULLE PART
--
-- CONSTAT (10 aout 2026, signale par l'utilisateur). L'ecran de saisie des
-- notes affiche « Bulletins archives pour cette periode. Modification des notes
-- impossible. » et grise ses champs. Mais l'ecran des GABARITS, lui, laissait
-- ajouter des cours a la meme classe et a la meme periode. Le bulletin remis a
-- la famille pouvait donc cesser de correspondre a ce que l'application montre.
--
-- ET LE BANDEAU NE PROTEGEAIT RIEN. Les deux ecrans ecrivent DIRECTEMENT depuis
-- le navigateur : masquer des boutons n'empeche pas un appel a l'API. Le verrou
-- d'archivage n'existait, en realite, nulle part en base.
--
-- CE QUE CETTE MIGRATION POSE : des qu'un bulletin est archive pour un couple
-- (classe, periode), plus aucune ecriture n'est acceptee sur ce couple —
-- gabarits, notes eleves, notes adultes, appreciations. Pour rouvrir, il faut
-- DESARCHIVER, ce qui reste possible : la garde lit `bulletin_archives`, elle
-- ne la protege pas.
--
-- VERIFIE AVANT D'ECRIRE, pour ne rien bloquer par accident :
--   . l'archivage n'ecrit QUE dans `bulletin_archives` — il ne se bloque donc
--     pas lui-meme, meme apres la premiere ligne inseree ;
--   . les appreciations sont ecrites par un autre chemin, jamais pendant
--     l'archivage ;
--   . la PURGE d'annee, elle, detruit precisement ces donnees : la garde y est
--     neutralisee le temps de l'operation (voir plus bas).
--
-- Idempotent.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_guard_periode_archivee()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  v_row    jsonb;
  v_class  uuid;
  v_period uuid;
BEGIN
  -- `to_jsonb` et non les colonnes par leur nom : ce declencheur sert CINQ
  -- tables de formes differentes, et PL/pgSQL compile l'expression entiere —
  -- citer `NEW.class_id` ferait echouer sur une table qui ne l'a pas. Faute
  -- deja payee le 7 aout, ou une garde generique a casse toute ecriture de
  -- l'application pendant une soiree.
  v_row := to_jsonb(CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END);

  IF v_row ? 'evaluation_id' THEN
    -- Les notes ne portent pas la classe : elles la tiennent de leur gabarit.
    SELECT e.class_id, e.period_id INTO v_class, v_period
    FROM evaluations e
    WHERE e.id = (v_row ->> 'evaluation_id')::uuid;
  ELSE
    v_class  := nullif(v_row ->> 'class_id',  '')::uuid;
    v_period := nullif(v_row ->> 'period_id', '')::uuid;
  END IF;

  -- Sans couple complet il n'y a rien a verifier : on laisse passer plutot que
  -- de refuser sur une information absente.
  IF v_class IS NULL OR v_period IS NULL THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  IF EXISTS (SELECT 1 FROM bulletin_archives
              WHERE class_id = v_class AND period_id = v_period)
     OR EXISTS (SELECT 1 FROM adult_bulletin_archives
                 WHERE class_id = v_class AND period_id = v_period)
  THEN
    RAISE EXCEPTION
      'Les bulletins de cette classe sont archives pour cette periode : aucune modification n''est possible. Desarchivez-les d''abord.';
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$function$;

-- Les cinq tables ou vit le contenu d'un bulletin.
DROP TRIGGER IF EXISTS guard_periode_archivee ON evaluations;
CREATE TRIGGER guard_periode_archivee
  BEFORE INSERT OR UPDATE OR DELETE ON evaluations
  FOR EACH ROW EXECUTE FUNCTION fn_guard_periode_archivee();

DROP TRIGGER IF EXISTS guard_periode_archivee ON grades;
CREATE TRIGGER guard_periode_archivee
  BEFORE INSERT OR UPDATE OR DELETE ON grades
  FOR EACH ROW EXECUTE FUNCTION fn_guard_periode_archivee();

DROP TRIGGER IF EXISTS guard_periode_archivee ON adult_grades;
CREATE TRIGGER guard_periode_archivee
  BEFORE INSERT OR UPDATE OR DELETE ON adult_grades
  FOR EACH ROW EXECUTE FUNCTION fn_guard_periode_archivee();

DROP TRIGGER IF EXISTS guard_periode_archivee ON bulletin_appreciations;
CREATE TRIGGER guard_periode_archivee
  BEFORE INSERT OR UPDATE OR DELETE ON bulletin_appreciations
  FOR EACH ROW EXECUTE FUNCTION fn_guard_periode_archivee();

DROP TRIGGER IF EXISTS guard_periode_archivee ON adult_bulletin_appreciations;
CREATE TRIGGER guard_periode_archivee
  BEFORE INSERT OR UPDATE OR DELETE ON adult_bulletin_appreciations
  FOR EACH ROW EXECUTE FUNCTION fn_guard_periode_archivee();


-- ── La purge d'annee neutralise la garde le temps de son travail ────────────

CREATE OR REPLACE FUNCTION public.purge_school_year(p_year_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_role     text := coalesce(get_user_role(), '');
  v_etab     uuid;
  v_label    text;
  v_start    date;
  v_end      date;
  v_archived timestamptz;
  v_purged   timestamptz;
  v_periods  uuid[];
  v_classes  uuid[];
  v_paidfees uuid[];
  n_notes    int := 0;
  n_absences int := 0;
  n_fees     int := 0;
  c          int;
BEGIN
  -- Garde de role
  IF v_role NOT IN ('admin', 'direction') THEN
    RAISE EXCEPTION 'Acces refuse : purge reservee a admin/direction.' USING ERRCODE = '42501';
  END IF;

  -- Etat de l'annee et jalons de cloture : tout se lit desormais sur la meme ligne.
  SELECT etablissement_id, label, start_date, end_date, archived_at, purged_at
    INTO v_etab, v_label, v_start, v_end, v_archived, v_purged
  FROM school_years WHERE id = p_year_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Annee introuvable.';
  END IF;

  -- Cloisonnement multi-etablissement (la RPC est SECURITY DEFINER → pas de RLS) :
  -- interdit de purger l'annee d'un autre etablissement, meme via appel RPC direct.
  -- IS DISTINCT FROM couvre le cas NULL (ex. super_admin sans etablissement → refuse).
  IF v_etab IS DISTINCT FROM current_etablissement_id() THEN
    RAISE EXCEPTION 'Acces refuse : annee d''un autre etablissement.' USING ERRCODE = '42501';
  END IF;

  -- Prerequis ABSOLU : annee archivee
  IF v_archived IS NULL THEN
    RAISE EXCEPTION 'Annee % non archivee : purge interdite.', v_label;
  END IF;

  SELECT coalesce(array_agg(id), '{}') INTO v_periods FROM periods WHERE school_year_id = p_year_id;
  SELECT coalesce(array_agg(id), '{}') INTO v_classes FROM classes WHERE academic_year = v_label AND etablissement_id = v_etab;

  -- Desactivation des triggers d'audit des tables purgees (rollback si erreur : DDL transactionnel).
  ALTER TABLE family_fees          DISABLE TRIGGER audit_family_fees;
  ALTER TABLE fee_installments     DISABLE TRIGGER audit_fee_installments;
  ALTER TABLE fee_adjustments      DISABLE TRIGGER audit_fee_adjustments;
  ALTER TABLE staff_time_entries   DISABLE TRIGGER audit_staff_time_entries;
  ALTER TABLE schedule_validations DISABLE TRIGGER audit_schedule_validations;

  -- Verrou d'archivage : la purge detruit precisement des donnees d'une annee
  -- archivee, la garde la ferait echouer. Neutralisee le temps de l'operation
  -- (rollback si erreur : le DDL est transactionnel).
  ALTER TABLE evaluations                   DISABLE TRIGGER guard_periode_archivee;
  ALTER TABLE grades                        DISABLE TRIGGER guard_periode_archivee;
  ALTER TABLE adult_grades                  DISABLE TRIGGER guard_periode_archivee;
  ALTER TABLE bulletin_appreciations        DISABLE TRIGGER guard_periode_archivee;
  ALTER TABLE adult_bulletin_appreciations  DISABLE TRIGGER guard_periode_archivee;

  -- ── Notes ──
  DELETE FROM grades WHERE evaluation_id IN (SELECT id FROM evaluations WHERE period_id = ANY(v_periods) OR class_id = ANY(v_classes));
  GET DIAGNOSTICS c = ROW_COUNT; n_notes := n_notes + c;
  DELETE FROM adult_grades WHERE evaluation_id IN (SELECT id FROM evaluations WHERE period_id = ANY(v_periods) OR class_id = ANY(v_classes));
  GET DIAGNOSTICS c = ROW_COUNT; n_notes := n_notes + c;

  -- ── Appreciations de bulletin ──
  DELETE FROM bulletin_appreciations       WHERE period_id = ANY(v_periods);
  DELETE FROM adult_bulletin_appreciations WHERE period_id = ANY(v_periods);

  -- ── Absences ──
  DELETE FROM absences WHERE period_id = ANY(v_periods);
  GET DIAGNOSTICS n_absences = ROW_COUNT;

  -- ── Evaluations ──
  DELETE FROM evaluations WHERE period_id = ANY(v_periods) OR class_id = ANY(v_classes);

  -- ── EDT : validations + exceptions + creneaux (scope aux creneaux de l'annee) ──
  DELETE FROM schedule_validations WHERE schedule_slot_id IN (SELECT id FROM schedule_slots WHERE school_year_id = p_year_id);
  DELETE FROM schedule_exceptions  WHERE schedule_slot_id IN (SELECT id FROM schedule_slots WHERE school_year_id = p_year_id);
  DELETE FROM schedule_slots       WHERE school_year_id = p_year_id;

  -- ── Temps de presence (etablissement + plage de dates de l'annee) ──
  IF v_start IS NOT NULL AND v_end IS NOT NULL THEN
    DELETE FROM staff_time_entries WHERE etablissement_id = v_etab AND entry_date BETWEEN v_start AND v_end;
  END IF;

  -- ── Cahier de texte (homework cascade homework_status + adult_homework_status) ──
  DELETE FROM homework      WHERE class_id = ANY(v_classes);
  DELETE FROM class_journal WHERE class_id = ANY(v_classes);

  -- ── Finance : foyers SOLDES uniquement (impayes conserves, vifs) ──
  -- Critere = RESTE RECALCULE (du - percu) <= 0, et NON le libelle `status`
  -- (denormalise, risque de desync → une dette marquee 'paid' a tort serait
  -- effacee). Tolerance centimes (0.005) : dans le doute, on NE supprime pas.
  SELECT coalesce(array_agg(ff.id), '{}')
    INTO v_paidfees
  FROM family_fees ff
  WHERE ff.school_year_id = p_year_id
    AND ff.total_due - coalesce(
          (SELECT sum(fi.amount_paid) FROM fee_installments fi WHERE fi.family_fee_id = ff.id), 0
        ) <= 0.005;

  DELETE FROM fee_installments WHERE family_fee_id = ANY(v_paidfees);
  DELETE FROM fee_adjustments  WHERE family_fee_id = ANY(v_paidfees);
  DELETE FROM family_fees      WHERE id = ANY(v_paidfees);
  GET DIAGNOSTICS n_fees = ROW_COUNT;

  -- Reactivation des triggers d'audit
  ALTER TABLE family_fees          ENABLE TRIGGER audit_family_fees;
  ALTER TABLE fee_installments     ENABLE TRIGGER audit_fee_installments;
  ALTER TABLE fee_adjustments      ENABLE TRIGGER audit_fee_adjustments;
  ALTER TABLE staff_time_entries   ENABLE TRIGGER audit_staff_time_entries;
  ALTER TABLE schedule_validations ENABLE TRIGGER audit_schedule_validations;

  ALTER TABLE evaluations                   ENABLE TRIGGER guard_periode_archivee;
  ALTER TABLE grades                        ENABLE TRIGGER guard_periode_archivee;
  ALTER TABLE adult_grades                  ENABLE TRIGGER guard_periode_archivee;
  ALTER TABLE bulletin_appreciations        ENABLE TRIGGER guard_periode_archivee;
  ALTER TABLE adult_bulletin_appreciations  ENABLE TRIGGER guard_periode_archivee;

  UPDATE school_years SET purged_at = now() WHERE id = p_year_id;

  RETURN jsonb_build_object(
    'label', v_label,
    'notes', n_notes,
    'absences', n_absences,
    'fees_paid', n_fees,
    'already_purged', (v_purged IS NOT NULL)
  );
END;
$function$
;
