-- ============================================================================
-- ABSENCES ENSEIGNANTS POUR INFORMATION : LE MOTIF RENDU AU PERSONNEL
-- (29 octobre 2026)
--
-- Decision de l'utilisateur (29/10, apres essai a l'ecran) : l'infobulle d'une
-- barre d'absence du calendrier de Temps de presence dit le nom et le MOTIF, et
-- le motif est visible de TOUT le personnel, enseignants compris. Les parents
-- ne lisent rien (inchange : la fonction ne repond qu'au personnel).
--
-- `absences_enseignants_information` rend desormais `motif`. Le type rendu
-- change : la fonction est supprimee puis recreee (CREATE OR REPLACE ne change
-- pas les colonnes d'une fonction TABLE), droits compris.
--
-- Changement : additif. Controle : supabase/controles/33-absences-information.sql
-- (le motif est rendu au personnel, toujours rien aux parents).
-- ============================================================================

DROP FUNCTION IF EXISTS public.absences_enseignants_information(date, date);

-- Absences qui chevauchent la periode [p_debut, p_fin] (jours compris).
CREATE FUNCTION public.absences_enseignants_information(p_debut date, p_fin date)
RETURNS TABLE (id uuid, teacher_id uuid, user_id uuid, civilite text, last_name text, first_name text,
               debut timestamp, fin timestamp, motif text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
  SELECT a.id, a.teacher_id, t.user_id, t.civilite::text, t.last_name, t.first_name, a.debut, a.fin, a.motif
    FROM absences_enseignants a
    JOIN teachers t ON t.id = a.teacher_id
   WHERE a.etablissement_id = current_etablissement_id()
     AND coalesce(get_user_role(), '') IN ('admin', 'direction', 'comptable', 'secretaire',
                                           'responsable_pedagogique', 'enseignant')
     AND a.fin > p_debut::timestamp
     AND a.debut < (p_fin + 1)::timestamp
   ORDER BY a.debut
$fn$;

REVOKE EXECUTE ON FUNCTION public.absences_enseignants_information(date, date) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.absences_enseignants_information(date, date) TO authenticated;

SELECT enregistrer_migration('absences-enseignants-information-motif.sql', '532e852e8681787dcc67b4047c69280b3640f75f6af1cbdfaa23a10930acc687');
