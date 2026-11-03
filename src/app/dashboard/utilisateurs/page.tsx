import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import UtilisateursClient from '@/components/utilisateurs/UtilisateursClient'
import type { Profile } from '@/types/database'
import { effectiveRole } from '@/lib/auth/effective-role'

export default async function UtilisateursPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Garde : espace utilisateurs réservé admin/direction
  const { data: me } = await supabase.from('profiles').select('role, etablissement_id').eq('id', user.id).single()
  if (!['admin', 'direction'].includes(effectiveRole(me) ?? '')) redirect('/dashboard/mon-compte')

  const [{ data: profiles }, { data: currentProfile }, { data: totpRows }, { data: etab }] = await Promise.all([
    supabase.from('profiles').select('*').order('last_name', { ascending: true }),
    supabase.from('profiles').select('role, etablissement_id').eq('id', user.id).single(),
    supabase.rpc('get_verified_totp_user_ids'),
    supabase.from('etablissements').select('option_espace_famille').maybeSingle(),
  ])

  // Onglet Parents : seulement si l'option espace famille de l'ecole est active
  // (docs/ESPACE-FAMILLE.md, decision 15). Statut et derniere connexion par la
  // base (`comptes_parents_ecole`, reservee a l'admin et a la direction).
  const espaceFamille = etab?.option_espace_famille === true
  const { data: comptesParents } = espaceFamille
    ? await supabase.rpc('comptes_parents_ecole')
    : { data: [] }

  const isCurrentUserAdmin = effectiveRole(currentProfile) === 'admin'

  // L'admin est visible uniquement par lui-même
  const visibleProfiles = isCurrentUserAdmin
    ? (profiles ?? [])
    : (profiles ?? []).filter(p => p.role !== 'admin')

  const twoFactorUserIds = ((totpRows ?? []) as { user_id: string }[]).map(r => r.user_id)

  return (
    <UtilisateursClient
      profiles={visibleProfiles as Profile[]}
      twoFactorUserIds={twoFactorUserIds}
      espaceFamille={espaceFamille}
      comptesParents={comptesParents ?? []}
    />
  )
}
