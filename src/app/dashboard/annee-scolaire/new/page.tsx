import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import SchoolYearForm from '@/components/annee-scolaire/SchoolYearForm'

export default async function NewAnneeScolairePage() {
  const supabase = await createClient()
  const { data: etablissement } = await supabase
    .from('etablissements')
    .select('id, week_start_day')
    .single()

  // Impossible de creer une annee « en cours » si une autre l'est deja.
  const { count } = await supabase
    .from('school_years')
    .select('id', { count: 'exact', head: true })
    .eq('is_current', true)
  const anotherYearIsCurrent = (count ?? 0) > 0

  return (
    <div className="space-y-6 animate-fade-in">

      <Link
        href="/dashboard/annee-scolaire"
        className="inline-flex items-center gap-1.5 text-sm text-warm-700 hover:text-secondary-700 transition-colors"
      >
        <ChevronLeft size={15} />
        Retour à la liste
      </Link>

      <SchoolYearForm etablissementId={etablissement?.id ?? ''} weekStartDay={etablissement?.week_start_day ?? 1} anotherYearIsCurrent={anotherYearIsCurrent} />

    </div>
  )
}
