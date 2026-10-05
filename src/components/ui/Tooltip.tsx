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

  /**
   * SURVOL — mais jamais au doigt.
   *
   * Au tap, le navigateur EMULE une sequence souris pour compatibilite
   * (`pointerenter` → `mouseenter` → `click`) et n emet AUCUN `mouseleave` tant
   * que l on ne touche pas ailleurs : la bulle restait donc affichee par-dessus
   * l ecran que le tap venait d ouvrir — vu sur une modale de la feuille d appel.
   *
   * On lit `pointerType` plutot qu une media query `(hover: hover)` : celle-ci
   * repond « oui » sur un PC tactile, ou le probleme se pose a l identique.
   * `pen` est admis — un stylet survole vraiment.
   */
  const survol = useCallback((e: React.PointerEvent) => {
    if (e.pointerType === 'touch') return
    show()
  }, [show])

  /**
   * FOCUS — seulement s il est VISIBLE, c est-a-dire venu du clavier.
   *
   * Un tap et un clic souris posent eux aussi le focus : sans ce filtre, le
   * second canal rouvrait la bulle que le premier venait de fermer. Le
   * navigateur ne pose `:focus-visible` que pour une interaction clavier, c est
   * donc lui qui tranche — et le declenchement au clavier, pose le 3 juillet
   * pour l accessibilite, est preserve.
   */
  const focus = useCallback((e: React.FocusEvent) => {
    try {
      if (!(e.target as Element).matches(':focus-visible')) return
    } catch {
      // Selecteur non reconnu : on retombe sur l ancien comportement plutot que
      // de perdre l infobulle au clavier.
    }
    show()
  }, [show])

  return (
    <span ref={triggerRef} className={['inline-flex', className].filter(Boolean).join(' ')} onPointerEnter={survol} onPointerLeave={hide} onFocus={focus} onBlur={hide}>
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
