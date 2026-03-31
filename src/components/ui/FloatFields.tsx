'use client'

import { useState } from 'react'
import { Loader2, Search, X } from 'lucide-react'

// ─── FloatInput ───────────────────────────────────────────────────────────────

export interface FloatInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label:     string
  required?: boolean
  error?:    string
  locked?:   boolean
  compact?:  boolean
}

export function FloatInput({ label, required, error, locked, compact, className, type, onFocus, onBlur, ...props }: FloatInputProps) {
  const isDate = type === 'date'
  // Pour les champs date : afficher type="text" quand vide et non focusé
  // afin de masquer le placeholder navigateur (jj/mm/aaaa)
  const [focused, setFocused] = useState(false)
  const effectiveType = isDate && !props.value && !focused ? 'text' : type

  return (
    <div className="relative">
      <input
        {...props}
        type={effectiveType}
        placeholder=" "
        disabled={locked}
        onFocus={e => { setFocused(true); onFocus?.(e) }}
        onBlur={e => { setFocused(false); onBlur?.(e) }}
        className={[
          'peer w-full px-3 rounded-lg border text-sm',
          compact ? 'pt-4 pb-1' : 'pt-5 pb-1.5',
          'transition-all duration-200',
          'focus:outline-none focus:ring-2',
          locked
            ? 'bg-warm-100 text-warm-400 cursor-default border-warm-200 focus:ring-0 focus:border-warm-200 opacity-75'
            : error
              ? 'bg-white text-gray-800 border-red-400 focus:border-red-400 focus:ring-red-400/20'
              : 'bg-white text-gray-800 border-warm-300 focus:border-primary-400 focus:ring-primary-400/20',
          className ?? '',
        ].join(' ')}
      />
      <label className={[
        'absolute left-3 transition-all duration-200 pointer-events-none select-none origin-left',
        compact ? 'top-2.5 text-xs' : 'top-3.5 text-sm',
        compact
          ? 'peer-focus:top-1 peer-focus:text-[10px] peer-focus:font-semibold peer-focus:tracking-wide peer-focus:uppercase peer-[&:not(:placeholder-shown)]:top-1 peer-[&:not(:placeholder-shown)]:text-[10px] peer-[&:not(:placeholder-shown)]:font-semibold peer-[&:not(:placeholder-shown)]:tracking-wide peer-[&:not(:placeholder-shown)]:uppercase'
          : 'peer-focus:top-1.5 peer-focus:text-[10px] peer-focus:font-semibold peer-focus:tracking-wide peer-focus:uppercase peer-[&:not(:placeholder-shown)]:top-1.5 peer-[&:not(:placeholder-shown)]:text-[10px] peer-[&:not(:placeholder-shown)]:font-semibold peer-[&:not(:placeholder-shown)]:tracking-wide peer-[&:not(:placeholder-shown)]:uppercase',
        locked
          ? 'text-warm-400'
          : error
            ? 'text-red-500 peer-focus:text-red-500'
            : 'text-warm-400 peer-focus:text-primary-600 peer-[&:not(:placeholder-shown)]:text-warm-500',
      ].join(' ')}>
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {error && <p className="mt-0.5 text-xs text-red-500">{error}</p>}
    </div>
  )
}

// ─── FloatSelect ──────────────────────────────────────────────────────────────

export interface FloatSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label:             string
  required?:         boolean
  error?:            string
  children:          React.ReactNode
  wrapperClassName?: string
  compact?:          boolean
}

