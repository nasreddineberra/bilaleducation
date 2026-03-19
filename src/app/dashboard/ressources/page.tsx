import { createClient } from '@/lib/supabase/server'
import ResourcesClient from '@/components/ressources/ResourcesClient'

export default async function ResourcesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: rooms }, { data: materials }, { data: profile }] = await Promise.all([
    supabase.from('rooms').select('*').order('name'),
    supabase.from('materials').select('*, rooms(name)').order('name'),
    supabase.from('profiles').select('etablissement_id').eq('id', user!.id).single(),
  ])

  return <ResourcesClient initialRooms={rooms ?? []} initialMaterials={materials ?? []} etablissementId={profile!.etablissement_id} />
}
