'use client'

import { useLayoutEffect, useRef, useState } from 'react'

/**
 * Nombre de lignes par page qui TIENNENT dans la zone de liste, sans barre de
 * defilement.
 *
 * Une taille de page ecrite en dur (20) ne vaut que pour un ecran : le vivier des
 * Affectations debordait des qu'un bandeau ou un filtre prenait quelques pixels,
 * et deborderait sur un ecran plus petit ou zoome. On MESURE donc la zone (son
 * cadre ne depend pas de son contenu : `flex-1 min-h-0`) et une ligne, marquee
 * `data-ligne`, et on recalcule a chaque redimensionnement.
 *
 * `ecart` = espace vertical entre deux lignes (`space-y-0.5` = 2 px).
 * `cle` relance la mesure quand les lignes apparaissent (liste d'abord vide).
 */
export function useTailleDePage<T extends HTMLElement = HTMLDivElement>(
  defaut: number,
  { ecart = 2, minimum = 5, cle }: { ecart?: number; minimum?: number; cle?: unknown } = {},
) {
  const ref = useRef<T>(null)
  const [taille, setTaille] = useState(defaut)

  useLayoutEffect(() => {
    const zone = ref.current
    if (!zone) return
    const mesurer = () => {
      const ligne = zone.querySelector<HTMLElement>('[data-ligne]')
      if (!ligne || ligne.offsetHeight === 0) return
      const pas = ligne.offsetHeight + ecart
      const n = Math.max(minimum, Math.floor((zone.clientHeight + ecart) / pas))
      setTaille(prev => (prev === n ? prev : n))
    }
    mesurer()
    const obs = new ResizeObserver(mesurer)
    obs.observe(zone)
    return () => obs.disconnect()
  }, [ecart, minimum, cle])

  return [ref, taille] as const
}
