'use client'

import { useState, useEffect, useRef } from 'react'
import { Loader2, Search, X } from 'lucide-react'
import Tooltip from './Tooltip'

// ─── Variante « bordure » — STYLE PAR DEFAUT depuis le 15/10/2026 ────────────
// Libelle pose SUR LE TRAIT du cadre (style Material « outlined ») au lieu de
// monter a l'interieur : le champ n'a plus a reserver de marge haute, il gagne
// environ 10 px. Valide sur la page modele (/dashboard/test-design) puis
// generalise : `bordure` vaut true par defaut, `bordure={false}` rend l'ancien
// rendu (libelle a l'interieur), reserve aux ecrans de marque (connexion).
//
// Le fond du libelle masque le trait : il prend la couleur de la CARTE. Sur un
// champ verrouille, il est COUPE en deux (carte en haut, `--champ-verrou` en
// bas) : sinon un rectangle blanc deborderait sur le gris. D'ou aussi une
// couleur PLEINE pour le champ verrouille (l'ancienne opacite a 75 % empechait
// les deux moities de se raccorder). Jetons dans globals.css, clair et sombre.
export const BORDURE_LABEL = 'left-2 px-1 bg-[var(--surface-card)]'
export const BORDURE_LABEL_VERROU = 'left-2 px-1 bg-[linear-gradient(to_bottom,var(--surface-card)_50%,var(--champ-verrou)_50%)]'
export const BORDURE_HAUT  = '-top-2 text-[10px] font-semibold tracking-wide uppercase'

// ─── FloatInput ───────────────────────────────────────────────────────────────

export interface FloatInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label:     string
  required?: boolean
  error?:    string
  locked?:   boolean
  compact?:  boolean
  /** Libelle sur le trait du cadre (voir « Variante bordure »). */
  bordure?:  boolean
}

