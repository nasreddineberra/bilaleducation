import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import ParentDetail from '@/components/parents/ParentDetail'

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditParentPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const { data: parent } = await supabase
    .from('parents')
    .select('*')
    .eq('id', id)
    .single()

  if (!parent) notFound()

  // Tuteurs inscrits a une classe adulte → la case « Inscrit aux cours adultes »
  // est grisee (on ne peut pas la decocher tant qu'inscrit).
  const { data: adultEnr } = await supabase
    .from('parent_class_enrollments')
    .select('tutor_number, classes!inner(cotisation_types:cotisation_type_id(is_adult))')
    .eq('parent_id', id).eq('status', 'active')
  const enrolledTutors = new Set(
    (adultEnr ?? []).filter((r: any) => r.classes?.cotisation_types?.is_adult).map((r: any) => r.tutor_number)
  )

  // Historique « scolarité adulte » (snapshots de clôture), plus récent en premier.
  const { data: adultHistory } = await supabase
    .from('student_year_history')
    .select('*')
    .eq('parent_id', id)
    .eq('participant_type', 'adult')
    .order('year_label', { ascending: false })

  return (
    <div className="space-y-6 animate-fade-in">

      <Link
        href="/dashboard/parents"
        className="inline-flex items-center gap-1.5 text-sm text-warm-700 hover:text-secondary-700 transition-colors"
      >
        <ChevronLeft size={15} />
        Retour à la liste
      </Link>

      <ParentDetail
        parent={parent}
        tutor1AdultEnrolled={enrolledTutors.has(1)}
        tutor2AdultEnrolled={enrolledTutors.has(2)}
        adultHistory={(adultHistory ?? []) as any[]}
      />

    </div>
  )
}
