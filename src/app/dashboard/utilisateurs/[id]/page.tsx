import { notFound, redirect } from 'next/navigation'
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

  // Garde : réservé admin/direction ; l'édition de son propre compte passe par Mon compte
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  if (user.id === id) redirect('/dashboard/mon-compte')

  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!me || (me.role !== 'admin' && me.role !== 'direction')) redirect('/dashboard/mon-compte')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (!profile) notFound()

  // Statut 2FA du compte visé (hors parent : 2FA non requise)
  let has2fa = false
  if (profile.role !== 'parent') {
    const { data: totpRows } = await supabase.rpc('get_verified_totp_user_ids')
    has2fa = ((totpRows ?? []) as { user_id: string }[]).some(r => r.user_id === id)
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <Link
        href="/dashboard/utilisateurs"
        className="inline-flex items-center gap-1.5 text-sm text-warm-700 hover:text-secondary-700 transition-colors"
      >
        <ChevronLeft size={15} />
        Retour à la liste
      </Link>
      <UtilisateurForm profile={profile as Profile} has2fa={has2fa} />
    </div>
  )
}