export function FloatInput({ label, required, error, locked, compact, bordure = true, className, type, onFocus, onBlur, ...props }: FloatInputProps) {
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
          bordure ? 'py-1.5' : compact ? 'pt-4 pb-1' : 'pt-5 pb-1.5',
          'transition-all duration-200',
          'focus:outline-none focus:ring-2',
          locked
            ? bordure
              ? 'bg-[var(--champ-verrou)] text-warm-400 cursor-default border-warm-200 focus:ring-0 focus:border-warm-200'
              : 'bg-warm-100 text-warm-400 cursor-default border-warm-200 focus:ring-0 focus:border-warm-200 opacity-75'
            : error
              ? 'bg-white text-gray-800 border-red-400 focus:border-red-400 focus:ring-red-400/20'
              : 'bg-white text-gray-800 border-warm-300 focus:border-primary-400 focus:ring-primary-400/20',
          className ?? '',
        ].join(' ')}
      />
      <label className={[
        'absolute transition-all duration-200 pointer-events-none select-none origin-left',
        bordure ? (locked ? BORDURE_LABEL_VERROU : BORDURE_LABEL) : 'left-3',
        bordure ? 'top-1.5 text-xs' : compact ? 'top-2.5 text-xs' : 'top-3.5 text-sm',
        bordure
          ? 'peer-focus:-top-2 peer-focus:text-[10px] peer-focus:font-semibold peer-focus:tracking-wide peer-focus:uppercase peer-[&:not(:placeholder-shown)]:-top-2 peer-[&:not(:placeholder-shown)]:text-[10px] peer-[&:not(:placeholder-shown)]:font-semibold peer-[&:not(:placeholder-shown)]:tracking-wide peer-[&:not(:placeholder-shown)]:uppercase'
          : compact
          ? 'peer-focus:top-1 peer-focus:text-[10px] peer-focus:font-semibold peer-focus:tracking-wide peer-focus:uppercase peer-[&:not(:placeholder-shown)]:top-1 peer-[&:not(:placeholder-shown)]:text-[10px] peer-[&:not(:placeholder-shown)]:font-semibold peer-[&:not(:placeholder-shown)]:tracking-wide peer-[&:not(:placeholder-shown)]:uppercase'
          : 'peer-focus:top-1.5 peer-focus:text-[10px] peer-focus:font-semibold peer-focus:tracking-wide peer-focus:uppercase peer-[&:not(:placeholder-shown)]:top-1.5 peer-[&:not(:placeholder-shown)]:text-[10px] peer-[&:not(:placeholder-shown)]:font-semibold peer-[&:not(:placeholder-shown)]:tracking-wide peer-[&:not(:placeholder-shown)]:uppercase',
        locked
          ? 'text-warm-700'
          : error
            ? 'text-red-500 peer-focus:text-red-500'
            : 'text-warm-700 peer-focus:text-primary-600 peer-[&:not(:placeholder-shown)]:text-warm-700',
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
  /** Libelle sur le trait du cadre (voir « Variante bordure »). */
  bordure?:          boolean
}

export function FloatSelect({ label, required, error, children, className, wrapperClassName, compact, bordure = true, ...props }: FloatSelectProps) {
  const hasValue = !!props.value && props.value !== ''
  return (
    <div className={['relative', wrapperClassName].filter(Boolean).join(' ')}>
      <select
        {...props}
        className={[
          'peer w-full pl-3 pr-8 rounded-lg border text-sm text-gray-800',
          bordure ? 'py-1.5' : compact ? 'pt-4 pb-1' : 'pt-5 pb-1.5',
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
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-warm-700">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </span>
      <label className={[
        'absolute transition-all duration-200 pointer-events-none select-none origin-left',
        bordure ? BORDURE_LABEL : 'left-3',
        bordure
          ? hasValue ? BORDURE_HAUT : 'top-1.5 text-xs'
          : hasValue
          ? compact ? 'top-1 text-[10px] font-semibold tracking-wide uppercase' : 'top-1.5 text-[10px] font-semibold tracking-wide uppercase'
          : compact ? 'top-2.5 text-xs' : 'top-3.5 text-sm',
        bordure
          ? 'peer-focus:-top-2 peer-focus:text-[10px] peer-focus:font-semibold peer-focus:tracking-wide peer-focus:uppercase'
          : compact
          ? 'peer-focus:top-1 peer-focus:text-[10px] peer-focus:font-semibold peer-focus:tracking-wide peer-focus:uppercase'
          : 'peer-focus:top-1.5 peer-focus:text-[10px] peer-focus:font-semibold peer-focus:tracking-wide peer-focus:uppercase',
        error
          ? 'text-red-500'
          : hasValue
            ? 'text-warm-700'
            : 'text-warm-700 peer-focus:text-primary-600',
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
  /** Libelle sur le trait du cadre (voir « Variante bordure »). */
  bordure?:  boolean
}

export function FloatTextarea({ label, required, error, bordure = true, className, placeholder, onFocus, onBlur, ...props }: FloatTextareaProps) {
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
          'peer w-full px-3 rounded-lg border text-sm text-gray-800',
          bordure ? 'pt-2.5 pb-1.5' : 'pt-7 pb-2',
          'bg-white transition-all duration-200 resize-none',
          'focus:outline-none focus:ring-2',
          error
            ? 'border-red-400 focus:border-red-400 focus:ring-red-400/20'
            : 'border-warm-300 focus:border-primary-400 focus:ring-primary-400/20',
          className ?? '',
        ].join(' ')}
      />
      <label className={[
        'absolute pointer-events-none select-none origin-left transition-all duration-200',
        bordure ? BORDURE_LABEL : 'left-3',
        bordure
          ? labelUp ? BORDURE_HAUT : 'top-2 text-xs'
          : labelUp
          ? 'top-1.5 text-[10px] font-semibold tracking-wide uppercase'
          : 'top-4 text-sm',
        error
          ? 'text-red-500'
          : labelUp
            ? focused ? 'text-primary-600' : 'text-warm-700'
            : 'text-warm-700',
      ].join(' ')}>
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {error && <p className="mt-0.5 text-xs text-red-500">{error}</p>}
    </div>
  )
}

// ─── SwitchOuiNon ─────────────────────────────────────────────────────────────
// Choix binaire en SWITCH segmente « Oui | Non » (motif des bascules de l'EDT,
// charte du 15/10/2026), a la place d'une case a cocher. `danger` : le « Oui »
// actif passe en rouge (option sensible, ex. PAI).

export function SwitchOuiNon({ label, checked, onChange, danger, disabled, seul }: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
  danger?: boolean
  disabled?: boolean
  /** Le switch SEUL, sans cadre ni libelle visible (le libelle reste lu par
   *  les lecteurs d'ecran) : pour le poser a droite d'un titre d'encadre. */
  seul?: boolean
}) {
  const segment = (valeur: boolean, texte: string, i: number) => {
    const actif = checked === valeur
    return (
      <button
        key={texte}
        type="button"
        role="radio"
        aria-checked={actif}
        disabled={disabled}
        onClick={() => onChange(valeur)}
        className={[
          seul ? 'px-2 py-0.5 text-[11px] leading-none' : 'px-3 py-1',
          'transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-300 disabled:cursor-default',
          i > 0 ? 'border-l border-warm-200' : '',
          actif
            ? valeur && danger
              ? 'bg-red-600 text-white'
              : 'bg-[var(--brand-surface)] text-white dark:bg-[var(--brand-accent)] dark:text-[var(--brand-surface-2)]'
            : 'bg-white text-warm-700 hover:bg-warm-50',
        ].join(' ')}
      >
        {texte}
      </button>
    )
  }
  const interrupteur = (
    <div role="radiogroup" aria-label={label} aria-disabled={disabled || undefined} className={['flex flex-shrink-0 rounded-lg overflow-hidden text-xs font-medium border border-warm-200', disabled ? 'opacity-60' : ''].join(' ')}>
      {segment(true, 'Oui', 0)}
      {segment(false, 'Non', 1)}
    </div>
  )
  if (seul) return interrupteur
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-warm-200 px-3 py-1.5">
      <span className={['text-sm', danger && checked ? 'text-red-700 font-medium' : 'text-warm-700'].join(' ')}>{label}</span>
      {interrupteur}
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
          // Vert de MARQUE (celui des switches segmentes), pas le turquoise.
          checked ? 'bg-[var(--brand-surface)] dark:bg-[var(--brand-accent)]' : 'bg-warm-300',
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
          checked ? 'text-[var(--brand-surface)] dark:text-[var(--brand-accent)]' : 'text-warm-400',
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
          checked ? 'bg-[var(--brand-surface)] border-[var(--brand-surface)] dark:bg-[var(--brand-accent)] dark:border-[var(--brand-accent)]' : 'border-warm-300 bg-white',
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
        {label && <span className="text-xs text-warm-700 select-none">{label}</span>}
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
          <Tooltip content={hint} className="ml-auto">
            <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-warm-200 text-warm-700 text-[10px] font-bold cursor-help">?</span>
          </Tooltip>
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
        checked ? 'bg-[var(--brand-surface)] border-[var(--brand-surface)] dark:bg-[var(--brand-accent)] dark:border-[var(--brand-accent)]' : 'border-warm-300 bg-white',
      ].join(' ')}>
        {checked && CHECK_ICON}
      </span>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="sr-only" />
      <div>
        <span className="text-sm font-medium text-secondary-700">{label}</span>
        {hint && <p className="text-xs text-warm-700 mt-0.5">{hint}</p>}
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
        checked ? 'border-[var(--brand-surface)] dark:border-[var(--brand-accent)] bg-white' : 'border-warm-300 bg-white',
      ].join(' ')}>
        {checked && <span className="w-2 h-2 rounded-full bg-[var(--brand-surface)] dark:bg-[var(--brand-accent)] block" />}
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
  ariaLabel?:   string
}

