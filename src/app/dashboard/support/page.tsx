import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { effectiveRole } from '@/lib/auth/effective-role'
import SupportRequestsClient, { type SupportRequestRow } from '@/components/support/SupportRequestsClient'

/**
 * Historique des demandes de support de l'établissement.
 *
 * GARDE DE RÔLE RÉELLE, et pas seulement un lien masqué dans la barre latérale :
 * une page est atteignable par son adresse. Elle double la RLS, qui reste la
 * seule protection qui compte.
 */
export default async function SupportPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, etablissement_id, civilite, first_name, last_name, email')
    .eq('id', user.id)
    .single()

  const role = effectiveRole(profile)
  if (!profile?.etablissement_id || !['admin', 'direction'].includes(role ?? '')) {
    redirect('/dashboard')
  }

  // La RLS borne déjà à l'établissement ; le filtre explicite documente
  // l'intention et survivrait à un changement de policy.
  const { data: demandes } = await supabase
    .from('support_requests')
    .select('id, category, impact, subject, message, attachment_path, context, email_status, email_error, author_name, author_email, author_role, created_at')
    .eq('etablissement_id', profile.etablissement_id)
    .order('created_at', { ascending: false })

  const { data: etab } = await supabase
    .from('etablissements')
    .select('nom')
    .eq('id', profile.etablissement_id)
    .single()

  return (
    <SupportRequestsClient
      demandes={(demandes ?? []) as SupportRequestRow[]}
      ecole={etab?.nom ?? null}
      auteur={{
        nom:   [profile.civilite, profile.last_name, profile.first_name].filter(Boolean).join(' ').trim(),
        email: profile.email ?? user.email ?? '',
        role:  role ?? '',
      }}
    />
  )
}
