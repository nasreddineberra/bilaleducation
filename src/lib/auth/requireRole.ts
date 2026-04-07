import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export type UserRole = 'admin' | 'direction' | 'enseignant' | 'parent' | 'secretaire' | 'responsable_pedagogique'

/**
 * Vérifie que l'utilisateur authentifié possède l'un des rôles autorisés.
 * Retourne l'utilisateur si le rôle est valide, sinon une réponse 403.
 *
 * Usage :
 *   const { user, error } = await requireRole(req, ['admin', 'direction', 'staff'])
 *   if (error) return error
 */
export async function requireRole(allowedRoles: UserRole[]) {
  const supabaseAuth = await createClient()
  const { data: { user } } = await supabaseAuth.auth.getUser()

  if (!user) {
    return { user: null, error: NextResponse.json({ error: 'Non authentifié' }, { status: 401 }) }
  }

  const { data: profile } = await supabaseAuth
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !allowedRoles.includes(profile.role as UserRole)) {
    return {
      user: null,
      error: NextResponse.json(
        { error: 'Accès refusé — rôle non autorisé' },
        { status: 403 }
      ),
    }
  }

  return { user, error: null }
}
