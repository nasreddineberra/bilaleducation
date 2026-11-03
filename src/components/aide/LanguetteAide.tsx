'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { clsx } from 'clsx'
import { ChevronLeft, ChevronRight, CircleHelp, ExternalLink, X } from 'lucide-react'
import Tooltip from '@/components/ui/Tooltip'
import { procedureDeLaPage } from '@/lib/aide'
import type { OptionsEcole } from '@/lib/aide/types'
import ContenuProcedure from './ContenuProcedure'

/** Le panneau commence SOUS la barre du haut (61 px) : il ne recouvre jamais la zone profil. */
const HAUT_PANNEAU = 'top-[61px]'
/** Languette a la hauteur de la premiere ligne de la page (marge haute de 20 px). */
const HAUT_LANGUETTE = 'top-5'

/**
 * Aide de l'ecran en cours (02/11) : un INTERCALAIRE au bord droit de la page.
 *
 * Au repos, seule la languette « ? » depasse, a la hauteur de la premiere ligne
 * de la page ; elle loge dans la marge droite (32 px sur ordinateur), donc ne
 * recouvre aucun bouton. Un clic fait COULISSER le panneau de droite a gauche,
 * la languette accrochee a son bord ; un second clic le RANGE. Le panneau passe
 * PAR-DESSUS l'ecran, il ne le pousse pas : aucune page ne perd de largeur. Il
 * commence sous la barre du haut : la zone profil reste visible et utilisable.
 *
 * Signal d'arrivee (3 pulsations) la PREMIERE fois que l'ecran est ouvert dans
 * la session (`sessionStorage`), coupe si le systeme demande moins d'animations.
 * Masquee quand l'ecran n'a pas de procedure pour ce role. Portee dans `<body>` ;
 * le panneau porte `role="dialog"` (pont du theme sombre) et devient `inert`
 * une fois range. Echap range aussi.
 */
export default function LanguetteAide({ role, options }: { role: string | null | undefined; options: OptionsEcole }) {
  const pathname = usePathname()
  const procedure = procedureDeLaPage(pathname, role, options)
  const [monte, setMonte] = useState(false)
  const [ouvert, setOuvert] = useState(false)
  const [signal, setSignal] = useState(false)
  const languette = useRef<HTMLButtonElement>(null)
  const panneau = useRef<HTMLDivElement>(null)
  const titreId = useId()
  const panneauId = useId()
  const slug = procedure?.slug ?? null

  useEffect(() => { setMonte(true) }, [])

  // Changement de page : le panneau decrivait l'ecran precedent. Premiere visite
  // de l'ecran dans la session : la languette se signale.
  useEffect(() => {
    setOuvert(false)
    if (!slug) return
    let premiere = false
    try {
      const cle = `aide-vue:${slug}`
      premiere = !sessionStorage.getItem(cle)
      if (premiere) sessionStorage.setItem(cle, '1')
    } catch { /* stockage indisponible : pas de signal */ }
    setSignal(premiere)
  }, [pathname, slug])

  useEffect(() => {
    if (!ouvert) return
    panneau.current?.focus()
    const echap = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOuvert(false); languette.current?.focus() }
    }
    document.addEventListener('keydown', echap)
    return () => document.removeEventListener('keydown', echap)
  }, [ouvert])

  if (!monte || !procedure) return null
  const ranger = () => { setOuvert(false); languette.current?.focus() }
  const libelle = ouvert ? 'Ranger l’aide' : 'Aide de cet écran'

  return createPortal(
    <div
      className={clsx(
        'fixed right-0 bottom-0 z-50 w-full sm:w-[420px] transition-transform duration-300 ease-out motion-reduce:transition-none',
        HAUT_PANNEAU,
        ouvert ? 'translate-x-0' : 'translate-x-full',
      )}
    >
      {/* Languette : accrochee au bord GAUCHE du panneau, elle depasse dans la
          page quand il est range. 16 px sous 1024 px (marge de page plus
          etroite), 24 px au-dela. */}
      <Tooltip content={<span className="whitespace-nowrap">{libelle}</span>} position="left" maxWidth="max-w-none" className={clsx('absolute right-full', HAUT_LANGUETTE)}>
        <button
          ref={languette}
          type="button"
          onClick={() => { setSignal(false); setOuvert(v => !v) }}
          onAnimationEnd={() => setSignal(false)}
          aria-label={libelle}
          aria-expanded={ouvert}
          aria-controls={panneauId}
          className={clsx(
            // Hauteur 34 px sur ordinateur : celle des champs et encadres compacts de la
            // premiere ligne des pages (`card px-3 py-1.5`, champs `bordure`).
            'flex flex-col lg:flex-row items-center justify-center gap-0.5 lg:gap-0 w-4 h-14 lg:w-[30px] lg:h-[34px] rounded-l-lg border border-r-0 shadow-md outline-none transition-colors',
            // Rangee : vert de marque. Deroulee : orange dore de la charte, vif, pour
            // se reperer d'un coup d'oeil ; encre foncee dessus (contraste). Filet fin
            // aux couleurs INVERSEES : orange sur la languette verte, vert sur l'orange.
            ouvert
              ? 'bg-amber-500 text-secondary-800 border-[var(--brand-surface)]'
              : 'bg-[var(--brand-surface)] text-white border-amber-500 dark:bg-[var(--brand-accent)] dark:text-[var(--brand-surface-2)]',
            'focus-visible:ring-2 focus-visible:ring-[var(--brand-focus)]',
            signal && 'languette-signal',
          )}
        >
          {/* Chevron du cote du geste : a GAUCHE du « ? » pour tirer le panneau, a
              DROITE pour le repousser. Sur ordinateur, cote a cote (la languette
              tient dans la marge de 32 px) ; en dessous, empiles (16 px de large). */}
          {!ouvert && <ChevronLeft className="w-3 h-3 lg:w-3.5 lg:h-3.5 shrink-0" aria-hidden="true" />}
          <CircleHelp className="w-3.5 h-3.5 lg:w-4 lg:h-4 shrink-0" aria-hidden="true" />
          {ouvert && <ChevronRight className="w-3 h-3 lg:w-3.5 lg:h-3.5 shrink-0" aria-hidden="true" />}
        </button>
      </Tooltip>

      <div
        ref={panneau}
        id={panneauId}
        role="dialog"
        aria-modal="false"
        aria-labelledby={titreId}
        aria-hidden={!ouvert}
        inert={!ouvert}
        tabIndex={-1}
        className="h-full flex flex-col bg-white border-l border-[var(--card-border)] shadow-2xl outline-none"
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
            onClick={ranger}
            aria-label="Ranger l’aide"
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
      </div>
    </div>,
    document.body,
  )
}
