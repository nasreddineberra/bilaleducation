-- ============================================================================
-- PURGE D'UNE ANNEE : LES MESSAGES PARTENT AVEC LE RESTE (23 octobre 2026)
--
-- Constat : `purge_school_year` vidait 15 tables (notes, absences, EDT, cahier de
-- texte, foyers soldes...) mais AUCUNE table de messagerie. Les messages
-- envoyes, leurs pieces jointes, les notifications et les relances restaient
-- indefiniment. Decision utilisateur : ils se purgent comme le reste.
--
-- Regle de rattachement (decision utilisateur) : un message appartient a
-- l'annee dont la date de fin le SUIT. Ceux envoyes entre deux annees (ete)
-- vont a l'annee superieure. La purge d'une annee emporte donc ce qui a ete
-- envoye APRES la date de fin de l'annee precedente, jusqu'a SA date de fin
-- incluse, a l'heure de Paris. Sans annee precedente : pas de borne basse. La
-- borne basse protege aussi une annee precedente CONSERVEE (« conserver toutes
-- les donnees ») : ses messages ne sont pas touches.
--
--   annonces       : `announcements` de l'ecole dans l'intervalle (date d'envoi,
--                    a defaut de creation) ; destinataires parents / equipe et
--                    pieces jointes suivent en cascade.
--   notifications  : `notifications` de l'ecole dans l'intervalle.
--   relances       : `financement_communications` de l'annee, SAUF pour les
--                    foyers dont le dossier reste (impayes conserves, vifs) :
--                    meme regle que les reglements.
--   support        : non touche (relation avec l'editeur).
--
-- FICHIERS : le SQL ne touche jamais `storage.objects`. La fonction RENVOIE les
-- chemins des pieces jointes supprimees (`fichiers`) ; l'action `purgeYear` les
-- retire du bucket `communication-attachments` APRES le succes (la ligne
-- d'abord, le fichier ensuite).
--
-- Le reste de la fonction est REPRIS A L'IDENTIQUE de la definition en base au
-- 23/10 (gardes, cloisonnement, verrous, foyers soldes). Les droits d'execution
-- sont conserves par CREATE OR REPLACE (anon et public restent revoques).
--
-- Changement additif cote application (le code en place ignore les nouvelles
-- cles du resultat) : migration d'abord.
-- Controle : supabase/controles/20-purge-messages.sql.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.purge_school_year(p_year_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $fn$
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
  v_prev_end date;
  v_annonces uuid[] := '{}';
  v_fichiers text[] := '{}';
  n_notes    int := 0;
  n_absences int := 0;
  n_fees     int := 0;
  n_messages int := 0;
  n_notifs   int := 0;
  n_relances int := 0;
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

  -- Une annee DEJA PURGEE ne se repurge pas : une operation destructrice
  -- ne doit pas pouvoir se relancer en silence.
  IF v_purged IS NOT NULL THEN
    RAISE EXCEPTION 'Annee % deja purgee le %.', v_label, v_purged::date;
  END IF;

  -- L ANNEE EN COURS NE SE PURGE JAMAIS. Le controle existait dans la server
  -- action `purgeYear`, mais une RPC s appelle directement depuis le navigateur :
  -- sans cette ligne, une annee courante cloturee puis archivee etait purgeable
  -- par-dessus l ecran, qui le refuse.
  IF (SELECT is_current FROM school_years WHERE id = p_year_id) THEN
    RAISE EXCEPTION 'Annee % en cours : purge interdite. Basculez d abord sur l annee suivante.', v_label;
  END IF;

  SELECT coalesce(array_agg(id), '{}') INTO v_periods FROM periods WHERE school_year_id = p_year_id;
  SELECT coalesce(array_agg(id), '{}') INTO v_classes FROM classes WHERE academic_year = v_label AND etablissement_id = v_etab;

  -- Desactivation des triggers d'audit des tables purgees (rollback si erreur : DDL transactionnel).
  ALTER TABLE family_fees              DISABLE TRIGGER audit_family_fees;
  ALTER TABLE fee_installments         DISABLE TRIGGER audit_fee_installments;
  ALTER TABLE fee_adjustments          DISABLE TRIGGER audit_fee_adjustments;
  ALTER TABLE staff_time_entries       DISABLE TRIGGER audit_staff_time_entries;
  ALTER TABLE schedule_validations     DISABLE TRIGGER audit_schedule_validations;
  ALTER TABLE announcements            DISABLE TRIGGER audit_announcements;
  ALTER TABLE announcement_attachments DISABLE TRIGGER audit_announcement_attachments;

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

  -- ── Relances de reglement : celles de l'annee, sauf foyers encore en dossier ──
  -- APRES la finance : les dossiers qui restent sont les impayes conserves.
  DELETE FROM financement_communications fc
   WHERE fc.school_year_id = p_year_id
     AND NOT EXISTS (SELECT 1 FROM family_fees ff
                      WHERE ff.school_year_id = p_year_id AND ff.parent_id = fc.parent_id);
  GET DIAGNOSTICS n_relances = ROW_COUNT;

  -- ── Messagerie : intervalle ]fin de l'annee precedente ; fin de l'annee] ──
  IF v_end IS NOT NULL THEN
    SELECT max(end_date) INTO v_prev_end
      FROM school_years
     WHERE etablissement_id = v_etab AND id <> p_year_id AND end_date < coalesce(v_start, v_end);

    SELECT coalesce(array_agg(a.id), '{}') INTO v_annonces
      FROM announcements a
     WHERE a.etablissement_id = v_etab
       AND (coalesce(a.sent_at, a.created_at) AT TIME ZONE 'Europe/Paris')::date <= v_end
       AND (v_prev_end IS NULL
            OR (coalesce(a.sent_at, a.created_at) AT TIME ZONE 'Europe/Paris')::date > v_prev_end);

    -- Releves AVANT la suppression : la cascade les emporte.
    SELECT coalesce(array_agg(aa.file_path) FILTER (WHERE aa.file_path IS NOT NULL), '{}') INTO v_fichiers
      FROM announcement_attachments aa
     WHERE aa.announcement_id = ANY(v_annonces);

    DELETE FROM announcements WHERE id = ANY(v_annonces);
    GET DIAGNOSTICS n_messages = ROW_COUNT;

    DELETE FROM notifications n
     WHERE n.etablissement_id = v_etab
       AND (n.created_at AT TIME ZONE 'Europe/Paris')::date <= v_end
       AND (v_prev_end IS NULL OR (n.created_at AT TIME ZONE 'Europe/Paris')::date > v_prev_end);
    GET DIAGNOSTICS n_notifs = ROW_COUNT;
  END IF;

  -- Reactivation des triggers d'audit
  ALTER TABLE family_fees              ENABLE TRIGGER audit_family_fees;
  ALTER TABLE fee_installments         ENABLE TRIGGER audit_fee_installments;
  ALTER TABLE fee_adjustments          ENABLE TRIGGER audit_fee_adjustments;
  ALTER TABLE staff_time_entries       ENABLE TRIGGER audit_staff_time_entries;
  ALTER TABLE schedule_validations     ENABLE TRIGGER audit_schedule_validations;
  ALTER TABLE announcements            ENABLE TRIGGER audit_announcements;
  ALTER TABLE announcement_attachments ENABLE TRIGGER audit_announcement_attachments;

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
    'messages', n_messages,
    'notifications', n_notifs,
    'relances', n_relances,
    'fichiers', to_jsonb(v_fichiers),
    'already_purged', (v_purged IS NOT NULL)
  );
END;
$fn$;

-- Registre des migrations (voir supabase/migrations/README.md).
SELECT enregistrer_migration('purge-messages-annee.sql', '96198dd980d416506307eeda0320f8c47cc2c6b92802aa4772fba0d9d28b3160');
