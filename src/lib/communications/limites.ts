/**
 * PLAFOND DES PIECES JOINTES D'UN MESSAGE (familles et equipe), tous fichiers
 * confondus. Une seule valeur pour l'ecran (refus a l'ajout, jauge) et pour le
 * serveur (garde de l'envoi) : recopiee quatre fois, elle pouvait diverger.
 */
export const PJ_MAX_OCTETS = 1024 * 1024

/** « 1 Mo », pour les messages. */
export const PJ_MAX_LIBELLE = `${PJ_MAX_OCTETS / (1024 * 1024)} Mo`
