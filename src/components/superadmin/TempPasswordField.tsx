'use client'

import { useState } from 'react'
import { Copy, Check, RefreshCw } from 'lucide-react'
import { generateTempPassword } from '@/lib/validation/generate-password'
import Tooltip from '@/components/ui/Tooltip'

/**
 * Champ de mot de passe temporaire : saisie libre, régénération et copie.
 *
 * PAS DE BOUTON ŒIL, et ce n'est pas un oubli. Masquer sert à protéger SON
 * propre mot de passe des regards ; ici l'éditeur ouvre un compte pour quelqu'un
 * d'AUTRE et doit lui transmettre ces douze caractères. Le masquer l'obligerait
 * à le dévoiler à chaque fois — un geste de plus pour aucune protection.
 *
 * La copie compte autant que la génération : sans elle, il faudrait relire douze
 * caractères à l'écran pour les retaper dans un message, et c'est précisément là
 * que les erreurs se glissent.
 */
export default function TempPasswordField({
  value,
  onChange,
  disabled = false,
  compact = false,
}: {
  value: string
  onChange: (v: string) => void
  disabled?: boolean
  compact?: boolean
}) {
  const [copie, setCopie] = useState(false)

  const generer = () => {
    onChange(generateTempPassword(12))
    setCopie(false)
  }

  const copier = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopie(true)
      setTimeout(() => setCopie(false), 2000)
    } catch {
      // Presse-papiers refusé (contexte non sécurisé, permission) : le mot de
      // passe reste lisible à l'écran, on ne bloque rien.
    }
  }

  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        autoComplete="off"
        spellCheck={false}
        placeholder="12 caractères"
        aria-label="Mot de passe temporaire"
        className={`input w-full pr-16 font-mono tracking-tight ${compact ? 'text-sm py-1.5' : ''}`}
      />
      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
        <Tooltip content={copie ? 'Copié' : 'Copier'}>
          <button
            type="button"
            onClick={copier}
            disabled={!value}
            aria-label="Copier le mot de passe"
            className="text-warm-700 hover:text-secondary-700 transition-colors disabled:opacity-40 rounded outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
          >
            {copie ? <Check size={14} className="text-primary-600" /> : <Copy size={14} />}
          </button>
        </Tooltip>
        <Tooltip content="Générer un mot de passe de 12 caractères">
          <button
            type="button"
            onClick={generer}
            disabled={disabled}
            aria-label="Générer un mot de passe temporaire"
            className="text-warm-700 hover:text-primary-600 transition-colors rounded outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
          >
            <RefreshCw size={14} />
          </button>
        </Tooltip>
      </div>
    </div>
  )
}
