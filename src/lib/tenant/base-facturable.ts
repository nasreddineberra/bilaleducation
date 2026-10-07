import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Base facturable de l'ecole courante : eleves actifs + adultes inscrits
 * (tuteurs coches « cours adultes », tuteur 1 et 2 comptes separement).
 *
 * C'est la mesure de la limite d'inscrits (`etablissements.max_students`), que
 * la base controle elle-meme (declencheur `fn_guard_limite_inscrits`). Ce
 * comptage-ci ne sert qu'a l'AFFICHER et a griser « Ajouter » : il passe par le
 * client de la page, donc par la RLS, qui borne deja a l'etablissement.
 *
 * Rend `null` si un comptage echoue : sur un comptage `head`, une requete
 * impossible rend `count: null` SANS erreur, et un `?? 0` ferait croire a une
 * place libre.
 */
export async function compterBaseFacturable(
  supabase: SupabaseClient,
): Promise<{ eleves: number; adultes: number; total: number } | null> {
  const [{ count: eleves }, { count: t1 }, { count: t2 }] = await Promise.all([
    supabase.from('students').select('id', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('parents').select('id', { count: 'exact', head: true }).eq('tutor1_adult_courses', true),
    supabase.from('parents').select('id', { count: 'exact', head: true }).eq('tutor2_adult_courses', true),
  ])
  if (eleves === null || t1 === null || t2 === null) return null
  return { eleves, adultes: t1 + t2, total: eleves + t1 + t2 }
}
