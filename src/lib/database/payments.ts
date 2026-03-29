import { createClient } from '@/lib/supabase/server'
import type { FamilyFee, FeeInstallment, FeeAdjustment } from '@/types/database'

export const paymentRepository = {
  // ── FamilyFees ─────────────────────────────────────────────────────────────

  async getFamilyFeesByYear(schoolYearId: string): Promise<FamilyFee[]> {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('family_fees')
      .select(`
        *,
        fee_adjustments (*),
        fee_installments (*)
      `)
      .eq('school_year_id', schoolYearId)
      .order('created_at')

    if (error) throw error
    return data || []
  },

  async getFamilyFeeByParent(parentId: string, schoolYearId: string): Promise<FamilyFee | null> {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('family_fees')
      .select(`
        *,
        fee_adjustments (*),
        fee_installments (*)
      `)
      .eq('parent_id', parentId)
      .eq('school_year_id', schoolYearId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw error
    }
    return data
  },

  async getFamilyFeeById(id: string): Promise<FamilyFee | null> {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('family_fees')
      .select(`
        *,
        fee_adjustments (*),
        fee_installments (*)
      `)
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw error
    }
    return data
  },

  async createFamilyFee(fee: Omit<FamilyFee, 'id' | 'created_at' | 'updated_at'>): Promise<FamilyFee> {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('family_fees')
      .insert(fee)
      .select()
      .single()

    if (error) throw error
    return data
  },

  async updateFamilyFee(id: string, updates: Partial<Omit<FamilyFee, 'id' | 'created_at' | 'updated_at'>>): Promise<FamilyFee> {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('family_fees')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  },

  async deleteFamilyFee(id: string): Promise<void> {
    const supabase = await createClient()
    const { error } = await supabase
      .from('family_fees')
      .delete()
      .eq('id', id)

    if (error) throw error
  },

  // ── FeeInstallments ────────────────────────────────────────────────────────

  async getInstallmentsByFee(familyFeeId: string): Promise<FeeInstallment[]> {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('fee_installments')
      .select('*')
      .eq('family_fee_id', familyFeeId)
      .order('installment_number')

    if (error) throw error
    return data || []
  },

  async createInstallment(installment: Omit<FeeInstallment, 'id' | 'created_at' | 'updated_at'>): Promise<FeeInstallment> {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('fee_installments')
      .insert(installment)
      .select()
      .single()

    if (error) throw error
    return data
  },

  async updateInstallment(id: string, updates: Partial<Omit<FeeInstallment, 'id' | 'created_at' | 'updated_at'>>): Promise<FeeInstallment> {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('fee_installments')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  },

  async deleteInstallment(id: string): Promise<void> {
    const supabase = await createClient()
    const { error } = await supabase
      .from('fee_installments')
      .delete()
      .eq('id', id)

    if (error) throw error
  },

  // ── FeeAdjustments ─────────────────────────────────────────────────────────

  async getAdjustmentsByFee(familyFeeId: string): Promise<FeeAdjustment[]> {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('fee_adjustments')
      .select('*')
      .eq('family_fee_id', familyFeeId)
      .order('adjustment_date')

    if (error) throw error
    return data || []
  },

  async createAdjustment(adjustment: Omit<FeeAdjustment, 'id' | 'created_at'>): Promise<FeeAdjustment> {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('fee_adjustments')
      .insert(adjustment)
      .select()
      .single()

    if (error) throw error
    return data
  },

  async deleteAdjustment(id: string): Promise<void> {
    const supabase = await createClient()
    const { error } = await supabase
      .from('fee_adjustments')
      .delete()
      .eq('id', id)

    if (error) throw error
  },
}
