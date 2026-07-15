-- ============================================================================
-- Remarques internes sur la fiche utilisateur (profiles.notes).
--
-- Pourquoi : direction / comptable / secretaire / responsable_pedagogique n'ont
-- AUCUNE fiche metier dediee — `profiles` est leur seule fiche, donc il n'existait
-- nulle part ou consigner une remarque a leur sujet.
-- Les enseignants (`teachers.notes`) et les parents (`parents.notes`) ont deja leur
-- champ Remarques sur leur fiche : cote UI, l'encadre n'est donc affiche QUE pour
-- les 4 roles sans fiche metier (evite deux champs Remarques concurrents).
--
-- Colonne non sensible : le trigger anti auto-escalade sur `profiles`
-- (role / is_active / etablissement_id) n'est pas concerne.
-- Idempotent.
-- ============================================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notes text;

SELECT 'profiles.notes ajoute (remarques internes, roles sans fiche metier).' AS status;
