import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import type { NumeroTuteur } from '@/lib/parents/participant'

/**
 * FOYER DU COMPTE CONNECTE (espace famille) : source unique, cote serveur comme
 * cote navigateur.
 *
 * La base en est seule juge (`foyer_du_compte()`, migration
 * espace-famille-fondations) : NULL si le compte n'est pas un parent, si l'option
 * espace famille de l'ecole est coupee, si l'ecole est inactive ou expiree. Le
 * lien passe par `tutor1_user_id` / `tutor2_user_id`, jamais par
 * `parents.user_id` (colonne retiree : rien ne la remplissait).
 */

type Client = SupabaseClient<Database>

export async function foyerDuCompte(supabase: Client): Promise<string | null> {
  const { data, error } = await supabase.rpc('foyer_du_compte')
  if (error) {
    console.error('[foyer_du_compte]', error.message)
    return null
  }
  return data ?? null
}

/** Place du compte dans son foyer (tuteur 1 ou 2), NULL hors espace famille. */
export async function tuteurDuCompte(supabase: Client): Promise<NumeroTuteur | null> {
  const { data, error } = await supabase.rpc('tuteur_du_compte')
  if (error) {
    console.error('[tuteur_du_compte]', error.message)
    return null
  }
  return data === 1 || data === 2 ? data : null
}

/**
 * Classes de l'annee en cours du compte : celles de ses enfants actifs et ses
 * cours adultes. Vide hors espace famille.
 */
export async function classesDuCompte(supabase: Client): Promise<string[]> {
  const { data, error } = await supabase.rpc('classes_du_compte')
  if (error) {
    console.error('[classes_du_compte]', error.message)
    return []
  }
  return data ?? []
}
