import { createClient } from '@/lib/supabase/server'
import type { UserRole } from '@/types/database'

/**
 * Vérifie que l'utilisateur authentifié possède l'un des rôles autorisés.
 * Conçu pour les Server Actions (retourne `{ error?: string }`).
 *
 * Usage :
 *   const { error } = await requireRoleServer(['admin', 'direction'])
 *   if (error) return { error }
 */
export async function requireRoleServer(allowedRoles: UserRole[]): Promise<{ error?: string }> {
  const supabaseAuth = await createClient()
  const { data: { user } } = await supabaseAuth.auth.getUser()

  if (!user) {
    return { error: 'Non authentifié.' }
  }

  const { data: profile } = await supabaseAuth
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !allowedRoles.includes(profile.role as UserRole)) {
    return { error: 'Accès refusé — votre rôle ne permet pas cette action.' }
  }

  return {}
}
