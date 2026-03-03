import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import CoursTree from '@/components/cours/CoursTree'

export default async function CoursPage() {
  const supabase        = await createClient()
  const h               = await headers()
  const etablissementId = h.get('x-etablissement-id') ?? ''

  const [{ data: ues }, { data: modules }, { data: cours }] = await Promise.all([
    supabase.from('unites_enseignement').select('*').order('order_index').order('nom_fr'),
    supabase.from('cours_modules').select('*').order('order_index').order('nom_fr'),
    supabase.from('cours').select('*').order('order_index').order('nom_fr'),
  ])

  return (
    <CoursTree
      ues={ues ?? []}
      modules={modules ?? []}
      cours={cours ?? []}
      etablissementId={etablissementId}
    />
  )
}
