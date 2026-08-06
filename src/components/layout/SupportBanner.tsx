'use client'

import { useState, useTransition } from 'react'
import { LifeBuoy } from 'lucide-react'
import { leaveSchool } from '@/app/superadmin/support-actions'
import { consoleUrl } from '@/lib/tenant/console-url'

/**
 * Bandeau d'intervention de support.
 *
 * PERMANENT et non refermable, volontairement : pendant une intervention,
 * l'éditeur voit l'application exactement comme l'administrateur de l'école, et
 * plus rien à l'écran ne dit chez QUI il agit. Un bandeau qu'on peut fermer
 * serait fermé au bout de trois minutes, et la garantie disparaîtrait avec lui.
 *
 * Il porte aussi la sortie : la console reste la sortie garantie — accessible
 * même après une session interrompue — mais elle est sur un autre sous-domaine,
 * et obliger à y retourner pour refermer serait un aller-retour inutile.
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
      className="flex items-center gap-3 px-8 py-2 bg-amber-50 dark:bg-amber-500/10 border-b border-amber-300 dark:border-amber-500/40"
    >
      <LifeBuoy className="w-4 h-4 shrink-0 text-amber-700 dark:text-amber-400" aria-hidden="true" />
      <p className="text-xs text-amber-900 dark:text-amber-200 min-w-0">
        <span className="font-bold uppercase tracking-wide">Intervention de support</span>
        <span className="mx-2" aria-hidden="true">·</span>
        vous agissez sur <span className="font-bold">{ecole}</span>. Vos actions sont enregistrées au journal de cet établissement.
      </p>

      {erreur && <span role="alert" className="text-xs font-medium text-red-700 dark:text-red-400">{erreur}</span>}

      <button
        type="button"
        onClick={quitter}
        disabled={pending}
        className="ml-auto shrink-0 px-3 py-1 text-xs font-medium rounded-md border border-amber-400 dark:border-amber-500/60 text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-500/20 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-1 disabled:opacity-50"
      >
        {pending ? 'Fermeture…' : "Quitter l'intervention"}
      </button>
    </div>
  )
}
