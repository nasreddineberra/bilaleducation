import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Nom et logo de l'établissement, pour coiffer un email à SA marque.
 *
 * Les trois routes de notification (devoir, absence, paiement) écrivaient
 * « Bilal Education · Notification automatique » en pied — le fournisseur du
 * logiciel signait des messages destinés aux familles. Elles ne chargeaient pas
 * l'établissement ; ce helper évite d'écrire trois fois la même requête.
 *
 * Le repli n'est pas anodin : sans nom, l'email arriverait sans expéditeur
 * identifiable. « Votre établissement » est vague mais honnête.
 */
export async function marqueEcole(
  supabase: SupabaseClient,
  etablissementId: string,
): Promise<{ nom: string; logoUrl: string | null }> {
  const { data } = await supabase
    .from('etablissements')
    .select('nom, logo_url')
    .eq('id', etablissementId)
    .maybeSingle()

  return {
    nom: data?.nom ?? 'Votre établissement',
    logoUrl: data?.logo_url ?? null,
  }
}
