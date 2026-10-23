'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'
import { clsx } from 'clsx'
import { rechercherComptes, type CompteRecherche } from '@/app/superadmin/recherche-actions'
import { libelleRole } from '@/lib/auth/role-labels'

export interface EcoleRecherche { id: string; nom: string; slug: string }

// Recherche insensible aux accents et a la casse (meme regle que la liste).
const norm = (v: string) => v.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

/** 2 caracteres minimum, comme `SearchField` dans l'application. */
const MIN = 2
const MAX_RESULTATS = 8
/** Attente apres la derniere frappe avant d'interroger le serveur (comptes). */
const DELAI_MS = 250

type Resultat =
  | { type: 'ecole'; ecole: EcoleRecherche }
  | { type: 'compte'; compte: CompteRecherche }

/**
 * Recherche GLOBALE de la console (barre du haut, toutes les pages) : une ecole
 * par son nom ou son sous-domaine, un COMPTE par son nom ou son email (23/10).
 * Ctrl+K (⌘K sur Mac) y place le curseur ; fleches + Entree ouvrent l'element ;
 * Entree sans selection montre la liste filtree des ecoles (`/superadmin?q=`).
 *
 * Les ecoles sont fournies par le layout (filtre instantane, sans reseau). Les
 * comptes viennent d'une action serveur a la frappe : leur liste complete ne
 * doit pas voyager dans chaque page.
 */
export default function RechercheConsole({ ecoles }: { ecoles: EcoleRecherche[] }) {
  const router = useRouter()
  const listeId = useId()
  const champ = useRef<HTMLInputElement>(null)
  const [q, setQ] = useState('')
  const [ouvert, setOuvert] = useState(false)
  const [actif, setActif] = useState(-1)
  const [mac, setMac] = useState(false)
  const [comptes, setComptes] = useState<CompteRecherche[]>([])
  const [chargement, setChargement] = useState(false)
  // Numero de la derniere requete : une reponse plus ancienne arrivee en retard
  // n'ecrase pas la plus recente.
  const derniere = useRef(0)

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

  useEffect(() => {
    const texte = q.trim()
    if (norm(texte).length < MIN) { setComptes([]); setChargement(false); return }
    setChargement(true)
    const n = ++derniere.current
    const minuteur = setTimeout(async () => {
      const { comptes: trouves } = await rechercherComptes(texte).catch(() => ({ comptes: [] as CompteRecherche[] }))
      if (n !== derniere.current) return
      setComptes(trouves)
      setChargement(false)
    }, DELAI_MS)
    return () => clearTimeout(minuteur)
  }, [q])

  const ecolesTrouvees = useMemo(() => {
    const n = norm(q.trim())
    if (n.length < MIN) return []
    return ecoles
      .filter(e => norm(e.nom).includes(n) || norm(e.slug).includes(n))
      .slice(0, MAX_RESULTATS)
  }, [q, ecoles])

  // Une seule suite pour le clavier : les ecoles, puis les comptes.
  const resultats: Resultat[] = [
    ...ecolesTrouvees.map(ecole => ({ type: 'ecole' as const, ecole })),
    ...comptes.map(compte => ({ type: 'compte' as const, compte })),
  ]

  const fermer = () => { setOuvert(false); setActif(-1) }

  const aller = (r: Resultat) => {
    fermer()
    setQ('')
    champ.current?.blur()
    router.push(r.type === 'ecole'
      ? `/superadmin/ecoles/${r.ecole.id}`
      : `/superadmin/ecoles/${r.compte.ecoleId}?compte=${r.compte.id}`)
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
  const intertitre = 'px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-widest text-[var(--ink-muted)]'
  const option = (i: number) => ({
    id: `${listeId}-${i}`,
    role: 'option' as const,
    'aria-selected': i === actif,
    onMouseDown: (ev: React.MouseEvent) => ev.preventDefault(),
    onClick: () => aller(resultats[i]),
    onMouseEnter: () => setActif(i),
  })

  return (
    <div className="relative w-full max-w-[420px]">
      <Search aria-hidden="true" size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--brand-muted)] pointer-events-none" />
      <input
        ref={champ}
        type="text"
        role="combobox"
        aria-label="Rechercher un établissement ou un compte"
        aria-expanded={visible}
        aria-controls={listeId}
        aria-autocomplete="list"
        aria-activedescendant={visible && actif >= 0 ? `${listeId}-${actif}` : undefined}
        placeholder="Rechercher un établissement ou un compte…"
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
        <div
          id={listeId}
          role="listbox"
          aria-label="Résultats de la recherche"
          className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 py-1 rounded-xl bg-[var(--surface-card)] border border-[var(--card-border)] shadow-[var(--card-shadow)] max-h-96 overflow-y-auto"
        >
          <div role="group" aria-label="Établissements">
            <p className={intertitre} aria-hidden="true">Établissements</p>
            {ecolesTrouvees.length === 0 ? (
              <p className="px-3 py-1.5 text-xs text-[var(--ink-muted)]">Aucun établissement ne correspond.</p>
            ) : ecolesTrouvees.map((e, i) => (
              <div
                key={e.id}
                {...option(i)}
                className={clsx(
                  'flex items-center justify-between gap-3 px-3 py-2 cursor-pointer text-[13px]',
                  i === actif ? 'bg-[var(--survol-ligne)]' : '',
                )}
              >
                <span className="font-medium text-[var(--ink)] truncate">{e.nom}</span>
                <span className="mono text-xs text-[var(--ink-muted)] flex-shrink-0">{e.slug}</span>
              </div>
            ))}
          </div>

          <div role="group" aria-label="Comptes" className="border-t border-[var(--card-border)] mt-1">
            <p className={intertitre} aria-hidden="true">Comptes</p>
            {comptes.length === 0 ? (
              <p className="px-3 py-1.5 text-xs text-[var(--ink-muted)]">
                {chargement ? 'Recherche…' : 'Aucun compte ne correspond.'}
              </p>
            ) : comptes.map((c, k) => {
              const i = ecolesTrouvees.length + k
              return (
                <div
                  key={c.id}
                  {...option(i)}
                  className={clsx(
                    'px-3 py-2 cursor-pointer text-[13px]',
                    i === actif ? 'bg-[var(--survol-ligne)]' : '',
                    !c.actif && 'opacity-60',
                  )}
                >
                  <p className="flex items-center justify-between gap-3">
                    <span className="font-medium text-[var(--ink)] truncate">{c.nom} {c.prenom}</span>
                    <span className="text-xs text-[var(--ink-muted)] flex-shrink-0">
                      {libelleRole(c.role, 'court')}{c.actif ? '' : ' · inactif'}
                    </span>
                  </p>
                  <p className="text-xs text-[var(--ink-muted)] truncate">{c.email} · {c.ecoleNom}</p>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
