import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { effectiveRole } from '@/lib/auth/effective-role'
import { proceduresDuRole } from '@/lib/aide'
import AideClient from '@/components/aide/AideClient'

// Menu Aide (02/11) : les procedures utilisateur lisibles par le role connecte
// (contenu : `lib/aide/procedures/`). Pas d'aide pour le parent en V1.
export default async function AidePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const etablissementId = (await headers()).get('x-etablissement-id') ?? ''

  const [{ data: me }, { data: etablissement }] = await Promise.all([
    supabase.from('profiles').select('role, etablissement_id').eq('id', user.id).single(),
    supabase.from('etablissements').select('nom').eq('id', etablissementId).maybeSingle(),
  ])
  const role = effectiveRole(me)
  if (!role || role === 'parent') redirect('/dashboard')

  return (
    <div className="h-full animate-fade-in">
      <AideClient procedures={proceduresDuRole(role)} etablissement={etablissement?.nom ?? ''} />
    </div>
  )
}
