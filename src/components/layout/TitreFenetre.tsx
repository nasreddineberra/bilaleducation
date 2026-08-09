'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

/**
 * Titre du document, ajusté quand l'application tourne INSTALLÉE.
 *
 * ┌─ POURQUOI ──────────────────────────────────────────────────────────────┐
 * │ Chrome compose le titre de la fenêtre d'une application installée en    │
 * │ COLLANT le nom du manifeste devant le titre du document. Avec « Bilal   │
 * │ Education » des deux côtés, la barre affichait :                        │
 * │   « Bilal Education - ÉCOLE BILAL - Bilal Education »                  │
 * │                                                                          │
 * │ Répartition retenue, lisible dans les TROIS endroits :                  │
 * │   · manifeste `name`      → « ÉCOLE BILAL »        (installation, menu) │
 * │   · titre en ONGLET        → « ÉCOLE BILAL - Bilal Education »          │
 * │   · titre en FENÊTRE       → « Bilal Education », que Chrome préfixe du │
 * │     nom de l'application, donnant « ÉCOLE BILAL - Bilal Education ».    │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Le mode installé ne se détecte QUE côté navigateur (`display-mode`), d'où ce
 * composant client : le serveur, qui rend les métadonnées, ne peut pas le savoir.
 *
 * Réappliqué à chaque navigation : Next repose le titre issu des métadonnées à
 * chaque changement de page, et l'écraserait sinon.
 */
export default function TitreFenetre() {
  const pathname = usePathname()

  useEffect(() => {
    if (!window.matchMedia('(display-mode: standalone)').matches) return
    // `requestAnimationFrame` : laisse Next poser son titre avant de le
    // remplacer, sinon l'ordre des deux écritures n'est pas garanti.
    const id = requestAnimationFrame(() => { document.title = 'Bilal Education' })
    return () => cancelAnimationFrame(id)
  }, [pathname])

  return null
}
