import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import UtilisateurForm from '@/components/utilisateurs/UtilisateurForm'

export default async function NewUtilisateurPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!me || (me.role !== 'admin' && me.role !== 'direction')) redirect('/dashboard/mon-compte')

  return (
    <div className="space-y-6 animate-fade-in">
      <Link
        href="/dashboard/utilisateurs"
        className="inline-flex items-center gap-1.5 text-sm text-warm-500 hover:text-secondary-700 transition-colors"
      >
        <ChevronLeft size={15} />
        Retour à la liste
      </Link>
      <UtilisateurForm />
    </div>
  )
}
