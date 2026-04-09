/**
 * Schémas de validation Zod pour les server actions.
 * Utilisés côté serveur pour valider les inputs avant traitement.
 */

import { z } from 'zod'

// ─── Utilisateurs / Profils ────────────────────────────────────────────────

export const CreateUserSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(8, 'Mot de passe trop court (min 8 caractères)'),
  role: z.enum(['admin', 'direction', 'comptable', 'responsable_pedagogique', 'enseignant', 'secretaire', 'parent']),
  civilite: z.string().optional(),
  first_name: z.string().min(2, 'Prénom trop court'),
  last_name: z.string().min(2, 'Nom trop court'),
  phone: z.string().optional().nullable(),
})

export const UpdateProfileSchema = z.object({
  role: z.enum(['admin', 'direction', 'comptable', 'responsable_pedagogique', 'enseignant', 'secretaire', 'parent']),
  civilite: z.string().optional(),
  first_name: z.string().min(2, 'Prénom trop court'),
  last_name: z.string().min(2, 'Nom trop court'),
  phone: z.string().optional().nullable(),
})

// ─── Enseignants ────────────────────────────────────────────────────────────

export const CreateTeacherSchema = z.object({
  employee_number: z.string().min(1, 'Numéro employé requis'),
  civilite: z.string().nullable(),
  last_name: z.string().min(2, 'Nom trop court'),
  first_name: z.string().min(2, 'Prénom trop court'),
  email: z.string().email('Email invalide'),
  phone: z.string().nullable(),
  hire_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide'),
  specialization: z.string().nullable(),
  is_active: z.boolean(),
})

export const UpdateTeacherSchema = CreateTeacherSchema

// ─── Parents ────────────────────────────────────────────────────────────────

export const CreateParentSchema = z.object({
  // Tuteur 1
  tutor1_first_name: z.string().min(2, 'Prénom tuteur 1 trop court').optional(),
  tutor1_last_name: z.string().min(2, 'Nom tuteur 1 trop court').optional(),
  tutor1_email: z.string().email().optional(),
  tutor1_phone: z.string().nullable().optional(),
  tutor1_relationship: z.string().nullable().optional(),
  tutor1_address: z.string().nullable().optional(),
  tutor1_city: z.string().nullable().optional(),
  tutor1_postal_code: z.string().nullable().optional(),
  tutor1_profession: z.string().nullable().optional(),
  tutor1_adult_courses: z.boolean().optional(),
  // Tuteur 2
  tutor2_first_name: z.string().nullable().optional(),
  tutor2_last_name: z.string().nullable().optional(),
  tutor2_email: z.string().email().nullable().optional(),
  tutor2_phone: z.string().nullable().optional(),
  tutor2_relationship: z.string().nullable().optional(),
  tutor2_address: z.string().nullable().optional(),
  tutor2_city: z.string().nullable().optional(),
  tutor2_postal_code: z.string().nullable().optional(),
  tutor2_profession: z.string().nullable().optional(),
  tutor2_adult_courses: z.boolean().optional(),
  // Famille
  situation_familiale: z.string().nullable().optional(),
  type_garde: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  student_ids: z.array(z.string().uuid()).optional(),
})

export const UpdateParentSchema = CreateParentSchema.omit({ student_ids: true })

// ─── Élèves ─────────────────────────────────────────────────────────────────

export const CreateStudentSchema = z.object({
  student_number: z.string().min(1, 'Numéro élève requis'),
  last_name: z.string().min(2, 'Nom trop court'),
  first_name: z.string().min(2, 'Prénom trop court'),
  date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide'),
  gender: z.string().min(1, 'Genre requis'),
  enrollment_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide'),
  parent_id: z.string().uuid().nullable(),
  is_active: z.boolean(),
  medical_notes: z.string().nullable(),
  exit_authorization: z.boolean(),
  media_authorization: z.boolean(),
  has_pai: z.boolean(),
  pai_notes: z.string().nullable(),
  photo_url: z.string().nullable(),
})

export const UpdateStudentSchema = CreateStudentSchema.partial()

// ─── Helper de validation ──────────────────────────────────────────────────

/**
 * Valide les données contre un schéma Zod.
 * Retourne `{ error: string }` si invalide, `{ data: T }` si valide.
 */
export function validateInput<T extends z.ZodType>(
  schema: T,
  data: unknown
): { error: string } | { data: z.infer<T> } {
  const result = schema.safeParse(data)
  if (!result.success) {
    // Premier message d'erreur
    const firstError = result.error.errors[0]
    return { error: `${firstError.path.join('.')}: ${firstError.message}` }
  }
  return { data: result.data }
}
