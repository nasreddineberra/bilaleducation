-- ============================================================================
-- ABSENCES ENSEIGNANTS : VISIBLES DE TOUS, POUR INFORMATION (29 octobre 2026)
--
-- Decision de l'utilisateur (29/10) : le calendrier de Temps de presence montre
-- les absences des enseignants a TOUT le personnel de l'ecole, enseignants
-- compris, avec les memes informations (seances touchees, decision, remplacant).
-- Jamais le MOTIF : « maladie » ou « personnel » ne regarde pas les collegues.
--
-- La table reste fermee (le motif y est) : un enseignant n'y lit que SES
-- absences. Cette fonction rend, pour une periode, les absences de l'ecole
-- SANS motif, avec le nom de l'enseignant (la fiche `teachers` d'un collegue est
-- fermee a l'enseignant). Les decisions (`absences_enseignants_seances`) et les
-- noms des remplacants (`profiles`) sont deja lisibles de tout le personnel.
--
-- Ecole par `current_etablissement_id()` (NULL pour une ecole inactive ou
-- expiree : aucune ligne). Roles : tout le personnel, jamais un parent.
--
-- Changement : additif. Controle : supabase/controles/33-absences-information.sql.
-- ============================================================================

-- Absences qui chevauchent la periode [p_debut, p_fin] (jours compris).
CREATE OR REPLACE FUNCTION public.absences_enseignants_information(p_debut date, p_fin date)
RETURNS TABLE (id uuid, teacher_id uuid, user_id uuid, civilite text, last_name text, first_name text,
               debut timestamp, fin timestamp)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
  SELECT a.id, a.teacher_id, t.user_id, t.civilite::text, t.last_name, t.first_name, a.debut, a.fin
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

SELECT enregistrer_migration('absences-enseignants-information.sql', '00b16d62dcc41a333e14d52bcadb87bd32c26b3faa8e35ec24bef0a51eda9d4b');
