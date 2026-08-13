-- ============================================================================
-- Une ABSENCE et une PRESENCE ne peuvent pas coexister sur la meme demi-journee
--
-- ┌─ POURQUOI EN BASE ───────────────────────────────────────────────────────┐
-- │ Cette regle existait deja — mais UNIQUEMENT dans la modale de temps de    │
-- │ presence (14 juillet), qui retire des listes deroulantes les personnes    │
-- │ deja absentes. Or `staff_time_entries` a un SECOND chemin d'ecriture : la │
-- │ VALIDATION depuis l'emploi du temps, qui insere directement.              │
-- │                                                                           │
-- │ Un enseignant marque absent voyait donc son creneau, cliquait ✓, et       │
-- │ creait une ligne de PRESENCE le jour meme ou une ABSENCE etait            │
-- │ enregistree. Deux lignes contradictoires, aucun signal, et un recapitulatif│
-- │ qui compte les deux.                                                      │
-- │                                                                           │
-- │ Une regle qui ne vit que dans un ecran n'est pas une regle : elle ne      │
-- │ couvre que le chemin ou on a pense a l'ecrire.                           │
-- └───────────────────────────────────────────────────────────────────────────┘
--
-- ── LA REGLE RAISONNE EN DEMI-JOURNEES ─────────────────────────────────────
--
-- `absence_period` distingue journee / matin / apres-midi depuis le 14 juillet.
-- Bloquer « toute presence le jour d'une absence » serait donc FAUX : une
-- absence du matin laisse l'apres-midi libre, et c'est un cas courant.
--
--   absence   full → matin + apres-midi   am → matin   pm → apres-midi
--   presence  deduite des horaires, la journee entiere si elle n'en a pas
--
-- Refus si les deux se CHEVAUCHENT sur une demi-journee et qu'au moins l'une
-- est une absence. Deux presences qui se chevauchent ne regardent pas cette
-- garde ; deux absences sur la meme demi-journee sont refusees (une seule
-- absence par demi-journee), mais matin + apres-midi restent possibles — le
-- recapitulatif les compte alors pour une journee.
--
-- SECURITY DEFINER : la garde doit voir TOUTES les lignes du jour, y compris
-- celles d'un collegue sur lesquelles l'appelant n'a aucun droit de lecture
-- depuis `add-role-checks-to-time-tracking`. Sans elevation, un enseignant ne
-- verrait pas sa propre absence saisie par la direction, et la garde le
-- laisserait passer.
--
-- Idempotent.
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_guard_presence_absence_exclusivity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_absence  boolean;
  v_new_am       boolean;
  v_new_pm       boolean;
  v_conflit      record;
BEGIN
  -- Le type est un CODE texte, sans cle etrangere, et il se repete d'une annee
  -- a l'autre : on interroge donc l'etablissement, pas une ligne precise.
  SELECT coalesce(bool_or(pt.is_absence), false) INTO v_new_absence
  FROM presence_types pt
  WHERE pt.etablissement_id = NEW.etablissement_id
    AND pt.code = NEW.entry_type;

  IF v_new_absence THEN
    v_new_am := NEW.absence_period IN ('full', 'am');
    v_new_pm := NEW.absence_period IN ('full', 'pm');
  ELSE
    -- Sans horaire, une presence occupe toute la journee : on ne devine pas.
    v_new_am := coalesce(NEW.start_time, TIME '00:00') <  TIME '12:00';
    v_new_pm := coalesce(NEW.end_time,   TIME '23:59') >  TIME '12:00';
  END IF;

  SELECT ste.id,
         ste.entry_type,
         coalesce(bool_or(pt.is_absence), false) AS est_absence,
         ste.absence_period,
         ste.start_time,
         ste.end_time
    INTO v_conflit
  FROM staff_time_entries ste
  LEFT JOIN presence_types pt
    ON pt.etablissement_id = ste.etablissement_id AND pt.code = ste.entry_type
  WHERE ste.profile_id = NEW.profile_id
    AND ste.entry_date = NEW.entry_date
    AND ste.id IS DISTINCT FROM NEW.id
  GROUP BY ste.id, ste.entry_type, ste.absence_period, ste.start_time, ste.end_time
  HAVING
    -- Au moins l'une des deux est une absence : deux presences ne concernent
    -- pas cette garde.
    (v_new_absence OR coalesce(bool_or(pt.is_absence), false))
    AND (
      -- Chevauchement sur le matin
      (v_new_am AND CASE WHEN coalesce(bool_or(pt.is_absence), false)
                         THEN ste.absence_period IN ('full', 'am')
                         ELSE coalesce(ste.start_time, TIME '00:00') < TIME '12:00' END)
      OR
      -- Chevauchement sur l'apres-midi
      (v_new_pm AND CASE WHEN coalesce(bool_or(pt.is_absence), false)
                         THEN ste.absence_period IN ('full', 'pm')
                         ELSE coalesce(ste.end_time, TIME '23:59') > TIME '12:00' END)
    )
  LIMIT 1;

  IF FOUND THEN
    IF v_new_absence THEN
      RAISE EXCEPTION
        'Absence impossible : une saisie (%) existe deja sur cette demi-journee pour cette personne.',
        v_conflit.entry_type
        USING ERRCODE = 'check_violation';
    ELSE
      RAISE EXCEPTION
        'Saisie impossible : cette personne est absente (%) sur cette demi-journee.',
        v_conflit.entry_type
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_presence_absence ON staff_time_entries;
CREATE TRIGGER trg_guard_presence_absence
  BEFORE INSERT OR UPDATE OF profile_id, entry_date, entry_type, start_time, end_time, absence_period
  ON staff_time_entries
  FOR EACH ROW
  EXECUTE FUNCTION fn_guard_presence_absence_exclusivity();

COMMENT ON FUNCTION fn_guard_presence_absence_exclusivity() IS
  'Refuse une presence sur une demi-journee ou la personne est absente, et '
  'reciproquement. La modale de temps de presence portait deja cette regle ; '
  'la validation depuis l''emploi du temps la contournait.';
