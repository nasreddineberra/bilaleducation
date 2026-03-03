import { createClient } from '@/lib/supabase/server'
import UtilisateursClient from '@/components/utilisateurs/UtilisateursClient'
import type { Profile } from '@/types/database'

export default async function UtilisateursPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: profiles }, { data: currentProfile }] = await Promise.all([
    supabase.from('profiles').select('*').order('last_name', { ascending: true }),
    supabase.from('profiles').select('role').eq('id', user!.id).single(),
  ])

  const isCurrentUserAdmin = currentProfile?.role === 'admin'

  // L'admin est visible uniquement par lui-même
  const visibleProfiles = isCurrentUserAdmin
    ? (profiles ?? [])
    : (profiles ?? []).filter(p => p.role !== 'admin')

  return <UtilisateursClient profiles={visibleProfiles as Profile[]} />
}
