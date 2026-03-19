import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import ClassForm from '@/components/classes/ClassForm'

export default async function NewClassPage() {
  const supabase = await createClient()

  const [{ data: schoolYears }, { data: teachers }, { data: ues }, { data: currentYearRow }, { data: rooms }] = await Promise.all([
    supabase
      .from('school_years')
      .select('*')
      .order('label', { ascending: false }),
    supabase
      .from('teachers')
      .select('id, first_name, last_name, employee_number, is_active')
      .eq('is_active', true)
      .order('last_name')
      .order('first_name'),
    supabase
      .from('unites_enseignement')
      .select('id, nom_fr, nom_ar, code')
      .order('order_index', { ascending: true })
      .order('nom_fr'),
    supabase
      .from('school_years')
      .select('id')
      .eq('is_current', true)
      .single(),
    supabase
      .from('rooms')
      .select('id, name, capacity')
      .eq('is_available', true)
      .in('room_type', ['salle_cours', 'salle_informatique', 'salle_sport', 'autre'])
      .order('name'),
  ])

  const { data: cotisationTypes } = currentYearRow
    ? await supabase
        .from('cotisation_types')
        .select('*')
        .eq('school_year_id', currentYearRow.id)
        .order('order_index')
    : { data: [] }

  return (
    <div className="space-y-6 animate-fade-in">

      <Link
        href="/dashboard/classes"
        className="inline-flex items-center gap-1.5 text-sm text-warm-500 hover:text-secondary-700 transition-colors"
      >
        <ChevronLeft size={15} />
        Retour à la liste
      </Link>

      <ClassForm
        schoolYears={schoolYears ?? []}
        teachers={teachers ?? []}
        ues={ues ?? []}
        cotisationTypes={(cotisationTypes ?? []) as any[]}
        rooms={(rooms ?? []) as any[]}
      />

    </div>
  )
}
