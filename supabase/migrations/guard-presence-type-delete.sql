-- ============================================================================
-- Garde EN BASE contre la suppression d'un type de presence encore utilise.
--
-- Jusqu'ici ce controle n'existait que cote CLIENT (TypesPresenceClient) : un
-- appel hors interface supprimait le type malgre des saisies existantes. Et
-- comme `staff_time_entries.entry_type` est un CODE TEXTE sans cle etrangere
-- vers `presence_types`, la base ne pouvait rien garantir d'elle-meme.
--
-- Ce trigger reproduit la regle applicative la ou elle ne peut pas etre
-- contournee : un type est indelebile s'il a servi a au moins une saisie de
-- temps de SON annee scolaire, dans SON etablissement.
--
-- Il complete (sans le remplacer) le trigger existant qui protege les types
-- RESERVES (absence / cours / activite).
--
-- Idempotent.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_guard_presence_type_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start date;
  v_end   date;
  v_count integer;
BEGIN
  -- Bornes de l'annee du type. Si l'annee n'existe plus, c'est une CASCADE
  -- (suppression de l'annee ou de l'etablissement) : on laisse passer, sinon
  -- la garde bloquerait un menage legitime.
  SELECT start_date, end_date INTO v_start, v_end
  FROM school_years
  WHERE id = OLD.school_year_id;

  IF NOT FOUND THEN
    RETURN OLD;
  END IF;

  SELECT count(*) INTO v_count
  FROM staff_time_entries
  WHERE etablissement_id = OLD.etablissement_id
    AND entry_type       = OLD.code
    AND entry_date BETWEEN v_start AND v_end;

  IF v_count > 0 THEN
    RAISE EXCEPTION
      'Ce type de présence est utilisé dans % saisie(s) de temps de l''année : il ne peut pas être supprimé.',
      v_count
      USING ERRCODE = 'restrict_violation';
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_presence_type_delete ON public.presence_types;
CREATE TRIGGER trg_guard_presence_type_delete
  BEFORE DELETE ON public.presence_types
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_guard_presence_type_delete();

SELECT 'Garde de suppression des types de presence installee (usage dans staff_time_entries).' AS status;
