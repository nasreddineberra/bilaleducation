'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { CircleHelp, ExternalLink, X } from 'lucide-react'
import Tooltip from '@/components/ui/Tooltip'
import { procedureDeLaPage } from '@/lib/aide'
import ContenuProcedure from './ContenuProcedure'

/**
 * Aide de l'ecran en cours (02/11) : icone « ? » de la barre du haut, qui ouvre
 * un TIROIR superpose au bord droit. Le tiroir passe PAR-DESSUS l'ecran, il ne
 * le pousse pas : aucune page n'a ete concue pour perdre 420 px de largeur.
 * Pour suivre une longue procedure en manipulant, « Ouvrir dans un onglet ».
 *
 * Masque quand l'ecran n'a pas (encore) de procedure pour ce role. Porte dans
 * `<body>` (piege du `transform` de `animate-fade-in`) ; `role="dialog"` le
 * place sous le pont du theme sombre. Ni fond ni verrou : l'ecran derriere reste
 * utilisable. Echap ferme (rien a perdre).
 */
export default function BoutonAide({ role }: { role: string | null | undefined }) {
  const pathname = usePathname()
  const procedure = procedureDeLaPage(pathname, role)
  const [ouvert, setOuvert] = useState(false)
  const bouton = useRef<HTMLButtonElement>(null)
  const panneau = useRef<HTMLDivElement>(null)
  const titreId = useId()

  // Changement de page : le tiroir decrivait l'ecran precedent.
  useEffect(() => { setOuvert(false) }, [pathname])

  useEffect(() => {
    if (!ouvert) return
    panneau.current?.focus()
    const echap = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOuvert(false); bouton.current?.focus() }
    }
    document.addEventListener('keydown', echap)
    return () => document.removeEventListener('keydown', echap)
  }, [ouvert])

  if (!procedure) return null
  const fermer = () => { setOuvert(false); bouton.current?.focus() }

  return (
    <>
      <Tooltip content="Aide de cet écran" position="bottom">
        <button
          ref={bouton}
          type="button"
          onClick={() => setOuvert(v => !v)}
          aria-label="Aide de cet écran"
          aria-expanded={ouvert}
          className="flex items-center justify-center w-9 h-9 rounded-lg text-warm-700 dark:text-[#8b9aa0] hover:bg-warm-100 dark:hover:bg-white/10 transition-colors motion-reduce:transition-none outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-focus)]"
        >
          <CircleHelp size={18} />
        </button>
      </Tooltip>

      {ouvert && typeof document !== 'undefined' && createPortal(
        <div
          ref={panneau}
          role="dialog"
          aria-modal="false"
          aria-labelledby={titreId}
          tabIndex={-1}
          className="fixed top-0 right-0 z-50 h-ecran w-full sm:w-[420px] flex flex-col bg-white border-l border-[var(--card-border)] shadow-2xl outline-none animate-fade-in"
        >
          <div className="flex items-center gap-2 px-4 py-3 border-b border-warm-100 shrink-0">
            <h2 id={titreId} className="flex-1 min-w-0 truncate text-base font-bold text-secondary-800">
              Aide · {procedure.titre}
            </h2>
            <Tooltip content="Ouvrir dans un onglet" position="bottom">
              <a
                href={`/dashboard/aide/${procedure.slug}`}
                target="_blank"
                rel="noopener"
                aria-label="Ouvrir dans un onglet"
                className="p-1.5 rounded-lg hover:bg-warm-100 text-warm-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-focus)]"
              >
                <ExternalLink size={16} />
              </a>
            </Tooltip>
            <button
              type="button"
              onClick={fermer}
              aria-label="Fermer"
              className="p-1.5 rounded-lg hover:bg-warm-100 text-warm-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-focus)]"
            >
              <X size={16} />
            </button>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto list-scroll px-4 py-4">
            <ContenuProcedure procedure={procedure} compact />
          </div>
          <div className="px-4 py-2.5 border-t border-warm-100 shrink-0 text-xs">
            <Link href="/dashboard/aide" className="text-[var(--brand-surface)] dark:text-[var(--brand-accent)] font-medium hover:underline">
              Toutes les procédures
            </Link>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