/**
 * Nombre de caracteres a partir duquel on cherche VRAIMENT.
 *
 * Une seule lettre ne filtre rien d'utile : sur trois cents familles, « a »
 * ramene presque tout, et l'ecran clignote a chaque frappe pour un resultat
 * qu'on n'a pas demande. Les recherches serveur, elles, partent en requete pour
 * rien.
 */
const MIN_RECHERCHE = 2

/**
 * Champ de recherche.
 *
 * ┌─ SEMI-CONTROLE, ET C'EST LA CLE ─────────────────────────────────────────┐
 * │ Il garde EN INTERNE ce qui est tape — sinon la premiere lettre            │
 * │ disparaitrait sous les doigts — mais ne remonte au parent que le terme    │
 * │ EFFECTIF : vide tant qu'on est sous le seuil.                             │
 * │                                                                           │
 * │ Consequence : les vingt ecrans qui l'utilisent heritent de la regle sans  │
 * │ changer une ligne. La poser dans chaque filtre aurait demande vingt       │
 * │ retouches, et la vingt-et-unieme aurait ete oubliee.                      │
 * └───────────────────────────────────────────────────────────────────────────┘
 */
export function SearchField({ value, onChange, placeholder = 'Rechercher…', className, onFocus, ariaLabel }: SearchFieldProps) {
  const [saisi, setSaisi] = useState(value)

  // Ce qu'on a remonte en dernier. Sert a distinguer « le parent a change la
  // valeur lui-meme » (restauration de filtres, bouton effacer exterieur) de
  // « c'est notre propre emission qui revient ».
  const dernierEmis = useRef(value)
  const champ = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (value !== dernierEmis.current) {
      setSaisi(value)
      dernierEmis.current = value
    }
  }, [value])

  const emettre = (v: string) => {
    setSaisi(v)
    const effectif = v.trim().length >= MIN_RECHERCHE ? v : ''
    if (effectif !== dernierEmis.current) {
      dernierEmis.current = effectif
      onChange(effectif)
    }
  }

  // CHARTE DU 15/10/2026 : champ clair arrondi prolonge a droite par un bouton
  // CARRE au vert de marque portant la loupe. La recherche reste « a la frappe »
  // (regle ci-dessus) : le bouton ne declenche rien, il rend le focus au champ.
  return (
    <div className={[
      'flex items-stretch h-9 rounded-lg border border-warm-300 bg-white overflow-hidden transition-all duration-200',
      'focus-within:border-[var(--brand-surface)] focus-within:ring-1 focus-within:ring-[var(--brand-surface)] dark:focus-within:border-[var(--brand-accent)] dark:focus-within:ring-[var(--brand-accent)]',
      className ?? 'w-64',
    ].join(' ')}>
      <div className="relative flex-1 min-w-0">
        <input
          ref={champ}
          type="text"
          value={saisi}
          onChange={e => emettre(e.target.value)}
          onFocus={onFocus}
          placeholder={placeholder}
          aria-label={ariaLabel ?? placeholder}
          className={[
            'w-full h-full pl-3 text-sm bg-transparent text-secondary-800 placeholder:text-warm-700 focus:outline-none',
            saisi ? 'pr-7' : 'pr-2',
          ].join(' ')}
        />
        {saisi && (
          <button
            type="button"
            onClick={() => { emettre(''); champ.current?.focus() }}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-warm-700 hover:text-secondary-600 transition-colors"
            aria-label="Effacer"
          >
            <X size={13} />
          </button>
        )}
      </div>
      <button
        type="button"
        tabIndex={-1}
        onClick={() => champ.current?.focus()}
        aria-label="Rechercher"
        className="flex items-center justify-center w-9 flex-shrink-0 text-white bg-[var(--brand-surface)] hover:bg-[var(--brand-surface-2)] dark:bg-[var(--brand-accent)] dark:text-[var(--brand-surface-2)] dark:hover:opacity-90 transition-colors"
      >
        <Search size={15} />
      </button>
    </div>
  )
}

