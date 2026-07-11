-- ============================================================================
-- Seed de test : devoirs autonomes (homework, journal_entry_id = NULL),
-- contenu PROPRE à chaque classe. Matière = « Général » (subject = 'General').
-- Rattachement par nom de classe (données de test spécifiques à cet établissement).
-- Idempotent : n'insère un devoir que si il n'existe pas déjà (même classe + titre).
-- ============================================================================

WITH targets AS (
  SELECT c.id AS class_id, c.name, c.etablissement_id, ct.teacher_id
  FROM classes c
  JOIN class_teachers ct
    ON ct.class_id = c.id
   AND ct.is_main_teacher = true
),
rows AS (
  SELECT * FROM (VALUES
    -- Cours adultes
    ('ADUL-DA-BL1', 'Réviser le vocabulaire des salutations', 'lecon',    (CURRENT_DATE + 3),  '<p>Mémoriser les 10 formules vues en cours.</p>'),
    ('ADUL-DA-BL1', 'Exercices d''écriture',                  'exercice', (CURRENT_DATE + 7),  '<p>Recopier et compléter la fiche d''écriture.</p>'),
    ('ADUL-DA-BL1', 'Préparer un court dialogue',             'expose',   (CURRENT_DATE - 2),  '<p>Préparer un dialogue de présentation à deux.</p>'),

    -- Maternelle — Mme BELAÏD
    ('MAT-SM-BD1',  'Colorier sans dépasser',                 'exercice', (CURRENT_DATE + 4),  '<p>Colorier le dessin en restant dans les traits.</p>'),
    ('MAT-SM-BD1',  'Apprendre la comptine',                  'lecon',    (CURRENT_DATE + 2),  '<p>Réciter la comptine apprise en classe.</p>'),
    ('MAT-SM-BD1',  'Rapporter une photo de famille',         'autre',    (CURRENT_DATE - 1),  '<p>Ramener une photo pour l''activité langage.</p>'),

    -- Maternelle — Mme BERRA
    ('MAT-SM-BL2',  'Exercice de tracé',                      'exercice', (CURRENT_DATE + 5),  '<p>Repasser sur les pointillés de la fiche.</p>'),
    ('MAT-SM-BL2',  'Apprendre une chanson',                  'lecon',    (CURRENT_DATE + 3),  '<p>Chanter la chanson de la classe à la maison.</p>'),
    ('MAT-SM-BL2',  'Fiche à faire signer',                   'autre',    (CURRENT_DATE - 2),  '<p>Faire signer la fiche de liaison par les parents.</p>')
  ) AS v(class_name, title, homework_type, due_date, description_html)
)
INSERT INTO homework (etablissement_id, class_id, teacher_id, subject, journal_entry_id,
                      title, description_html, homework_type, due_date)
SELECT t.etablissement_id, t.class_id, t.teacher_id, 'General', NULL,
       r.title, r.description_html, r.homework_type, r.due_date::date
FROM rows r
JOIN targets t ON t.name = r.class_name
WHERE NOT EXISTS (
  SELECT 1 FROM homework h
  WHERE h.class_id = t.class_id
    AND h.title = r.title
);

-- Vérification :
-- SELECT c.name, h.title, h.homework_type, h.due_date
-- FROM homework h JOIN classes c ON c.id = h.class_id
-- ORDER BY c.name, h.due_date DESC;
