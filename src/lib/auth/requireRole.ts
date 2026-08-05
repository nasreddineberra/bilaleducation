import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export type UserRole = 'admin' | 'direction' | 'comptable' | 'enseignant' | 'parent' | 'secretaire' | 'responsable_pedagogique'

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
    return { user: null, etablissementId: null, error: NextResponse.json({ error: 'Non authentifié' }, { status: 401 }) }
  }

  // `etablissement_id` remonte avec le role : sans lui, les routes API allaient
  // le chercher dans le CORPS de la requete, donc chez l'appelant.
  const { data: profile } = await supabaseAuth
    .from('profiles')
    .select('role, etablissement_id')
    .eq('id', user.id)
    .single()

  if (!profile || !allowedRoles.includes(profile.role as UserRole)) {
    return {
      user: null,
      etablissementId: null,
      error: NextResponse.json(
        { error: 'Accès refusé · rôle non autorisé' },
        { status: 403 }
      ),
    }
  }

  return { user, etablissementId: profile.etablissement_id as string | null, error: null }
}
