-- ============================================================================
-- ABSENCES ENSEIGNANTS : LECTURE PAR LE COMPTABLE (lot 4)
-- (29 octobre 2026)
--
-- Temps de presence lit desormais les absences d'enseignant dans
-- `absences_enseignants` (heures de seances manquees, recapitulatifs mensuel et
-- annuel). Le comptable lit tout Temps de presence : sans cette lecture, la
-- colonne Absences serait vide pour lui seul. Il lisait deja
-- `absences_enseignants_seances`. Le motif n'est pas envoye a son ecran (calcul
-- cote serveur), mais la ligne lui est lisible : une absence ne coute rien,
-- seules ses heures comptent.
--
-- Changement : additif. Controle : supabase/controles/29-absences-enseignants.sql
-- (le comptable lit les 4 absences de l'ecole jetable).
-- ============================================================================

DROP POLICY IF EXISTS absences_enseignants_select ON public.absences_enseignants;
CREATE POLICY absences_enseignants_select ON public.absences_enseignants FOR SELECT
  USING (etablissement_id = current_etablissement_id()
         AND (coalesce(get_user_role(), '') IN ('admin', 'direction', 'comptable', 'responsable_pedagogique', 'secretaire')
              OR (coalesce(get_user_role(), '') = 'enseignant'
                  AND teacher_id IN (SELECT t.id FROM teachers t WHERE t.user_id = auth.uid()))));

SELECT enregistrer_migration('absences-enseignants-comptable.sql', 'b8bd660d93f330039538debb0be8e1aef6ef8a5964b74d0b90af3ac3578f65da');
