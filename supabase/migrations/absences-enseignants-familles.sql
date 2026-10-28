-- ============================================================================
-- ABSENCES ENSEIGNANTS : LES FAMILLES PREVENUES (lot 3c)
-- (28 octobre 2026)
--
-- Une seance annulee pour une absence est annoncee aux familles par email (case
-- cochee par defaut) ; si elle redevient une seance ordinaire apres cet email,
-- les familles sont prevenues qu'elle a bien lieu. La base garde la date de
-- l'annonce (`familles_prevenues_le`) : c'est elle qui dit, au changement
-- suivant, s'il y a un retablissement a annoncer (`decider_seances_absence`
-- rend deja ces seances dans `retablies`).
--
-- 1. Type de notification « seance » (l'ecran Notifications le nomme).
-- 2. `marquer_familles_prevenues` : l'envoi fait, la date est posee sur les
--    seances ANNULEES de l'absence (encadrement + secretaire, comme decider).
-- 3. `decider_seances_absence` efface la date quand une seance n'est plus
--    annulee : une nouvelle annulation repartira par email. Rapiecage par
--    ancrage (son corps n'est pas recopie).
--
-- Changement : additif. Controle : supabase/controles/32-absences-familles.sql.
-- ============================================================================

-- ── 1. Type de notification ───────────────────────────────────────────────────
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('absence', 'retard', 'payment', 'announcement', 'homework', 'seance'));

-- ── 2. Noter l'annonce ────────────────────────────────────────────────────────
-- p_seances : [{ "slot_id", "date" }]. Seules les seances ANNULEES de cette
-- absence sont marquees ; rend le nombre de seances marquees.
CREATE OR REPLACE FUNCTION public.marquer_familles_prevenues(p_absence_id uuid, p_seances jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_etab uuid := fn_absences_garde();
  v_nb   integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM absences_enseignants WHERE id = p_absence_id AND etablissement_id = v_etab) THEN
    RAISE EXCEPTION 'ABSENCE_INTROUVABLE' USING HINT = 'Cette absence n''existe plus.';
  END IF;
  IF jsonb_typeof(p_seances) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'ABSENCE_DECISIONS' USING HINT = 'Liste de seances invalide.';
  END IF;

  UPDATE absences_enseignants_seances d
     SET familles_prevenues_le = now()
    FROM jsonb_array_elements(p_seances) s
   WHERE d.absence_id = p_absence_id
     AND d.etablissement_id = v_etab
     AND d.decision = 'annulee'
     AND d.schedule_slot_id::text = s->>'slot_id'
     AND d.seance_date::text = s->>'date';
  GET DIAGNOSTICS v_nb = ROW_COUNT;
  RETURN v_nb;
END
$fn$;

REVOKE EXECUTE ON FUNCTION public.marquer_familles_prevenues(uuid, jsonb) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.marquer_familles_prevenues(uuid, jsonb) TO authenticated;

-- ── 3. Une seance qui n'est plus annulee perd sa date d'annonce ──────────────
DO $patch$
DECLARE
  v_def   text := pg_get_functiondef('public.decider_seances_absence(uuid, jsonb)'::regprocedure);
  v_ancre text := 'decide_le = EXCLUDED.decide_le;';
  v_neuf  text := 'decide_le = EXCLUDED.decide_le,
            familles_prevenues_le = CASE WHEN EXCLUDED.decision = ''annulee''
                                         THEN absences_enseignants_seances.familles_prevenues_le END;';
BEGIN
  IF position('familles_prevenues_le = CASE' IN v_def) > 0 THEN
    RETURN;   -- deja rapiecee
  END IF;
  IF (length(v_def) - length(replace(v_def, v_ancre, ''))) / length(v_ancre) <> 1 THEN
    RAISE EXCEPTION 'Ancre introuvable ou multiple dans decider_seances_absence.';
  END IF;
  EXECUTE replace(v_def, v_ancre, v_neuf);
END
$patch$;

-- ── 4. Verification ───────────────────────────────────────────────────────────
DO $verif$
BEGIN
  IF position('familles_prevenues_le = CASE' IN
       pg_get_functiondef('public.decider_seances_absence(uuid, jsonb)'::regprocedure)) = 0 THEN
    RAISE EXCEPTION 'decider_seances_absence non rapiecee.';
  END IF;
  IF has_function_privilege('anon', 'public.marquer_familles_prevenues(uuid, jsonb)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.marquer_familles_prevenues(uuid, jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Droit d''execution inattendu sur marquer_familles_prevenues.';
  END IF;
  IF pg_get_constraintdef((SELECT oid FROM pg_constraint WHERE conname = 'notifications_type_check')) NOT LIKE '%seance%' THEN
    RAISE EXCEPTION 'Type de notification seance absent.';
  END IF;
END
$verif$;

SELECT enregistrer_migration('absences-enseignants-familles.sql', 'b9200da72671c2ef8de55b6bb7b5ee91c68a185d7432143d09eb13a1d8e9adb4');
