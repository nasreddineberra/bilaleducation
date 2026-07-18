import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import TeacherDetail from '@/components/teachers/TeacherDetail'
import type { TeacherDocument } from '@/types/database'

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditTeacherPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const { data: teacher } = await supabase
    .from('teachers')
    .select('*')
    .eq('id', id)
    .single()

  if (!teacher) notFound()

  // Documents lies (peut etre vide / null si la migration n'est pas encore passee)
  const { data: documents } = await supabase
    .from('teacher_documents')
    .select('id, etablissement_id, teacher_id, category, label, file_url, file_name, expires_at, created_at')
    .eq('teacher_id', id)
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6 animate-fade-in">

      <Link
        href="/dashboard/teachers"
        className="inline-flex items-center gap-1.5 text-sm text-warm-700 hover:text-secondary-700 transition-colors"
      >
        <ChevronLeft size={15} />
        Retour à la liste
      </Link>

      <TeacherDetail teacher={teacher} documents={(documents ?? []) as TeacherDocument[]} />

    </div>
  )
}
