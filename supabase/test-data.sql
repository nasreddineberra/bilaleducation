-- ============================================
-- BILAL EDUCATION - Données de test (VERSION CORRIGÉE)
-- À exécuter APRÈS schema.sql et policies.sql
-- ============================================

-- ⚠️ ATTENTION : Ces données sont pour le développement uniquement
-- NE PAS utiliser en production !

-- ============================================
-- NOTES IMPORTANTES
-- ============================================
-- 1. Vous devez d'abord créer les utilisateurs via l'interface Supabase
-- 2. Puis insérer leurs profils ici avec les bons IDs
-- 3. Les mots de passe sont : demo123 pour tous les comptes de test

-- ============================================
-- LES 7 RÔLES DE L'APPLICATION
-- ============================================
-- admin - Administrateur système (accès complet)
-- direction - Direction de l'école
-- comptable - Gestion financière
-- responsable_pedagogique - Responsable pédagogique
-- enseignant - Enseignants
-- secretaire - Secrétariat
-- parent - Parents d'élèves

-- ============================================
-- ÉTAPE 1 : Créer les utilisateurs via Supabase UI
-- ============================================
-- Aller dans Authentication > Users > Add User
-- Créer les utilisateurs suivants (noter leurs IDs) :
-- 
-- 1. admin@bilaleducation.fr           (rôle: admin)
-- 2. direction@bilaleducation.fr       (rôle: direction)
-- 3. comptable@bilaleducation.fr       (rôle: comptable)
-- 4. resp.pedago@bilaleducation.fr     (rôle: responsable_pedagogique)
-- 5. secretaire@bilaleducation.fr      (rôle: secretaire)
-- 6. enseignant1@bilaleducation.fr     (rôle: enseignant)
-- 7. parent1@bilaleducation.fr         (rôle: parent)

-- ============================================
-- ÉTAPE 2 : Insérer les profils
-- ============================================
-- Remplacer les IDs par ceux générés par Supabase

-- Admin
INSERT INTO profiles (id, email, role, first_name, last_name, phone, is_active)
VALUES 
  ('REMPLACER_PAR_ID_ADMIN', 'admin@bilaleducation.fr', 'admin', 'Admin', 'Système', '+33612345678', true);

-- Direction
INSERT INTO profiles (id, email, role, first_name, last_name, phone, is_active)
VALUES 
  ('REMPLACER_PAR_ID_DIRECTION', 'direction@bilaleducation.fr', 'direction', 'Hassan', 'Mansouri', '+33612345679', true);

-- Comptable
INSERT INTO profiles (id, email, role, first_name, last_name, phone, is_active)
VALUES 
  ('REMPLACER_PAR_ID_COMPTABLE', 'comptable@bilaleducation.fr', 'comptable', 'Fatima', 'Alaoui', '+33612345680', true);

-- ============================================
-- Insérer les Matières (niveau 1)
-- ============================================
INSERT INTO subjects (name, code, description, order_index) VALUES
  ('Langue arabe', 'AR', 'Apprentissage complet de la langue arabe', 1),
  ('Récitation du Coran', 'QURAN', 'Mémorisation et récitation du Saint Coran', 2),
  ('Éducation islamique', 'ISLAM', 'Principes et enseignements de l''Islam', 3),
  ('Culture arabe', 'CULTURE', 'Histoire et culture du monde arabe', 4);

-- ============================================
-- Insérer les Unités d'Enseignement (niveau 2)
-- Les UE appartiennent aux Matières
-- ============================================

-- UE pour "Langue arabe"
INSERT INTO teaching_units (subject_id, name, code, description, order_index)
SELECT 
  id,
  'Lecture',
  'AR-LECT',
  'Apprentissage de la lecture en arabe',
  1
FROM subjects WHERE code = 'AR';

INSERT INTO teaching_units (subject_id, name, code, description, order_index)
SELECT 
  id,
  'Écriture',
  'AR-ECRI',
  'Apprentissage de l''écriture en arabe',
  2
