/**
 * Version de l'application, affichée en pied de sidebar et sur les écrans
 * d'authentification.
 *
 * Constante partagée et non valeur répétée : elle apparaît désormais à sept
 * endroits, et six copies d'un numéro de version finissent toujours par
 * diverger — c'est celle qu'on oublie qui reste affichée.
 *
 * Volontairement DÉCORRÉLÉE de `package.json` : ce champ suit le versionnage
 * technique du paquet (0.1.0), pas la version fonctionnelle annoncée aux
 * utilisateurs.
 */
export const APP_VERSION = 'v1.0'
