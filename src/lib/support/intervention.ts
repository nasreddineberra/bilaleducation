import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Interventions de support : ouverture, fermeture, expiration.
 *
 * Module ORDINAIRE et non `'use server'` : il est appelé depuis des server
 * actions ET depuis le rendu de pages (le layout du tableau de bord, la console).
 * Un fichier `'use server'` ne peut exporter que des fonctions async destinées au
 * client, et exposerait ces écritures comme des points d'entrée appelables
 * depuis un navigateur — ce qu'elles ne doivent surtout pas être.
 *
 * Toutes les écritures passent par le SERVICE-ROLE : la table est en régime
 * serveur uniquement (aucune politique, aucun privilège pour les rôles de l'API).
 */

/**
 * Durée au-delà de laquelle une intervention se referme d'office.
 *
 * UNE HEURE — décision de l'éditeur, et elle se tient : c'est exactement le
 * délai d'inactivité des sessions (`INACTIVITY_SECONDS`). Les deux protections
 * expirent donc ensemble, au lieu de laisser un rattachement survivre trois
 * heures à la session qui l'utilisait.
 *
 * Le compteur part de l'OUVERTURE, pas de la dernière action : c'est une durée
 * d'AUTORISATION, pas une inactivité. Un dépannage plus long n'est pas bloqué —
 * il se rouvre depuis la console, en un clic, et cette réouverture laisse une
 * trace de plus, ce qui est le comportement souhaitable pour un accès aux
 * données d'un client.
 *
 * L'inactivité, elle, ne referme PAS le rattachement, qui survit à la session :
 * c'est ce qui garantit de pouvoir sortir après un plantage, et c'est aussi le
 * trou que ce délai comble.
 */
export const INTERVENTION_MAX_HEURES = 1

export type Intervention = {
  id: string
  etablissement_id: string
  opened_at: string
}

/** Intervention ouverte de cet éditeur, ou `null`. */
export async function getInterventionOuverte(superAdminId: string): Promise<Intervention | null> {
  const { data } = await createAdminClient()
    .from('support_interventions')
    .select('id, etablissement_id, opened_at')
    .eq('super_admin_id', superAdminId)
    .is('closed_at', null)
    .order('opened_at', { ascending: false })
    .maybeSingle()

  return data ?? null
}

/** Enregistre l'ouverture. Toute intervention restée ouverte est refermée avant. */
export async function ouvrirIntervention(
  superAdminId: string,
  superAdminEmail: string | null,
  etablissementId: string,
): Promise<void> {
  const admin = createAdminClient()

  // Une seule intervention ouverte à la fois — le rattachement l'est déjà, la
  // table doit dire la même chose. Sans ce ménage, une ligne oubliée ferait
  // croire à deux interventions simultanées, ce que le modèle interdit.
  await admin
    .from('support_interventions')
    .update({ closed_at: new Date().toISOString(), closed_reason: 'expiration' })
    .eq('super_admin_id', superAdminId)
    .is('closed_at', null)

  await admin.from('support_interventions').insert({
    super_admin_id:    superAdminId,
    super_admin_email: superAdminEmail,
    etablissement_id:  etablissementId,
  })
}

/** Referme l'intervention ouverte, s'il y en a une. */
export async function fermerIntervention(
  superAdminId: string,
  raison: 'manuelle' | 'expiration' = 'manuelle',
): Promise<void> {
  await createAdminClient()
    .from('support_interventions')
    .update({ closed_at: new Date().toISOString(), closed_reason: raison })
    .eq('super_admin_id', superAdminId)
    .is('closed_at', null)
}

/**
 * Referme l'intervention si elle a dépassé le délai, et détache l'éditeur.
 *
 * Renvoie `true` quand une expiration a eu lieu — l'appelant doit alors renvoyer
 * vers la console, l'accès venant de disparaître sous ses pieds.
 *
 * APPELÉE DEPUIS UN RENDU DE PAGE, donc sans `updateTag` : invalider un cache
 * pendant un rendu est interdit par le framework. Ce n'est pas un problème ici,
 * car le layout lit le rattachement RÉEL en base et non le profil mis en cache —
 * il verra donc l'état à jour au rendu suivant. C'est aussi pourquoi ce contrôle
 * vit là : il faut qu'il s'exécute même si l'éditeur ne revient jamais à sa
 * console, sans quoi un onglet oublié garderait l'accès ouvert.
 */
export async function expirerSiDepassee(superAdminId: string): Promise<boolean> {
  const ouverte = await getInterventionOuverte(superAdminId)
  if (!ouverte) return false

  const ecoulees = (Date.now() - new Date(ouverte.opened_at).getTime()) / 3_600_000
  if (ecoulees < INTERVENTION_MAX_HEURES) return false

  const admin = createAdminClient()

  await admin
    .from('support_interventions')
    .update({ closed_at: new Date().toISOString(), closed_reason: 'expiration' })
    .eq('id', ouverte.id)

  // Le détachement est ce qui retire RÉELLEMENT l'accès : refermer la ligne du
  // journal sans le faire ne fermerait qu'une écriture comptable.
  await admin.from('profiles').update({ etablissement_id: null }).eq('id', superAdminId)

  console.warn(`[support] Intervention expirée après ${INTERVENTION_MAX_HEURES} h et refermée d'office (${superAdminId})`)
  return true
}
