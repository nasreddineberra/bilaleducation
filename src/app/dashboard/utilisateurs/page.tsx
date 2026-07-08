import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import UtilisateursClient from '@/components/utilisateurs/UtilisateursClient'
import type { Profile } from '@/types/database'

export default async function UtilisateursPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Garde : espace utilisateurs réservé admin/direction
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!me || (me.role !== 'admin' && me.role !== 'direction')) redirect('/dashboard/mon-compte')

  const [{ data: profiles }, { data: currentProfile }, { data: totpRows }] = await Promise.all([
    supabase.from('profiles').select('*').order('last_name', { ascending: true }),
    supabase.from('profiles').select('role').eq('id', user.id).single(),
    supabase.rpc('get_verified_totp_user_ids'),
  ])

  const isCurrentUserAdmin = currentProfile?.role === 'admin'

  // L'admin est visible uniquement par lui-même
  const visibleProfiles = isCurrentUserAdmin
    ? (profiles ?? [])
    : (profiles ?? []).filter(p => p.role !== 'admin')

  const twoFactorUserIds = ((totpRows ?? []) as { user_id: string }[]).map(r => r.user_id)

  return <UtilisateursClient profiles={visibleProfiles as Profile[]} twoFactorUserIds={twoFactorUserIds} />
}
