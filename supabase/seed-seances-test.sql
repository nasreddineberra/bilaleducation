-- ============================================================================
-- Seed de test : séances (class_journal), contenu PROPRE à chaque classe.
-- Matière = « Général » (subject = NULL) — conforme V1.
-- Rattachement par nom de classe (données de test spécifiques à cet établissement).
-- Idempotent : n'insère une séance que si elle n'existe pas déjà (même classe + titre).
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
    ('ADUL-DA-BL1', 'Les salutations et présentations', (CURRENT_DATE - 1),  '<p>Formules de politesse, se présenter et présenter quelqu''un.</p>'),
    ('ADUL-DA-BL1', 'L''alphabet et la prononciation',  (CURRENT_DATE - 5),  '<p>Révision de l''alphabet et travail sur la prononciation.</p>'),
    ('ADUL-DA-BL1', 'Conversation : la vie quotidienne', (CURRENT_DATE - 9),  '<p>Mises en situation : faire ses courses, demander son chemin.</p>'),

    -- Maternelle — Mme BELAÏD
    ('MAT-SM-BD1',  'Graphisme : les boucles',          (CURRENT_DATE - 2),  '<p>Tracé des boucles à l''endroit et à l''envers sur ardoise.</p>'),
    ('MAT-SM-BD1',  'Comptine et langage oral',         (CURRENT_DATE - 6),  '<p>Apprentissage d''une comptine et échanges en groupe.</p>'),
    ('MAT-SM-BD1',  'Découverte des formes',            (CURRENT_DATE - 9),  '<p>Reconnaître et nommer le rond, le carré et le triangle.</p>'),

    -- Maternelle — Mme BERRA
    ('MAT-SM-BL2',  'Les couleurs primaires',           (CURRENT_DATE - 1),  '<p>Nommer et associer le rouge, le bleu et le jaune.</p>'),
    ('MAT-SM-BL2',  'Motricité fine : le découpage',    (CURRENT_DATE - 5),  '<p>Utiliser les ciseaux en suivant un trait droit.</p>'),
    ('MAT-SM-BL2',  'Reconnaissance des prénoms',       (CURRENT_DATE - 8),  '<p>Reconnaître son prénom parmi ceux de la classe.</p>')
  ) AS v(class_name, title, session_date, content_html)
)
INSERT INTO class_journal (etablissement_id, class_id, teacher_id, subject, session_date, title, content_html)
SELECT t.etablissement_id, t.class_id, t.teacher_id, NULL, r.session_date::date, r.title, r.content_html
FROM rows r
JOIN targets t ON t.name = r.class_name
WHERE NOT EXISTS (
  SELECT 1 FROM class_journal j
  WHERE j.class_id = t.class_id
    AND j.title = r.title
);

-- Vérification :
-- SELECT c.name, j.title, j.session_date
-- FROM class_journal j JOIN classes c ON c.id = j.class_id
-- ORDER BY c.name, j.session_date DESC;
