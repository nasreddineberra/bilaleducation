import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { effectiveRole } from '@/lib/auth/effective-role'

/**
 * Espace famille (docs/ESPACE-FAMILLE.md, lot 6) : ecrans du PARENT seul. Un
 * compte du personnel qui y arrive par l'adresse retourne a son tableau de
 * bord (l'inverse est garde par le middleware).
 */
export default async function FamilleLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profil } = await supabase.from('profiles').select('role, etablissement_id').eq('id', user.id).single()
  if (effectiveRole(profil) !== 'parent') redirect('/dashboard')
  return <>{children}</>
}