export function FloatSelect({ label, required, error, children, className, wrapperClassName, compact, ...props }: FloatSelectProps) {
  const hasValue = !!props.value && props.value !== ''
  return (
    <div className={['relative', wrapperClassName].filter(Boolean).join(' ')}>
      <select
        {...props}
        className={[
          'peer w-full px-3 rounded-lg border text-sm text-gray-800',
          compact ? 'pt-4 pb-1' : 'pt-5 pb-1.5',
          'bg-white transition-all duration-200 appearance-none',
          'focus:outline-none focus:ring-2',
          error
            ? 'border-red-400 focus:border-red-400 focus:ring-red-400/20'
            : 'border-warm-300 focus:border-primary-400 focus:ring-primary-400/20',
          className ?? '',
        ].join(' ')}
      >
        {children}
      </select>
      {/* Flèche custom */}
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-warm-400">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </span>
      <label className={[
        'absolute left-3 transition-all duration-200 pointer-events-none select-none origin-left',
        hasValue
          ? compact ? 'top-1 text-[10px] font-semibold tracking-wide uppercase' : 'top-1.5 text-[10px] font-semibold tracking-wide uppercase'
          : compact ? 'top-2.5 text-xs' : 'top-3.5 text-sm',
        compact
          ? 'peer-focus:top-1 peer-focus:text-[10px] peer-focus:font-semibold peer-focus:tracking-wide peer-focus:uppercase'
          : 'peer-focus:top-1.5 peer-focus:text-[10px] peer-focus:font-semibold peer-focus:tracking-wide peer-focus:uppercase',
        error
          ? 'text-red-500'
          : hasValue
            ? 'text-warm-500'
            : 'text-warm-400 peer-focus:text-primary-600',
      ].join(' ')}>
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {error && <p className="mt-0.5 text-xs text-red-500">{error}</p>}
    </div>
  )
}

// ─── FloatTextarea ────────────────────────────────────────────────────────────

export interface FloatTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label:     string
  required?: boolean
  error?:    string
}

export function FloatTextarea({ label, required, error, className, placeholder, onFocus, onBlur, ...props }: FloatTextareaProps) {
  const [focused, setFocused] = useState(false)
  const hasValue = !!props.value || !!props.defaultValue
  const labelUp = focused || hasValue

  return (
    <div className="relative">
      <textarea
        {...props}
        // Quand vide et non focusé : espace pour déclencher peer-not-placeholder-shown=false
        // Quand focusé : on affiche le vrai placeholder descriptif
        placeholder={focused ? (placeholder ?? ' ') : ' '}
        onFocus={e => { setFocused(true); onFocus?.(e) }}
        onBlur={e => { setFocused(false); onBlur?.(e) }}
        className={[
          'peer w-full px-3 pt-7 pb-2 rounded-lg border text-sm text-gray-800',
          'bg-white transition-all duration-200 resize-none',
          'focus:outline-none focus:ring-2',
          error
            ? 'border-red-400 focus:border-red-400 focus:ring-red-400/20'
            : 'border-warm-300 focus:border-primary-400 focus:ring-primary-400/20',
          className ?? '',
        ].join(' ')}
      />
      <label className={[
        'absolute left-3 pointer-events-none select-none origin-left transition-all duration-200',
        labelUp
          ? 'top-1.5 text-[10px] font-semibold tracking-wide uppercase'
          : 'top-4 text-sm',
        error
          ? 'text-red-500'
          : labelUp
            ? focused ? 'text-primary-600' : 'text-warm-500'
            : 'text-warm-400',
      ].join(' ')}>
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {error && <p className="mt-0.5 text-xs text-red-500">{error}</p>}
    </div>
  )
}

// ─── FloatCheckbox ────────────────────────────────────────────────────────────
// variant "card"    : carte turquoise, pour les cases à cocher de formulaire
// variant "danger-card" : carte rouge, pour PAI et options sensibles
// variant "switch"  : toggle on/off avec label dynamique
// variant "compact" : inline sans carte, pour les petits contrôles dans les en-têtes

export interface FloatCheckboxProps {
  label:        string
  checked:      boolean
  onChange:     (checked: boolean) => void
  variant?:     'card' | 'danger-card' | 'switch' | 'compact'
  hint?:        string
  disabled?:    boolean
  activeLabel?: string   // label affiché quand checked (switch uniquement)
  inactiveLabel?: string // label affiché quand !checked (switch uniquement)
  className?:   string
}

