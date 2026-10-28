-- ============================================================================
-- ABSENCES ENSEIGNANTS : VALIDATION D'UNE SEANCE ET CAHIER DE TEXTE DU
-- REMPLACANT (lot 3b-2a)
-- (28 octobre 2026)
--
-- 1. VALIDER UNE SEANCE PAR LA BASE. La validation ecrivait deux lignes depuis
--    le navigateur (heures dans `staff_time_entries`, puis `schedule_validations`),
--    et c'est l'ecran qui decidait a qui creditait l'heure. Decision du 28/10 :
--    les heures d'un remplacant viennent de la VALIDATION de la seance, et un
--    remplacant peut etre n'importe quel membre de l'equipe (sans fiche
--    enseignant). La base decide donc qui recoit l'heure :
--      - seance remplacee (`absences_enseignants_seances`) : le remplacant ;
--      - sinon : le titulaire en poste ce jour-la (`fn_titulaire_de`) ;
--    et refuse une seance annulee (EDT ou absence), encore « a decider »,
--    future, deja validee, ou sans enseignant. Les deux ecritures se font d'un
--    coup. L'encadrement valide pour n'importe qui (c'est ce qui permet de
--    valider pour un remplacant sans fiche) ; un enseignant ne valide que les
--    seances dont il recoit l'heure.
--
-- 2. CAHIER DE TEXTE DU REMPLACANT (decision du 28/10) : un enseignant qui
--    remplace une seance d'une classe lit et ecrit son cahier de texte de
--    7 jours avant cette seance a 7 jours apres. Policies NOUVELLES (permissives,
--    elles s'ajoutent a celles du titulaire, qui ne changent pas).
--
-- Changement ADDITIF : migration d'abord (l'ecran actuel ecrit encore lui-meme ;
-- il passera par ces fonctions au deploiement du lot 3b-2a).
-- Controle : supabase/controles/31-absences-validation.sql.
-- ============================================================================

