import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import StudentForm from '@/components/students/StudentForm'

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ from?: string }>
}

const PARENTS_SELECT = [
  'id',
  'tutor1_last_name', 'tutor1_first_name', 'tutor1_relationship',
  'tutor1_address', 'tutor1_city', 'tutor1_postal_code', 'tutor1_phone', 'tutor1_email',
  'tutor2_last_name', 'tutor2_first_name', 'tutor2_relationship',
  'tutor2_address', 'tutor2_city', 'tutor2_postal_code', 'tutor2_phone', 'tutor2_email',
].join(', ')

export default async function EditStudentPage({ params, searchParams }: Props) {
  const { id } = await params
  const { from } = await searchParams
  const backHref  = from === 'parents' ? '/dashboard/parents' : '/dashboard/students'
  const backLabel = from === 'parents' ? 'Retour aux parents' : 'Retour à la liste'
  const supabase = await createClient()

  const [{ data: student }, { data: parents }] = await Promise.all([
    supabase.from('students').select('*').eq('id', id).single(),
    supabase
      .from('parents')
      .select(PARENTS_SELECT)
      .order('tutor1_last_name')
      .order('tutor1_first_name'),
  ])

  if (!student) notFound()

  return (
    <div className="space-y-6 animate-fade-in">

      <Link
        href={backHref}
        className="inline-flex items-center gap-1.5 text-sm text-warm-500 hover:text-secondary-700 transition-colors"
      >
        <ChevronLeft size={15} />
        {backLabel}
      </Link>

      <StudentForm student={student} parents={parents ?? []} backHref={backHref} etablissementId={student.etablissement_id} />

    </div>
  )
}
