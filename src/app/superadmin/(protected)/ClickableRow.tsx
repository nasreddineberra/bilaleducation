'use client'

import { useRouter } from 'next/navigation'

/**
 * Ligne de liste cliquable, règle du projet : la ligne entière mène à la fiche.
 *
 * La page qui l'entoure est un composant SERVEUR — ses cellules ne peuvent donc
 * pas porter de `stopPropagation`. On inverse la logique : tout ce qui doit
 * échapper à la navigation se marque d'un `data-no-row-nav`, et c'est la ligne
 * qui regarde d'où vient le clic. Sans cela, cliquer « Intervenir » ouvrirait
 * l'intervention ET partirait vers la fiche.
 */
export default function ClickableRow({
  href,
  label,
  children,
  className = '',
}: {
  href: string
  label: string
  children: React.ReactNode
  className?: string
}) {
  const router = useRouter()

  const naviguer = (cible: EventTarget | null) => {
    if (cible instanceof Element && cible.closest('[data-no-row-nav]')) return
    router.push(href)
  }

  return (
    <tr
      onClick={e => naviguer(e.target)}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          if (e.target instanceof Element && e.target.closest('[data-no-row-nav]')) return
          e.preventDefault()
          router.push(href)
        }
      }}
      tabIndex={0}
      role="link"
      aria-label={label}
      className={`cursor-pointer hover:bg-warm-100 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500/50 ${className}`}
    >
      {children}
    </tr>
  )
}
