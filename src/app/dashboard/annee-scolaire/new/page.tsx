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

  return (
    <div className="space-y-6 animate-fade-in">

      <Link
        href="/dashboard/annee-scolaire"
        className="inline-flex items-center gap-1.5 text-sm text-warm-500 hover:text-secondary-700 transition-colors"
      >
        <ChevronLeft size={15} />
        Retour à la liste
      </Link>

      <SchoolYearForm etablissementId={etablissement?.id ?? ''} weekStartDay={etablissement?.week_start_day ?? 1} />

    </div>
  )
}
