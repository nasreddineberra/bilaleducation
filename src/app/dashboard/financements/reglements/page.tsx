import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ReglementsShell from '@/components/financements/ReglementsShell'
import { isFinanceRole } from '@/lib/financements/roles'
import { AlertTriangle } from 'lucide-react'
import { effectiveRole } from '@/lib/auth/effective-role'
import { chargerReglements } from '@/lib/financements/reglements'

export default async function FinancementsPage({ searchParams }: { searchParams: Promise<{ parent?: string }> }) {
  const { parent: initialParentId } = await searchParams
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: me } = await supabase.from('profiles').select('role, etablissement_id').eq('id', user.id).single()
  if (!isFinanceRole(effectiveRole(me))) redirect('/dashboard')

  // Année en cours
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

  // Lectures : `lib/financements/reglements.ts` (les ecrans en tirent leurs types).
  const donnees = await chargerReglements(supabase, currentYear)

  return (
    <div className="h-full animate-fade-in">
      <ReglementsShell
        currentYear={currentYear}
        {...donnees}
        initialParentId={initialParentId}
        canDeleteComms={isFinanceRole(effectiveRole(me))}
      />
    </div>
  )
}
