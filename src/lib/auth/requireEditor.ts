import { createClient } from '@/lib/supabase/server'

/**
 * Reconnaît l'ÉDITEUR, sur la colonne brute `profiles.role`.
 *
 * POURQUOI PAS `requireRoleServer`. Celle-ci compare le rôle EFFECTIF, qui vaut
 * `admin` pendant une intervention de support. Employée ici, elle refuserait
 * toutes les actions de la console — y compris `leaveSchool` — au moment précis
 * où l'éditeur est entré dans une école et où il lui faut pouvoir en sortir.
 * Le rôle en base est l'identité ; le rôle effectif n'est qu'un costume.
 *
 * La lecture passe par le client de SESSION : la politique de lecture des
 * profils accorde toujours à chacun sa propre ligne (`id = auth.uid()`),
 * rattaché ou non — la console reste donc joignable en toute circonstance.
 */
export async function requireEditor(): Promise<{ userId?: string; error?: string }> {
  const session = await createClient()
  const { data: { user } } = await session.auth.getUser()
  if (!user) return { error: 'Non authentifié.' }

  const { data } = await session.from('profiles').select('role').eq('id', user.id).single()
  if (data?.role !== 'super_admin') {
    return { error: "Accès refusé · cette action est réservée à l'éditeur." }
  }
  return { userId: user.id }
}
