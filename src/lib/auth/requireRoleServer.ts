import { createClient } from '@/lib/supabase/server'
import type { UserRole } from '@/types/database'
import { effectiveRole } from '@/lib/auth/effective-role'

/**
 * Vérifie que l'utilisateur authentifié possède l'un des rôles autorisés.
 * Conçu pour les Server Actions (retourne `{ error?: string }`).
 *
 * Usage :
 *   const { error } = await requireRoleServer(['admin', 'direction'])
 *   if (error) return { error }
 *
 * Le rôle comparé est le rôle EFFECTIF, celui que voient déjà les politiques
 * RLS : pendant une intervention de support, le super-admin vaut `admin`. Sans
 * cette traduction, la base lui ouvrirait les données et chaque enregistrement
 * serait refusé ici — il pourrait tout consulter et ne rien réparer, ce qui est
 * précisément l'inverse du but.
 *
 * Ne PAS employer cette garde pour reconnaître l'éditeur lui-même : pendant une
 * intervention elle ne répond plus `super_admin`, et la sortie deviendrait
 * impossible. Ce contrôle-là lit la colonne brute — voir `support-actions.ts`.
 */
export async function requireRoleServer(allowedRoles: UserRole[]): Promise<{ error?: string }> {
  const supabaseAuth = await createClient()
  const { data: { user } } = await supabaseAuth.auth.getUser()

  if (!user) {
    return { error: 'Non authentifié.' }
  }

  const { data: profile } = await supabaseAuth
    .from('profiles')
    .select('role, etablissement_id')
    .eq('id', user.id)
    .single()

  const role = effectiveRole(profile)
  if (!role || !allowedRoles.includes(role)) {
    return { error: 'Accès refusé · votre rôle ne permet pas cette action.' }
  }

  return {}
}
