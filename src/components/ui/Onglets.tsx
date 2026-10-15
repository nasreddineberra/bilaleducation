'use client'

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { clsx } from 'clsx'

/**
 * ONGLETS A SOULIGNEMENT ANIME (charte du 15/10/2026, validee sur la page
 * modele) : texte simple, l'onglet actif au vert de marque, et une barre de
 * 3 px qui GLISSE d'un onglet a l'autre.
 *
 * Le conteneur ne gere que l'apparence : chaque ecran garde ses boutons
 * `role="tab"` (refs, fleches du clavier, deep-link `?tab=`), il leur applique
 * simplement `classeOnglet(actif)`. La position de la barre est MESUREE sur le
 * bouton actif (et remesuree si la largeur change : compteur dans un libelle,
 * fenetre redimensionnee) — jamais ecrite en dur.
 */
export function classeOnglet(actif: boolean): string {
  return clsx(
    'flex items-center gap-1.5 py-2 text-sm whitespace-nowrap transition-colors duration-200 rounded-t',
    'outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--brand-accent)]',
    actif
      ? 'font-semibold text-[var(--brand-surface)] dark:text-[var(--brand-accent)]'
      : 'font-medium text-warm-700 hover:text-secondary-800',
  )
}

export default function Onglets({ ariaLabel, actifIndex, children, className }: {
  ariaLabel:  string
  /** Index du bouton `role="tab"` actif, dans l'ordre du rendu. */
  actifIndex: number
  children:   ReactNode
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [barre, setBarre] = useState({ left: 0, width: 0 })

  useLayoutEffect(() => {
    const conteneur = ref.current
    if (!conteneur) return
    const mesurer = () => {
      const el = conteneur.querySelectorAll<HTMLElement>('[role="tab"]')[actifIndex]
      if (el) setBarre({ left: el.offsetLeft, width: el.offsetWidth })
    }
    mesurer()
    const obs = new ResizeObserver(mesurer)
    obs.observe(conteneur)
    conteneur.querySelectorAll('[role="tab"]').forEach(t => obs.observe(t))
    return () => obs.disconnect()
  }, [actifIndex, children])

  return (
    <div
      ref={ref}
      role="tablist"
      aria-label={ariaLabel}
      className={clsx('relative flex gap-6 border-b border-[var(--card-border)] overflow-x-auto', className)}
    >
      {children}
      <span
        aria-hidden
        className="absolute bottom-0 h-[3px] rounded-full bg-[var(--brand-surface)] dark:bg-[var(--brand-accent)] transition-all duration-300 ease-out motion-reduce:transition-none"
        style={{ left: barre.left, width: barre.width }}
      />
    </div>
  )
}
