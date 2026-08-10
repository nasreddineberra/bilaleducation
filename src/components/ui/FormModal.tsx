'use client'

import { useId } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

/**
 * Coque de modale de SAISIE.
 *
 * VERROUILLÉE, et c'est la règle du projet : ni clic sur le fond, ni Échap. Une
 * modale qui contient des champs ne doit pas pouvoir se fermer par accident —
 * un clic à côté effacerait la saisie sans un mot. Seuls X, Annuler et le bouton
 * de validation ferment. (Échap reste accepté sur les modales de CONFIRMATION,
 * qui n'ont rien à perdre : voir `ConfirmModal`.)
 *
 * PORTÉE DANS `<body>` : `animate-fade-in`, appliqué un peu partout, laisse un
 * `transform` sur l'élément — lequel devient alors le bloc conteneur de tout
 * `position: fixed` qu'il englobe, et le haut de la modale passe sous l'en-tête.
 * Piège déjà payé sur le cahier de texte et les financements.
 *
 * Reprend la forme de `FormModal` défini localement dans `ClassForm` — à faire
 * converger ici, ce fichier étant sa deuxième occurrence.
 */
export default function FormModal({
  title,
  onClose,
  children,
  footer,
  maxWidth = 'max-w-md',
  footerSeparator = true,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
  footer: React.ReactNode
  maxWidth?: string
  /** Filet au-dessus du pied. À désactiver quand le pied contient un CHAMP et
   *  non seulement des actions : le trait couperait alors le formulaire en deux
   *  et ferait passer la partie basse pour une autre zone. */
  footerSeparator?: boolean
}) {
  const titleId = useId()

  if (typeof document === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`bg-white rounded-2xl shadow-xl w-full ${maxWidth} flex flex-col max-h-[90vh]`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-warm-100 shrink-0">
          <h2 id={titleId} className="text-base font-bold text-secondary-800">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="p-1.5 rounded-lg hover:bg-warm-100 text-warm-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
          >
            <X size={16} />
          </button>
        </div>
        {/* Sans filet, le pied CONTINUE le formulaire : les remplissages ne
            doivent plus se cumuler, sinon un trou de 28 px s'ouvre au milieu
            des champs. On retombe alors sur le rythme de `space-y-3`. */}
        <div className={`px-5 pt-4 space-y-3 overflow-y-auto min-h-0 ${footerSeparator ? 'pb-4' : 'pb-3'}`}>
          {children}
        </div>
        <div className={`flex items-center gap-2 px-5 pb-4 shrink-0${footerSeparator ? ' pt-3 border-t border-warm-100' : ' pt-0'}`}>
          {footer}
        </div>
      </div>
    </div>,
    document.body,
  )
}
