'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'
import { clsx } from 'clsx'

export interface EcoleRecherche { id: string; nom: string; slug: string }

// Recherche insensible aux accents et a la casse (meme regle que la liste).
const norm = (v: string) => v.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

/** 2 caracteres minimum, comme `SearchField` dans l'application. */
const MIN = 2
const MAX_RESULTATS = 8

/**
 * Recherche GLOBALE de la console (barre du haut, toutes les pages) : une ecole
 * par son nom ou son sous-domaine. Ctrl+K (⌘K sur Mac) y place le curseur ;
 * fleches + Entree ouvrent la fiche ; Entree sans selection montre la liste
 * filtree (`/superadmin?q=`). La liste des ecoles est fournie par le layout :
 * aucun appel reseau a la frappe.
 */
export default function RechercheEcoles({ ecoles }: { ecoles: EcoleRecherche[] }) {
  const router = useRouter()
  const listeId = useId()
  const champ = useRef<HTMLInputElement>(null)
  const [q, setQ] = useState('')
  const [ouvert, setOuvert] = useState(false)
  const [actif, setActif] = useState(-1)
  const [mac, setMac] = useState(false)

  useEffect(() => {
    setMac(/Mac|iPhone|iPad/.test(navigator.platform))
    const raccourci = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        champ.current?.focus()
        champ.current?.select()
      }
    }
    window.addEventListener('keydown', raccourci)
    return () => window.removeEventListener('keydown', raccourci)
  }, [])

  const resultats = useMemo(() => {
    const n = norm(q.trim())
    if (n.length < MIN) return []
    return ecoles
      .filter(e => norm(e.nom).includes(n) || norm(e.slug).includes(n))
      .slice(0, MAX_RESULTATS)
  }, [q, ecoles])

  const fermer = () => { setOuvert(false); setActif(-1) }

  const aller = (e: EcoleRecherche) => {
    fermer()
    setQ('')
    champ.current?.blur()
    router.push(`/superadmin/ecoles/${e.id}`)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOuvert(true)
      setActif(i => Math.min(i + 1, resultats.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActif(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (actif >= 0 && resultats[actif]) aller(resultats[actif])
      else if (q.trim().length >= MIN) {
        fermer()
        router.push(`/superadmin?q=${encodeURIComponent(q.trim())}`)
      }
    } else if (e.key === 'Escape') {
      fermer()
    }
  }

  const visible = ouvert && q.trim().length >= MIN

  return (
    <div className="relative w-full max-w-[420px]">
      <Search aria-hidden="true" size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--brand-muted)] pointer-events-none" />
      <input
        ref={champ}
        type="text"
        role="combobox"
        aria-label="Rechercher une école"
        aria-expanded={visible}
        aria-controls={listeId}
        aria-autocomplete="list"
        aria-activedescendant={visible && actif >= 0 ? `${listeId}-${actif}` : undefined}
        placeholder="Rechercher une école…"
        value={q}
        onChange={e => { setQ(e.target.value); setOuvert(true); setActif(-1) }}
        onFocus={() => setOuvert(true)}
        // Laisser le clic d'un resultat aboutir avant de refermer.
        onBlur={() => setTimeout(fermer, 120)}
        onKeyDown={onKeyDown}
        className="w-full h-[34px] pl-9 pr-16 rounded-full text-[13px] text-white placeholder:text-[var(--brand-muted)] bg-[var(--console-champ)] border border-[var(--console-champ-trait)] outline-none transition-colors focus:border-[var(--console-accent)] focus:shadow-[0_0_0_4px_var(--console-halo)]"
      />
      <kbd className="mono absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-[var(--brand-muted)] pointer-events-none">
        {mac ? '⌘K' : 'Ctrl K'}
      </kbd>

      {visible && (
        <ul
          id={listeId}
          role="listbox"
          aria-label="Écoles trouvées"
          className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 py-1 rounded-xl bg-[var(--surface-card)] border border-[var(--card-border)] shadow-[var(--card-shadow)] max-h-80 overflow-y-auto"
        >
          {resultats.length === 0 ? (
            <li className="px-3 py-2 text-xs text-[var(--ink-muted)]">Aucune école ne correspond.</li>
          ) : resultats.map((e, i) => (
            <li
              key={e.id}
              id={`${listeId}-${i}`}
              role="option"
              aria-selected={i === actif}
              onMouseDown={ev => ev.preventDefault()}
              onClick={() => aller(e)}
              onMouseEnter={() => setActif(i)}
              className={clsx(
                'flex items-center justify-between gap-3 px-3 py-2 cursor-pointer text-[13px]',
                i === actif ? 'bg-[var(--survol-ligne)]' : '',
              )}
            >
              <span className="font-medium text-[var(--ink)] truncate">{e.nom}</span>
              <span className="mono text-xs text-[var(--ink-muted)] flex-shrink-0">{e.slug}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
