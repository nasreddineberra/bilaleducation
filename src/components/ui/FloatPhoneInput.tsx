'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'
import { BORDURE_LABEL, BORDURE_HAUT } from './FloatFields'

// ─── Country codes ────────────────────────────────────────────────────────────

export const COUNTRY_CODES = [
  { code: '+33',  iso: 'fr', name: 'France'           },
  { code: '+32',  iso: 'be', name: 'Belgique'         },
  { code: '+41',  iso: 'ch', name: 'Suisse'           },
  { code: '+213', iso: 'dz', name: 'Algérie'          },
  { code: '+212', iso: 'ma', name: 'Maroc'            },
  { code: '+216', iso: 'tn', name: 'Tunisie'          },
  { code: '+221', iso: 'sn', name: 'Sénégal'          },
  { code: '+223', iso: 'ml', name: 'Mali'             },
  { code: '+225', iso: 'ci', name: "Côte d'Ivoire"    },
  { code: '+20',  iso: 'eg', name: 'Égypte'           },
  { code: '+90',  iso: 'tr', name: 'Turquie'          },
  { code: '+44',  iso: 'gb', name: 'Royaume-Uni'      },
  { code: '+49',  iso: 'de', name: 'Allemagne'        },
  { code: '+34',  iso: 'es', name: 'Espagne'          },
  { code: '+39',  iso: 'it', name: 'Italie'           },
]

const flagUrl = (iso: string) => `https://flagcdn.com/w20/${iso}.png`

// ─── FloatPhoneInput ──────────────────────────────────────────────────────────

export interface FloatPhoneInputProps {
  label?:          string
  codeValue:       string
  numberValue:     string
  onCodeChange:    (v: string) => void
  onNumberChange:  (v: string) => void
  error?:          string
}

export function FloatPhoneInput({
  label = 'Téléphone',
  codeValue,
  numberValue,
  onCodeChange,
  onNumberChange,
  error,
}: FloatPhoneInputProps) {
  const [open,    setOpen]    = useState(false)
  const [focused, setFocused] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const selected = COUNTRY_CODES.find(c => c.code === codeValue) ?? COUNTRY_CODES[0]

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node))
        setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div className="relative">
      {/* Wrapper avec bordure unifiée */}
      <div className={[
        'flex rounded-lg border transition-all duration-200',
        focused
          ? 'border-primary-400 ring-2 ring-primary-400/20'
          : error
            ? 'border-red-400'
            : 'border-warm-300',
      ].join(' ')}>

        {/* Sélecteur indicatif */}
        <div ref={dropdownRef} className="relative flex-shrink-0">
          <button
            type="button"
            onClick={() => setOpen(v => !v)}
            className="h-full flex items-center gap-1.5 px-3 border-r border-warm-200 rounded-l-lg bg-white hover:bg-warm-50 transition-colors select-none whitespace-nowrap"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={flagUrl(selected.iso)} alt={selected.name} className="w-5 h-auto rounded-sm flex-shrink-0" />
            <span className="text-xs text-secondary-700 font-mono">{selected.code}</span>
            <ChevronDown size={12} className="text-warm-700" />
          </button>

          {open && (
            <div className="absolute top-full left-0 mt-1.5 z-50 bg-white border border-warm-200 rounded-lg shadow-lg overflow-y-auto max-h-52 w-52 py-1">
              {COUNTRY_CODES.map(c => (
                <button
                  key={c.code}
                  type="button"
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => { onCodeChange(c.code); setOpen(false) }}
                  className={[
                    'w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors',
                    c.code === codeValue
                      ? 'bg-primary-50 text-primary-700'
                      : 'hover:bg-warm-50 text-secondary-700',
                  ].join(' ')}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={flagUrl(c.iso)} alt={c.name} className="w-5 h-auto rounded-sm flex-shrink-0" />
                  <span className="font-mono text-xs w-10 flex-shrink-0">{c.code}</span>
                  <span className="text-xs truncate">{c.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Champ numéro. Le libellé est posé sur le trait du cadre (modèle
            « bordure » de la charte), au-dessus du sélecteur d'indicatif : il
            reste toujours en haut, l'indicatif occupant déjà le champ. */}
        <div className="relative flex-1 min-w-0">
          <input
            type="text"
            inputMode="numeric"
            value={numberValue}
            onChange={e => onNumberChange(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            className="w-full px-3 py-1.5 text-sm text-gray-800 bg-white rounded-r-lg focus:outline-none"
          />
        </div>

      </div>
      <label className={[
        'absolute pointer-events-none select-none',
        BORDURE_LABEL, BORDURE_HAUT,
        error ? 'text-red-500' : focused ? 'text-primary-600' : 'text-warm-700',
      ].join(' ')}>
        {label}
      </label>
      {error && <p className="mt-0.5 text-xs text-red-500">{error}</p>}
    </div>
  )
}
