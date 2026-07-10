-- ============================================================================
-- Fix : la contrainte anti-doublon des créneaux récurrents ignorait les dates
-- d'effet (Du → Au). Deux créneaux recurrents de meme classe/jour/horaire mais
-- a periodes DISJOINTES (ex. clotures au 11/09 vs a partir du 12/09) etaient
-- rejetes a tort (« duplicate key ... idx_schedule_no_class_overlap_recurring »).
--
-- On remplace l'index d'unicite par une contrainte d'EXCLUSION qui n'interdit le
-- doublon (meme classe, jour, horaires) que si les periodes d'effet SE CHEVAUCHENT.
--
-- Idempotent : reexecutable sans erreur.
-- ============================================================================

-- Necessaire pour un gist mixte (egalite scalaire + chevauchement de plage).
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Retrait de l'ancien index d'unicite (ignorait les dates d'effet).
DROP INDEX IF EXISTS idx_schedule_no_class_overlap_recurring;

-- Retrait d'une eventuelle execution precedente de cette migration.
ALTER TABLE schedule_slots DROP CONSTRAINT IF EXISTS schedule_no_class_overlap_recurring;

-- Nouvelle contrainte : meme (classe, jour, debut, fin) interdit uniquement si les
-- periodes d'effet se chevauchent. daterange('[]') : NULL = borne illimitee.
-- Garde : si effective_from > effective_until (plage « a l'envers », creneau jamais
-- visible), on utilise une plage vide qui ne chevauche rien (evite l'erreur
-- « range lower bound must be less than or equal to range upper bound »).
ALTER TABLE schedule_slots
  ADD CONSTRAINT schedule_no_class_overlap_recurring
  EXCLUDE USING gist (
    class_id    WITH =,
    day_of_week WITH =,
    start_time  WITH =,
    end_time    WITH =,
    (CASE
       WHEN effective_from IS NOT NULL AND effective_until IS NOT NULL AND effective_from > effective_until
         THEN 'empty'::daterange
       ELSE daterange(effective_from, effective_until, '[]')
     END) WITH &&
  )
  WHERE (is_active = true AND is_recurring = true);
