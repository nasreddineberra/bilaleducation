import { createAdminClient } from '@/lib/supabase/admin'

/**
 * L'ECOLE DE DEMONSTRATION EST-ELLE PRETE ? (decision du 23/10)
 *
 * Une remise a zero reussie laisse toujours une annee scolaire EN COURS et des
 * COMPTES : ce sont les premieres choses qu'elle cree. Apres un depart (comptes
 * et donnees effaces) ou une remise a zero interrompue, l'une des deux manque :
 * on n'y entre pas (« Intervenir » grise, refus serveur) tant qu'elle n'a pas
 * ete reinitialisee correctement.
 */
export const RAISON_DEMO_A_REINITIALISER = "Réinitialisez d'abord l'école de démonstration."

export function demoPrete(anneeEnCours: boolean, comptes: number): boolean {
  return anneeEnCours && comptes > 0
}

/** Meme regle, lue en base : pour les actions serveur. */
export async function demoPreteEnBase(etablissementId: string): Promise<boolean> {
  const admin = createAdminClient()
  const [{ count: annees }, { count: comptes }] = await Promise.all([
    admin.from('school_years').select('id', { count: 'exact', head: true })
      .eq('etablissement_id', etablissementId).eq('is_current', true),
    admin.from('profiles').select('id', { count: 'exact', head: true })
      .eq('etablissement_id', etablissementId).neq('role', 'parent'),
  ])
  // Comptage impossible (`null`) : dans le doute, la demonstration n'est pas prete.
  return demoPrete((annees ?? 0) > 0, comptes ?? 0)
}