FROM subjects WHERE code = 'AR';

INSERT INTO teaching_units (subject_id, name, code, description, order_index)
SELECT 
  id,
  'Grammaire',
  'AR-GRAM',
  'Grammaire et conjugaison arabe',
  3
FROM subjects WHERE code = 'AR';

INSERT INTO teaching_units (subject_id, name, code, description, order_index)
SELECT 
  id,
  'Vocabulaire',
  'AR-VOCAB',
  'Enrichissement du vocabulaire',
  4
FROM subjects WHERE code = 'AR';

INSERT INTO teaching_units (subject_id, name, code, description, order_index)
SELECT 
  id,
  'Expression orale',
  'AR-ORAL',
  'Pratique de la conversation en arabe',
  5
FROM subjects WHERE code = 'AR';

-- UE pour "Récitation du Coran"
INSERT INTO teaching_units (subject_id, name, code, description, order_index)
SELECT 
  id,
  'Tajwid',
  'QURAN-TAJWID',
  'Règles de récitation du Coran',
  1
FROM subjects WHERE code = 'QURAN';

INSERT INTO teaching_units (subject_id, name, code, description, order_index)
SELECT 
  id,
  'Mémorisation',
  'QURAN-MEMO',
  'Mémorisation des sourates',
  2
FROM subjects WHERE code = 'QURAN';

-- UE pour "Éducation islamique"
INSERT INTO teaching_units (subject_id, name, code, description, order_index)
SELECT 
  id,
  'Aqida',
  'ISLAM-AQIDA',
  'Fondements de la foi',
  1
FROM subjects WHERE code = 'ISLAM';

INSERT INTO teaching_units (subject_id, name, code, description, order_index)
SELECT 
  id,
  'Fiqh',
  'ISLAM-FIQH',
  'Jurisprudence islamique',
  2
FROM subjects WHERE code = 'ISLAM';

INSERT INTO teaching_units (subject_id, name, code, description, order_index)
SELECT 
  id,
  'Sira',
  'ISLAM-SIRA',
  'Vie du Prophète (PBSL)',
  3
FROM subjects WHERE code = 'ISLAM';

-- ============================================
-- Insérer les Modules (niveau 3)
-- Les Modules appartiennent aux Unités d'Enseignement
-- ============================================

-- Modules pour UE "Lecture" (de Langue arabe)
INSERT INTO modules (teaching_unit_id, name, code, description, order_index)
SELECT 
  id,
  'Alphabet',
  'AR-LECT-ALPHA',
  'Apprentissage de l''alphabet arabe',
  1
FROM teaching_units WHERE code = 'AR-LECT';

INSERT INTO modules (teaching_unit_id, name, code, description, order_index)
SELECT 
  id,
  'Syllabes',
  'AR-LECT-SYL',
  'Formation et lecture des syllabes',
  2
FROM teaching_units WHERE code = 'AR-LECT';

INSERT INTO modules (teaching_unit_id, name, code, description, order_index)
SELECT 
  id,
  'Mots simples',
  'AR-LECT-MOTS',
  'Lecture de mots simples',
  3
FROM teaching_units WHERE code = 'AR-LECT';

-- Modules pour UE "Écriture" (de Langue arabe)
INSERT INTO modules (teaching_unit_id, name, code, description, order_index)
SELECT 
  id,
  'Calligraphie de base',
  'AR-ECRI-CAL',
  'Techniques de base de calligraphie',
  1
FROM teaching_units WHERE code = 'AR-ECRI';

INSERT INTO modules (teaching_unit_id, name, code, description, order_index)
SELECT 
  id,
  'Écriture cursive',
  'AR-ECRI-CURS',
  'Écriture en cursive',
  2
FROM teaching_units WHERE code = 'AR-ECRI';

-- Modules pour UE "Grammaire" (de Langue arabe)
INSERT INTO modules (teaching_unit_id, name, code, description, order_index)
SELECT 
  id,
  'Nom et verbe',
  'AR-GRAM-NV',
  'Distinction nom et verbe',
  1
