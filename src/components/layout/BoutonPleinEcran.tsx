'use client'

import { useEffect, useState } from 'react'
import { Maximize2, Minimize2 } from 'lucide-react'
import Tooltip from '@/components/ui/Tooltip'

/**
 * Passage en plein ecran (28/10) : dans la partie blanche de la barre du haut,
 * a gauche de la zone compte, sur ordinateur seulement.
 *
 * L'etat suit l'evenement `fullscreenchange` : Echap (gere par le navigateur)
 * fait aussi sortir, et l'icone suit. Rien n'est enregistre.
 * Rendu seulement apres le montage : la prise en charge du plein ecran ne se
 * connait qu'au navigateur (sans cela, ecart d'hydratation), et un navigateur
 * qui ne l'offre pas n'a pas de bouton.
 */
export default function BoutonPleinEcran({ className }: { className?: string }) {
  const [possible, setPossible] = useState(false)
  const [plein, setPlein] = useState(false)

  useEffect(() => {
    setPossible(!!document.fullscreenEnabled)
    const suivre = () => setPlein(!!document.fullscreenElement)
    suivre()
    document.addEventListener('fullscreenchange', suivre)
    return () => document.removeEventListener('fullscreenchange', suivre)
  }, [])

  if (!possible) return null

  const libelle = plein ? 'Quitter le plein écran' : 'Plein écran'
  const basculer = () => {
    const action = plein ? document.exitFullscreen() : document.documentElement.requestFullscreen()
    action.catch(() => { /* refuse par le navigateur : l'etat reste celui de l'evenement */ })
  }

  return (
    <Tooltip content={libelle} position="bottom">
      <button
        type="button"
        onClick={basculer}
        aria-label={libelle}
        aria-pressed={plein}
        className={`flex items-center justify-center w-9 h-9 rounded-lg text-warm-700 dark:text-[#8b9aa0] hover:bg-warm-100 dark:hover:bg-white/10 transition-colors motion-reduce:transition-none outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-focus)] ${className ?? ''}`}
      >
        {plein ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
      </button>
    </Tooltip>
  )
}
