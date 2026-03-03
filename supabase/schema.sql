-- ============================================
-- BILAL EDUCATION - Schéma Multi-Tenant
-- ============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- FONCTION : mise à jour automatique updated_at
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TABLE: etablissements
-- Un enregistrement par établissement client
-- ============================================

CREATE TABLE etablissements (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug                    TEXT UNIQUE NOT NULL,        -- identifiant sous-domaine (ex: al-kindi)
  nom                     TEXT NOT NULL,
  adresse                 TEXT,
  telephone               TEXT,
  contact                 TEXT,                        -- email de contact
  annee_courante          TEXT NOT NULL DEFAULT '2025-2026',
  is_active               BOOLEAN NOT NULL DEFAULT TRUE,
  subscription_expires_at TIMESTAMPTZ,                -- NULL = pas d'expiration
  max_students            INTEGER,                     -- NULL = illimité (mode production)
  notes                   TEXT,                        -- Notes internes super-admin uniquement
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER update_etablissements_updated_at
  BEFORE UPDATE ON etablissements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- TABLE: profiles
-- Profils utilisateurs (complète auth.users)
-- ============================================

CREATE TABLE profiles (
  id               UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  etablissement_id UUID REFERENCES etablissements(id) ON DELETE SET NULL,  -- NULL pour super_admin
  email            TEXT NOT NULL,
  role             TEXT NOT NULL CHECK (role IN (
    'super_admin', 'admin', 'direction', 'comptable', 'responsable_pedagogique',
    'enseignant', 'secretaire', 'parent'
  )),
  first_name       TEXT NOT NULL,
  last_name        TEXT NOT NULL,
  phone            TEXT,
  avatar_url       TEXT,
  is_active        BOOLEAN DEFAULT TRUE,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_profiles_etablissement ON profiles(etablissement_id);
CREATE INDEX idx_profiles_role         ON profiles(role);
CREATE INDEX idx_profiles_is_active    ON profiles(is_active);

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- FONCTION RLS : retourne l'etablissement_id de l'utilisateur courant
-- SECURITY DEFINER : bypass RLS sur profiles → évite la récursion infinie
-- ============================================

CREATE OR REPLACE FUNCTION current_etablissement_id()
RETURNS UUID AS $$
  SELECT etablissement_id FROM profiles WHERE id = auth.uid()
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ============================================
-- FONCTION TRIGGER : auto-remplir etablissement_id à l'INSERT côté client
-- ============================================

CREATE OR REPLACE FUNCTION set_etablissement_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.etablissement_id IS NULL THEN
    NEW.etablissement_id := current_etablissement_id();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- RLS : profiles et etablissements
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select" ON profiles
  FOR SELECT USING (id = auth.uid() OR etablissement_id = current_etablissement_id());
CREATE POLICY "profiles_update" ON profiles
  FOR UPDATE USING (etablissement_id = current_etablissement_id());

ALTER TABLE etablissements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "etablissements_select" ON etablissements
  FOR SELECT USING (id = current_etablissement_id());
CREATE POLICY "etablissements_update" ON etablissements
  FOR UPDATE USING (
    id = current_etablissement_id() AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'direction')
    )
  );

-- ============================================
-- TABLE: parents
-- ============================================

