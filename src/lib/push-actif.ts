/**
 * NOTIFICATIONS DU NAVIGATEUR (push) : interrupteur unique.
 *
 * Le push ne sert qu'aux parents (bouton d'abonnement de l'ecran Notifications,
 * envoi par `createNotification`). Decision du 03/11 (docs/ESPACE-FAMILLE.md,
 * decision 11) : pas de push pour les familles, email et notification dans
 * l'espace famille seulement. Le code reste en place : `true` le reactive.
 *
 * Module a part de `lib/push.ts` : celui-ci charge `web-push` (serveur), l'ecran
 * Notifications (client) doit pouvoir lire l'interrupteur sans l'embarquer.
 */
export const PUSH_ACTIF = false
