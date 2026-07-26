'use client'

import { useEffect, useRef } from 'react'
import type { ChangeEvent, ClipboardEvent, KeyboardEvent } from 'react'
import { clsx } from 'clsx'

interface OtpInputProps {
  value: string
  onChange: (v: string) => void
  /** Appelé automatiquement dès que les N chiffres sont saisis. */
  onComplete?: (v: string) => void
  length?: number
  disabled?: boolean
  error?: boolean
  autoFocus?: boolean
  ariaLabel?: string
}

/**
 * Saisie de code à usage unique : N cases d'un seul chiffre.
 * - saisie d'un chiffre → avance automatiquement à la case suivante ;
 * - Backspace → efface la case (ou revient à la précédente si vide) ;
 * - flèches ← → pour naviguer ; collage d'un code réparti sur les cases ;
 * - validation AUTO via `onComplete` dès la dernière case remplie.
 */
export default function OtpInput({
  value, onChange, onComplete, length = 6, disabled = false, error = false,
  autoFocus = true, ariaLabel = 'Code de vérification',
}: OtpInputProps) {
  const refs = useRef<(HTMLInputElement | null)[]>([])
  const digits = Array.from({ length }, (_, i) => value[i] ?? '')

  // Focus initial + refocus sur la 1re case quand la valeur est réinitialisée
  // (ex. après une erreur, le parent remet `value` à '').
  useEffect(() => {
    if (autoFocus && value === '') refs.current[0]?.focus()
  }, [autoFocus, value])

  const emit = (arr: string[]) => {
    const v = arr.join('')
    onChange(v)
    if (v.length === length && arr.every(d => d !== '')) onComplete?.(v)
  }

  const setAt = (i: number, d: string) => {
    const arr = Array.from({ length }, (_, k) => value[k] ?? '')
    arr[i] = d
    emit(arr)
  }

  const handleChange = (i: number, e: ChangeEvent<HTMLInputElement>) => {
    const d = e.target.value.replace(/\D/g, '').slice(-1)
    if (!d) { setAt(i, ''); return }
    setAt(i, d)
    if (i < length - 1) refs.current[i + 1]?.focus()
  }

  const handleKeyDown = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault()
      if (digits[i]) setAt(i, '')
      else if (i > 0) { setAt(i - 1, ''); refs.current[i - 1]?.focus() }
    } else if (e.key === 'ArrowLeft' && i > 0) {
      e.preventDefault(); refs.current[i - 1]?.focus()
    } else if (e.key === 'ArrowRight' && i < length - 1) {
      e.preventDefault(); refs.current[i + 1]?.focus()
    }
  }

  const handlePaste = (i: number, e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length - i)
    if (!text) return
    const arr = Array.from({ length }, (_, k) => value[k] ?? '')
    for (let k = 0; k < text.length; k++) arr[i + k] = text[k]
    emit(arr)
    refs.current[Math.min(i + text.length, length - 1)]?.focus()
  }

  return (
    <div className="flex justify-center gap-2 sm:gap-2.5" role="group" aria-label={ariaLabel}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={el => { refs.current[i] = el }}
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          value={d}
          disabled={disabled}
          aria-label={`Chiffre ${i + 1} sur ${length}`}
          onChange={e => handleChange(i, e)}
          onKeyDown={e => handleKeyDown(i, e)}
          onPaste={e => handlePaste(i, e)}
          onFocus={e => e.currentTarget.select()}
          className={clsx(
            'w-11 h-14 sm:w-12 rounded-xl border-2 text-center text-2xl font-bold tabular-nums',
            'text-secondary-800 dark:text-[#e7eef0] outline-none transition-colors',
            'focus:ring-2 focus:ring-primary-500/30 disabled:opacity-60 disabled:cursor-not-allowed',
            error
              ? 'border-danger-400 focus:border-danger-500'
              : d
                ? 'border-primary-400 bg-primary-50/40 dark:bg-primary-500/15 focus:border-primary-500'
                : 'border-warm-200 bg-white dark:border-[#2c3a42] dark:bg-[#1a252b] focus:border-primary-500',
          )}
        />
      ))}
    </div>
  )
}
