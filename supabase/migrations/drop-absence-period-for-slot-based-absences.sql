-- ============================================================================
-- UNE ABSENCE PORTE DES HORAIRES, PLUS UNE DEMI-JOURNEE
--
-- ┌─ POURQUOI ───────────────────────────────────────────────────────────────┐
-- │ Depuis qu'un remplacant se designe directement sur le CRENEAU, la maille  │
-- │ d'une absence est le creneau, pas la demi-journee. Les deux ne            │
-- │ coincidaient pas : un enseignant ayant deux cours le matin et n'en        │
-- │ manquant qu'un ne pouvait pas l'exprimer — l'ecran proposait « Matin »,   │
-- │ donc les deux cours, et reclamait un remplacant pour celui qu'il avait    │
-- │ assure.                                                                   │
-- │                                                                           │
-- │ `absence_period` disparait donc entierement, avec son CHECK. Une absence  │
-- │ devient une saisie comme une autre : des horaires et une duree.           │
-- └───────────────────────────────────────────────────────────────────────────┘
--
-- ── LA GARDE CHANGE DE REGLE ───────────────────────────────────────────────
--
-- Elle raisonnait en demi-journees. Elle raisonne desormais en HORAIRES :
--
--   « deux saisies d'une meme personne ne peuvent pas se chevaucher »
--
-- Plus general, et plus juste : deux cours manques le meme matin sont deux
-- absences legitimes (l'ancienne regle en refusait la seconde), tandis qu'une
-- absence de 9h a 10h ne bloque plus la matinee entiere.
--
-- Elle couvre du meme coup le DOUBLE COMPTAGE presence x presence, qui restait
-- ouvert : une ligne saisie a la main et une ligne creee par la validation
-- d'un creneau se chevauchent, donc la seconde est refusee.
--
-- ── DONNEES ────────────────────────────────────────────────────────────────
--
-- Verifie avant ecriture : les 9 lignes existantes sont toutes en `full` ET
-- portent deja un horaire. Aucune conversion, aucune perte.
--
-- Idempotent.
-- ============================================================================

-- ── 1. La garde, reecrite AVANT de retirer la colonne ──────────────────────
--
-- Dans cet ordre : le declencheur cite `absence_period`, le laisser en place
-- pendant le DROP le ferait echouer.

CREATE OR REPLACE FUNCTION fn_guard_presence_absence_exclusivity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conflit record;
BEGIN
  -- Sans horaire, il n'y a rien a comparer : on laisse passer plutot que
  -- d'inventer une plage. Le formulaire, lui, les exige.
  IF NEW.start_time IS NULL OR NEW.end_time IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT ste.id, ste.entry_type, ste.start_time, ste.end_time
    INTO v_conflit
  FROM staff_time_entries ste
  WHERE ste.profile_id = NEW.profile_id
    AND ste.entry_date = NEW.entry_date
    AND ste.id IS DISTINCT FROM NEW.id
    AND ste.start_time IS NOT NULL
    AND ste.end_time IS NOT NULL
    -- Chevauchement strict : deux creneaux qui se touchent (12:00-12:00) ne se
    -- chevauchent pas. Un cours qui finit a midi et un qui commence a midi
    -- sont deux saisies valides.
    AND NEW.start_time < ste.end_time
    AND NEW.end_time   > ste.start_time
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION
      'Cette personne a deja une saisie (%) de % a % ce jour. Deux saisies ne peuvent pas se chevaucher.',
      v_conflit.entry_type,
      to_char(v_conflit.start_time, 'HH24:MI'),
      to_char(v_conflit.end_time,   'HH24:MI')
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_presence_absence ON staff_time_entries;
CREATE TRIGGER trg_guard_presence_absence
  BEFORE INSERT OR UPDATE OF profile_id, entry_date, start_time, end_time
  ON staff_time_entries
  FOR EACH ROW
  EXECUTE FUNCTION fn_guard_presence_absence_exclusivity();

COMMENT ON FUNCTION fn_guard_presence_absence_exclusivity() IS
  'Deux saisies d''une meme personne ne peuvent pas se chevaucher dans le '
  'temps. Remplace la regle en demi-journees, supprimee avec absence_period.';

-- ── 2. La colonne disparait ────────────────────────────────────────────────
--
-- Le CHECK part avec elle : PostgreSQL supprime les contraintes qui ne
-- portent que sur la colonne retiree.

ALTER TABLE staff_time_entries DROP COLUMN IF EXISTS absence_period;
