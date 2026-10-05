/**
 * Le seuil du FILTRE DE MENU — a ne pas confondre avec celui du CADRE.
 *
 *   cadre (barre laterale en tiroir)  ->  1024 px  (`lg` de Tailwind)
 *   filtre de menu                    ->   768 px  (`md` de Tailwind)
 *
 * POURQUOI DEUX SEUILS. Le zoom du navigateur reduit la largeur CSS : un
 * ordinateur de 1280 px zoome a 150 % tombe a 853 px. A un seuil unique de
 * 1024, un directeur qui zoome pour lire perdrait la moitie de ses menus
 * **sur son ordinateur**, sans comprendre pourquoi — et ce projet a fait une
 * passe entiere sur la lisibilite en juillet, ces utilisateurs zooment.
 *
 * A 768, ce meme ecran (853 px) garde TOUS ses menus tout en profitant du
 * tiroir. Un telephone (360-430 px) est largement en dessous, une tablette en
 * portrait au-dessus — et elle peut afficher l emploi du temps.
 *
 * Le masquage reste donc SEC (decision du 5 octobre) : c est le choix du
 * seuil qui regle le cas du zoom, pas une echappatoire.
 *
 * TOUT PASSE PAR LE JS, pas par une variante CSS — et ce n est pas un choix de
 * confort :
 *  - la barre laterale pilote `inert` et `aria-expanded`, qui sont des
 *    ATTRIBUTS : masquer en CSS laisserait un menu visible mais INERTE ;
 *  - les tableaux de bord doivent parfois rendre un `div` LA OU il y avait un
 *    lien (le nom reste lisible, il cesse d etre cliquable). Le CSS ne sait que
 *    montrer ou cacher, pas remplacer.
 *
 * `SEUIL_MOBILE_PX` reste exporte pour que la valeur soit NOMMEE une seule fois
 * et reste lisible a cote de son explication.
 */
export const SEUIL_MOBILE_PX = 768

/** Meme bascule que la variante Tailwind `md`, exprimee pour `matchMedia`. */
export const REQUETE_MOBILE = `(max-width: ${SEUIL_MOBILE_PX - 1}px)`

/**
 * Le seuil du CADRE (barre laterale en tiroir), en regard du precedent.
 * Il etait jusqu ici porte par la seule variante `lg:` de Tailwind ; le
 * nommer permet de l interroger en JS, ce qu exige la fermeture du tiroir
 * quand la fenetre repasse au-dessus.
 */
export const SEUIL_CADRE_PX = 1024

/** Meme bascule que la variante Tailwind `lg`, exprimee pour `matchMedia`. */
export const REQUETE_CADRE = `(max-width: ${SEUIL_CADRE_PX - 1}px)`

/**
 * Un raccourci de tableau de bord. `mobile` absent = masque sous le seuil.
 *
 * TYPE EXPLICITE ET NON INFERE : une liste dont AUCUNE entree ne porte le
 * drapeau (le tableau de bord pedagogique, dont les quatre destinations sont
 * fermees sur telephone) verrait TypeScript refuser le filtre. Et l inference
 * tomberait a nouveau le jour ou l on retire le dernier `mobile` d une autre.
 */
export type Raccourci = {
  href:    string
  label:   string
  mobile?: boolean
}
