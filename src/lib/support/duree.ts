/**
 * Durée au-delà de laquelle une intervention de support se referme d'office.
 *
 * DANS SON PROPRE MODULE, et ce n'est pas de la coquetterie : cette valeur est
 * affichée par des composants CLIENT (le bouton « Intervenir », le bandeau).
 * Importée depuis `intervention.ts`, elle entraînerait tout ce fichier dans le
 * bundle du navigateur — dont `createAdminClient`, c'est-à-dire le chemin de la
 * clé de service. Un module sans dépendance serveur ne peut rien entraîner.
 *
 * UNE HEURE — décision de l'éditeur, et elle se tient : c'est exactement le
 * délai d'inactivité des sessions (`INACTIVITY_SECONDS`). Les deux protections
 * expirent donc ensemble, au lieu de laisser un rattachement survivre à la
 * session qui l'utilisait.
 *
 * Le compteur part de l'OUVERTURE, pas de la dernière action : c'est une durée
 * d'AUTORISATION, pas une inactivité. Un dépannage plus long n'est pas bloqué —
 * il se rouvre depuis la console en un clic, et cette réouverture laisse une
 * trace de plus, ce qui est souhaitable pour un accès aux données d'un client.
 */
export const INTERVENTION_MAX_HEURES = 1
