import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SyntheseClient from '@/components/financements/SyntheseClient'
import { isFinanceRole } from '@/lib/financements/roles'
import { getFamilyFinancials } from '@/lib/financements/family-financials'
import { chargerCoutHeures } from '@/lib/financements/cout-heures'
import { AlertTriangle } from 'lucide-react'
import { effectiveRole } from '@/lib/auth/effective-role'

export default async function SynthesePage() {
  const supabase = await createClient()

  // Situation financiere = CA, cout des salaires, depenses → trio finance
  // uniquement. La RLS fait foi ; cette garde evite d'afficher une page vide.
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: me } = await supabase.from('profiles').select('role, etablissement_id').eq('id', user.id).single()
  if (!isFinanceRole(effectiveRole(me))) redirect('/dashboard')

  // Annee en cours
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

  // ── Cotisations ─────────────────────────────────────────────────────────
  // Calcul PARTAGE (`getFamilyFinancials`), le meme que Statistiques, le tableau
  // de bord et l'archive de cloture. Cette page en avait sa propre copie : elle
  // ignorait les familles sans inscription (depart en cours d'annee) et ne
  // bornait pas les cours adultes a l'annee.
  const fin = await getFamilyFinancials(supabase, currentYear)

  // ── Cout des heures : calcul partage avec le tableau de bord comptable ──
  const coutHeures = await chargerCoutHeures(supabase, currentYear)

  // ── Depenses ───────────────────────────────────────────────────────────
  const { data: expenses } = await supabase
    .from('expenses')
    .select('id, expense_date, label, amount, category, document_path, notes')
    .eq('school_year_id', currentYear.id)
    .order('expense_date', { ascending: false })

  const totalExpenses = (expenses ?? []).reduce((s, e) => s + Number(e.amount ?? 0), 0)

  // ── Revenus autres ─────────────────────────────────────────────────────
  const { data: revenues } = await supabase
    .from('other_revenues')
    .select('id, revenue_date, label, amount, source_type, notes')
    .eq('school_year_id', currentYear.id)
    .order('revenue_date', { ascending: false })

  const totalRevenues = (revenues ?? []).reduce((s, r) => s + Number(r.amount ?? 0), 0)

  return (
    <div className="h-full animate-fade-in">
      <SyntheseClient
        yearLabel={currentYear.label}
        schoolYearId={currentYear.id}
        cotisations={{
          totalDue: fin.kpi.billed,
          totalPaid: fin.kpi.collected,
          remaining: fin.kpi.outstanding,
          familyCount: fin.rows.length,
          collectRate: fin.kpi.rate,
        }}
        teachingCosts={coutHeures}
        initialExpenses={expenses ?? []}
        totalExpenses={totalExpenses}
        initialRevenues={revenues ?? []}
        totalRevenues={totalRevenues}
      />
    </div>
  )
}
