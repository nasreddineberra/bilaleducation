import { createClient } from '@/lib/supabase/server'
import EtablissementForm from '@/components/etablissement/EtablissementForm'
import DocumentTypesConfig from '@/components/etablissement/DocumentTypesConfig'
import MessagerieConfig from '@/components/etablissement/MessagerieConfig'
import { getSmtpSettings } from '@/app/dashboard/etablissement/smtp-actions'
import type { Etablissement } from '@/types/database'

export default async function EtablissementPage() {
  const supabase = await createClient()

  // RLS filtre automatiquement par etablissement_id du profil connecté
  const [{ data }, { data: docTypes }] = await Promise.all([
    supabase.from('etablissements').select('*').single(),
    supabase.from('document_type_configs').select('id, category, doc_key, label, is_required, order_index').order('order_index'),
  ])

  const etab = data as Etablissement

  // Réservé admin/direction : l'action renvoie une erreur pour les autres rôles,
  // auquel cas la section n'est pas rendue. Le mot de passe n'en sort jamais.
  const { config: smtpConfig, error: smtpError } = await getSmtpSettings()

  return (
    // Deux colonnes alignees en haut, separees d'un filet : tout doit tenir a
    // l'ecran sans scroll.
    <div className="h-full animate-fade-in flex gap-6">

      {/* Colonne gauche : identite + messagerie */}
      <div className="flex-1 min-w-0 space-y-4">
        <EtablissementForm etablissement={etab} />

        {/* Messagerie (SMTP) — masquee si le role n'y a pas droit */}
        {!smtpError && (
          <MessagerieConfig
            initialConfig={smtpConfig ?? null}
            contact={etab.contact ?? null}
            etablissementNom={etab.nom ?? ''}
          />
        )}

        {/* Mention commune aux deux encadres */}
        <p className="text-xs text-warm-500">
          <span className="font-semibold text-red-400">*</span> obligatoire
        </p>
      </div>

      <div className="w-px bg-warm-200 shrink-0" aria-hidden="true" />

      {/* Colonne droite : documents requis */}
      <div className="flex-1 min-w-0">
        <DocumentTypesConfig
          etablissementId={etab.id}
          initialDocTypes={(docTypes ?? []) as any[]}
        />
      </div>
    </div>
  )
}
