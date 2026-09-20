'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Recalcule le compteur de la cloche après un marquage « lu ».
 *
 * Le compteur vit dans le LAYOUT du tableau de bord, et Next ne re-rend que
 * le segment qui change : ouvrir une notification re-rend la page, jamais le
 * layout. Sans ce rafraîchissement, le badge gardait sa valeur jusqu'au
 * prochain rechargement complet.
 *
 * `actif` n'est vrai que si une ligne VIENT d'être marquée : au re-rendu qui
 * suit le refresh, l'update ne touche plus rien, la prop retombe à false, et
 * on ne boucle pas.
 */
export default function RafraichirBadge({ actif }: { actif: boolean }) {
  const router = useRouter()
  useEffect(() => {
    if (actif) router.refresh()
  }, [actif, router])
  return null
}
