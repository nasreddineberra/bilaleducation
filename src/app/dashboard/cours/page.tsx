import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import CoursTree from '@/components/cours/CoursTree'
import { getCurrentYear } from '@/lib/cache/dashboard'

export default async function CoursPage() {
  const supabase        = await createClient()
  const h               = await headers()
  const etablissementId = h.get('x-etablissement-id') ?? ''

  const [{ data: ues }, { data: modules }, { data: cours }, currentYear] = await Promise.all([
    supabase.from('unites_enseignement').select('*').order('order_index').order('nom_fr'),
    supabase.from('cours_modules').select('*').order('order_index').order('nom_fr'),
    supabase.from('cours').select('*').order('order_index').order('nom_fr'),
    // Sert à distinguer, avant une suppression, les gabarits VIVANTS de ceux
    // d'années archivées : les premiers bloquent, les seconds sont seulement
    // annoncés. Voir `guard-referentiel-delete.sql`.
    getCurrentYear(),
  ])

  return (
    <CoursTree
      ues={ues ?? []}
      modules={modules ?? []}
      cours={cours ?? []}
      etablissementId={etablissementId}
      currentYearLabel={currentYear?.label ?? null}
    />
  )
}
