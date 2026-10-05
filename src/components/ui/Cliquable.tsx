'use client'

import Link from 'next/link'
import { clsx } from 'clsx'

/**
 * Une ligne qui MENE quelque part, ou seulement qui AFFICHE.
 *
 * `href = null` rend un `div` au lieu d un lien : le contenu reste lisible, il
 * cesse d etre cliquable. C est ce qu il faut sur telephone quand la
 * destination est un ecran masque (phase 2 du responsive, 5 octobre) — masquer
 * la ligne entiere ferait perdre l information, qui a sa valeur seule : un nom
 * d apprenant absent, un compteur de familles sans paiement, un rappel de
 * bascule de periode.
 *
 * `classNameLien` porte ce qui n a de sens QUE sur un lien (survol,
 * transition) : un `div` qui change de couleur au survol promet un clic qui
 * n arrivera jamais.
 */
export function Cliquable({
  href,
  className,
  classNameLien,
  children,
}: {
  href:           string | null
  className?:     string
  classNameLien?: string
  children:       React.ReactNode
}) {
  if (!href) return <div className={className}>{children}</div>

  return (
    <Link href={href} className={clsx(className, classNameLien)}>
      {children}
    </Link>
  )
}