FROM teaching_units WHERE code = 'AR-GRAM';

INSERT INTO modules (teaching_unit_id, name, code, description, order_index)
SELECT 
  id,
  'Conjugaison de base',
  'AR-GRAM-CONJ',
  'Conjugaison des verbes simples',
  2
FROM teaching_units WHERE code = 'AR-GRAM';

-- Modules pour UE "Tajwid" (de Récitation du Coran)
INSERT INTO modules (teaching_unit_id, name, code, description, order_index)
SELECT 
  id,
  'Règles de base',
  'QURAN-TAJWID-BASE',
  'Règles fondamentales du Tajwid',
  1
FROM teaching_units WHERE code = 'QURAN-TAJWID';

INSERT INTO modules (teaching_unit_id, name, code, description, order_index)
SELECT 
  id,
  'Makhârij al-hurûf',
  'QURAN-TAJWID-MAKH',
  'Points d''articulation des lettres',
  2
FROM teaching_units WHERE code = 'QURAN-TAJWID';

-- Modules pour UE "Mémorisation" (de Récitation du Coran)
INSERT INTO modules (teaching_unit_id, name, code, description, order_index)
SELECT 
  id,
  'Juz Amma',
  'QURAN-MEMO-JUZZ',
  'Mémorisation du Juz Amma',
  1
FROM teaching_units WHERE code = 'QURAN-MEMO';

INSERT INTO modules (teaching_unit_id, name, code, description, order_index)
SELECT 
  id,
  'Sourates courtes',
  'QURAN-MEMO-SHORT',
  'Mémorisation des sourates courtes',
  2
FROM teaching_units WHERE code = 'QURAN-MEMO';

-- ============================================
-- Insérer les enseignants dans la table teachers
-- ============================================
INSERT INTO teachers (user_id, first_name, last_name, employee_number, email, specialization, is_active)
VALUES
  (NULL, 'Ahmed', 'Benali', 'ENS001', 'ahmed.benali@bilaleducation.fr', 'Langue arabe - Niveau débutant', true),
  (NULL, 'Fatima', 'Zahra', 'ENS002', 'fatima.zahra@bilaleducation.fr', 'Langue arabe - Niveau intermédiaire', true),
  (NULL, 'Mohammed', 'Alami', 'ENS003', 'mohammed.alami@bilaleducation.fr', 'Récitation du Coran', true),
  (NULL, 'Aisha', 'Mansouri', 'ENS004', 'aisha.mansouri@bilaleducation.fr', 'Langue arabe - Niveau avancé', true),
  (NULL, 'Youssef', 'Kadiri', 'ENS005', 'youssef.kadiri@bilaleducation.fr', 'Éducation islamique', true);

-- ============================================
-- Insérer les classes (SANS LIMITE MAX)
-- ============================================
INSERT INTO classes (name, level, academic_year, description, room_number, is_active)
VALUES
  ('Niveau 1A', 'Débutant', '2025-2026', 'Initiation à la langue arabe - Groupe A', 'Salle 101', true),
  ('Niveau 1B', 'Débutant', '2025-2026', 'Initiation à la langue arabe - Groupe B', 'Salle 102', true),
  ('Niveau 2A', 'Intermédiaire', '2025-2026', 'Approfondissement - Groupe A', 'Salle 201', true),
  ('Niveau 2B', 'Intermédiaire', '2025-2026', 'Approfondissement - Groupe B', 'Salle 202', true),
  ('Niveau 3', 'Avancé', '2025-2026', 'Perfectionnement', 'Salle 301', true),
  ('Coran 1', 'Débutant', '2025-2026', 'Mémorisation et récitation - Débutant', 'Salle 103', true);

-- ============================================
-- Associer les enseignants aux classes
-- ============================================
INSERT INTO class_teachers (class_id, teacher_id, is_main_teacher, subject)
SELECT 
  c.id,
  t.id,
  true,
  'Langue arabe'
