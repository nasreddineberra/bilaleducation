import { createClient } from '@/lib/supabase/server'
import EtablissementForm from '@/components/etablissement/EtablissementForm'
import type { Etablissement } from '@/types/database'

export default async function EtablissementPage() {
  const supabase = await createClient()

  // RLS filtre automatiquement par etablissement_id du profil connecté
  const { data } = await supabase
    .from('etablissements')
    .select('*')
    .single()

  return <EtablissementForm etablissement={data as Etablissement} />
}
