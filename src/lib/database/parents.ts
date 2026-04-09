// Ce repository utilise le client navigateur car il est appelé
// exclusivement depuis des Client Components.
import { createClient } from '@/lib/supabase/client'
import type { Parent } from '@/types/database'

export const parentRepository = {
  async getAll(): Promise<Parent[]> {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('parents')
      .select('id, etablissement_id, tutor1_last_name, tutor1_first_name, tutor1_relationship, tutor1_phone, tutor1_email, tutor1_address, tutor1_city, tutor1_postal_code, tutor1_profession, tutor1_adult_courses, tutor2_last_name, tutor2_first_name, tutor2_relationship, tutor2_phone, tutor2_email, tutor2_address, tutor2_city, tutor2_postal_code, tutor2_profession, tutor2_adult_courses, situation_familiale, type_garde, notes, tutor1_user_id, tutor2_user_id, created_at, updated_at')
      .order('tutor1_last_name')
      .order('tutor1_first_name')
      .order('tutor2_last_name',  { nullsFirst: false })
      .order('tutor2_first_name', { nullsFirst: false })

    if (error) throw error
    return data || []
  },

  async getById(id: string): Promise<Parent | null> {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('parents')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw error
    }
    return data
  },

  async create(parent: Omit<Parent, 'id' | 'created_at' | 'updated_at'>): Promise<Parent> {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('parents')
      .insert(parent)
      .select()
      .single()

    if (error) throw error
    return data
  },

  async update(id: string, updates: Partial<Omit<Parent, 'id' | 'created_at' | 'updated_at'>>): Promise<Parent> {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('parents')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  },

  async delete(id: string): Promise<void> {
    const supabase = createClient()
    const { error } = await supabase
      .from('parents')
      .delete()
      .eq('id', id)

    if (error) throw error
  },

  async search(query: string): Promise<Parent[]> {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('parents')
      .select('id, etablissement_id, tutor1_last_name, tutor1_first_name, tutor1_relationship, tutor1_phone, tutor1_email, tutor1_address, tutor1_city, tutor1_postal_code, tutor1_profession, tutor1_adult_courses, tutor2_last_name, tutor2_first_name, tutor2_relationship, tutor2_phone, tutor2_email, tutor2_address, tutor2_city, tutor2_postal_code, tutor2_profession, tutor2_adult_courses, situation_familiale, type_garde, notes, tutor1_user_id, tutor2_user_id, created_at, updated_at')
      .or(
        `tutor1_last_name.ilike.%${query}%,` +
        `tutor1_first_name.ilike.%${query}%,` +
        `tutor2_last_name.ilike.%${query}%,` +
        `tutor2_first_name.ilike.%${query}%`
      )
      .order('tutor1_last_name')
      .order('tutor1_first_name')
      .order('tutor2_last_name',  { nullsFirst: false })
      .order('tutor2_first_name', { nullsFirst: false })

    if (error) throw error
    return data || []
  },
}