FROM classes c, teachers t
WHERE c.name = 'Niveau 1A' AND t.employee_number = 'ENS001';

INSERT INTO class_teachers (class_id, teacher_id, is_main_teacher, subject)
SELECT 
  c.id,
  t.id,
  true,
  'Langue arabe'
FROM classes c, teachers t
WHERE c.name = 'Niveau 1B' AND t.employee_number = 'ENS001';

INSERT INTO class_teachers (class_id, teacher_id, is_main_teacher, subject)
SELECT 
  c.id,
  t.id,
  true,
  'Langue arabe'
FROM classes c, teachers t
WHERE c.name = 'Niveau 2A' AND t.employee_number = 'ENS002';

INSERT INTO class_teachers (class_id, teacher_id, is_main_teacher, subject)
SELECT 
  c.id,
  t.id,
  true,
  'Récitation Coran'
FROM classes c, teachers t
WHERE c.name = 'Coran 1' AND t.employee_number = 'ENS003';

-- ============================================
-- Insérer les élèves
-- ============================================
INSERT INTO students (student_number, first_name, last_name, date_of_birth, gender, address, city, postal_code, emergency_contact_name, emergency_contact_phone, is_active)
VALUES
  ('STD001', 'Youssef', 'Amrani', '2015-03-15', 'male', '12 rue de la Paix', 'Lyon', '69001', 'Hassan Amrani', '+33612345601', true),
  ('STD002', 'Maryam', 'Bennani', '2014-07-22', 'female', '25 avenue Victor Hugo', 'Lyon', '69002', 'Samira Bennani', '+33612345602', true),
  ('STD003', 'Omar', 'Chakir', '2016-01-10', 'male', '8 boulevard des Belges', 'Lyon', '69006', 'Karim Chakir', '+33612345603', true),
  ('STD004', 'Leila', 'Drissi', '2015-11-05', 'female', '33 rue Garibaldi', 'Lyon', '69003', 'Nadia Drissi', '+33612345604', true),
  ('STD005', 'Ibrahim', 'El Fassi', '2013-09-18', 'male', '17 cours Vitton', 'Lyon', '69006', 'Rachid El Fassi', '+33612345605', true),
  ('STD006', 'Salma', 'Fahmi', '2014-04-27', 'female', '42 rue de la République', 'Lyon', '69002', 'Laila Fahmi', '+33612345606', true),
  ('STD007', 'Hamza', 'Ghali', '2016-06-12', 'male', '9 place Bellecour', 'Lyon', '69002', 'Ali Ghali', '+33612345607', true),
  ('STD008', 'Nour', 'Haddi', '2015-02-03', 'female', '56 rue Mercière', 'Lyon', '69002', 'Yasmine Haddi', '+33612345608', true),
  ('STD009', 'Amine', 'Idrissi', '2014-12-20', 'male', '14 quai Saint-Antoine', 'Lyon', '69002', 'Omar Idrissi', '+33612345609', true),
  ('STD010', 'Khadija', 'Jilali', '2016-08-15', 'female', '28 rue Paul Bert', 'Lyon', '69003', 'Fatima Jilali', '+33612345610', true);

-- ============================================
-- Insérer les parents
-- ============================================
INSERT INTO parents (first_name, last_name, phone, email, address, city, postal_code, profession)
VALUES
  ('Hassan', 'Amrani', '+33612345601', 'hassan.amrani@email.com', '12 rue de la Paix', 'Lyon', '69001', 'Ingénieur'),
  ('Samira', 'Amrani', '+33612345621', 'samira.amrani@email.com', '12 rue de la Paix', 'Lyon', '69001', 'Médecin'),
  ('Karim', 'Chakir', '+33612345603', 'karim.chakir@email.com', '8 boulevard des Belges', 'Lyon', '69006', 'Commerçant'),
  ('Nadia', 'Drissi', '+33612345604', 'nadia.drissi@email.com', '33 rue Garibaldi', 'Lyon', '69003', 'Professeur'),
  ('Rachid', 'El Fassi', '+33612345605', 'rachid.elfassi@email.com', '17 cours Vitton', 'Lyon', '69006', 'Avocat'),
  ('Laila', 'Fahmi', '+33612345606', 'laila.fahmi@email.com', '42 rue de la République', 'Lyon', '69002', 'Infirmière'),
  ('Ali', 'Ghali', '+33612345607', 'ali.ghali@email.com', '9 place Bellecour', 'Lyon', '69002', 'Chef d''entreprise'),
  ('Yasmine', 'Haddi', '+33612345608', 'yasmine.haddi@email.com', '56 rue Mercière', 'Lyon', '69002', 'Pharmacienne');