-- ── 1. Valider une seance ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.valider_seance(p_slot_id uuid, p_date date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_etab       uuid := current_etablissement_id();
  v_role       text := coalesce(get_user_role(), '');
  v_slot       schedule_slots%ROWTYPE;
  v_ex         schedule_exceptions%ROWTYPE;
  v_decision   absences_enseignants_seances%ROWTYPE;
  v_titulaire  uuid;   -- teachers.id
  v_tit_profil uuid;   -- son compte
  v_credite    uuid;   -- profiles.id qui recoit l'heure
  v_remplace   uuid;   -- profiles.id du titulaire remplace
  v_debut      time;
  v_fin        time;
  v_type       text;
  v_entree     uuid;
  v_valid      schedule_validations%ROWTYPE;
BEGIN
  IF v_etab IS NULL OR v_role NOT IN ('admin', 'direction', 'responsable_pedagogique', 'secretaire', 'enseignant') THEN
    RAISE EXCEPTION 'VALIDATION_REFUSEE' USING HINT = 'Votre role ne permet pas de valider une seance.';
  END IF;

  SELECT * INTO v_slot FROM schedule_slots WHERE id = p_slot_id AND etablissement_id = v_etab;
  IF NOT FOUND OR p_date IS NULL OR NOT fn_seance_a_lieu(p_slot_id, p_date) THEN
    RAISE EXCEPTION 'VALIDATION_SEANCE' USING HINT = 'Cette seance n''existe pas a cette date.';
  END IF;
  IF p_date > (now() AT TIME ZONE 'Europe/Paris')::date THEN
    RAISE EXCEPTION 'VALIDATION_FUTURE' USING HINT = 'Une seance a venir ne se valide pas.';
  END IF;
  IF EXISTS (SELECT 1 FROM schedule_validations WHERE schedule_slot_id = p_slot_id AND validation_date = p_date) THEN
    RAISE EXCEPTION 'VALIDATION_DEJA' USING HINT = 'Cette seance est deja validee.';
  END IF;

  SELECT * INTO v_ex FROM schedule_exceptions WHERE schedule_slot_id = p_slot_id AND exception_date = p_date;
  SELECT * INTO v_decision FROM absences_enseignants_seances WHERE schedule_slot_id = p_slot_id AND seance_date = p_date;
  IF v_ex.exception_type = 'cancelled' OR v_decision.decision = 'annulee' THEN
    RAISE EXCEPTION 'VALIDATION_ANNULEE' USING HINT = 'Une seance annulee ne se valide pas.';
  END IF;

  v_debut := coalesce(v_ex.override_start_time, v_slot.start_time);
  v_fin   := coalesce(v_ex.override_end_time, v_slot.end_time);
  v_titulaire := fn_titulaire_de(v_slot.class_id, p_date);
  SELECT user_id INTO v_tit_profil FROM teachers WHERE id = v_titulaire;

  IF v_decision.decision = 'remplacee' THEN
    v_credite  := v_decision.remplacant_profile_id;
    v_remplace := v_tit_profil;
  ELSIF v_ex.override_teacher_id IS NOT NULL THEN
    -- Ancien remplacement d'une seance (`override_teacher_id`, retire au lot 5).
    SELECT user_id INTO v_credite FROM teachers WHERE id = v_ex.override_teacher_id;
    v_remplace := CASE WHEN v_ex.override_teacher_id IS DISTINCT FROM v_titulaire THEN v_tit_profil END;
  ELSE
    IF EXISTS (SELECT 1 FROM absences_enseignants a
                WHERE a.teacher_id = v_titulaire
                  AND a.debut < p_date + v_fin AND a.fin > p_date + v_debut) THEN
      RAISE EXCEPTION 'VALIDATION_A_DECIDER'
        USING HINT = 'L''enseignant est absent et rien n''est decide pour cette seance : reglez d''abord l''absence.';
    END IF;
    v_credite := v_tit_profil;
  END IF;

  IF v_credite IS NULL THEN
    RAISE EXCEPTION 'VALIDATION_SANS_ENSEIGNANT'
      USING HINT = 'Personne n''assure cette seance (ou l''enseignant n''a pas de compte) : sa presence ne peut pas etre validee.';
  END IF;
  IF v_role = 'enseignant' AND v_credite IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'VALIDATION_REFUSEE' USING HINT = 'Vous ne validez que les seances que vous assurez.';
  END IF;

  SELECT code INTO v_type FROM presence_types
   WHERE school_year_id = v_slot.school_year_id AND reserved_kind = v_slot.slot_type
   LIMIT 1;
  IF v_type IS NULL THEN
    RAISE EXCEPTION 'VALIDATION_TYPE'
      USING HINT = 'Aucun type de presence n''est associe a ce type de seance : configurez-le dans Parametres, Types de presence.';
  END IF;

  INSERT INTO staff_time_entries (etablissement_id, profile_id, entry_date, entry_type, start_time, end_time,
                                  duration_minutes, is_replacement, replaced_profile_id, recorded_by)
  VALUES (v_etab, v_credite, p_date, v_type, v_debut, v_fin,
          (extract(epoch FROM (v_fin - v_debut)) / 60)::integer, v_remplace IS NOT NULL, v_remplace, auth.uid())
  RETURNING id INTO v_entree;

  INSERT INTO schedule_validations (etablissement_id, schedule_slot_id, profile_id, validation_date, time_entry_id)
  VALUES (v_etab, p_slot_id, v_credite, p_date, v_entree)
  RETURNING * INTO v_valid;

  RETURN jsonb_build_object('id', v_valid.id, 'schedule_slot_id', v_valid.schedule_slot_id,
                            'profile_id', v_valid.profile_id, 'validation_date', v_valid.validation_date,
                            'time_entry_id', v_valid.time_entry_id);
END
$fn$;

-- ── 2. Retirer une validation ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.retirer_validation_seance(p_slot_id uuid, p_date date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_etab  uuid := current_etablissement_id();
  v_role  text := coalesce(get_user_role(), '');
  v_valid schedule_validations%ROWTYPE;
BEGIN
  IF v_etab IS NULL OR v_role NOT IN ('admin', 'direction', 'responsable_pedagogique', 'secretaire', 'enseignant') THEN
    RAISE EXCEPTION 'VALIDATION_REFUSEE' USING HINT = 'Votre role ne permet pas de retirer une validation.';
  END IF;
  SELECT * INTO v_valid FROM schedule_validations
   WHERE schedule_slot_id = p_slot_id AND validation_date = p_date AND etablissement_id = v_etab
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'VALIDATION_INTROUVABLE' USING HINT = 'Cette seance n''est pas validee.';
  END IF;
  IF v_role = 'enseignant' AND v_valid.profile_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'VALIDATION_REFUSEE' USING HINT = 'Vous ne retirez que vos propres validations.';
  END IF;
  DELETE FROM schedule_validations WHERE id = v_valid.id;
  IF v_valid.time_entry_id IS NOT NULL THEN
    DELETE FROM staff_time_entries WHERE id = v_valid.time_entry_id;
  END IF;
END
$fn$;

-- ── 3. Cahier de texte du remplacant ──────────────────────────────────────────
-- Le connecte remplace-t-il une seance de cette classe dans les 7 jours (avant
-- ou apres) ? Lu par les policies : EXECUTE accorde a `authenticated`.
CREATE OR REPLACE FUNCTION public.fn_remplace_classe(p_class_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
  SELECT EXISTS (
    SELECT 1
      FROM absences_enseignants_seances d
      JOIN schedule_slots s ON s.id = d.schedule_slot_id
     WHERE d.decision = 'remplacee'
       AND d.remplacant_profile_id = auth.uid()
       AND s.class_id = p_class_id
       AND d.etablissement_id = current_etablissement_id()
       AND CURRENT_DATE BETWEEN d.seance_date - 7 AND d.seance_date + 7
  )
$fn$;

DROP POLICY IF EXISTS journal_remplacant_select ON public.class_journal;
CREATE POLICY journal_remplacant_select ON public.class_journal FOR SELECT
  USING (etablissement_id = current_etablissement_id()
         AND coalesce(get_user_role(), '') = 'enseignant'
         AND fn_remplace_classe(class_id));
DROP POLICY IF EXISTS journal_remplacant_insert ON public.class_journal;
CREATE POLICY journal_remplacant_insert ON public.class_journal FOR INSERT
  WITH CHECK (etablissement_id = current_etablissement_id()
              AND coalesce(get_user_role(), '') = 'enseignant'
              AND teacher_id IN (SELECT t.id FROM teachers t WHERE t.user_id = auth.uid())
              AND fn_remplace_classe(class_id));

DROP POLICY IF EXISTS homework_remplacant_select ON public.homework;
CREATE POLICY homework_remplacant_select ON public.homework FOR SELECT
  USING (etablissement_id = current_etablissement_id()
         AND coalesce(get_user_role(), '') = 'enseignant'
         AND fn_remplace_classe(class_id));
DROP POLICY IF EXISTS homework_remplacant_insert ON public.homework;
CREATE POLICY homework_remplacant_insert ON public.homework FOR INSERT
  WITH CHECK (etablissement_id = current_etablissement_id()
              AND coalesce(get_user_role(), '') = 'enseignant'
              AND teacher_id IN (SELECT t.id FROM teachers t WHERE t.user_id = auth.uid())
              AND fn_remplace_classe(class_id));

DROP POLICY IF EXISTS hwstatus_remplacant_select ON public.homework_status;
CREATE POLICY hwstatus_remplacant_select ON public.homework_status FOR SELECT
  USING (coalesce(get_user_role(), '') = 'enseignant'
         AND homework_id IN (SELECT h.id FROM homework h
                              WHERE h.etablissement_id = current_etablissement_id()
                                AND fn_remplace_classe(h.class_id)));
DROP POLICY IF EXISTS adult_hwstatus_remplacant_select ON public.adult_homework_status;
CREATE POLICY adult_hwstatus_remplacant_select ON public.adult_homework_status FOR SELECT
  USING (coalesce(get_user_role(), '') = 'enseignant'
         AND homework_id IN (SELECT h.id FROM homework h
                              WHERE h.etablissement_id = current_etablissement_id()
                                AND fn_remplace_classe(h.class_id)));

-- ── 4. Droits d'execution ─────────────────────────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.valider_seance(uuid, date) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.retirer_validation_seance(uuid, date) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.fn_remplace_classe(uuid) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.valider_seance(uuid, date) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.retirer_validation_seance(uuid, date) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.fn_remplace_classe(uuid) TO authenticated;

-- ── 5. Verification ───────────────────────────────────────────────────────────
DO $verif$
BEGIN
  IF (SELECT count(*) FROM pg_policies
       WHERE policyname IN ('journal_remplacant_select', 'journal_remplacant_insert', 'homework_remplacant_select',
                            'homework_remplacant_insert', 'hwstatus_remplacant_select', 'adult_hwstatus_remplacant_select')) <> 6 THEN
    RAISE EXCEPTION 'Policies du remplacant incompletes.';
  END IF;
  IF has_function_privilege('anon', 'public.valider_seance(uuid, date)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.fn_remplace_classe(uuid)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.valider_seance(uuid, date)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.retirer_validation_seance(uuid, date)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.fn_remplace_classe(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Droit d''execution inattendu sur les fonctions de validation.';
  END IF;
END
$verif$;

SELECT enregistrer_migration('absences-enseignants-validation.sql', '8063748f725f64bf0f38b0c4ac4d33a7bfc023b9ade160c2f7b361f754e1b046');
