// Ce repository utilise le client serveur car il est appelé
// exclusivement depuis des Server Components (pages du dashboard).
import { createClient } from '@/lib/supabase/server'
import type { Teacher } from '@/types/database'

export const teacherRepository = {
  async getAll(): Promise<Teacher[]> {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('teachers')
      .select('id, employee_number, civilite, last_name, first_name, email, phone, hire_date, specialization, is_active, created_at, updated_at, user_id, etablissement_id')
      .eq('is_active', true)
      .order('last_name')

    if (error) throw error
    return data || []
  },

  async getById(id: string): Promise<Teacher | null> {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('teachers')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw error
    }
    return data
  },

  async getByEmployeeNumber(employeeNumber: string): Promise<Teacher | null> {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('teachers')
      .select('*')
      .eq('employee_number', employeeNumber)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw error
    }
    return data
  },

  async create(teacher: Omit<Teacher, 'id' | 'created_at' | 'updated_at'>): Promise<Teacher> {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('teachers')
      .insert(teacher)
      .select()
      .single()

    if (error) throw error
    return data
  },

  async update(id: string, updates: Partial<Omit<Teacher, 'id' | 'created_at' | 'updated_at'>>): Promise<Teacher> {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('teachers')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  },

  async deactivate(id: string): Promise<void> {
    const supabase = await createClient()
    const { error } = await supabase
      .from('teachers')
      .update({ is_active: false })
      .eq('id', id)

    if (error) throw error
  },

  async delete(id: string): Promise<void> {
    const supabase = await createClient()
    const { error } = await supabase
      .from('teachers')
      .delete()
      .eq('id', id)

    if (error) throw error
  },

  async checkDuplicate(firstName: string, lastName: string, excludeId?: string): Promise<boolean> {
    const supabase = await createClient()
    let query = supabase
      .from('teachers')
      .select('id')
      .ilike('first_name', firstName)
      .ilike('last_name', lastName)

    if (excludeId) {
      query = query.neq('id', excludeId)
    }

    const { data, error } = await query
    if (error) throw error
    return (data?.length ?? 0) > 0
  },

  async search(query: string): Promise<Teacher[]> {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('teachers')
      .select('id, employee_number, civilite, last_name, first_name, email, phone, hire_date, specialization, is_active, created_at, updated_at, user_id, etablissement_id')
      .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,employee_number.ilike.%${query}%`)
      .eq('is_active', true)
      .order('last_name')

    if (error) throw error
    return data || []
  },
}