const CHECK_ICON = (
  <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
    <path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

export function FloatCheckbox({
  label,
  checked,
  onChange,
  variant = 'card',
  hint,
  disabled,
  activeLabel,
  inactiveLabel,
  className,
}: FloatCheckboxProps) {

  // ── Switch (toggle) ──
  if (variant === 'switch') {
    const displayLabel = checked
      ? (activeLabel ?? label)
      : (inactiveLabel ?? label)
    return (
      <label className={[
        'flex items-center gap-2 select-none',
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
      ].join(' ')}>
        <span className={[
          'relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent',
          'transition-colors duration-200',
          checked ? 'bg-primary-500' : 'bg-warm-300',
        ].join(' ')}>
          <span className={[
            'inline-block h-4 w-4 rounded-full bg-white shadow',
            'transform transition-transform duration-200',
            checked ? 'translate-x-4' : 'translate-x-0',
          ].join(' ')} />
        </span>
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={e => onChange(e.target.checked)}
          className="sr-only"
        />
        <span className={[
          'text-xs font-semibold uppercase tracking-wide',
          checked ? 'text-primary-600' : 'text-warm-400',
        ].join(' ')}>
          {displayLabel}
        </span>
      </label>
    )
  }

  // ── Compact (inline sans carte) ──
  if (variant === 'compact') {
    return (
      <label className={[
        'flex items-center gap-1.5 select-none',
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
        className ?? '',
      ].join(' ')}>
        <span className={[
          'flex-shrink-0 w-3.5 h-3.5 rounded border-2 flex items-center justify-center transition-colors',
          checked ? 'bg-primary-500 border-primary-500' : 'border-warm-300 bg-white',
        ].join(' ')}>
          {checked && (
            <svg width="7" height="5.5" viewBox="0 0 9 7" fill="none">
              <path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </span>
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={e => onChange(e.target.checked)}
          className="sr-only"
        />
        {label && <span className="text-xs text-warm-400 select-none">{label}</span>}
      </label>
    )
  }

  // ── Danger-card (rouge) ──
  if (variant === 'danger-card') {
    return (
      <label className={[
        'flex items-center gap-2.5 px-3 py-2.5 rounded-lg border cursor-pointer transition-all duration-200 select-none',
        checked ? 'bg-red-50 border-red-300 shadow-sm' : 'border-warm-200 hover:border-warm-300 hover:bg-warm-50',
      ].join(' ')}>
        <span className={[
          'flex-shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition-colors',
          checked ? 'bg-red-500 border-red-500' : 'border-warm-300 bg-white',
        ].join(' ')}>
          {checked && CHECK_ICON}
        </span>
        <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="sr-only" />
        <span className="text-sm font-medium text-secondary-700">{label}</span>
        {hint && (
          <span title={hint} className="ml-auto inline-flex items-center justify-center w-4 h-4 rounded-full bg-warm-200 text-warm-500 text-[10px] font-bold cursor-help">?</span>
        )}
      </label>
    )
  }

  // ── Card (turquoise, défaut) ──
  return (
    <label className={[
      'flex items-center gap-2.5 px-3 py-2.5 rounded-lg border cursor-pointer transition-all duration-200 select-none',
      checked ? 'bg-primary-50 border-primary-300 shadow-sm' : 'border-warm-200 hover:border-warm-300 hover:bg-warm-50',
    ].join(' ')}>
      <span className={[
        'flex-shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition-colors',
        checked ? 'bg-primary-500 border-primary-500' : 'border-warm-300 bg-white',
      ].join(' ')}>
        {checked && CHECK_ICON}
      </span>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="sr-only" />
      <div>
        <span className="text-sm font-medium text-secondary-700">{label}</span>
        {hint && <p className="text-xs text-warm-400 mt-0.5">{hint}</p>}
      </div>
    </label>
  )
}

// ─── FloatRadioCard ───────────────────────────────────────────────────────────
// Option radio avec le même thème carte que FloatCheckbox

export interface FloatRadioCardProps {
  name:      string
  value:     string
  checked:   boolean
  onChange:  (value: string) => void
  children:  React.ReactNode
}

export function FloatRadioCard({ name, value, checked, onChange, children }: FloatRadioCardProps) {
  return (
    <label className={[
      'flex items-center gap-2.5 px-3 py-2.5 rounded-lg border cursor-pointer transition-all duration-200 select-none',
      checked ? 'bg-primary-50 border-primary-300 shadow-sm' : 'border-warm-200 hover:border-warm-300 hover:bg-warm-50',
    ].join(' ')}>
      {/* Cercle radio custom */}
      <span className={[
        'flex-shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors',
        checked ? 'border-primary-500 bg-white' : 'border-warm-300 bg-white',
      ].join(' ')}>
        {checked && <span className="w-2 h-2 rounded-full bg-primary-500 block" />}
      </span>
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={() => onChange(value)}
        className="sr-only"
      />
      <span className="text-sm text-secondary-700">{children}</span>
    </label>
  )
}

// ─── SearchField ─────────────────────────────────────────────────────────────

export interface SearchFieldProps {
  value:        string
  onChange:     (value: string) => void
  placeholder?: string
  className?:   string
  onFocus?:     () => void
}

export function SearchField({ value, onChange, placeholder = 'Rechercher…', className, onFocus }: SearchFieldProps) {
  return (
    <div className={['relative flex items-center', className ?? 'w-64'].join(' ')}>
      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-warm-400 pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={onFocus}
        placeholder={placeholder}
        className={[
          'pl-8 py-2 text-sm rounded-lg border w-full',
          'bg-white text-secondary-800 placeholder:text-warm-400',
          'border-warm-300 transition-all duration-200',
          'focus:outline-none focus:ring-2 focus:ring-primary-400/30 focus:border-primary-400',
          value ? 'pr-8' : 'pr-3',
        ].join(' ')}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-warm-400 hover:text-secondary-600 transition-colors"
          aria-label="Effacer"
        >
          <X size={13} />
        </button>
      )}
    </div>
  )
}

// ─── FloatButton ──────────────────────────────────────────────────────────────
// variant "submit"    : fond sidebar (#2e4550 → secondary-700) — Valider / Enregistrer
// variant "secondary" : blanc + bordure — Annuler
// variant "edit"      : orange doré (amber) — Modifier
// variant "danger"    : rouge — Supprimer
// variant "print"     : turquoise (primary-500) — Imprimer

export interface FloatButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:  'submit' | 'secondary' | 'edit' | 'danger' | 'print'
  loading?:  boolean
  children:  React.ReactNode
}

