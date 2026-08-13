-- ============================================================================
-- DESIGNER LE REMPLACANT AU MOMENT DE L'ABSENCE
--
-- ┌─ CE QUI MANQUAIT ────────────────────────────────────────────────────────┐
-- │ Un remplacement ponctuel n'etait designe NULLE PART avant d'avoir lieu.   │
-- │ Sa seule trace etait la ligne de presence saisie au remplacant APRES      │
-- │ coup, avec `replaced_profile_id` — un RESULTAT, pas une designation.      │
-- │                                                                           │
-- │ L'emploi du temps n'avait donc rien a lire pour savoir a qui montrer le   │
-- │ creneau, et le remplacant ne pouvait pas valider sa propre presence : ses │
-- │ heures dependaient d'une saisie manuelle faite par quelqu'un d'autre.     │
-- └───────────────────────────────────────────────────────────────────────────┘
--
-- La designation remonte donc en AMONT : sur la ligne d'ABSENCE du titulaire.
-- Une seule saisie — « X est absent mardi matin, Y le remplace » — et tout en
-- decoule : le creneau apparait chez Y, Y valide, ses heures existent.
--
-- ── DEUX COLONNES VOISINES, A NE PAS CONFONDRE ─────────────────────────────
--
--   replaced_profile_id      sur la ligne de PRESENCE du remplacant
--                            « je remplace X »          — le RESULTAT
--
--   replacement_profile_id   sur la ligne d'ABSENCE du titulaire
--                            « je suis remplace par Y » — la DESIGNATION
--
-- Elles pointent en sens inverse et ne vivent pas sur la meme ligne. La
-- premiere existe deja et reste ecrite par la validation du remplacant ; la
-- seconde est ce que cette migration ajoute.
--
-- ── POURQUOI UNE COLONNE ET NON UNE TABLE ──────────────────────────────────
--
-- Verifie sur les donnees reelles : aucun enseignant n'a deux classes sur une
-- meme demi-journee, et `absence_period` distingue deja matin et apres-midi.
-- Une absence porte donc sur au plus une classe, et un remplacant par absence
-- suffit. Une table permettrait de designer par creneau — utile le jour ou deux
-- classes se tiendraient en parallele, ce qui serait d'abord un conflit
-- d'emploi du temps.
--
-- Idempotent.
-- ============================================================================

ALTER TABLE staff_time_entries
  ADD COLUMN IF NOT EXISTS replacement_profile_id uuid REFERENCES profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN staff_time_entries.replacement_profile_id IS
  'Sur une ligne d''ABSENCE : qui remplace la personne absente. A ne pas '
  'confondre avec `replaced_profile_id`, qui vit sur la ligne de PRESENCE du '
  'remplacant et pointe en sens inverse.';

-- L'emploi du temps interroge « qui remplace, ce jour-la ». Sans index il
-- balaierait toute la table a chaque affichage de semaine.
CREATE INDEX IF NOT EXISTS idx_staff_time_replacement
  ON staff_time_entries (replacement_profile_id, entry_date)
  WHERE replacement_profile_id IS NOT NULL;

-- ── La designation n'a de sens que sur une absence, et le remplacant doit
--    etre disponible ────────────────────────────────────────────────────────
--
-- On etend la garde d'exclusivite posee ce matin plutot que d'empiler un
-- second declencheur sur la meme table : deux gardes qui se lisent l'une sans
-- l'autre finissent par se contredire.
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
  v_remp_occupe  boolean;
BEGIN
  SELECT coalesce(bool_or(pt.is_absence), false) INTO v_new_absence
  FROM presence_types pt
  WHERE pt.etablissement_id = NEW.etablissement_id
    AND pt.code = NEW.entry_type;

  IF v_new_absence THEN
    v_new_am := NEW.absence_period IN ('full', 'am');
    v_new_pm := NEW.absence_period IN ('full', 'pm');
  ELSE
    v_new_am := coalesce(NEW.start_time, TIME '00:00') <  TIME '12:00';
    v_new_pm := coalesce(NEW.end_time,   TIME '23:59') >  TIME '12:00';
  END IF;

  -- ── 1. Absence et presence ne coexistent pas sur une demi-journee ────────
  SELECT ste.id, ste.entry_type
    INTO v_conflit
  FROM staff_time_entries ste
  LEFT JOIN presence_types pt
    ON pt.etablissement_id = ste.etablissement_id AND pt.code = ste.entry_type
  WHERE ste.profile_id = NEW.profile_id
    AND ste.entry_date = NEW.entry_date
    AND ste.id IS DISTINCT FROM NEW.id
  GROUP BY ste.id, ste.entry_type, ste.absence_period, ste.start_time, ste.end_time
  HAVING
    (v_new_absence OR coalesce(bool_or(pt.is_absence), false))
    AND (
      (v_new_am AND CASE WHEN coalesce(bool_or(pt.is_absence), false)
                         THEN ste.absence_period IN ('full', 'am')
                         ELSE coalesce(ste.start_time, TIME '00:00') < TIME '12:00' END)
      OR
      (v_new_pm AND CASE WHEN coalesce(bool_or(pt.is_absence), false)
                         THEN ste.absence_period IN ('full', 'pm')
                         ELSE coalesce(ste.end_time, TIME '23:59') > TIME '12:00' END)
    )
  LIMIT 1;

  IF FOUND THEN
    IF v_new_absence THEN
      RAISE EXCEPTION
        'Absence impossible : une saisie (%) existe deja sur cette demi-journee pour cette personne.',
        v_conflit.entry_type USING ERRCODE = 'check_violation';
    ELSE
      RAISE EXCEPTION
        'Saisie impossible : cette personne est absente (%) sur cette demi-journee.',
        v_conflit.entry_type USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  -- ── 2. La designation d'un remplacant ────────────────────────────────────
  IF NEW.replacement_profile_id IS NOT NULL THEN

    IF NOT v_new_absence THEN
      RAISE EXCEPTION
        'Un remplacant ne se designe que sur une absence.'
        USING ERRCODE = 'check_violation';
    END IF;

    IF NEW.replacement_profile_id = NEW.profile_id THEN
      RAISE EXCEPTION
        'Une personne ne peut pas se remplacer elle-meme.'
        USING ERRCODE = 'check_violation';
    END IF;

    -- Le remplacant doit etre disponible : le designer alors qu'il est lui-meme
    -- absent sur cette demi-journee est une erreur de saisie, pas un cas limite.
    SELECT EXISTS (
      SELECT 1
      FROM staff_time_entries ste
      JOIN presence_types pt
        ON pt.etablissement_id = ste.etablissement_id AND pt.code = ste.entry_type
      WHERE ste.profile_id = NEW.replacement_profile_id
        AND ste.entry_date = NEW.entry_date
        AND pt.is_absence
        AND (
          (v_new_am AND ste.absence_period IN ('full', 'am'))
          OR (v_new_pm AND ste.absence_period IN ('full', 'pm'))
        )
    ) INTO v_remp_occupe;

    IF v_remp_occupe THEN
      RAISE EXCEPTION
        'Le remplacant designe est lui-meme absent sur cette demi-journee.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_presence_absence ON staff_time_entries;
CREATE TRIGGER trg_guard_presence_absence
  BEFORE INSERT OR UPDATE OF profile_id, entry_date, entry_type, start_time, end_time,
                             absence_period, replacement_profile_id
  ON staff_time_entries
  FOR EACH ROW
  EXECUTE FUNCTION fn_guard_presence_absence_exclusivity();
