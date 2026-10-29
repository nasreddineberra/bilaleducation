-- ============================================================================
-- LOT 5 DU CHANTIER PLANNING / ABSENCES : LE NETTOYAGE (29 octobre 2026)
--
-- Conception : docs/CONCEPTION-PLANNING-ABSENCES.md, § 7. Qui assure une seance
-- se DEDUIT a la date (titulaire en poste, sinon remplacant decide dans la page
-- Absences enseignants) : plus rien n'est recopie sur un creneau ni sur une
-- seance. Le code ne lit ni n'ecrit plus ces colonnes depuis le commit du lot 5
-- (etape 1, deployee AVANT cette migration : changement restrictif, code d'abord).
--
-- Mesure du 29/10 (toutes ecoles) : 4 creneaux de la DEMONSTRATION portent un
-- `teacher_id` (donnees fictives) ; aucune seance modifiee (horaire, enseignant),
-- aucun `room_number`, aucun remplacant dans `class_teachers`.
--
-- 1. `valider_seance` : plus de branche « ancien remplacement d'une seance »
--    (`override_teacher_id`) ni d'horaire modifie : rapiecage par ancrage.
-- 2. `fn_demo_peupler` : plus d'enseignant sur les creneaux (rapiecage).
-- 3. Colonnes retirees : `schedule_slots.teacher_id` (son FK etait ON DELETE
--    CASCADE : supprimer une fiche enseignant effacait ses creneaux), et son
--    index ; `schedule_exceptions.override_teacher_id`, `override_start_time`,
--    `override_end_time` ; `classes.room_number`.
-- 4. Gardes : une seance « modifiee » porte une salle (seule modification
--    restante) ; `class_teachers` ne recoit plus que des titulaires.
--
-- IRREVERSIBLE (colonnes supprimees) : sauvegarde avant application.
-- Controle : supabase/controles/34-lot5-nettoyage.sql.
-- ============================================================================

-- ── 1. valider_seance ────────────────────────────────────────────────────────
DO $patch$
DECLARE
  v_def text := pg_get_functiondef('public.valider_seance(uuid, date)'::regprocedure);
  v_ancres text[] := ARRAY[
    $a$  v_debut := coalesce(v_ex.override_start_time, v_slot.start_time);$a$,
    $a$  v_fin   := coalesce(v_ex.override_end_time, v_slot.end_time);$a$,
    $a$  ELSIF v_ex.override_teacher_id IS NOT NULL THEN
    -- Ancien remplacement d'une seance (`override_teacher_id`, retire au lot 5).
    SELECT user_id INTO v_credite FROM teachers WHERE id = v_ex.override_teacher_id;
    v_remplace := CASE WHEN v_ex.override_teacher_id IS DISTINCT FROM v_titulaire THEN v_tit_profil END;
$a$];
  v_remplacements text[] := ARRAY[
    $a$  v_debut := v_slot.start_time;$a$,
    $a$  v_fin   := v_slot.end_time;$a$,
    ''];
  i integer;
BEGIN
  -- Corps cree depuis un fichier Windows : fins de ligne CRLF, normalisees pour
  -- que les ancres multi-lignes se trouvent (le corps est recree en LF).
  v_def := replace(v_def, E'\r\n', E'\n');
  IF position('override_' IN v_def) = 0 THEN
    RETURN;   -- deja rapiecee (rejeu)
  END IF;
  FOR i IN 1 .. array_length(v_ancres, 1) LOOP
    -- Ancres normalisees aussi : un collage dans l'editeur SQL sous Windows
    -- les ramene en CRLF.
    v_ancres[i] := replace(v_ancres[i], E'\r\n', E'\n');
    IF position(v_ancres[i] IN v_def) = 0 THEN
      RAISE EXCEPTION 'valider_seance : ancrage % introuvable, la fonction a change.', i;
    END IF;
    v_def := replace(v_def, v_ancres[i], v_remplacements[i]);
  END LOOP;
  IF position('override_' IN v_def) > 0 THEN
    RAISE EXCEPTION 'valider_seance : il reste une reference override_ apres rapiecage.';
  END IF;
  EXECUTE v_def;
END
$patch$;

-- ── 2. fn_demo_peupler ───────────────────────────────────────────────────────
DO $patch$
DECLARE
  v_def text := pg_get_functiondef('public.fn_demo_peupler(uuid)'::regprocedure);
  v_ancres text[] := ARRAY[
    $a$INSERT INTO schedule_slots (etablissement_id, school_year_id, class_id, teacher_id, is_recurring,$a$,
    $a$VALUES (p_id, v_sy, v_id, v_ens[CASE WHEN i = 4 THEN 1 ELSE i END], true, 6,$a$,
    $a$VALUES (p_id, v_sy, v_id, v_ens[i], true, 3,$a$];
  v_remplacements text[] := ARRAY[
    $a$INSERT INTO schedule_slots (etablissement_id, school_year_id, class_id, is_recurring,$a$,
    $a$VALUES (p_id, v_sy, v_id, true, 6,$a$,
    $a$VALUES (p_id, v_sy, v_id, true, 3,$a$];
  i integer;
BEGIN
  v_def := replace(v_def, E'\r\n', E'\n');
  IF position('class_id, teacher_id, is_recurring' IN v_def) = 0 THEN
    RETURN;   -- deja rapiecee (rejeu)
  END IF;
  FOR i IN 1 .. array_length(v_ancres, 1) LOOP
    IF position(v_ancres[i] IN v_def) = 0 THEN
      RAISE EXCEPTION 'fn_demo_peupler : ancrage % introuvable, la fonction a change.', i;
    END IF;
    v_def := replace(v_def, v_ancres[i], v_remplacements[i]);
  END LOOP;
  EXECUTE v_def;
END
$patch$;

-- ── 3. Colonnes retirees ─────────────────────────────────────────────────────
DROP INDEX IF EXISTS public.idx_schedule_slots_teacher;
ALTER TABLE public.schedule_slots DROP COLUMN IF EXISTS teacher_id;
ALTER TABLE public.schedule_exceptions
  DROP COLUMN IF EXISTS override_teacher_id,
  DROP COLUMN IF EXISTS override_start_time,
  DROP COLUMN IF EXISTS override_end_time;
ALTER TABLE public.classes DROP COLUMN IF EXISTS room_number;

-- ── 4. Gardes ────────────────────────────────────────────────────────────────
ALTER TABLE public.schedule_exceptions DROP CONSTRAINT IF EXISTS schedule_exceptions_modifiee_salle;
ALTER TABLE public.schedule_exceptions ADD CONSTRAINT schedule_exceptions_modifiee_salle
  CHECK (exception_type <> 'modified' OR override_room_id IS NOT NULL);

ALTER TABLE public.class_teachers DROP CONSTRAINT IF EXISTS class_teachers_titulaire_seul;
ALTER TABLE public.class_teachers ADD CONSTRAINT class_teachers_titulaire_seul
  CHECK (is_main_teacher IS TRUE);

SELECT enregistrer_migration('lot5-nettoyage.sql', '553423573b13ba391a18f8503480fbec56994f530ff86f3d315dcda96766680e');
