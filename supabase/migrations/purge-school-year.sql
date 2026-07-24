-- ============================================================================
-- BILAL EDUCATION — Purge d'une année archivée (Phase 5, DESTRUCTIF)
-- ----------------------------------------------------------------------------
-- Allège la BDD en supprimant les lignes TRANSACTIONNELLES d'une année, une fois
-- celle-ci ARCHIVÉE. RPC atomique (tout ou rien), SECURITY DEFINER, garde
-- admin/direction, prérequis `archived_at` posé.
--
-- ON CONSERVE (jamais purgé) :
--   - PDF bulletins : bulletin_archives / adult_bulletin_archives (+ bucket)
--   - Snapshots : student_year_history / family_year_finance
--   - Structures : années, périodes, classes, cotisations, élèves, parents,
--     enseignants, INSCRIPTIONS (enrollments / parent_class_enrollments)
--
-- ON SUPPRIME (année N uniquement) :
--   - Notes (grades, adult_grades), appréciations, évaluations, absences
--   - Temps de présence, validations, EDT (créneaux + exceptions)
--   - Cahier de texte (journal + devoirs, statuts en cascade)
--   - Finance : family_fees + échéances + ajustements des foyers SOLDÉS UNIQUEMENT
--     (les impayés restent vifs et payables)
--
-- Les 5 triggers d'audit des tables purgées sont désactivés le temps de la purge
-- (évite des milliers de lignes audit_logs) ; l'action serveur trace l'événement
-- une seule fois. Cascades FK conservées (désactivation par NOM de trigger).
--
-- Idempotent (CREATE OR REPLACE). À RELIRE puis exécuter dans Supabase SQL Editor.
-- ============================================================================

CREATE OR REPLACE FUNCTION purge_school_year(p_year_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  n_notes    int := 0;
  n_absences int := 0;
  n_fees     int := 0;
  c          int;
BEGIN
  -- Garde de rôle
  IF v_role NOT IN ('admin', 'direction') THEN
    RAISE EXCEPTION 'Accès refusé : purge réservée à admin/direction.' USING ERRCODE = '42501';
  END IF;

  SELECT etablissement_id, label, start_date, end_date
    INTO v_etab, v_label, v_start, v_end
  FROM school_years WHERE id = p_year_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Année introuvable.';
  END IF;

  -- Prérequis ABSOLU : année archivée
  SELECT archived_at, purged_at INTO v_archived, v_purged
  FROM year_closure WHERE school_year_id = p_year_id;
  IF v_archived IS NULL THEN
    RAISE EXCEPTION 'Année % non archivée : purge interdite.', v_label;
  END IF;

  SELECT coalesce(array_agg(id), '{}') INTO v_periods FROM periods WHERE school_year_id = p_year_id;
  SELECT coalesce(array_agg(id), '{}') INTO v_classes FROM classes WHERE academic_year = v_label AND etablissement_id = v_etab;

  -- Désactivation des triggers d'audit des tables purgées (rollback si erreur : DDL transactionnel).
  ALTER TABLE family_fees          DISABLE TRIGGER audit_family_fees;
  ALTER TABLE fee_installments     DISABLE TRIGGER audit_fee_installments;
  ALTER TABLE fee_adjustments      DISABLE TRIGGER audit_fee_adjustments;
  ALTER TABLE staff_time_entries   DISABLE TRIGGER audit_staff_time_entries;
  ALTER TABLE schedule_validations DISABLE TRIGGER audit_schedule_validations;

  -- ── Notes ──
  DELETE FROM grades WHERE evaluation_id IN (SELECT id FROM evaluations WHERE period_id = ANY(v_periods));
  GET DIAGNOSTICS c = ROW_COUNT; n_notes := n_notes + c;
  DELETE FROM adult_grades WHERE evaluation_id IN (SELECT id FROM evaluations WHERE period_id = ANY(v_periods));
  GET DIAGNOSTICS c = ROW_COUNT; n_notes := n_notes + c;

  -- ── Appréciations de bulletin ──
  DELETE FROM bulletin_appreciations       WHERE period_id = ANY(v_periods);
  DELETE FROM adult_bulletin_appreciations WHERE period_id = ANY(v_periods);

  -- ── Absences ──
  DELETE FROM absences WHERE period_id = ANY(v_periods);
  GET DIAGNOSTICS n_absences = ROW_COUNT;

  -- ── Évaluations ──
  DELETE FROM evaluations WHERE period_id = ANY(v_periods);

  -- ── EDT : validations + exceptions + créneaux (scopé aux créneaux de l'année) ──
  DELETE FROM schedule_validations WHERE schedule_slot_id IN (SELECT id FROM schedule_slots WHERE school_year_id = p_year_id);
  DELETE FROM schedule_exceptions  WHERE schedule_slot_id IN (SELECT id FROM schedule_slots WHERE school_year_id = p_year_id);
  DELETE FROM schedule_slots       WHERE school_year_id = p_year_id;

  -- ── Temps de présence (établissement + plage de dates de l'année) ──
  IF v_start IS NOT NULL AND v_end IS NOT NULL THEN
    DELETE FROM staff_time_entries WHERE etablissement_id = v_etab AND entry_date BETWEEN v_start AND v_end;
  END IF;

  -- ── Cahier de texte (homework cascade homework_status + adult_homework_status) ──
  DELETE FROM homework      WHERE class_id = ANY(v_classes);
  DELETE FROM class_journal WHERE class_id = ANY(v_classes);

  -- ── Finance : foyers SOLDÉS uniquement (impayés conservés, vifs) ──
  DELETE FROM fee_installments WHERE family_fee_id IN (SELECT id FROM family_fees WHERE school_year_id = p_year_id AND status = 'paid');
  DELETE FROM fee_adjustments  WHERE family_fee_id IN (SELECT id FROM family_fees WHERE school_year_id = p_year_id AND status = 'paid');
  DELETE FROM family_fees WHERE school_year_id = p_year_id AND status = 'paid';
  GET DIAGNOSTICS n_fees = ROW_COUNT;

  -- Réactivation des triggers d'audit
  ALTER TABLE family_fees          ENABLE TRIGGER audit_family_fees;
  ALTER TABLE fee_installments     ENABLE TRIGGER audit_fee_installments;
  ALTER TABLE fee_adjustments      ENABLE TRIGGER audit_fee_adjustments;
  ALTER TABLE staff_time_entries   ENABLE TRIGGER audit_staff_time_entries;
  ALTER TABLE schedule_validations ENABLE TRIGGER audit_schedule_validations;

  UPDATE year_closure SET purged_at = now() WHERE school_year_id = p_year_id;

  RETURN jsonb_build_object(
    'label', v_label,
    'notes', n_notes,
    'absences', n_absences,
    'fees_paid', n_fees,
    'already_purged', (v_purged IS NOT NULL)
  );
END;
$$;

REVOKE ALL ON FUNCTION purge_school_year(uuid) FROM public;
GRANT EXECUTE ON FUNCTION purge_school_year(uuid) TO authenticated;

SELECT 'RPC purge_school_year créée (purge atomique d''une année archivée, foyers soldés uniquement).' AS status;
