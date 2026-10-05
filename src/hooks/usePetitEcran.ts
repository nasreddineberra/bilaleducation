'use client'

import { useEffect, useState } from 'react'
import { REQUETE_MOBILE } from '@/lib/mobile'

/**
 * Vrai sous 768 px PAR DEFAUT — le seuil du FILTRE DE MENU, pas celui du cadre
 * (voir `src/lib/mobile.ts`, qui porte les deux et explique pourquoi). Un autre
 * seuil se passe en argument : `usePetitEcran(REQUETE_CADRE)` pour les 1024 px
 * du tiroir.
 *
 * POURQUOI UN HOOK ET NON DU CSS. Deux raisons, selon l appelant :
 *  - la barre laterale pilote `inert` et `aria-expanded`, qui sont des
 *    ATTRIBUTS : masquer en CSS laisserait un menu visible mais INERTE ;
 *  - les tableaux de bord doivent parfois rendre un `span` LA OU il y avait un
 *    lien — le nom reste lisible, il cesse seulement d etre cliquable. Le CSS
 *    ne sait que montrer ou cacher, pas remplacer.
 *
 * Rend `false` au rendu serveur et au premier rendu client : on affiche donc
 * TOUT avant de restreindre. Si le script echoue, on montre trop plutot que
 * trop peu — meme principe FAIL-OPEN que la session (11 aout). Le reflow qui
 * suit l hydratation ne se voit pas dans la barre laterale (le tiroir est
 * ferme au chargement) ; sur un tableau de bord il porte sur quelques liens.
 */
export function usePetitEcran(requete: string = REQUETE_MOBILE): boolean {
  const [petitEcran, setPetitEcran] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia(requete)
    const maj = () => setPetitEcran(mq.matches)
    maj()
    mq.addEventListener('change', maj)
    return () => mq.removeEventListener('change', maj)
  }, [requete])

  return petitEcran
}
