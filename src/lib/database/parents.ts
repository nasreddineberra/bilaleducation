import { createClient } from '@/lib/supabase/client'
import type { Parent } from '@/types/database'

export const parentRepository = {
  async getAll(): Promise<Parent[]> {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('parents')
      .select('*')
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
      .select('*')
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
