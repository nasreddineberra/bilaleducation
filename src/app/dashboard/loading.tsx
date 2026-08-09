/**
 * Chargement du tableau de bord.
 *
 * ┌─ NE PAS Y REDESSINER LE CADRE ──────────────────────────────────────────┐
 * │ Ce fallback est rendu dans DEUX situations qu'on ne peut pas distinguer  │
 * │ ici :                                                                    │
 * │   · chargement à froid — le layout est lui aussi suspendu, l'écran n'a   │
 * │     donc ni barre latérale ni en-tête ;                                  │
 * │   · navigation interne — le layout est DÉJÀ rendu, ce fallback s'affiche │
 * │     À L'INTÉRIEUR de lui.                                                │
 * │                                                                          │
 * │ J'y avais dessiné une silhouette de cadre pour le premier cas : elle     │
 * │ s'est affichée par-dessus le vrai cadre dans le second, donnant une      │
 * │ seconde barre latérale et un second en-tête. Un fallback de segment ne   │
 * │ dessine que du CONTENU.                                                  │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
export { default } from '@/components/ui/RouteSkeleton'
