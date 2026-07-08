import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import MonCompteClient from '@/components/mon-compte/MonCompteClient'

export default async function MonComptePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, role, civilite, first_name, last_name, phone, etablissement_id')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  let etablissementName = ''
  if (profile.etablissement_id) {
    const { data: etab } = await supabase
      .from('etablissements')
      .select('nom')
      .eq('id', profile.etablissement_id)
      .single()
    etablissementName = etab?.nom ?? ''
  }

  return (
    <MonCompteClient
      profile={profile}
      email={user.email ?? profile.email}
      etablissementName={etablissementName}
    />
  )
}