const VARIANT_CLS: Record<NonNullable<FloatButtonProps['variant']>, string> = {
  submit:    'bg-secondary-700 text-white hover:bg-secondary-800 focus:ring-secondary-500 shadow-[0_2px_6px_rgba(47,69,80,0.30)] hover:shadow-[0_4px_12px_rgba(47,69,80,0.40)]',
  secondary: 'bg-white text-secondary-600 border border-warm-300 shadow-sm hover:bg-warm-50 hover:border-warm-400 focus:ring-secondary-300',
  edit:      'bg-amber-500 text-white hover:bg-amber-600 focus:ring-amber-400 shadow-[0_2px_6px_rgba(255,162,0,0.30)] hover:shadow-[0_4px_12px_rgba(255,162,0,0.40)]',
  danger:    'bg-red-600 text-white hover:bg-red-700 focus:ring-red-400 shadow-[0_2px_6px_rgba(220,38,38,0.25)] hover:shadow-[0_4px_12px_rgba(220,38,38,0.35)]',
  print:     'bg-primary-500 text-white hover:bg-primary-600 focus:ring-primary-400 shadow-[0_2px_6px_rgba(24,170,153,0.30)] hover:shadow-[0_4px_12px_rgba(24,170,153,0.40)]',
}

export function FloatButton({
  variant = 'submit',
  loading = false,
  disabled,
  children,
  className,
  ...props
}: FloatButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={[
        'inline-flex items-center justify-center gap-2',
        'px-5 py-2 rounded-lg font-semibold text-sm tracking-wide',
        'transition-all duration-200',
        'focus:outline-none focus:ring-2 focus:ring-offset-1',
        'active:scale-[0.97] select-none',
        'disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 disabled:shadow-none',
        VARIANT_CLS[variant],
        className ?? '',
      ].join(' ')}
    >
      {loading && <Loader2 size={14} className="animate-spin flex-shrink-0" />}
      {children}
    </button>
  )
}
