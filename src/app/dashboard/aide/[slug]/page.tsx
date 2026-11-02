import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { effectiveRole } from '@/lib/auth/effective-role'
import { procedureParSlug } from '@/lib/aide'
import ContenuProcedure from '@/components/aide/ContenuProcedure'

interface Props {
  params: Promise<{ slug: string }>
}

// Une procedure en pleine page : depuis le menu Aide, ou ouverte dans un onglet
// depuis le tiroir d'un ecran (pour la suivre en manipulant). Une procedure
// qu'aucun droit du role ne concerne n'existe pas pour lui.
export default async function ProcedurePage({ params }: Props) {
  const { slug } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: me } = await supabase.from('profiles').select('role, etablissement_id').eq('id', user.id).single()

  const procedure = procedureParSlug(slug, effectiveRole(me))
  if (!procedure) notFound()

  return (
    <div className="h-full overflow-y-auto list-scroll animate-fade-in">
      <div className="max-w-3xl space-y-4 pb-6">
        <Link href="/dashboard/aide" className="inline-flex items-center gap-1 text-xs font-medium text-warm-700 hover:text-secondary-800">
          <ChevronLeft size={14} aria-hidden="true" />
          Toutes les procédures
        </Link>
        <div className="card">
          <h2 className="text-lg font-bold text-secondary-800 mb-3">{procedure.titre}</h2>
          <ContenuProcedure procedure={procedure} />
        </div>
      </div>
    </div>
  )
}
