import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import UtilisateurForm from '@/components/utilisateurs/UtilisateurForm'
import type { Profile } from '@/types/database'

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditUtilisateurPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (!profile) notFound()

  return (
    <div className="space-y-6 animate-fade-in">
      <Link
        href="/dashboard/utilisateurs"
        className="inline-flex items-center gap-1.5 text-sm text-warm-500 hover:text-secondary-700 transition-colors"
      >
        <ChevronLeft size={15} />
        Retour à la liste
      </Link>
      <UtilisateurForm profile={profile as Profile} />
    </div>
  )
}