-- ============================================
-- Associer les élèves aux parents (possibilité de plusieurs parents par élève)
-- ============================================

-- Youssef Amrani -> Hassan Amrani (père) ET Samira Amrani (mère)
INSERT INTO student_parents (student_id, parent_id, relationship, is_primary_contact, can_pickup)
SELECT s.id, p.id, 'father', true, true
FROM students s, parents p
WHERE s.student_number = 'STD001' AND p.first_name = 'Hassan' AND p.last_name = 'Amrani';

INSERT INTO student_parents (student_id, parent_id, relationship, is_primary_contact, can_pickup)
SELECT s.id, p.id, 'mother', false, true
FROM students s, parents p
WHERE s.student_number = 'STD001' AND p.first_name = 'Samira' AND p.last_name = 'Amrani';

-- Omar Chakir -> Karim Chakir (père)
INSERT INTO student_parents (student_id, parent_id, relationship, is_primary_contact, can_pickup)
SELECT s.id, p.id, 'father', true, true
FROM students s, parents p
WHERE s.student_number = 'STD003' AND p.last_name = 'Chakir';

-- Leila Drissi -> Nadia Drissi (mère)
INSERT INTO student_parents (student_id, parent_id, relationship, is_primary_contact, can_pickup)
SELECT s.id, p.id, 'mother', true, true
FROM students s, parents p
WHERE s.student_number = 'STD004' AND p.last_name = 'Drissi';

-- ============================================
-- Inscrire les élèves dans les classes
-- ============================================

-- Niveau 1A (6 élèves)
INSERT INTO enrollments (student_id, class_id, status)
SELECT s.id, c.id, 'active'
FROM students s, classes c
WHERE s.student_number IN ('STD001', 'STD002', 'STD003', 'STD004', 'STD007', 'STD008')
  AND c.name = 'Niveau 1A';

-- Niveau 2A (3 élèves)
INSERT INTO enrollments (student_id, class_id, status)
SELECT s.id, c.id, 'active'
FROM students s, classes c
WHERE s.student_number IN ('STD005', 'STD006', 'STD009')
  AND c.name = 'Niveau 2A';

-- Coran 1 (4 élèves)
INSERT INTO enrollments (student_id, class_id, status)
SELECT s.id, c.id, 'active'
FROM students s, classes c
WHERE s.student_number IN ('STD001', 'STD003', 'STD005', 'STD010')
  AND c.name = 'Coran 1';

-- ============================================
-- Créer quelques évaluations (avec modules)
-- ============================================
INSERT INTO evaluations (class_id, module_id, teacher_id, title, description, evaluation_type, max_score, coefficient, evaluation_date)
SELECT 
  c.id,
  m.id,
  t.id,
  'Contrôle mensuel - Alphabet arabe',
  'Évaluation de la connaissance de l''alphabet arabe',
  'test',
  20.00,
  1.00,
  '2026-02-10'
FROM classes c, modules m, teachers t
WHERE c.name = 'Niveau 1A' 
  AND m.code = 'AR-LECT-ALPHA'
  AND t.employee_number = 'ENS001';

INSERT INTO evaluations (class_id, module_id, teacher_id, title, description, evaluation_type, max_score, coefficient, evaluation_date)
SELECT 
  c.id,
  m.id,
  t.id,
  'Récitation - Sourate Al-Fatiha',
  'Récitation de la sourate Al-Fatiha',
  'oral',
  20.00,
  2.00,
  '2026-02-12'
