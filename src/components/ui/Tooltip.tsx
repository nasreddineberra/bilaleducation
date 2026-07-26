'use client'

import { useState, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'

interface TooltipProps {
  children: React.ReactNode
  /** Texte simple OU contenu JSX riche */
  content:   React.ReactNode
  /** Position du tooltip par rapport au déclencheur (défaut : 'top').
   *  'bottom' : indispensable pour les contrôles collés en haut de page (header),
   *  où une bulle au-dessus sortirait de la fenêtre. */
  position?: 'top' | 'top-right' | 'bottom'
  /** Largeur max du tooltip (défaut : 'max-w-xs') */
  maxWidth?: string
  /** Classes ajoutées au wrapper déclencheur (ex. flex-1 min-w-0 pour un libellé tronqué) */
  className?: string
}

export default function Tooltip({ children, content, position = 'top', maxWidth = 'max-w-xs', className }: TooltipProps) {
  const triggerRef = useRef<HTMLSpanElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  const show = useCallback(() => {
    const el = triggerRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    if (position === 'top-right') {
      setPos({ top: r.top - 8, left: r.right + r.width / 2 })
    } else if (position === 'bottom') {
      setPos({ top: r.bottom + 8, left: r.left + r.width / 2 })
    } else {
      setPos({ top: r.top - 8, left: r.left + r.width / 2 })
    }
  }, [position])

  const hide = useCallback(() => setPos(null), [])

  return (
    <span ref={triggerRef} className={['inline-flex', className].filter(Boolean).join(' ')} onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}>
      {children}
      {pos && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed z-[10050] pointer-events-none"
          style={{
            top:  pos.top,
            left: pos.left,
            transform: position === 'bottom'
              ? 'translate(-50%, 0)'
              : position === 'top-right' ? 'translate(-100%, -100%)' : 'translate(-50%, -100%)',
          }}
        >
          {/* Flèche au-dessus quand la bulle est en dessous du déclencheur.
              Deux triangles superposés : le plus grand (accent, sombre uniquement)
              dépasse de 1px → contour sur les obliques et la pointe. */}
          {position === 'bottom' && (
            <div className="relative h-[5px] -mb-px">
              <span className="hidden dark:block absolute bottom-0 left-1/2 -translate-x-1/2 border-x-[6px] border-b-[6px] border-x-transparent border-b-[var(--brand-accent)]" />
              <span className="absolute bottom-0 left-1/2 -translate-x-1/2 border-x-[5px] border-b-[5px] border-x-transparent border-b-[var(--brand-surface)]" />
            </div>
          )}
          <div className={`bg-[var(--brand-surface)] text-white rounded-xl shadow-xl px-3 py-2 text-xs leading-relaxed dark:border dark:border-[var(--brand-accent)] ${maxWidth}`}>
            {content}
          </div>
          {position !== 'bottom' && (
            <div className="relative h-[5px] -mt-px">
              <span className={`hidden dark:block absolute top-0 border-x-[6px] border-t-[6px] border-x-transparent border-t-[var(--brand-accent)] ${position === 'top-right' ? 'right-2' : 'left-1/2 -translate-x-1/2'}`} />
              <span className={`absolute top-0 border-x-[5px] border-t-[5px] border-x-transparent border-t-[var(--brand-surface)] ${position === 'top-right' ? 'right-2' : 'left-1/2 -translate-x-1/2'}`} />
            </div>
          )}
        </div>,
        document.body,
      )}
    </span>
  )
}