// ─── FloatButton ──────────────────────────────────────────────────────────────
// variant "submit"    : fond sidebar (#2e4550 → secondary-700) — Valider / Enregistrer
// variant "secondary" : blanc + bordure — Annuler
// variant "edit"      : orange doré (amber) — Modifier
// variant "danger"    : rouge — Supprimer
// variant "primary"   : turquoise (couleur principale du thème) — action de validation phare (login…)
// variant "brand"     : surface de marque (--brand-surface = teal profond #0c5b51) — CTA sur pages de marque (login)

export interface FloatButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:  'submit' | 'secondary' | 'edit' | 'danger' | 'primary' | 'brand'
  /** Rend un `<a>` au lieu d'un `<button>`, avec la meme apparence exactement. */
  href?:     string
  /** Telechargement direct, quand `href` designe un fichier. */
  download?: boolean
  /**
   * TAILLE, orthogonale à la variante — et non une variante de plus : sans ça
   * il faudrait `mini-submit`, `mini-secondary`, `mini-danger`… pour chaque
   * couleur. `mini` sert aux boutons posés DANS un en-tête ou une barre, où un
   * bouton pleine taille écraserait la ligne.
   *
   * Remplace l'habillage `className="text-xs px-2.5 py-1"` qu'on recopiait à la
   * main : une valeur répétée finit toujours par diverger.
   */
  size?:     'normal' | 'mini'
  loading?:  boolean
  children:  React.ReactNode
}

