-- ============================================================================
-- CRENEAUX SANS ENSEIGNANT (27 octobre 2026)
--
-- Le 11/10, le titulaire d'une classe est devenu facultatif : une classe peut
-- rester sans titulaire, ses creneaux restent au planning « sans enseignant »
-- (l'EDT les affiche « Prof non affecte », bordure en pointilles) et reprennent
-- un titulaire a l'affectation suivante. La colonne `schedule_slots.teacher_id`
-- etait pourtant restee NOT NULL : retirer le titulaire d'une classe qui a des
-- creneaux, ou creer des creneaux pour une classe sans titulaire, echouait.
-- Trouve par le typage des requetes (types generes de la base).
--
-- Additif (une contrainte en moins). Aucune fonction ni regle d'acces ne
-- suppose la colonne remplie ; la cle etrangere vers `teachers` reste.
-- ============================================================================

ALTER TABLE public.schedule_slots ALTER COLUMN teacher_id DROP NOT NULL;

SELECT enregistrer_migration('schedule-slots-enseignant-facultatif.sql', 'e56c7c01e2cde55d66f9c328f213ee7f023e0cc3cac9d96c2c30bfa3898bbb93');
