import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import ResourcesClient from '@/components/ressources/ResourcesClient'

export default async function ResourcesPage() {
  const supabase = await createClient()

  // L'établissement est résolu par le middleware (header fiable, service-role)
  // plutôt que via une requête RLS sur profiles (fragile selon le contexte de session).
  const etablissementId = (await headers()).get('x-etablissement-id') ?? ''

  const [{ data: rooms }, { data: materials }] = await Promise.all([
    supabase.from('rooms').select('*').order('name'),
    supabase.from('materials').select('*, rooms(name)').order('name'),
  ])

  return <ResourcesClient initialRooms={rooms ?? []} initialMaterials={materials ?? []} etablissementId={etablissementId} />
}