const VARIANT_CLS: Record<NonNullable<FloatButtonProps['variant']>, string> = {
  // Action de validation = couleur de MARQUE du thème.
  // Clair : surface teal profond + texte blanc (accord avec la sidebar).
  // Sombre : la surface (#18242a) serait invisible sur une carte (#161f24) →
  // on passe à l'ACCENT turquoise avec un texte très foncé.
  submit:    'bg-[var(--brand-surface)] text-white hover:bg-[var(--brand-surface-2)] focus:ring-primary-400 shadow-[0_2px_6px_rgba(12,91,81,0.30)] hover:shadow-[0_4px_12px_rgba(12,91,81,0.40)] dark:bg-[var(--brand-accent)] dark:text-[var(--brand-surface-2)] dark:hover:bg-[var(--brand-accent)] dark:hover:opacity-90 dark:shadow-none',
  secondary: 'bg-white text-secondary-600 border border-warm-300 shadow-sm hover:bg-warm-50 hover:border-warm-400 focus:ring-secondary-300 dark:bg-[var(--surface-sunken)] dark:text-[var(--ink)] dark:border-[var(--line-strong)] dark:hover:bg-[var(--line-strong)]',
  // « Modifier » = CONTOUR de marque (l'ambre est abandonné) : Valider est plein,
  // Modifier est en contour → hiérarchie lisible sans introduire de teinte
  // supplémentaire. Bordure et texte suivent le thème (teal clair / accent sombre).
  edit:      'bg-transparent text-[var(--brand-surface)] border border-[var(--brand-surface)] hover:bg-[var(--brand-surface)] hover:text-white focus:ring-primary-400 dark:text-[var(--brand-accent)] dark:border-[var(--brand-accent)] dark:hover:bg-[var(--brand-accent)] dark:hover:text-[var(--brand-surface-2)]',
  danger:    'bg-red-600 text-white hover:bg-red-700 focus:ring-red-400 shadow-[0_2px_6px_rgba(220,38,38,0.25)] hover:shadow-[0_4px_12px_rgba(220,38,38,0.35)]',
  primary:   'bg-primary-500 text-white hover:bg-primary-600 focus:ring-primary-400 shadow-[0_2px_6px_rgba(24,170,153,0.30)] hover:shadow-[0_4px_12px_rgba(24,170,153,0.40)]',
  brand:     'bg-[var(--brand-surface)] text-white hover:bg-[var(--brand-surface-2)] focus:ring-primary-400 shadow-[0_2px_6px_rgba(12,91,81,0.30)] hover:shadow-[0_4px_12px_rgba(12,91,81,0.40)]',
}

/**
 * `href` : le bouton devient un vrai LIEN.
 *
 * Sans lui, tout ce qui doit naviguer ou telecharger etait habille a la main —
 * le `<Link>` stylé des listes Apprenants et Parents, le lien de telechargement
 * du gabarit d'import. Or une apparence recopiee finit toujours par diverger de
 * son modele : le bouton « Télécharger le modèle » avait deja une hauteur et un
 * arrondi differents de son voisin.
 *
 * On rend donc un `<a>` avec EXACTEMENT les memes classes, jamais une copie.
 */
export function FloatButton({
  variant = 'submit',
  size = 'normal',
  loading = false,
  disabled,
  children,
  className,
  href,
  download,
  ...props
}: FloatButtonProps) {
  const classes = [
    'inline-flex items-center justify-center gap-2',
    size === 'mini' ? 'px-2.5 py-1 text-xs' : 'px-5 py-2 text-sm',
    'rounded-lg font-semibold tracking-wide',
    'transition-all duration-200',
    'focus:outline-none focus:ring-2 focus:ring-offset-1',
    'active:scale-[0.97] select-none',
    'disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 disabled:shadow-none',
    VARIANT_CLS[variant],
    className ?? '',
  ].join(' ')

  if (href) {
    return (
      <a href={href} download={download} className={classes}>
        {children}
      </a>
    )
  }

  return (
    <button {...props} disabled={disabled || loading} className={classes}>
      {loading && <Loader2 size={14} className="animate-spin flex-shrink-0" />}
      {children}
    </button>
  )
}
