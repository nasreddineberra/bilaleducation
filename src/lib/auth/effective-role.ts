import type { UserRole } from '@/types/database'

/**
 * Le rôle sous lequel l'application doit AFFICHER un utilisateur.
 *
 * Pendant une intervention de support, le super-admin travaille en `admin` :
 * c'est déjà ce que répond `get_user_role()` en base, donc ce que voient les
 * politiques RLS. Sans cette traduction côté application, la base lui ouvrirait
 * les données et l'écran ne lui montrerait rien — le rôle `super_admin` ne
 * figure dans aucun menu de la sidebar ni dans aucune branche du tableau de
 * bord, et il verrait une coquille vide.
 *
 * L'INTERRUPTEUR est le rattachement, comme en base : hors intervention,
 * `etablissement_id` est nul et le rôle réel est renvoyé tel quel. La colonne
 * `profiles.role`, elle, ne change jamais — les gardes de la console
 * (`requireRoleServer(['super_admin'])`) continuent donc de reconnaître
 * l'éditeur pendant qu'il intervient, ce qui lui garantit une sortie.
 *
 * Cette fonction est un miroir de la fonction SQL du même nom métier. Les deux
 * doivent rester d'accord : voir `add-superadmin-support-access.sql`.
 */
export function effectiveRole(
  profile: { role?: string | null; etablissement_id?: string | null } | null | undefined,
): UserRole | undefined {
  if (!profile?.role) return undefined
  if (profile.role === 'super_admin' && profile.etablissement_id) return 'admin'
  return profile.role as UserRole
}

/** Une intervention de support est-elle en cours pour ce profil ? */
export function isSupportSession(
  profile: { role?: string | null; etablissement_id?: string | null } | null | undefined,
): boolean {
  return profile?.role === 'super_admin' && Boolean(profile.etablissement_id)
}
