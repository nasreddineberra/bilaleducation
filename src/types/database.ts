// Types générés depuis le schéma Supabase

export type UserRole = 'super_admin' | 'admin' | 'direction' | 'comptable' | 'responsable_pedagogique' | 'enseignant' | 'secretaire' | 'parent'

export type Gender = 'male' | 'female'

export type TutorRelationship = 'père' | 'mère' | 'tuteur' | 'autre'

export type EnrollmentStatus = 'active' | 'withdrawn' | 'completed'

export type EvaluationType = 'test' | 'exam' | 'oral' | 'homework' | 'participation'

export type PeriodType  = 'trimestrial' | 'semestrial'

export type EvalTypeKind = 'diagnostic' | 'scored' | 'stars'

export interface DiagnosticOption {
  acronym: string
  comment: string
}

/** Parse un élément diagnostic_options (objet, chaîne JSON, ou simple string) */
export function parseDiagnosticOption(o: unknown): DiagnosticOption {
  if (typeof o === 'object' && o !== null && 'acronym' in o) return o as DiagnosticOption
  if (typeof o === 'string') {
    if (o.startsWith('{')) try { return JSON.parse(o) } catch { /* fallback */ }
    return { acronym: o, comment: '' }
  }
  return { acronym: String(o), comment: '' }
}

export type AbsenceType = 'absence' | 'retard'

export type WarningSeverity = 'punition' | 'prevention' | 'conservatoire' | 'sanction'

export type AnnouncementType = 'general' | 'class' | 'parent' | 'teacher'

export type Priority = 'low' | 'normal' | 'high' | 'urgent'

export type PaymentType = 'enrollment' | 'tuition' | 'materials' | 'other'

export type PaymentMethod = 'cash' | 'check' | 'bank_transfer' | 'card' | 'other'

export type PaymentStatus = 'pending' | 'paid' | 'overdue' | 'cancelled'

export interface Etablissement {
  id: string
  slug: string
  nom: string
  adresse?: string
  telephone?: string
  contact?: string
  logo_url?: string | null
  is_active: boolean
  subscription_expires_at?: string
  max_students?: number | null    // NULL = illimité
  notes?: string | null           // Notes internes super-admin
  created_at: string
  updated_at: string
}

export interface SchoolYear {
  id: string
  etablissement_id: string
  label: string              // ex. "2025-2026"
  is_current: boolean
  period_type: PeriodType
  created_at: string
}

export interface Period {
  id: string
  school_year_id: string
  label: string              // "T1", "T2", "T3" / "S1", "S2"
  order_index: number
  created_at: string
}

export interface EvalTypeConfig {
  id: string
  school_year_id: string
  eval_type: EvalTypeKind
  is_active: boolean
  max_score?: number | null           // 10 ou 20 pour 'scored', null sinon
  diagnostic_options?: DiagnosticOption[] | null // ex. [{acronym:'AC',comment:'Acquis Consolidé'}]
  created_at: string
}

