-- ============================================================================
-- Inspection des affectations enseignants (class_teachers)
-- Affiche l'état DÉRIVÉ (actif / historique) à partir de is_main_teacher + dates.
--   Titulaire actif      : is_main_teacher = true  ET effective_until IS NULL
--   Ancien titulaire      : is_main_teacher = true  ET effective_until renseigné
--   Remplacement en cours : is_main_teacher = false ET (effective_until IS NULL OU > aujourd'hui)
--   Historique remplacement: is_main_teacher = false ET effective_until <= aujourd'hui
-- ============================================================================

SELECT
  c.name                                   AS classe,
  CASE WHEN ct.is_main_teacher THEN 'Titulaire' ELSE 'Remplaçant' END AS role,
  (t.last_name || ' ' || t.first_name)     AS enseignant,
  ct.effective_from                        AS du,
  ct.effective_until                       AS au,
  CASE
    WHEN ct.is_main_teacher AND ct.effective_until IS NULL                  THEN 'Titulaire actif'
    WHEN ct.is_main_teacher                                                 THEN 'Ancien titulaire (historique)'
    WHEN NOT ct.is_main_teacher
         AND (ct.effective_until IS NULL OR ct.effective_until > CURRENT_DATE) THEN 'Remplacement en cours'
    ELSE 'Historique remplacement'
  END                                      AS etat_derive
FROM class_teachers ct
JOIN classes  c ON c.id = ct.class_id
JOIN teachers t ON t.id = ct.teacher_id
-- Filtrer une classe précise (décommenter) :
-- WHERE c.name = 'MAT-SM-BD1'
ORDER BY
  c.name,
  ct.is_main_teacher DESC,                 -- titulaires d'abord
  (ct.effective_until IS NOT NULL),        -- actifs (until nul) avant historique
  ct.effective_from NULLS FIRST;
