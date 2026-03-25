import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import SchoolYearForm from '@/components/annee-scolaire/SchoolYearForm'

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditAnneeScolairePage({ params }: Props) {
  const { id }   = await params
  const supabase = await createClient()

  const [{ data: schoolYear }, { data: etablissement }] = await Promise.all([
    supabase
      .from('school_years')
      .select(`
        *,
        periods ( * ),
        eval_type_configs ( * )
      `)
      .eq('id', id)
      .single(),
    supabase
      .from('etablissements')
      .select('week_start_day')
      .single(),
  ])

  if (!schoolYear) notFound()

  return (
    <div className="space-y-6 animate-fade-in">

      <Link
        href="/dashboard/annee-scolaire"
        className="inline-flex items-center gap-1.5 text-sm text-warm-500 hover:text-secondary-700 transition-colors"
      >
        <ChevronLeft size={15} />
        Retour à la liste
      </Link>

      <SchoolYearForm schoolYear={schoolYear} weekStartDay={etablissement?.week_start_day ?? 1} />

    </div>
  )
}