CREATE TABLE parents (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  etablissement_id UUID NOT NULL REFERENCES etablissements(id) ON DELETE CASCADE,

  tutor1_last_name     TEXT NOT NULL,
  tutor1_first_name    TEXT NOT NULL,
  tutor1_relationship  TEXT CHECK (tutor1_relationship IN ('père', 'mère', 'tuteur', 'autre')) DEFAULT 'père',
  tutor1_phone         TEXT,
  tutor1_email         TEXT,
  tutor1_address       TEXT,
  tutor1_city          TEXT,
  tutor1_postal_code   TEXT,
  tutor1_profession    TEXT,

  tutor2_last_name     TEXT,
  tutor2_first_name    TEXT,
  tutor2_relationship  TEXT CHECK (tutor2_relationship IN ('père', 'mère', 'tuteur', 'autre')),
  tutor2_phone         TEXT,
  tutor2_email         TEXT,
  tutor2_address       TEXT,
  tutor2_city          TEXT,
  tutor2_postal_code   TEXT,
  tutor2_profession    TEXT,

  tutor1_adult_courses BOOLEAN NOT NULL DEFAULT FALSE,
  tutor2_adult_courses BOOLEAN NOT NULL DEFAULT FALSE,

  situation_familiale  TEXT CHECK (situation_familiale IN ('mariés', 'pacsés', 'union_libre', 'séparés', 'divorcés', 'veuf_veuve', 'monoparental')),
  type_garde           TEXT CHECK (type_garde IN ('alternée', 'exclusive_t1', 'exclusive_t2')),
  notes                TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_parents_etablissement ON parents(etablissement_id);
CREATE INDEX idx_parents_tutor1_name   ON parents(tutor1_last_name);

CREATE TRIGGER update_parents_updated_at
  BEFORE UPDATE ON parents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER parents_auto_etablissement
  BEFORE INSERT ON parents FOR EACH ROW EXECUTE FUNCTION set_etablissement_id();

ALTER TABLE parents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "parents_tenant" ON parents
  USING (etablissement_id = current_etablissement_id());

-- ============================================
-- TABLE: students
-- ============================================

CREATE TABLE students (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  etablissement_id UUID NOT NULL REFERENCES etablissements(id) ON DELETE CASCADE,
  user_id          UUID REFERENCES profiles(id) ON DELETE SET NULL,
  parent_id        UUID REFERENCES parents(id) ON DELETE RESTRICT,
  student_number   TEXT NOT NULL,
  first_name       TEXT NOT NULL,
  last_name        TEXT NOT NULL,
  date_of_birth    DATE NOT NULL,
  gender           TEXT CHECK (gender IN ('male', 'female')),
  address          TEXT,
  city             TEXT,
  postal_code      TEXT,
  emergency_contact_name  TEXT,
  emergency_contact_phone TEXT,
  medical_notes    TEXT,
  enrollment_date  DATE DEFAULT CURRENT_DATE,
  is_active        BOOLEAN DEFAULT TRUE,
  exit_authorization  BOOLEAN NOT NULL DEFAULT FALSE,
  media_authorization BOOLEAN NOT NULL DEFAULT FALSE,
  has_pai          BOOLEAN NOT NULL DEFAULT FALSE,
  pai_notes        TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(etablissement_id, student_number)
);

CREATE INDEX idx_students_etablissement ON students(etablissement_id);
CREATE INDEX idx_students_number        ON students(student_number);
CREATE INDEX idx_students_is_active     ON students(is_active);
CREATE INDEX idx_students_parent        ON students(parent_id);

CREATE TRIGGER update_students_updated_at
  BEFORE UPDATE ON students FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER students_auto_etablissement
  BEFORE INSERT ON students FOR EACH ROW EXECUTE FUNCTION set_etablissement_id();

ALTER TABLE students ENABLE ROW LEVEL SECURITY;
CREATE POLICY "students_tenant" ON students
  USING (etablissement_id = current_etablissement_id());

-- ============================================
-- TABLE: teachers
-- ============================================

CREATE TABLE teachers (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  etablissement_id UUID NOT NULL REFERENCES etablissements(id) ON DELETE CASCADE,
  user_id          UUID REFERENCES profiles(id) ON DELETE SET NULL,
  first_name       TEXT NOT NULL,
  last_name        TEXT NOT NULL,
  employee_number  TEXT NOT NULL,
  phone            TEXT,
  email            TEXT NOT NULL,
  specialization   TEXT,
  hire_date        DATE DEFAULT CURRENT_DATE,
  is_active        BOOLEAN DEFAULT TRUE,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(etablissement_id, employee_number),
  UNIQUE(etablissement_id, email)
);

CREATE INDEX idx_teachers_etablissement ON teachers(etablissement_id);
CREATE INDEX idx_teachers_is_active     ON teachers(is_active);

CREATE TRIGGER update_teachers_updated_at
  BEFORE UPDATE ON teachers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER teachers_auto_etablissement
  BEFORE INSERT ON teachers FOR EACH ROW EXECUTE FUNCTION set_etablissement_id();

ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "teachers_tenant" ON teachers
  USING (etablissement_id = current_etablissement_id());

-- ============================================
-- TABLE: classes
-- ============================================

CREATE TABLE classes (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  etablissement_id UUID NOT NULL REFERENCES etablissements(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  level            TEXT NOT NULL,
  academic_year    TEXT NOT NULL,
  description      TEXT,
  max_students     INTEGER DEFAULT 25,
  room_number      TEXT,
  schedule_notes   TEXT,
  is_active        BOOLEAN DEFAULT TRUE,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_classes_etablissement ON classes(etablissement_id);
CREATE INDEX idx_classes_academic_year ON classes(academic_year);
CREATE INDEX idx_classes_is_active     ON classes(is_active);

CREATE TRIGGER update_classes_updated_at
  BEFORE UPDATE ON classes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER classes_auto_etablissement
  BEFORE INSERT ON classes FOR EACH ROW EXECUTE FUNCTION set_etablissement_id();

ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "classes_tenant" ON classes
  USING (etablissement_id = current_etablissement_id());

-- ============================================
-- TABLE: class_teachers
-- ============================================

CREATE TABLE class_teachers (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_id        UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  teacher_id      UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  is_main_teacher BOOLEAN DEFAULT FALSE,
  subject         TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(class_id, teacher_id, subject)
);

CREATE INDEX idx_class_teachers_class   ON class_teachers(class_id);
CREATE INDEX idx_class_teachers_teacher ON class_teachers(teacher_id);

ALTER TABLE class_teachers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "class_teachers_tenant" ON class_teachers
  USING (class_id IN (
    SELECT id FROM classes WHERE etablissement_id = current_etablissement_id()
  ));

-- ============================================
-- TABLE: enrollments
-- ============================================

CREATE TABLE enrollments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id      UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  class_id        UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  enrollment_date DATE DEFAULT CURRENT_DATE,
  status          TEXT DEFAULT 'active' CHECK (status IN ('active', 'withdrawn', 'completed')),
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, class_id)
);

CREATE INDEX idx_enrollments_student ON enrollments(student_id);
CREATE INDEX idx_enrollments_class   ON enrollments(class_id);
CREATE INDEX idx_enrollments_status  ON enrollments(status);

CREATE TRIGGER update_enrollments_updated_at
  BEFORE UPDATE ON enrollments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "enrollments_tenant" ON enrollments
  USING (student_id IN (
    SELECT id FROM students WHERE etablissement_id = current_etablissement_id()
  ));

-- ============================================
-- TABLE: subjects
-- ============================================

CREATE TABLE subjects (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  etablissement_id UUID NOT NULL REFERENCES etablissements(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  code             TEXT NOT NULL,
  description      TEXT,
  order_index      INTEGER DEFAULT 0,
  is_active        BOOLEAN DEFAULT TRUE,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(etablissement_id, code)
);

CREATE INDEX idx_subjects_etablissement ON subjects(etablissement_id);
CREATE INDEX idx_subjects_order         ON subjects(order_index);

CREATE TRIGGER update_subjects_updated_at
  BEFORE UPDATE ON subjects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER subjects_auto_etablissement
  BEFORE INSERT ON subjects FOR EACH ROW EXECUTE FUNCTION set_etablissement_id();

ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "subjects_tenant" ON subjects
  USING (etablissement_id = current_etablissement_id());

-- ============================================
-- TABLE: teaching_units
-- ============================================

CREATE TABLE teaching_units (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  etablissement_id UUID NOT NULL REFERENCES etablissements(id) ON DELETE CASCADE,
  subject_id       UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  code             TEXT NOT NULL,
  description      TEXT,
  order_index      INTEGER DEFAULT 0,
  is_active        BOOLEAN DEFAULT TRUE,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(etablissement_id, code)
);

CREATE INDEX idx_teaching_units_etablissement ON teaching_units(etablissement_id);
CREATE INDEX idx_teaching_units_subject       ON teaching_units(subject_id);
CREATE INDEX idx_teaching_units_order         ON teaching_units(order_index);

CREATE TRIGGER update_teaching_units_updated_at
  BEFORE UPDATE ON teaching_units FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER teaching_units_auto_etablissement
  BEFORE INSERT ON teaching_units FOR EACH ROW EXECUTE FUNCTION set_etablissement_id();

ALTER TABLE teaching_units ENABLE ROW LEVEL SECURITY;
CREATE POLICY "teaching_units_tenant" ON teaching_units
  USING (etablissement_id = current_etablissement_id());

-- ============================================
-- TABLE: modules
-- ============================================

CREATE TABLE modules (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  etablissement_id UUID NOT NULL REFERENCES etablissements(id) ON DELETE CASCADE,
  teaching_unit_id UUID NOT NULL REFERENCES teaching_units(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  code             TEXT NOT NULL,
  description      TEXT,
  order_index      INTEGER DEFAULT 0,
  is_active        BOOLEAN DEFAULT TRUE,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(etablissement_id, code)
);

CREATE INDEX idx_modules_etablissement ON modules(etablissement_id);
CREATE INDEX idx_modules_teaching_unit ON modules(teaching_unit_id);
CREATE INDEX idx_modules_order         ON modules(order_index);

CREATE TRIGGER update_modules_updated_at
  BEFORE UPDATE ON modules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER modules_auto_etablissement
  BEFORE INSERT ON modules FOR EACH ROW EXECUTE FUNCTION set_etablissement_id();

ALTER TABLE modules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "modules_tenant" ON modules
  USING (etablissement_id = current_etablissement_id());

-- ============================================
-- TABLE: evaluations
-- ============================================

CREATE TABLE evaluations (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  etablissement_id UUID NOT NULL REFERENCES etablissements(id) ON DELETE CASCADE,
  class_id         UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  module_id        UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  teacher_id       UUID REFERENCES teachers(id) ON DELETE SET NULL,
  title            TEXT NOT NULL,
  description      TEXT,
  evaluation_type  TEXT CHECK (evaluation_type IN ('test', 'exam', 'oral', 'homework', 'participation')),
  max_score        DECIMAL(5,2) NOT NULL DEFAULT 20.00,
  coefficient      DECIMAL(3,2) DEFAULT 1.00,
  evaluation_date  DATE NOT NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_evaluations_etablissement ON evaluations(etablissement_id);
CREATE INDEX idx_evaluations_class         ON evaluations(class_id);
CREATE INDEX idx_evaluations_module        ON evaluations(module_id);
CREATE INDEX idx_evaluations_date          ON evaluations(evaluation_date);

CREATE TRIGGER update_evaluations_updated_at
  BEFORE UPDATE ON evaluations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER evaluations_auto_etablissement
  BEFORE INSERT ON evaluations FOR EACH ROW EXECUTE FUNCTION set_etablissement_id();

ALTER TABLE evaluations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "evaluations_tenant" ON evaluations
  USING (etablissement_id = current_etablissement_id());

-- ============================================
-- TABLE: grades
-- ============================================

CREATE TABLE grades (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id    UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  evaluation_id UUID NOT NULL REFERENCES evaluations(id) ON DELETE CASCADE,
  score         DECIMAL(5,2),
  comment       TEXT,
  is_absent     BOOLEAN DEFAULT FALSE,
  graded_by     UUID REFERENCES teachers(id) ON DELETE SET NULL,
  graded_at     TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, evaluation_id),
  CHECK (score IS NULL OR score >= 0)
);

CREATE INDEX idx_grades_student    ON grades(student_id);
CREATE INDEX idx_grades_evaluation ON grades(evaluation_id);

CREATE TRIGGER update_grades_updated_at
  BEFORE UPDATE ON grades FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE grades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "grades_tenant" ON grades
  USING (student_id IN (
    SELECT id FROM students WHERE etablissement_id = current_etablissement_id()
  ));

-- ============================================
-- TABLE: absences
-- ============================================

CREATE TABLE absences (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id    UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  class_id      UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  absence_date  DATE NOT NULL,
  absence_type  TEXT CHECK (absence_type IN ('absence', 'late', 'authorized_absence')),
  period        TEXT,
  reason        TEXT,
  is_justified  BOOLEAN DEFAULT FALSE,
  justification_document_url TEXT,
  recorded_by   UUID REFERENCES teachers(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_absences_student ON absences(student_id);
CREATE INDEX idx_absences_date    ON absences(absence_date);
CREATE INDEX idx_absences_type    ON absences(absence_type);

CREATE TRIGGER update_absences_updated_at
  BEFORE UPDATE ON absences FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE absences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "absences_tenant" ON absences
  USING (student_id IN (
    SELECT id FROM students WHERE etablissement_id = current_etablissement_id()
  ));

-- ============================================
-- TABLE: announcements
-- ============================================

CREATE TABLE announcements (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  etablissement_id UUID NOT NULL REFERENCES etablissements(id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  content          TEXT NOT NULL,
  announcement_type TEXT CHECK (announcement_type IN ('general', 'class', 'parent', 'teacher')),
  target_class_id  UUID REFERENCES classes(id) ON DELETE CASCADE,
  priority         TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  published_by     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  is_published     BOOLEAN DEFAULT FALSE,
  published_at     TIMESTAMPTZ,
  expires_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_announcements_etablissement ON announcements(etablissement_id);
CREATE INDEX idx_announcements_type          ON announcements(announcement_type);
CREATE INDEX idx_announcements_class         ON announcements(target_class_id);
CREATE INDEX idx_announcements_published     ON announcements(is_published);

CREATE TRIGGER update_announcements_updated_at
  BEFORE UPDATE ON announcements FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER announcements_auto_etablissement
  BEFORE INSERT ON announcements FOR EACH ROW EXECUTE FUNCTION set_etablissement_id();

ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "announcements_tenant" ON announcements
  USING (etablissement_id = current_etablissement_id());

-- ============================================
-- TABLE: announcement_recipients
-- ============================================

CREATE TABLE announcement_recipients (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  announcement_id UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  parent_id       UUID NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  is_read         BOOLEAN DEFAULT FALSE,
  read_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(announcement_id, parent_id)
);

CREATE INDEX idx_ann_recipients_announcement ON announcement_recipients(announcement_id);
CREATE INDEX idx_ann_recipients_parent       ON announcement_recipients(parent_id);
CREATE INDEX idx_ann_recipients_is_read      ON announcement_recipients(is_read);

ALTER TABLE announcement_recipients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ann_recipients_tenant" ON announcement_recipients
  USING (announcement_id IN (
    SELECT id FROM announcements WHERE etablissement_id = current_etablissement_id()
  ));

-- ============================================
-- TABLE: announcement_staff_recipients
-- ============================================

CREATE TABLE announcement_staff_recipients (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  announcement_id UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  profile_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  is_read         BOOLEAN DEFAULT FALSE,
  read_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(announcement_id, profile_id)
);

CREATE INDEX idx_ann_staff_ann     ON announcement_staff_recipients(announcement_id);
CREATE INDEX idx_ann_staff_profile ON announcement_staff_recipients(profile_id);
CREATE INDEX idx_ann_staff_read    ON announcement_staff_recipients(is_read);

ALTER TABLE announcement_staff_recipients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ann_staff_recipients_tenant" ON announcement_staff_recipients
  USING (announcement_id IN (
    SELECT id FROM announcements WHERE etablissement_id = current_etablissement_id()
  ));

-- ============================================
-- TABLE: payments
-- ============================================

CREATE TABLE payments (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  etablissement_id UUID NOT NULL REFERENCES etablissements(id) ON DELETE CASCADE,
  student_id       UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  amount           DECIMAL(10,2) NOT NULL,
  payment_type     TEXT CHECK (payment_type IN ('enrollment', 'tuition', 'materials', 'other')),
  payment_method   TEXT CHECK (payment_method IN ('cash', 'check', 'bank_transfer', 'card', 'other')),
  payment_status   TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'overdue', 'cancelled')),
  due_date         DATE,
  paid_date        DATE,
  academic_year    TEXT NOT NULL,
  description      TEXT,
  receipt_number   TEXT,
  created_by       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(etablissement_id, receipt_number)
);

CREATE INDEX idx_payments_etablissement ON payments(etablissement_id);
CREATE INDEX idx_payments_student       ON payments(student_id);
CREATE INDEX idx_payments_status        ON payments(payment_status);
CREATE INDEX idx_payments_academic_year ON payments(academic_year);

CREATE TRIGGER update_payments_updated_at
  BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER payments_auto_etablissement
  BEFORE INSERT ON payments FOR EACH ROW EXECUTE FUNCTION set_etablissement_id();

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payments_tenant" ON payments
  USING (etablissement_id = current_etablissement_id());

-- ============================================
-- TABLE: schedules
-- ============================================

CREATE TABLE schedules (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_id    UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  teacher_id  UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  module_id   UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  day_of_week INTEGER CHECK (day_of_week BETWEEN 0 AND 6),
  start_time  TIME NOT NULL,
  end_time    TIME NOT NULL,
  room_number TEXT,
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  CHECK (end_time > start_time)
);

CREATE INDEX idx_schedules_class   ON schedules(class_id);
CREATE INDEX idx_schedules_teacher ON schedules(teacher_id);
CREATE INDEX idx_schedules_day     ON schedules(day_of_week);

CREATE TRIGGER update_schedules_updated_at
  BEFORE UPDATE ON schedules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "schedules_tenant" ON schedules
  USING (class_id IN (
    SELECT id FROM classes WHERE etablissement_id = current_etablissement_id()
  ));

-- ============================================
-- FIN DU SCHÉMA
-- ============================================
-- Initialisation après exécution du schéma :
--
-- 1. Dans Supabase Studio → SQL Editor, exécuter :
--    INSERT INTO etablissements (slug, nom, annee_courante)
--    VALUES ('demo', 'Mon Établissement', '2025-2026');
--
-- 2. Dans Supabase Studio → Authentication → Add user :
--    Créer l'utilisateur admin (email + mot de passe)
--
-- 3. Insérer son profil (remplacer les UUIDs) :
--    INSERT INTO profiles (id, etablissement_id, email, role, first_name, last_name)
--    VALUES (
--      '<user-uuid-from-auth>',
--      '<etablissement-uuid>',
--      'admin@monecole.fr',
--      'admin',
--      'Admin',
--      'Principal'
--    );
--
-- 4. Ajouter dans .env.local :
--    DEFAULT_TENANT_SLUG=demo
-- ============================================

SELECT 'Schéma multi-tenant Bilal Education créé avec succès!' AS status;
