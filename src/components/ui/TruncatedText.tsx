'use client'

import { useEffect, useRef, useState } from 'react'
import Tooltip from './Tooltip'

/**
 * Texte tronqué avec infobulle **uniquement s'il est réellement coupé**.
 *
 * Une infobulle systématique est une nuisance : elle s'ouvre sur un texte
 * entièrement lisible et masque ce qui l'entoure. On mesure donc le débordement
 * (`scrollWidth > clientWidth`) et on n'enveloppe dans un `Tooltip` que dans ce
 * cas. La mesure est refaite au redimensionnement de la fenêtre, la troncature
 * dépendant de la largeur disponible.
 *
 * Extrait de `TempsPresenceClient` le 5 août 2026, à son deuxième usage
 * (historique des communications comptables).
 */
export default function TruncatedText({
  text,
  tooltip,
  className = '',
}: {
  text: string
  /** Contenu de l'infobulle si différent du texte lui-même. */
  tooltip?: React.ReactNode
  className?: string
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const [truncated, setTruncated] = useState(false)

  useEffect(() => {
    const measure = () => {
      const el = ref.current
      // +1 : marge d'arrondi, les deux mesures étant en pixels sous-pixellisés.
      if (el) setTruncated(el.scrollWidth > el.clientWidth + 1)
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [text])

  const inner = <span ref={ref} className={`block w-full truncate ${className}`}>{text}</span>

  return truncated
    ? <Tooltip content={tooltip ?? text} className="flex-1 min-w-0">{inner}</Tooltip>
    : <span className="inline-flex flex-1 min-w-0">{inner}</span>
}
