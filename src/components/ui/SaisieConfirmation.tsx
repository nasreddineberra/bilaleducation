'use client'

import { useEffect, useRef } from 'react'
import { FloatInput } from '@/components/ui/FloatFields'
import { frappeAcceptable } from '@/lib/texte/saisie-confirmation'

/**
 * Champ ou l'on RETAPE un mot-cle, un nom ou un slug avant une action grave
 * (decision du 28/10). Collage, glisser-deposer et texte propose par le
 * navigateur ou le clavier du telephone sont refuses : la saisie se tape.
 * Une frappe qui mettrait une espace en tete ou deux espaces de suite est
 * ignoree ; l'espace finale est retiree en quittant le champ. La conformite
 * se juge par `saisieConforme` (lib/texte/saisie-confirmation).
 */

/** Insertions qui ne viennent pas de la frappe (presse-papiers, depot, correcteur). */
const INSERTIONS_REFUSEES = new Set([
  'insertFromPaste',
  'insertFromPasteAsQuotation',
  'insertFromDrop',
  'insertFromYank',
  'insertReplacementText',
])

export default function SaisieConfirmation({ label, valeur, onChange, libelleMasque, autoFocus }: {
  label: string
  valeur: string
  onChange: (valeur: string) => void
  libelleMasque?: boolean
  autoFocus?: boolean
}) {
  const champ = useRef<HTMLInputElement>(null)

  // `beforeinput` natif : seul evenement qui dit d'OU vient l'insertion
  // (l'evenement synthetique de React ne porte pas `inputType`).
  useEffect(() => {
    const input = champ.current
    if (!input) return
    const filtrer = (e: InputEvent) => {
      if (INSERTIONS_REFUSEES.has(e.inputType)) e.preventDefault()
    }
    input.addEventListener('beforeinput', filtrer)
    return () => input.removeEventListener('beforeinput', filtrer)
  }, [])

  return (
    <FloatInput
      ref={champ}
      label={label}
      libelleMasque={libelleMasque}
      value={valeur}
      onChange={e => { if (frappeAcceptable(e.target.value)) onChange(e.target.value) }}
      onBlur={() => { if (valeur.endsWith(' ')) onChange(valeur.trimEnd()) }}
      onPaste={e => e.preventDefault()}
      onDrop={e => e.preventDefault()}
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="off"
      spellCheck={false}
      autoFocus={autoFocus}
    />
  )
}
