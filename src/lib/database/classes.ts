import { createClient } from '@/lib/supabase/server'
import type { Class, Student, Teacher } from '@/types/database'

export const classRepository = {
  async getAll(): Promise<Class[]> {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('classes')
      .select('id, etablissement_id, name, level, academic_year, description, max_students, room_number, schedule_notes, is_active, created_at, updated_at, day_of_week, start_time, end_time, cotisation_type_id, room_id, teaching_mode')
      .order('name')

    if (error) throw error
    return data || []
  },

  async getById(id: string): Promise<Class | null> {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('classes')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw error
    }
    return data
  },

  async create(cls: Omit<Class, 'id' | 'created_at' | 'updated_at'>): Promise<Class> {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('classes')
      .insert(cls)
      .select()
      .single()

    if (error) throw error
    return data
  },

  async update(id: string, updates: Partial<Omit<Class, 'id' | 'created_at' | 'updated_at'>>): Promise<Class> {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('classes')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  },

  async delete(id: string): Promise<void> {
    const supabase = await createClient()
    const { error } = await supabase
      .from('classes')
      .delete()
      .eq('id', id)

    if (error) throw error
  },

  async getStudentsInClass(classId: string): Promise<Student[]> {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('students')
      .select(`
        *,
        enrollments!inner(class_id, status)
      `)
      .eq('enrollments.class_id', classId)
      .eq('enrollments.status', 'active')
      .eq('is_active', true)
      .order('last_name')

    if (error) throw error
    return data || []
  },

  async getTeachersInClass(classId: string): Promise<Teacher[]> {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('teachers')
      .select(`
        *,
        class_teachers!inner(class_id, is_main_teacher, subject)
      `)
      .eq('class_teachers.class_id', classId)
      .eq('is_active', true)
      .order('last_name')

    if (error) throw error
    return data || []
  },
}
