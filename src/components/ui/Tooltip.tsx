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
          {/* Flèche au-dessus quand la bulle est en dessous du déclencheur */}
          {position === 'bottom' && (
            <div className="flex justify-center -mb-px">
              <span className="border-[5px] border-transparent border-b-[var(--brand-surface)]" />
            </div>
          )}
          <div className={`bg-[var(--brand-surface)] text-white rounded-xl shadow-xl px-3 py-2 text-xs leading-relaxed ${maxWidth}`}>
            {content}
          </div>
          {position !== 'bottom' && (
            <div className={`flex -mt-px ${position === 'top-right' ? 'justify-end pr-2' : 'justify-center'}`}>
              <span className="border-[5px] border-transparent border-t-[var(--brand-surface)]" />
            </div>
          )}
        </div>,
        document.body,
      )}
    </span>
  )
}
