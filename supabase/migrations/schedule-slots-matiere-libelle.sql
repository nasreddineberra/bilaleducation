-- ============================================================================
-- CRENEAUX : MATIERE D'UN COURS, NOM D'UNE ACTIVITE (27 octobre 2026)
--
-- Une classe peut avoir cours d'une matiere (= unite d'enseignement du
-- referentiel) sur un creneau et d'une autre sur un autre. Une activite n'a pas
-- de matiere mais peut porter un nom. Les deux sont FACULTATIFS (decisions
-- utilisateur) : sans eux, le creneau s'affiche « Cours » ou « Activite ».
--
--   1. `unite_enseignement_id` : matiere d'un COURS. ON DELETE RESTRICT : une
--      unite qui sert a un creneau ne se supprime pas (le referentiel ne
--      supprime deja que le vide, il compte desormais les creneaux).
--   2. `libelle` : nom d'une ACTIVITE, 60 caracteres au plus, jamais vide.
--   3. Chaque champ a sa place : pas de matiere sur une activite, pas de nom sur
--      un cours (le type d'un creneau ne change pas apres creation : il decide
--      du code de presence des validations).
--   4. La matiere appartient a l'ecole du creneau (une cle etrangere ne le
--      garantit pas : sans ce declencheur, un appel direct a l'API pourrait
--      rattacher l'unite d'une autre ecole).
--
-- `cours_id` (cours du referentiel, chantier Secondaire en veille) reste en place.
-- Additif (colonnes facultatives, aucune donnee existante concernee).
-- Controle : supabase/controles/28-creneaux-matiere.sql.
-- ============================================================================

ALTER TABLE public.schedule_slots
  ADD COLUMN IF NOT EXISTS unite_enseignement_id uuid
    REFERENCES public.unites_enseignement(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS libelle text;

CREATE INDEX IF NOT EXISTS idx_schedule_slots_unite_enseignement
  ON public.schedule_slots (unite_enseignement_id) WHERE unite_enseignement_id IS NOT NULL;

ALTER TABLE public.schedule_slots DROP CONSTRAINT IF EXISTS schedule_slots_libelle_check;
ALTER TABLE public.schedule_slots ADD CONSTRAINT schedule_slots_libelle_check
  CHECK (libelle IS NULL OR (btrim(libelle) <> '' AND char_length(libelle) <= 60));

ALTER TABLE public.schedule_slots DROP CONSTRAINT IF EXISTS schedule_slots_intitule_selon_type;
ALTER TABLE public.schedule_slots ADD CONSTRAINT schedule_slots_intitule_selon_type
  CHECK ((slot_type = 'cours'    OR unite_enseignement_id IS NULL)
     AND (slot_type = 'activite' OR libelle IS NULL));

CREATE OR REPLACE FUNCTION public.fn_schedule_slots_matiere_ecole()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
BEGIN
  IF NEW.unite_enseignement_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM unites_enseignement u
     WHERE u.id = NEW.unite_enseignement_id AND u.etablissement_id = NEW.etablissement_id
  ) THEN
    RAISE EXCEPTION 'Cette matière n''appartient pas à l''établissement du créneau.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END
$fn$;

REVOKE ALL ON FUNCTION public.fn_schedule_slots_matiere_ecole() FROM PUBLIC, anon, authenticated;

-- Nom en `z` : apres `schedule_slots_auto_etablissement` (ordre alphabetique),
-- qui pose l'ecole quand le code ne l'envoie pas.
DROP TRIGGER IF EXISTS schedule_slots_z_matiere_ecole ON public.schedule_slots;
CREATE TRIGGER schedule_slots_z_matiere_ecole
  BEFORE INSERT OR UPDATE OF unite_enseignement_id, etablissement_id ON public.schedule_slots
  FOR EACH ROW EXECUTE FUNCTION public.fn_schedule_slots_matiere_ecole();

SELECT enregistrer_migration('schedule-slots-matiere-libelle.sql', 'f449b87b92a5e41a65b6c0f8cedefa349e019b487ddab871e97e2f6dd2ff8933');