export interface Profile {
  id: string
  etablissement_id?: string   // NULL pour super_admin
  email: string
  role: UserRole
  civilite?: string
  first_name: string
  last_name: string
  phone?: string
  avatar_url?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Student {
  id: string
  etablissement_id: string
  user_id?: string
  parent_id?: string
  student_number: string
  first_name: string
  last_name: string
  date_of_birth: string
  gender?: Gender
  address?: string
  city?: string
  postal_code?: string
  emergency_contact_name?: string
  emergency_contact_phone?: string
  medical_notes?: string
  enrollment_date: string
  is_active: boolean
  exit_authorization: boolean
  media_authorization: boolean
  has_pai: boolean
  pai_notes?: string
  photo_url?: string | null
  created_at: string
  updated_at: string
}

export interface Parent {
  id: string
  etablissement_id: string
  user_id?: string
  // Tuteur 1 (obligatoire)
  tutor1_last_name: string
  tutor1_first_name: string
  tutor1_relationship?: TutorRelationship
  tutor1_phone?: string
  tutor1_email?: string
  tutor1_address?: string
  tutor1_city?: string
  tutor1_postal_code?: string
  tutor1_profession?: string
  // Tuteur 2 (optionnel)
  tutor2_last_name?: string
  tutor2_first_name?: string
  tutor2_relationship?: TutorRelationship
  tutor2_phone?: string
  tutor2_email?: string
  tutor2_address?: string
  tutor2_city?: string
  tutor2_postal_code?: string
  tutor2_profession?: string
  tutor1_adult_courses: boolean
  tutor2_adult_courses: boolean
  situation_familiale?: string
  type_garde?: string
  notes?: string
  created_at: string
  updated_at: string
}

export interface Teacher {
  id: string
  etablissement_id: string
  user_id?: string
  civilite?: string
  first_name: string
  last_name: string
  employee_number: string
  phone?: string
  email: string
  specialization?: string
  hire_date: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Class {
  id: string
  etablissement_id: string
  name: string
  level: string
  academic_year: string
  description?: string
  max_students: number
  room_number?: string
  room_id?: string | null
  schedule_notes?: string
  day_of_week?: string | null
  start_time?: string | null
  end_time?: string | null
  cotisation_type_id?: string | null
  created_at: string
  updated_at: string
}

export interface ClassTeacher {
  id: string
  class_id: string
  teacher_id: string
  is_main_teacher: boolean
  subject?: string
  created_at: string
}

export interface Enrollment {
  id: string
  student_id: string
  class_id: string
  enrollment_date: string
  status: EnrollmentStatus
  notes?: string
  created_at: string
  updated_at: string
}

export interface Subject {
  id: string
  etablissement_id: string
  name: string
  code: string
  description?: string
  order_index: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface TeachingUnit {
  id: string
  etablissement_id: string
  subject_id: string
  name: string
  code: string
  description?: string
  order_index: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Module {
  id: string
  etablissement_id: string
  teaching_unit_id: string
  name: string
  code: string
  description?: string
  order_index: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Evaluation {
  id: string
  etablissement_id: string
  class_id: string
  module_id?: string | null       // ancien système (nullable depuis migration)
  cours_id?: string | null        // nouveau référentiel
  period_id?: string | null       // période scolaire
  teacher_id?: string
  title: string
  description?: string
  evaluation_type?: EvaluationType
  eval_kind?: EvalTypeKind | null // nouveau : diagnostic | scored | stars
  max_score?: number | null
  coefficient: number
  evaluation_date?: string | null
  display_ue_id?: string | null     // override UE pour le panneau d'élaboration
  display_module_id?: string | null // override module pour le panneau d'élaboration
  created_at: string
  updated_at: string
}

export interface Grade {
  id: string
  student_id: string
  evaluation_id: string
  score?: number
  comment?: string
  is_absent: boolean
  graded_by?: string
  graded_at?: string
  created_at: string
  updated_at: string
}

export interface Absence {
  id: string
  etablissement_id: string
  student_id: string
  class_id: string
  period_id: string
  absence_date: string
  absence_type: AbsenceType
  comment?: string
  is_justified: boolean
  justification_date?: string
  justification_comment?: string
  justification_document_url?: string
  recorded_by?: string
  created_at: string
  updated_at: string
}

export interface Announcement {
  id: string
  etablissement_id: string
  title: string
  content: string
  announcement_type?: AnnouncementType
  target_class_id?: string
  priority: Priority
  published_by?: string
  is_published: boolean
  published_at?: string
  expires_at?: string
  created_at: string
  updated_at: string
}

export interface StudentWarning {
  id: string
  etablissement_id: string
  student_id: string
  class_id: string
  period_id: string
  warning_date: string
  severity: WarningSeverity
  motif: string
  issued_by?: string
  created_at: string
}

export interface StudentWarningAttachment {
  id: string
  warning_id: string
  file_url: string
  file_name: string
  created_at: string
}

export type DocumentCategory = 'identite' | 'medical' | 'assurance' | 'autres'

export interface DocumentTypeConfig {
  id: string
  etablissement_id: string
  category: DocumentCategory
  doc_key: string
  label: string
  is_required: boolean
  order_index: number
  created_at: string
}

export interface StudentDocument {
  id: string
  etablissement_id: string
  student_id: string
  doc_type_key: string
  category: DocumentCategory
  file_url: string
  file_name: string
  expires_at?: string
  uploaded_by?: string
  created_at: string
}

export interface AnnouncementRecipient {
  id: string
  announcement_id: string
  parent_id: string
  is_read: boolean
  read_at?: string
  created_at: string
}

export interface AnnouncementStaffRecipient {
  id: string
  announcement_id: string
  profile_id: string
  is_read: boolean
  read_at?: string
  created_at: string
}

export interface Payment {
  id: string
  etablissement_id: string
  student_id: string
  amount: number
  payment_type?: PaymentType
  payment_method?: PaymentMethod
  payment_status: PaymentStatus
  due_date?: string
  paid_date?: string
  academic_year: string
  description?: string
  receipt_number?: string
  created_by?: string
  created_at: string
  updated_at: string
}

export interface UniteEnseignement {
  id: string
  etablissement_id: string
  nom_fr: string
  nom_ar: string | null
  code: string | null
  order_index: number
  created_at: string
}

export interface CoursModule {
  id: string
  unite_enseignement_id: string
  nom_fr: string
  nom_ar: string | null
  code: string | null
  order_index: number
  created_at: string
}

export interface Cours {
  id: string
  unite_enseignement_id: string
  module_id: string | null
  nom_fr: string
  nom_ar: string | null
  code: string | null
  duree_minutes: number | null
  order_index: number
  created_at: string
}

export interface Schedule {
  id: string
  class_id: string
  teacher_id: string
  module_id: string
  day_of_week?: number
  start_time: string
  end_time: string
  room_number?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface CotisationType {
  id: string
  etablissement_id: string
  school_year_id: string
  label: string
  amount: number
  registration_fee: number
  sibling_discount: number
  sibling_discount_same_type: boolean  // true = réduction fratrie uniquement entre enfants du même type
  max_installments: number
  is_adult: boolean                    // true = cours adultes (parents/tuteurs)
  order_index: number
  created_at: string
}

export interface ParentClassEnrollment {
  id: string
  etablissement_id: string
  parent_id: string
  class_id: string
  tutor_number: 1 | 2
  enrollment_date: string
  status: 'active' | 'withdrawn'
  created_at: string
  updated_at: string
}

export type FeeStatus = 'pending' | 'partial' | 'paid' | 'overpaid'

export type AdjustmentType = 'reduction' | 'avoir' | 'remboursement'

export type FeePaymentMethod = 'cash' | 'check' | 'card' | 'transfer' | 'online'

export interface FamilyFee {
  id: string
  etablissement_id: string
  parent_id: string
  school_year_id: string
  subtotal: number
  adjustments_total: number
  total_due: number
  num_installments: number
  status: FeeStatus
  created_at: string
  updated_at: string
}

export interface FeeAdjustment {
  id: string
  etablissement_id: string
  family_fee_id: string
  adjustment_date: string
  adjustment_type: AdjustmentType
  label: string
  amount: number
  recorded_by?: string
  created_at: string
}

export interface PaymentReference {
  check_number?: string
  bank?: string
  transaction_id?: string
  reference?: string
  provider?: string
  payment_intent_id?: string
}

export interface FeeInstallment {
  id: string
  etablissement_id: string
  family_fee_id: string
  installment_number: number
  due_date: string
  amount_due: number
  amount_paid: number
  paid_date?: string
  payment_method?: FeePaymentMethod
  payment_reference?: PaymentReference
  receipt_number?: string
  status: FeeStatus
  notes?: string
  recorded_by?: string
  created_at: string
  updated_at: string
}

// ─── Cahier de texte ──────────────────────────────────────────────────────────

export type HomeworkType = 'exercice' | 'lecon' | 'expose' | 'autre'

export interface ClassJournal {
  id: string
  etablissement_id: string
  class_id: string
  teacher_id: string
  subject: string | null
  session_date: string
  title: string
  content_html: string
  created_at: string
  updated_at: string
}

export interface Homework {
  id: string
  etablissement_id: string
  class_id: string
  teacher_id: string
  subject: string
  journal_entry_id: string | null
  title: string
  description_html: string
  homework_type: HomeworkType
  due_date: string
  created_at: string
  updated_at: string
}

export interface HomeworkStatus {
  id: string
  homework_id: string
  student_id: string
  parent_id: string
  is_seen: boolean
  seen_at: string | null
  is_done: boolean
  done_at: string | null
  created_at: string
}

// ─── Salles & Ressources matérielles ─────────────────────────────────────────

export type RoomType = 'salle_cours' | 'salle_informatique' | 'bibliotheque' | 'salle_reunion' | 'salle_sport' | 'administration' | 'autre'

export type MaterialCategory = 'informatique' | 'audiovisuel' | 'mobilier' | 'sport' | 'fournitures' | 'autre'

export type MaterialCondition = 'neuf' | 'bon' | 'use' | 'hors_service'

export interface Room {
  id: string
  etablissement_id: string
  name: string
  room_type: RoomType
  capacity?: number
  floor?: string
  description?: string
  is_available: boolean
  created_at: string
  updated_at: string
}

// ─── Audit Logs ──────────────────────────────────────────────────────────────

export type AuditAction = 'INSERT' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT'

export interface AuditLog {
  id: string
  etablissement_id: string
  user_id: string | null
  user_email: string | null
  user_name: string | null
  entity_type: string
  entity_id: string | null
  action: AuditAction
  old_data: Record<string, unknown> | null
  new_data: Record<string, unknown> | null
  created_at: string
}

export interface Material {
  id: string
  etablissement_id: string
  name: string
  category: MaterialCategory
  quantity: number
  room_id?: string
  condition: MaterialCondition
  serial_number?: string
  purchase_date?: string
  notes?: string
  created_at: string
  updated_at: string
}
