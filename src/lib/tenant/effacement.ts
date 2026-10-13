import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Une école dont les DONNÉES ont été effacées (départ, RGPD) garde sa fiche dans
 * la console, grisée et en lecture seule, jusqu'à sa réouverture.
 *
 * Garde SERVEUR des actions de la console : griser la fiche ne protège rien, une
 * server action reste appelable. Rend le message de refus, ou `null`.
 * Module ordinaire et non `'use server'` : il ne doit pas devenir un point
 * d'entrée appelable du navigateur.
 */
export async function refuserSiEffacee(etablissementId: string): Promise<string | null> {
  const { data } = await createAdminClient()
    .from('etablissements')
    .select('donnees_effacees_le')
    .eq('id', etablissementId)
    .maybeSingle()
  return data?.donnees_effacees_le
    ? 'Les données de cette école sont effacées : rouvrez sa fiche avant toute modification.'
    : null
}