FROM classes c, modules m, teachers t
WHERE c.name = 'Coran 1' 
  AND m.code = 'QURAN-MEMO-SHORT'
  AND t.employee_number = 'ENS003';

-- ============================================
-- Créer quelques annonces
-- ============================================
INSERT INTO announcements (title, content, announcement_type, target_class_id, priority, published_by, is_published, published_at)
SELECT
  'Rentrée des classes 2025-2026',
  'La rentrée aura lieu le lundi 1er septembre 2026. Les cours débuteront à 9h00. Merci d''être à l''heure !',
  'general',
  NULL,
  'high',
  p.id,
  true,
  NOW()
FROM profiles p
WHERE p.role = 'admin'
LIMIT 1;

INSERT INTO announcements (title, content, announcement_type, target_class_id, priority, published_by, is_published, published_at)
SELECT
  'Sortie pédagogique',
  'Une sortie à la Grande Mosquée de Lyon est prévue le 15 mars. Autorisation parentale requise.',
  'class',
  c.id,
  'normal',
  p.id,
  true,
  NOW()
FROM classes c, profiles p
WHERE c.name = 'Niveau 2A' AND p.role = 'admin'
LIMIT 1;

-- ============================================
-- Créer quelques paiements
-- ============================================
INSERT INTO payments (student_id, amount, payment_type, payment_method, payment_status, due_date, academic_year, description)
SELECT
  s.id,
  450.00,
  'enrollment',
  'bank_transfer',
  'paid',
  '2025-09-01',
  '2025-2026',
  'Frais d''inscription annuelle'
FROM students s
WHERE s.student_number IN ('STD001', 'STD002', 'STD003');

INSERT INTO payments (student_id, amount, payment_type, payment_method, payment_status, due_date, academic_year, description)
SELECT
  s.id,
  450.00,
  'enrollment',
  'check',
  'pending',
  '2025-09-01',
  '2025-2026',
  'Frais d''inscription annuelle'
FROM students s
WHERE s.student_number IN ('STD004', 'STD005');

-- ============================================
-- Créer un emploi du temps de base (avec modules)
-- ============================================
-- Niveau 1A - Lundi 9h-11h - Alphabet
INSERT INTO schedules (class_id, teacher_id, module_id, day_of_week, start_time, end_time, room_number)
SELECT
  c.id,
  t.id,
  m.id,
  1, -- Lundi
  '09:00',
  '11:00',
  'Salle 101'
FROM classes c, teachers t, modules m
WHERE c.name = 'Niveau 1A'
  AND t.employee_number = 'ENS001'
  AND m.code = 'AR-LECT-ALPHA';

-- Niveau 1A - Mercredi 14h-16h - Calligraphie
INSERT INTO schedules (class_id, teacher_id, module_id, day_of_week, start_time, end_time, room_number)
SELECT
  c.id,
  t.id,
  m.id,
  3, -- Mercredi
  '14:00',
  '16:00',
  'Salle 101'
FROM classes c, teachers t, modules m
WHERE c.name = 'Niveau 1A'
  AND t.employee_number = 'ENS001'
  AND m.code = 'AR-ECRI-CAL';

-- ============================================
-- FIN DES DONNÉES DE TEST
-- ============================================

SELECT 'Données de test insérées avec succès!' AS status;
SELECT 'Total élèves: ' || COUNT(*) FROM students;
SELECT 'Total parents: ' || COUNT(*) FROM parents;
SELECT 'Total classes: ' || COUNT(*) FROM classes;
SELECT 'Total enseignants: ' || COUNT(*) FROM teachers;
SELECT 'Total matières: ' || COUNT(*) FROM subjects;
SELECT 'Total unités d''enseignement: ' || COUNT(*) FROM teaching_units;
SELECT 'Total modules: ' || COUNT(*) FROM modules;
