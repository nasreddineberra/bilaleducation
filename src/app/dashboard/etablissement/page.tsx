import { createClient } from '@/lib/supabase/server'
import EtablissementForm from '@/components/etablissement/EtablissementForm'
import DocumentTypesConfig from '@/components/etablissement/DocumentTypesConfig'
import type { Etablissement } from '@/types/database'

export default async function EtablissementPage() {
  const supabase = await createClient()

  // RLS filtre automatiquement par etablissement_id du profil connecté
  const [{ data }, { data: docTypes }] = await Promise.all([
    supabase.from('etablissements').select('*').single(),
    supabase.from('document_type_configs').select('id, category, doc_key, label, is_required, order_index').order('order_index'),
  ])

  const etab = data as Etablissement

  return (
    <div className="h-full overflow-y-auto animate-fade-in space-y-6">
      {/* Infos établissement */}
      <div className="max-w-3xl">
        <EtablissementForm etablissement={etab} />
      </div>
      {/* Documents requis */}
      <DocumentTypesConfig
        etablissementId={etab.id}
        initialDocTypes={(docTypes ?? []) as any[]}
      />
    </div>
  )
}
