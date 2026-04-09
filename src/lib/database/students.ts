// Ce repository utilise le client navigateur car il est appelé
// exclusivement depuis des Client Components (ParentsTable, etc.).
import { createClient } from '@/lib/supabase/client'
import type { Student } from '@/types/database'

/**
 * Repository Pattern pour les élèves
 * Cette couche d'abstraction facilite la migration future vers une autre BDD
 */

export const studentRepository = {
  /**
   * Récupérer tous les élèves actifs
   */
  async getAll(): Promise<Student[]> {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('students')
      .select('id, student_number, last_name, first_name, date_of_birth, gender, photo_url, parent_id, is_active, enrollment_date, address, city, postal_code, emergency_contact_name, emergency_contact_phone, medical_notes, exit_authorization, media_authorization, has_pai, pai_notes, created_at, updated_at, etablissement_id')
      .eq('is_active', true)
      .order('last_name')

    if (error) throw error
    return data || []
  },

  /**
   * Récupérer un élève par ID
   */
  async getById(id: string): Promise<Student | null> {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('students')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null // Not found
      throw error
    }
    return data
  },

  /**
   * Récupérer un élève par numéro d'étudiant
   */
  async getByStudentNumber(studentNumber: string): Promise<Student | null> {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('students')
      .select('*')
      .eq('student_number', studentNumber)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw error
    }
    return data
  },

  /**
   * Créer un nouvel élève
   */
  async create(student: Omit<Student, 'id' | 'created_at' | 'updated_at'>): Promise<Student> {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('students')
      .insert(student)
      .select()
      .single()

    if (error) throw error
    return data
  },

  /**
   * Mettre à jour un élève
   */
  async update(id: string, updates: Partial<Student>): Promise<Student> {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('students')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  },

  /**
   * Désactiver un élève (soft delete)
   */
  async deactivate(id: string): Promise<void> {
    const supabase = createClient()
    const { error } = await supabase
      .from('students')
      .update({ is_active: false })
      .eq('id', id)

    if (error) throw error
  },

  /**
   * Supprimer définitivement un élève (hard delete)
   */
  async delete(id: string): Promise<void> {
    const supabase = createClient()
    const { error } = await supabase
      .from('students')
      .delete()
      .eq('id', id)

    if (error) throw error
  },

  /**
   * Rechercher des élèves par nom
   */
  async search(query: string): Promise<Student[]> {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('students')
      .select('id, student_number, last_name, first_name, date_of_birth, gender, photo_url, parent_id, is_active, enrollment_date, address, city, postal_code, emergency_contact_name, emergency_contact_phone, medical_notes, exit_authorization, media_authorization, has_pai, pai_notes, created_at, updated_at, etablissement_id')
      .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,student_number.ilike.%${query}%`)
      .eq('is_active', true)
      .order('last_name')

    if (error) throw error
    return data || []
  },

  /**
   * Récupérer les élèves d'une classe
   */
  async getByClass(classId: string): Promise<Student[]> {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('students')
      .select(`
        *,
        enrollments!inner(class_id)
      `)
      .eq('enrollments.class_id', classId)
      .eq('enrollments.status', 'active')
      .eq('is_active', true)
      .order('last_name')

    if (error) throw error
    return data || []
  },

  /**
   * Récupérer les enfants d'une fiche parents (fratrie incluse)
   */
  async getByParent(parentId: string, activeOnly = false): Promise<Student[]> {
    const supabase = createClient()
    const query = supabase
      .from('students')
      .select('id, student_number, last_name, first_name, date_of_birth, gender, photo_url, parent_id, is_active, enrollment_date, has_pai, exit_authorization, media_authorization')
      .eq('parent_id', parentId)
      .order('last_name')

    if (activeOnly) query.eq('is_active', true)

    const { data, error } = await query
    if (error) throw error
    return data || []
  },
}
