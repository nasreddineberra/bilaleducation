-- ============================================================================
-- Espace famille, lot 6a : ecrans du parent (03/11)
--
-- 1. `famille_enfants()` : les enfants du foyer et leur classe de l'ANNEE EN
--    COURS (affectation active, sinon la derniere retiree), date de depart. Le
--    parent ne lit pas `enrollments` (colonne `notes` interne) : fonction a
--    colonnes choisies, comme les `famille_*` du lot 2.
-- 2. `marquer_notification_lue(id, source)` : le parent marque lue UNE de ses
--    notifications (`notifications`) ou UN de ses messages
--    (`announcement_recipients`). Aucune regle d'ecriture n'est ouverte : la
--    fonction ne touche que `is_read` / `read_at`, sur une ligne de SON foyer.
--
-- Additive. Controle : supabase/controles/42-espace-famille-ecrans.sql.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.famille_enfants()
 RETURNS TABLE (id uuid, last_name text, first_name text, gender text, date_of_birth date, is_active boolean,
                class_id uuid, classe_nom text, inscription_active boolean, date_depart date)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $fn$
  SELECT s.id, s.last_name, s.first_name, s.gender, s.date_of_birth, s.is_active,
         ins.class_id, ins.name, ins.active, ins.date_depart
    FROM students s
    LEFT JOIN LATERAL (
      SELECT en.class_id, c.name, en.status = 'active' AS active, en.date_depart
        FROM enrollments en
        JOIN classes c ON c.id = en.class_id
        JOIN school_years y ON y.etablissement_id = c.etablissement_id AND y.is_current AND y.label = c.academic_year
       WHERE en.student_id = s.id AND en.status IN ('active', 'withdrawn')
       ORDER BY (en.status = 'active') DESC, en.updated_at DESC
       LIMIT 1
    ) ins ON true
   WHERE s.parent_id = foyer_du_compte()
   ORDER BY s.is_active DESC, s.date_of_birth, s.first_name
$fn$;

CREATE OR REPLACE FUNCTION public.marquer_notification_lue(p_id uuid, p_source text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_foyer uuid := foyer_du_compte();
  v_n     integer;
BEGIN
  IF v_foyer IS NULL OR NOT foyer_actif() THEN
    RAISE EXCEPTION 'Acces refuse' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_source = 'auto' THEN
    UPDATE notifications SET is_read = true, read_at = coalesce(read_at, now())
     WHERE id = p_id AND parent_id = v_foyer AND etablissement_id = current_etablissement_id();
  ELSIF p_source = 'announcement' THEN
    UPDATE announcement_recipients SET is_read = true, read_at = coalesce(read_at, now())
     WHERE id = p_id AND parent_id = v_foyer;
  ELSE
    RAISE EXCEPTION 'Source inconnue';
  END IF;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n = 1;
END;
$fn$;

REVOKE ALL ON FUNCTION public.famille_enfants() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.marquer_notification_lue(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.famille_enfants() TO authenticated;
GRANT EXECUTE ON FUNCTION public.marquer_notification_lue(uuid, text) TO authenticated;

DO $verif$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.routine_privileges
              WHERE routine_schema = 'public' AND grantee IN ('anon', 'PUBLIC')
                AND routine_name IN ('famille_enfants', 'marquer_notification_lue')) THEN
    RAISE EXCEPTION 'fonctions de l''espace famille executables par anon ou PUBLIC';
  END IF;
END
$verif$;
SELECT enregistrer_migration('espace-famille-ecrans.sql', '14dec91b617a2a1e311de9662ea2ef09f09e93d8a6c40d19d12da1a04b6a5c4a');
