import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import VueGlobaleClient from '@/components/financements/VueGlobaleClient'
import { getFamilyFinancials } from '@/lib/financements/family-financials'
import { isFinanceRole } from '@/lib/financements/roles'
import { AlertTriangle } from 'lucide-react'

export default async function VueGlobalePage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!isFinanceRole(me?.role)) redirect('/dashboard')

  const { data: currentYear } = await supabase
    .from('school_years')
    .select('id, label, start_date, end_date')
    .eq('is_current', true)
    .single()

  if (!currentYear) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center animate-fade-in">
        <AlertTriangle size={36} className="text-warm-700" />
        <p className="text-sm text-warm-700">Aucune annee scolaire en cours.</p>
      </div>
    )
  }

  // Financier partage (meme calcul que le TABLEAU DE BORD → aucune divergence possible).
  const { rows, monthly, byMethod, byCotisation } = await getFamilyFinancials(supabase, currentYear)

  return (
    <div className="h-full animate-fade-in">
      <VueGlobaleClient
        rows={rows}
        yearLabel={currentYear.label}
        monthly={monthly}
        byMethod={byMethod}
        byCotisation={byCotisation}
      />
    </div>
  )
}
