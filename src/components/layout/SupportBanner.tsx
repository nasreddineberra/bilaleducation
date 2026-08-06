'use client'

import { useState, useTransition } from 'react'
import { LifeBuoy } from 'lucide-react'
import { leaveSchool } from '@/app/superadmin/support-actions'
import { consoleUrl } from '@/lib/tenant/console-url'
import Tooltip from '@/components/ui/Tooltip'

/**
 * Rappel d'intervention de support, logé AU CENTRE DU HEADER.
 *
 * Il occupait d'abord une bande sous le header. C'était plus lisible, mais cette
 * bande prenait sa hauteur à la zone de contenu, qui défile : chaque écran
 * gagnait une barre de défilement pour la seule durée de l'intervention. Le
 * header, lui, a de la place libre entre le titre et les commandes.
 *
 * PERMANENT et non refermable, volontairement : pendant une intervention,
 * l'éditeur voit l'application exactement comme l'administrateur de l'école, et
 * plus rien à l'écran ne dit chez QUI il agit. Un rappel qu'on peut fermer serait
 * fermé au bout de trois minutes, et la garantie disparaîtrait avec lui.
 *
 * La mention du journal passe en infobulle : elle rassure, mais elle ne mérite
 * pas la largeur qu'elle prenait — le nom de l'école, si.
 */
export default function SupportBanner({ ecole }: { ecole: string }) {
  const [pending, start] = useTransition()
  const [erreur, setErreur] = useState<string | null>(null)

  const quitter = () => {
    setErreur(null)
    start(async () => {
      const res = await leaveSchool()
      if (res.error) { setErreur(res.error); return }
      // Rechargement complet et non `router.push` : le rattachement vient de
      // changer, tout ce qui a été rendu sous l'ancien état doit disparaître.
      window.location.href = consoleUrl()
    })
  }

  return (
    <div
      role="status"
      className="hidden lg:flex items-center gap-2 min-w-0 px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-500/10 border border-amber-300 dark:border-amber-500/40"
    >
      <Tooltip content="Vos actions sont enregistrées au journal de cet établissement.">
        <span className="flex items-center gap-2 min-w-0">
          <LifeBuoy className="w-3.5 h-3.5 shrink-0 text-amber-700 dark:text-amber-400" aria-hidden="true" />
          <span className="text-xs text-amber-900 dark:text-amber-200 truncate">
            <span className="font-bold uppercase tracking-wide">Support</span>
            <span className="mx-1.5" aria-hidden="true">·</span>
            <span className="font-bold">{ecole}</span>
          </span>
        </span>
      </Tooltip>

      {erreur && <span role="alert" className="text-xs font-medium text-red-700 dark:text-red-400">{erreur}</span>}

      <button
        type="button"
        onClick={quitter}
        disabled={pending}
        className="shrink-0 px-2 py-0.5 text-xs font-medium rounded-full border border-amber-400 dark:border-amber-500/60 text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-500/20 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-1 disabled:opacity-50"
      >
        {pending ? 'Fermeture…' : 'Quitter'}
      </button>
    </div>
  )
}
