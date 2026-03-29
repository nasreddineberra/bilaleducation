'use client'

import { useState, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'

interface TooltipProps {
  children: React.ReactNode
  /** Texte simple OU contenu JSX riche */
  content:   React.ReactNode
  /** Position du tooltip par rapport au déclencheur (défaut : 'top') */
  position?: 'top' | 'top-right'
  /** Largeur max du tooltip (défaut : 'max-w-xs') */
  maxWidth?: string
}

export default function Tooltip({ children, content, position = 'top', maxWidth = 'max-w-xs' }: TooltipProps) {
  const triggerRef = useRef<HTMLSpanElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  const show = useCallback(() => {
    const el = triggerRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    if (position === 'top-right') {
      setPos({ top: r.top - 8, left: r.right + r.width / 2 })
    } else {
      setPos({ top: r.top - 8, left: r.left + r.width / 2 })
    }
  }, [position])

  const hide = useCallback(() => setPos(null), [])

  return (
    <span ref={triggerRef} className="inline-flex" onMouseEnter={show} onMouseLeave={hide}>
      {children}
      {pos && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed z-[9999] pointer-events-none"
          style={{
            top:       pos.top,
            left:      pos.left,
            transform: position === 'top-right' ? 'translate(-100%, -100%)' : 'translate(-50%, -100%)',
          }}
        >
          <div className={`bg-secondary-800 text-white rounded-xl shadow-xl px-3 py-2 text-xs leading-relaxed ${maxWidth}`}>
            {content}
          </div>
          <div className={`flex -mt-px ${position === 'top-right' ? 'justify-end pr-2' : 'justify-center'}`}>
            <span className="border-[5px] border-transparent border-t-secondary-800" />
          </div>
        </div>,
        document.body,
      )}
    </span>
  )
}
