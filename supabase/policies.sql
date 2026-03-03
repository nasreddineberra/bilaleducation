-- ============================================
-- BILAL EDUCATION - Politiques de sécurité RLS (VERSION FINALE)
-- Row Level Security (RLS) selon la matrice des permissions exacte
-- ============================================

-- Active RLS sur toutes les tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE parents ENABLE ROW LEVEL SECURITY;
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE teaching_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE absences ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcement_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcement_staff_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;

-- ============================================
-- FONCTIONS HELPER
-- ============================================

CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
BEGIN
  RETURN (SELECT role FROM profiles WHERE id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Admin a TOUT (super-admin technique)
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN get_user_role() = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- TABLE: profiles
-- ============================================

-- Les utilisateurs peuvent voir leur propre profil
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- Admin et Direction peuvent voir tous les profils
CREATE POLICY "Admin and direction can view all profiles"
  ON profiles FOR SELECT
  USING (get_user_role() IN ('admin', 'direction'));

-- Les utilisateurs peuvent mettre à jour leur propre profil
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Seuls Admin et Direction peuvent créer et supprimer des profils
CREATE POLICY "Admin and direction can insert profiles"
  ON profiles FOR INSERT
  WITH CHECK (get_user_role() IN ('admin', 'direction'));

CREATE POLICY "Admin and direction can delete profiles"
  ON profiles FOR DELETE
  USING (get_user_role() IN ('admin', 'direction'));

-- ============================================
-- TABLE: students
-- Permissions : Admin ✅, Direction ✅, Secrétaire ✅, Enseignant 👁️, Parent 🔒
-- ============================================

-- Admin, Direction et Secrétaire peuvent TOUT faire
CREATE POLICY "Admin, direction and secretaire can manage students"
  ON students FOR ALL
  USING (get_user_role() IN ('admin', 'direction', 'secretaire'));

-- Enseignants peuvent VOIR tous les élèves
CREATE POLICY "Teachers can view all students"
  ON students FOR SELECT
  USING (get_user_role() = 'enseignant');

-- Parents peuvent voir LEURS enfants (portail parent — à compléter)
-- CREATE POLICY "Parents can view their children"
--   ON students FOR SELECT
--   USING (
--     get_user_role() = 'parent' AND
--     parent_id IN (SELECT id FROM parents WHERE user_id = auth.uid())
--   );

-- ============================================
-- TABLE: parents
-- ============================================

-- Admin, Direction et Secrétaire peuvent tout voir et gérer
CREATE POLICY "Admin, direction and secretaire can manage parents"
  ON parents FOR ALL
  USING (get_user_role() IN ('admin', 'direction', 'secretaire'));

-- Enseignants peuvent voir tous les parents
CREATE POLICY "Teachers can view all parents"
  ON parents FOR SELECT
  USING (get_user_role() = 'enseignant');

-- Parents peuvent voir leur propre fiche (portail parent — à compléter)
-- CREATE POLICY "Parents can view own profile"
--   ON parents FOR SELECT
--   USING (user_id = auth.uid());

-- ============================================
-- TABLE: teachers
-- Permissions : Admin ✅, Direction ✅, autres ❌
-- ============================================

-- Tous les utilisateurs authentifiés peuvent VOIR les enseignants
CREATE POLICY "Authenticated users can view teachers"
  ON teachers FOR SELECT
  TO authenticated
  USING (true);

-- Seuls Admin et Direction peuvent gérer
CREATE POLICY "Admin and direction can manage teachers"
  ON teachers FOR ALL
  USING (get_user_role() IN ('admin', 'direction'));

-- ============================================
-- TABLE: classes
-- Permissions : Admin ✅, Direction ✅, Resp. Pédago ✅, Enseignant 👁️
-- ============================================

-- Tous peuvent VOIR les classes
CREATE POLICY "Authenticated users can view classes"
  ON classes FOR SELECT
  TO authenticated
  USING (true);

-- Admin, Direction et Responsable Pédagogique peuvent gérer
CREATE POLICY "Admin, direction and pedagogical manager can manage classes"
  ON classes FOR ALL
  USING (get_user_role() IN ('admin', 'direction', 'responsable_pedagogique'));

-- ============================================
-- TABLE: class_teachers
-- ============================================

-- Tous peuvent voir les assignations
CREATE POLICY "Authenticated users can view class-teacher assignments"
  ON class_teachers FOR SELECT
  TO authenticated
  USING (true);

-- Admin, Direction et Responsable Pédagogique peuvent gérer
CREATE POLICY "Admin, direction and pedagogical manager can manage assignments"
  ON class_teachers FOR ALL
  USING (get_user_role() IN ('admin', 'direction', 'responsable_pedagogique'));

-- ============================================
-- TABLE: enrollments
-- ============================================

-- Admin, Direction et Secrétaire peuvent gérer
CREATE POLICY "Admin, direction and secretaire can manage enrollments"
  ON enrollments FOR ALL
  USING (get_user_role() IN ('admin', 'direction', 'secretaire'));

-- Enseignants et Responsable Pédagogique peuvent voir
CREATE POLICY "Teachers and pedagogical manager can view enrollments"
  ON enrollments FOR SELECT
  USING (get_user_role() IN ('enseignant', 'responsable_pedagogique'));

-- Parents peuvent voir les inscriptions de leurs enfants (portail parent — à compléter)
-- CREATE POLICY "Parents can view their children enrollments"
--   ON enrollments FOR SELECT
--   USING (
--     get_user_role() = 'parent' AND
--     student_id IN (SELECT id FROM students WHERE parent_id IN (SELECT id FROM parents WHERE user_id = auth.uid()))
--   );

-- ============================================
-- TABLE: subjects (Matières)
-- Permissions : Admin ✅, Direction ✅, Resp. Pédago ✅, Enseignant 👁️
-- ============================================

-- Tous peuvent VOIR les matières
CREATE POLICY "Authenticated users can view subjects"
  ON subjects FOR SELECT
  TO authenticated
  USING (true);

-- Admin, Direction et Responsable Pédagogique peuvent gérer
CREATE POLICY "Admin, direction and pedagogical manager can manage subjects"
  ON subjects FOR ALL
  USING (get_user_role() IN ('admin', 'direction', 'responsable_pedagogique'));

-- ============================================
-- TABLE: teaching_units (UE)
-- Permissions : Admin ✅, Direction ✅, Resp. Pédago ✅, Enseignant 👁️
-- ============================================

-- Tous peuvent VOIR les UE
CREATE POLICY "Authenticated users can view teaching units"
  ON teaching_units FOR SELECT
  TO authenticated
  USING (true);

-- Admin, Direction et Responsable Pédagogique peuvent gérer
CREATE POLICY "Admin, direction and pedagogical manager can manage teaching units"
  ON teaching_units FOR ALL
  USING (get_user_role() IN ('admin', 'direction', 'responsable_pedagogique'));

-- ============================================
-- TABLE: modules
-- Permissions : Admin ✅, Direction ✅, Resp. Pédago ✅, Enseignant 👁️
-- ============================================

-- Tous peuvent VOIR les modules
CREATE POLICY "Authenticated users can view modules"
  ON modules FOR SELECT
  TO authenticated
  USING (true);

-- Admin, Direction et Responsable Pédagogique peuvent gérer
CREATE POLICY "Admin, direction and pedagogical manager can manage modules"
  ON modules FOR ALL
  USING (get_user_role() IN ('admin', 'direction', 'responsable_pedagogique'));

-- ============================================
-- TABLE: evaluations
-- Permissions : Admin ✅, Direction ✅, Resp. Pédago ✅, Enseignant 📝 (ses classes)
-- ============================================

-- Admin, Direction et Responsable Pédagogique peuvent TOUT faire
CREATE POLICY "Admin, direction and pedagogical manager can manage all evaluations"
  ON evaluations FOR ALL
  USING (get_user_role() IN ('admin', 'direction', 'responsable_pedagogique'));

-- Enseignants peuvent voir toutes les évaluations
CREATE POLICY "Teachers can view all evaluations"
  ON evaluations FOR SELECT
  USING (get_user_role() = 'enseignant');

-- Enseignants peuvent créer et modifier LEURS évaluations (leurs classes)
CREATE POLICY "Teachers can manage their class evaluations"
  ON evaluations FOR INSERT
  WITH CHECK (
    get_user_role() = 'enseignant' AND
    (teacher_id IN (SELECT id FROM teachers WHERE user_id = auth.uid()) OR
     class_id IN (
       SELECT ct.class_id 
       FROM class_teachers ct
       JOIN teachers t ON ct.teacher_id = t.id
       WHERE t.user_id = auth.uid()
     ))
  );

CREATE POLICY "Teachers can update their class evaluations"
  ON evaluations FOR UPDATE
  USING (
    get_user_role() = 'enseignant' AND
    (teacher_id IN (SELECT id FROM teachers WHERE user_id = auth.uid()) OR
     class_id IN (
       SELECT ct.class_id 
       FROM class_teachers ct
       JOIN teachers t ON ct.teacher_id = t.id
       WHERE t.user_id = auth.uid()
     ))
  );

CREATE POLICY "Teachers can delete their class evaluations"
  ON evaluations FOR DELETE
  USING (
    get_user_role() = 'enseignant' AND
    teacher_id IN (SELECT id FROM teachers WHERE user_id = auth.uid())
  );

-- Parents peuvent voir les évaluations des classes de leurs enfants (portail parent — à compléter)
-- CREATE POLICY "Parents can view evaluations of their children's classes"
--   ON evaluations FOR SELECT
--   USING (
--     get_user_role() = 'parent' AND
--     class_id IN (
--       SELECT e.class_id FROM enrollments e
--       WHERE e.student_id IN (SELECT id FROM students WHERE parent_id IN (SELECT id FROM parents WHERE user_id = auth.uid()))
--     )
--   );

-- ============================================
-- TABLE: grades
-- Permissions : Admin ✅, Direction ✅, Resp. Pédago ✅, Enseignant 📝, Parent 🔒
-- ============================================

-- Admin, Direction et Responsable Pédagogique peuvent TOUT faire
CREATE POLICY "Admin, direction and pedagogical manager can manage all grades"
  ON grades FOR ALL
  USING (get_user_role() IN ('admin', 'direction', 'responsable_pedagogique'));

-- Enseignants peuvent voir toutes les notes
CREATE POLICY "Teachers can view all grades"
  ON grades FOR SELECT
  USING (get_user_role() = 'enseignant');

-- Enseignants peuvent gérer les notes de leurs classes
CREATE POLICY "Teachers can manage grades for their classes"
  ON grades FOR INSERT
  WITH CHECK (
    get_user_role() = 'enseignant' AND
    evaluation_id IN (
      SELECT e.id 
      FROM evaluations e
      JOIN class_teachers ct ON e.class_id = ct.class_id
      JOIN teachers t ON ct.teacher_id = t.id
      WHERE t.user_id = auth.uid()
    )
  );

CREATE POLICY "Teachers can update grades for their classes"
  ON grades FOR UPDATE
  USING (
    get_user_role() = 'enseignant' AND
    evaluation_id IN (
      SELECT e.id 
      FROM evaluations e
      JOIN class_teachers ct ON e.class_id = ct.class_id
      JOIN teachers t ON ct.teacher_id = t.id
      WHERE t.user_id = auth.uid()
    )
  );

CREATE POLICY "Teachers can delete grades for their classes"
  ON grades FOR DELETE
  USING (
    get_user_role() = 'enseignant' AND
    evaluation_id IN (
      SELECT e.id 
      FROM evaluations e
      JOIN class_teachers ct ON e.class_id = ct.class_id
      JOIN teachers t ON ct.teacher_id = t.id
      WHERE t.user_id = auth.uid()
    )
  );

-- Parents peuvent voir les notes de leurs enfants (portail parent — à compléter)
-- CREATE POLICY "Parents can view their children grades"
--   ON grades FOR SELECT
--   USING (
--     get_user_role() = 'parent' AND
--     student_id IN (SELECT id FROM students WHERE parent_id IN (SELECT id FROM parents WHERE user_id = auth.uid()))
--   );

-- ============================================
-- TABLE: absences
-- Permissions : Admin ✅, Direction ✅, Resp. Pédago ✅, Enseignant 📝, Secrétaire ✅, Parent 🔒
-- ============================================

-- Admin, Direction, Responsable Pédagogique et Secrétaire peuvent TOUT faire
CREATE POLICY "Admin, direction, pedagogical manager and secretaire can manage all absences"
  ON absences FOR ALL
  USING (get_user_role() IN ('admin', 'direction', 'responsable_pedagogique', 'secretaire'));

-- Enseignants peuvent voir toutes les absences
CREATE POLICY "Teachers can view all absences"
  ON absences FOR SELECT
  USING (get_user_role() = 'enseignant');

-- Enseignants peuvent gérer les absences de leurs classes
CREATE POLICY "Teachers can manage absences for their classes"
  ON absences FOR INSERT
  WITH CHECK (
    get_user_role() = 'enseignant' AND
    class_id IN (
      SELECT ct.class_id 
      FROM class_teachers ct
      JOIN teachers t ON ct.teacher_id = t.id
      WHERE t.user_id = auth.uid()
    )
  );

CREATE POLICY "Teachers can update absences for their classes"
  ON absences FOR UPDATE
  USING (
    get_user_role() = 'enseignant' AND
    class_id IN (
      SELECT ct.class_id 
      FROM class_teachers ct
      JOIN teachers t ON ct.teacher_id = t.id
      WHERE t.user_id = auth.uid()
    )
  );

CREATE POLICY "Teachers can delete absences for their classes"
  ON absences FOR DELETE
  USING (
    get_user_role() = 'enseignant' AND
    class_id IN (
      SELECT ct.class_id 
      FROM class_teachers ct
      JOIN teachers t ON ct.teacher_id = t.id
      WHERE t.user_id = auth.uid()
    )
  );

-- Parents peuvent voir les absences de leurs enfants (portail parent — à compléter)
-- CREATE POLICY "Parents can view their children absences"
--   ON absences FOR SELECT
--   USING (
--     get_user_role() = 'parent' AND
--     student_id IN (SELECT id FROM students WHERE parent_id IN (SELECT id FROM parents WHERE user_id = auth.uid()))
--   );

-- ============================================
-- TABLE: announcements
-- Permissions : Tous peuvent créer et gérer (Admin ✅, Direction ✅, Comptable ✅, Resp. Pédago ✅, Enseignant ✅, Secrétaire ✅, Parent 👁️)
-- ============================================

-- Les annonces générales sont visibles par tous
CREATE POLICY "Everyone can view general announcements"
  ON announcements FOR SELECT
  USING (
    is_published = true AND
    announcement_type = 'general'
  );

-- Les annonces de classe sont visibles par les concernés
CREATE POLICY "Class members can view class announcements"
  ON announcements FOR SELECT
  USING (
    is_published = true AND
    announcement_type = 'class' AND
    (
      -- Enseignants de la classe
      (get_user_role() = 'enseignant' AND target_class_id IN (
        SELECT ct.class_id 
        FROM class_teachers ct
        JOIN teachers t ON ct.teacher_id = t.id
        WHERE t.user_id = auth.uid()
      )) OR
      -- Tout le personnel
      get_user_role() IN ('admin', 'direction', 'comptable', 'responsable_pedagogique', 'secretaire')
    )
  );

-- Tout le personnel peut voir toutes les annonces
CREATE POLICY "Staff can view all announcements"
  ON announcements FOR SELECT
  USING (get_user_role() IN ('admin', 'direction', 'comptable', 'responsable_pedagogique', 'enseignant', 'secretaire'));

-- Tout le personnel peut créer des annonces
CREATE POLICY "Staff can create announcements"
  ON announcements FOR INSERT
  WITH CHECK (get_user_role() IN ('admin', 'direction', 'comptable', 'responsable_pedagogique', 'enseignant', 'secretaire'));

-- Les créateurs peuvent modifier leurs annonces
CREATE POLICY "Publishers can update own announcements"
  ON announcements FOR UPDATE
  USING (published_by = auth.uid());

-- Admin et Direction peuvent tout gérer
CREATE POLICY "Admin and direction can manage all announcements"
  ON announcements FOR ALL
  USING (get_user_role() IN ('admin', 'direction'));

-- ============================================
-- TABLE: announcement_recipients (pour parents)
-- ============================================

-- Tout le personnel peut voir tous les destinataires
CREATE POLICY "Staff can view all announcement recipients"
  ON announcement_recipients FOR SELECT
  USING (get_user_role() IN ('admin', 'direction', 'comptable', 'responsable_pedagogique', 'enseignant', 'secretaire'));

-- Parents peuvent voir les annonces qui leur sont destinées (portail parent — à compléter)
-- CREATE POLICY "Parents can view their own announcement receipts"
--   ON announcement_recipients FOR SELECT
--   USING (
--     get_user_role() = 'parent' AND
--     parent_id IN (SELECT id FROM parents WHERE user_id = auth.uid())
--   );

-- Parents peuvent marquer comme lu (portail parent — à compléter)
-- CREATE POLICY "Parents can update read status"
--   ON announcement_recipients FOR UPDATE
--   USING (
--     get_user_role() = 'parent' AND
--     parent_id IN (SELECT id FROM parents WHERE user_id = auth.uid())
--   );

-- Tout le personnel peut créer et gérer les destinataires
CREATE POLICY "Staff can manage announcement recipients"
  ON announcement_recipients FOR ALL
  USING (get_user_role() IN ('admin', 'direction', 'comptable', 'responsable_pedagogique', 'enseignant', 'secretaire'));

-- ============================================
-- TABLE: announcement_staff_recipients (pour personnel)
-- ============================================

-- Tout le personnel peut voir tous les destinataires du personnel
CREATE POLICY "Staff can view all staff announcement recipients"
  ON announcement_staff_recipients FOR SELECT
  USING (get_user_role() IN ('admin', 'direction', 'comptable', 'responsable_pedagogique', 'enseignant', 'secretaire'));

-- Membres du personnel peuvent voir les annonces qui leur sont destinées
CREATE POLICY "Staff can view their own announcement receipts"
  ON announcement_staff_recipients FOR SELECT
  USING (profile_id = auth.uid());

-- Membres du personnel peuvent marquer comme lu
CREATE POLICY "Staff can update their own read status"
  ON announcement_staff_recipients FOR UPDATE
  USING (profile_id = auth.uid());

-- Tout le personnel peut créer et gérer les destinataires du personnel
CREATE POLICY "Staff can manage staff announcement recipients"
  ON announcement_staff_recipients FOR ALL
  USING (get_user_role() IN ('admin', 'direction', 'comptable', 'responsable_pedagogique', 'enseignant', 'secretaire'));

-- ============================================
-- TABLE: payments
-- Permissions : Admin ✅, Direction ✅, Comptable ✅, Parent 🔒
-- ============================================

-- Admin, Direction et Comptable peuvent TOUT faire
CREATE POLICY "Admin, direction and accountant can manage all payments"
  ON payments FOR ALL
  USING (get_user_role() IN ('admin', 'direction', 'comptable'));

-- Parents peuvent voir les paiements de leurs enfants (portail parent — à compléter)
-- CREATE POLICY "Parents can view their children payments"
--   ON payments FOR SELECT
--   USING (
--     get_user_role() = 'parent' AND
--     student_id IN (SELECT id FROM students WHERE parent_id IN (SELECT id FROM parents WHERE user_id = auth.uid()))
--   );

-- ============================================
-- TABLE: schedules
-- ============================================

-- Tous les utilisateurs authentifiés peuvent voir les emplois du temps
CREATE POLICY "Authenticated users can view schedules"
  ON schedules FOR SELECT
  TO authenticated
  USING (true);

-- Admin, Direction et Responsable Pédagogique peuvent gérer
CREATE POLICY "Admin, direction and pedagogical manager can manage schedules"
  ON schedules FOR ALL
  USING (get_user_role() IN ('admin', 'direction', 'responsable_pedagogique'));

-- ============================================
-- FIN DES POLITIQUES RLS
-- ============================================

SELECT 'Politiques RLS Bilal Education créées avec succès (selon matrice exacte) !' AS status;
