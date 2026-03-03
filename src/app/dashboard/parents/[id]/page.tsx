import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import ParentForm from '@/components/parents/ParentForm'

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

  return (
    <div className="space-y-6 animate-fade-in">

      <Link
        href="/dashboard/parents"
        className="inline-flex items-center gap-1.5 text-sm text-warm-500 hover:text-secondary-700 transition-colors"
      >
        <ChevronLeft size={15} />
        Retour à la liste
      </Link>

      <ParentForm parent={parent} />

    </div>
  )
}
