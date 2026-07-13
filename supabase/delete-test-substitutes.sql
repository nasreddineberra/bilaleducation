-- ============================================================================
-- Suppression des REMPLAÇANTS de test (is_main_teacher = false) sur MAT-SM-BD1.
-- Le titulaire (is_main_teacher = true) n'est PAS touché.
-- ============================================================================

-- 1) (optionnel) Vérifier ce qui sera supprimé AVANT :
-- SELECT c.name, (t.last_name || ' ' || t.first_name) AS enseignant,
--        ct.effective_from AS du, ct.effective_until AS au
-- FROM class_teachers ct
-- JOIN classes c  ON c.id = ct.class_id
-- JOIN teachers t ON t.id = ct.teacher_id
-- WHERE c.name = 'MAT-SM-BD1' AND ct.is_main_teacher = false;

-- 2) Suppression :
DELETE FROM class_teachers
WHERE is_main_teacher = false
  AND class_id = (SELECT id FROM classes WHERE name = 'MAT-SM-BD1');

-- ── Pour supprimer TOUS les remplaçants de TOUTES les classes (à n'utiliser
--    que si tu veux vraiment tout nettoyer), décommenter :
-- DELETE FROM class_teachers WHERE is_main_teacher = false;
