-- ============================================================================
-- ABSENCES ENSEIGNANTS : QUI PEUT REMPLACER (lot 3b-1)
-- (28 octobre 2026)
--
-- La fiche d'une absence propose, pour chaque seance, les membres de l'equipe
-- qui peuvent la reprendre, et grise ceux qui sont pris sur l'horaire avec la
-- raison (« CE1 · 15:00-16:00 », « absent »). C'est la base qui le dit, par la
-- meme regle que `decider_seances_absence` (`fn_membre_occupe`) : l'ecran ne
-- recopie rien, il ne peut pas proposer ce que la base refuserait.
--
-- QUI PEUT REMPLACER : un membre ACTIF de l'equipe (direction, comptable,
-- secretaire, responsable pedagogique, enseignant), jamais l'absent. Le compte
-- `admin` est ecarte : il ne pointe pas son temps (Temps de presence ne le liste
-- pas), ses heures de remplacement n'apparaitraient nulle part. La regle vit
-- dans `fn_role_remplacant`, partagee avec `decider_seances_absence` (retouchee
-- par ancrage : son corps n'est pas recopie).
--
-- Changement : additif (fonction nouvelle) + restriction mineure (admin ecarte
-- des remplacants ; aucune decision en base, aucun ecran ne decide encore).
-- Controle : supabase/controles/30-absences-remplacants.sql.
-- ============================================================================

-- ── 1. Les roles qui remplacent ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_role_remplacant(p_role text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public', 'pg_temp'
AS $fn$
  SELECT coalesce(p_role, '') IN ('direction', 'comptable', 'secretaire', 'responsable_pedagogique', 'enseignant')
$fn$;

-- ── 2. `decider_seances_absence` suit la meme regle (rapiecage par ancrage) ───
DO $patch$
DECLARE
  v_def   text := pg_get_functiondef('public.decider_seances_absence(uuid, jsonb)'::regprocedure);
  v_ancre text := $a$p.role IN ('admin', 'direction', 'comptable', 'secretaire', 'responsable_pedagogique', 'enseignant')$a$;
BEGIN
  IF position('fn_role_remplacant(p.role)' IN v_def) > 0 THEN
    RETURN;   -- deja rapiecee (rejeu)
  END IF;
  IF position(v_ancre IN v_def) = 0 THEN
    RAISE EXCEPTION 'decider_seances_absence : ancrage des roles introuvable, la fonction a change.';
  END IF;
  EXECUTE replace(v_def, v_ancre, 'fn_role_remplacant(p.role)');
END
$patch$;

-- ── 3. Les remplacants possibles de chaque seance ─────────────────────────────
-- p_seances : [{ "slot_id", "date" (AAAA-MM-JJ) }]. Une ligne par seance et par
-- membre admissible ; `occupe` NULL = libre, sinon la raison.
CREATE OR REPLACE FUNCTION public.remplacants_possibles(p_absence_id uuid, p_seances jsonb)
RETURNS TABLE (slot_id uuid, seance_date date, profile_id uuid, occupe text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_etab   uuid := fn_absences_garde();
  v_absent uuid;
BEGIN
  SELECT t.user_id INTO v_absent
    FROM absences_enseignants a JOIN teachers t ON t.id = a.teacher_id
   WHERE a.id = p_absence_id AND a.etablissement_id = v_etab;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ABSENCE_INTROUVABLE' USING HINT = 'Cette absence n''existe plus.';
  END IF;
  IF jsonb_typeof(p_seances) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'ABSENCE_DECISION' USING HINT = 'Liste de seances attendue.';
  END IF;

  RETURN QUERY
  SELECT s.id, x.date, p.id, fn_membre_occupe(p.id, x.date, s.start_time, s.end_time, s.id)
    FROM jsonb_to_recordset(p_seances) AS x(slot_id uuid, date date)
    JOIN schedule_slots s ON s.id = x.slot_id AND s.etablissement_id = v_etab
    JOIN profiles p ON p.etablissement_id = v_etab
                   AND coalesce(p.is_active, false)
                   AND fn_role_remplacant(p.role)
                   AND p.id IS DISTINCT FROM v_absent
   ORDER BY s.id, x.date, p.last_name, p.first_name;
END
$fn$;

REVOKE EXECUTE ON FUNCTION public.fn_role_remplacant(text) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.remplacants_possibles(uuid, jsonb) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.remplacants_possibles(uuid, jsonb) TO authenticated;

-- ── 4. Verification ───────────────────────────────────────────────────────────
DO $verif$
BEGIN
  IF position('fn_role_remplacant(p.role)' IN pg_get_functiondef('public.decider_seances_absence(uuid, jsonb)'::regprocedure)) = 0 THEN
    RAISE EXCEPTION 'decider_seances_absence n''utilise pas fn_role_remplacant.';
  END IF;
  IF has_function_privilege('anon', 'public.remplacants_possibles(uuid, jsonb)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.fn_role_remplacant(text)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.remplacants_possibles(uuid, jsonb)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.decider_seances_absence(uuid, jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Droit d''execution inattendu sur les fonctions des remplacants.';
  END IF;
END
$verif$;

SELECT enregistrer_migration('absences-enseignants-remplacants.sql', '7e5e51ae44e27b90ad259b81213e05b48d19d35663489eeffa49430a4cf031c9');
