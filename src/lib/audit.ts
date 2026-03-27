import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Insère un audit log descriptif (non-bloquant).
 * Récupère automatiquement le profil utilisateur pour etablissement_id, email, nom.
 */
export async function logAudit(
  supabase: SupabaseClient,
  params: {
    action: 'INSERT' | 'UPDATE' | 'DELETE'
    entityType: string
    entityId?: string | null
    description: string
    oldData?: Record<string, unknown> | null
    newData?: Record<string, unknown> | null
  }
) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase
      .from('profiles')
      .select('etablissement_id, email, first_name, last_name')
      .eq('id', user.id)
      .single()

    if (!profile?.etablissement_id) return

    await supabase.from('audit_logs').insert({
      etablissement_id: profile.etablissement_id,
      user_id: user.id,
      user_email: profile.email ?? user.email,
      user_name: `${profile.last_name ?? ''} ${profile.first_name ?? ''}`.trim(),
      entity_type: params.entityType,
      entity_id: params.entityId ?? null,
      action: params.action,
      old_data: params.oldData ?? null,
      new_data: params.newData ?? null,
      description: params.description,
    })
  } catch {
    // Non-bloquant : ne jamais bloquer l'opération principale
  }
}
