'use client'

/**
 * PAGE MODELE — prototype de la nouvelle presentation, DONNEES FICTIVES.
 *
 * Aucun composant reel n'est modifie : les champs « bordure » et les onglets
 * intercalaires sont reecrits ici en local, pour pouvoir les juger avant de
 * toucher a `FloatFields` et aux fiches. A supprimer une fois les choix faits.
 */

import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { clsx } from 'clsx'
import { Bell, ChevronDown, ChevronLeft, Moon, Pencil, Power, Search, Sun, Trash2, X } from 'lucide-react'
import { useTheme } from '@/components/layout/ThemeContext'
import Tooltip from '@/components/ui/Tooltip'
import FormModal from '@/components/ui/FormModal'
import { FloatButton } from '@/components/ui/FloatFields'

// ─── Donnees fictives ─────────────────────────────────────────────────────────

type Eleve = {
  id: number
  nom: string
  prenom: string
  numero: string
  genre: 'male' | 'female'
  naissance: string // JJ/MM/AAAA
  age: number
  classe: string | null
  actif: boolean
  absences: number
}

const ELEVES: Eleve[] = [
  { id: 1,  nom: 'BIANCHI',   prenom: 'Lucia',    numero: 'ELV-202609-001', genre: 'female', naissance: '14/03/2018', age: 8,  classe: 'CE1', actif: true,  absences: 0 },
  { id: 2,  nom: 'COSTA',     prenom: 'Tiago',    numero: 'ELV-202609-002', genre: 'male',   naissance: '02/11/2017', age: 8,  classe: 'CE1', actif: true,  absences: 2 },
  { id: 3,  nom: 'DIALLO',    prenom: 'Aminata',  numero: 'ELV-202609-003', genre: 'female', naissance: '21/06/2019', age: 7,  classe: 'CP',  actif: true,  absences: 1 },
  { id: 4,  nom: 'HOFFMANN',  prenom: 'Jonas',    numero: 'ELV-202609-004', genre: 'male',   naissance: '09/01/2016', age: 10, classe: 'CM1', actif: true,  absences: 0 },
  { id: 5,  nom: 'KOWALSKI',  prenom: 'Zofia',    numero: 'ELV-202609-005', genre: 'female', naissance: '30/09/2016', age: 10, classe: null,  actif: true,  absences: 0 },
  { id: 6,  nom: 'MARTIN',    prenom: 'Hugo',     numero: 'ELV-202609-006', genre: 'male',   naissance: '17/04/2019', age: 7,  classe: 'CP',  actif: false, absences: 0 },
  { id: 7,  nom: 'NGUYEN',    prenom: 'Mai',      numero: 'ELV-202609-007', genre: 'female', naissance: '05/12/2017', age: 8,  classe: 'CE1', actif: true,  absences: 4 },
  { id: 8,  nom: 'OKAFOR',    prenom: 'Chidi',    numero: 'ELV-202609-008', genre: 'male',   naissance: '23/07/2016', age: 10, classe: 'CM1', actif: true,  absences: 0 },
  { id: 9,  nom: 'PETROV',    prenom: 'Anya',     numero: 'ELV-202609-009', genre: 'female', naissance: '11/02/2018', age: 8,  classe: null,  actif: false, absences: 0 },
  { id: 10, nom: 'RAHMANI',   prenom: 'Yanis',    numero: 'ELV-202609-010', genre: 'male',   naissance: '28/08/2019', age: 7,  classe: 'CP',  actif: true,  absences: 1 },
  { id: 11, nom: 'SANTOS',    prenom: 'Beatriz',  numero: 'ELV-202609-011', genre: 'female', naissance: '16/05/2016', age: 10, classe: 'CM1', actif: true,  absences: 0 },
  { id: 12, nom: 'YAMADA',    prenom: 'Kenji',    numero: 'ELV-202609-012', genre: 'male',   naissance: '03/10/2017', age: 9,  classe: 'CE1', actif: false, absences: 0 },
]

// ─── Champs « bordure » (version prototype) ──────────────────────────────────
//
// Libelle pose SUR LE TRAIT du cadre. Correction du champ verrouille : le
// libelle n'a plus un fond blanc qui deborde sur le gris, mais un fond COUPE en
// deux — moitie haute = couleur de la carte, moitie basse = couleur du champ
// verrouille. Le champ verrouille perd son opacite a 75 % (une couleur pleine,
// sans quoi les deux moitiés ne pourraient pas se raccorder). Les deux couleurs
// passent par des variables : le theme sombre suit sans pont.

const FOND_LIBELLE        = 'bg-[var(--surface-card)]'
const FOND_LIBELLE_VERROU = 'bg-[linear-gradient(to_bottom,var(--surface-card)_50%,var(--champ-verrou)_50%)]'
const LIBELLE_HAUT        = '-top-2 text-[10px] font-semibold tracking-wide uppercase'

const CHAMP = 'peer w-full px-3 py-1.5 rounded-lg border text-sm transition-colors focus:outline-none focus:ring-2'
const CHAMP_ACTIF = 'bg-[var(--surface-card)] text-[var(--ink)] border-[var(--line-strong)] focus:border-primary-400 focus:ring-primary-400/20'
const CHAMP_VERROU = 'bg-[var(--champ-verrou)] text-warm-400 border-[var(--line-strong)] cursor-default focus:ring-0'

function Libelle({ texte, requis, verrou, flottant }: { texte: string; requis?: boolean; verrou?: boolean; flottant: boolean }) {
  return (
    <label className={clsx(
      'absolute left-2 px-1 pointer-events-none select-none transition-all duration-200 text-warm-700',
      verrou ? FOND_LIBELLE_VERROU : FOND_LIBELLE,
      flottant
        ? LIBELLE_HAUT
        : 'top-1.5 text-xs peer-focus:-top-2 peer-focus:text-[10px] peer-focus:font-semibold peer-focus:tracking-wide peer-focus:uppercase peer-focus:text-primary-600',
    )}>
      {texte}{requis && <span className="text-red-400 ml-0.5">*</span>}
    </label>
  )
}

function ChampB({ label, value, onChange, requis, verrou, type = 'text' }: {
  label: string; value: string; onChange?: (v: string) => void; requis?: boolean; verrou?: boolean; type?: string
}) {
  return (
    <div className="relative">
      <input
        type={type}
        value={value}
        placeholder=" "
        disabled={verrou}
        onChange={e => onChange?.(e.target.value)}
        className={clsx(CHAMP, verrou ? CHAMP_VERROU : CHAMP_ACTIF)}
      />
      <Libelle texte={label} requis={requis} verrou={verrou} flottant={!!value} />
    </div>
  )
}

function SelectB({ label, value, onChange, options, requis }: {
  label: string; value: string; onChange: (v: string) => void; options: string[]; requis?: boolean
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className={clsx(CHAMP, CHAMP_ACTIF, 'appearance-none pr-8 cursor-pointer')}
      >
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
      <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-warm-700 pointer-events-none" />
      <Libelle texte={label} requis={requis} flottant />
    </div>
  )
}

function TexteB({ label, value, onChange, lignes = 3 }: {
  label: string; value: string; onChange: (v: string) => void; lignes?: number
}) {
  return (
    <div className="relative">
      <textarea
        value={value}
        rows={lignes}
        placeholder=" "
        onChange={e => onChange(e.target.value)}
        className={clsx(CHAMP, CHAMP_ACTIF, 'pt-2.5 resize-none')}
      />
      <Libelle texte={label} flottant={!!value} />
    </div>
  )
}

// ─── En-tete : bascule de theme, partagee par les 2 propositions ────────────

function BasculeTheme({ surMarque }: { surMarque?: boolean }) {
  const { theme, toggle } = useTheme()
  const bouton = (cible: 'light' | 'dark') => clsx(
    'flex items-center justify-center w-7 h-6 rounded-full transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50',
    theme === cible
      ? surMarque ? 'bg-[var(--brand-accent)] text-[var(--brand-surface-2)]' : 'bg-[var(--surface-card)] text-[var(--brand-surface)] shadow-sm dark:text-[var(--brand-accent)]'
      : surMarque ? 'text-[var(--brand-icon)] hover:text-white' : 'text-warm-700 hover:text-secondary-800',
  )
  return (
    <div role="group" aria-label="Thème de l'interface" className={clsx(
      'flex items-center gap-0.5 p-0.5 rounded-full',
      surMarque ? 'bg-black/20' : 'bg-warm-100',
    )}>
      <button type="button" aria-label="Thème clair" aria-pressed={theme === 'light'} onClick={() => theme !== 'light' && toggle()} className={bouton('light')}>
        <Sun className="w-3.5 h-3.5" />
      </button>
      <button type="button" aria-label="Thème sombre" aria-pressed={theme === 'dark'} onClick={() => theme !== 'dark' && toggle()} className={bouton('dark')}>
        <Moon className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

/** Barre oblique de separation (un trait incline, pas un caractere « / »). */
function Oblique({ surMarque }: { surMarque?: boolean }) {
  return <span aria-hidden className={clsx('h-7 w-px rotate-[20deg]', surMarque ? 'bg-[var(--brand-icon)] opacity-60' : 'bg-warm-300')} />
}

function ZoneCompte({ surMarque }: { surMarque?: boolean }) {
  const icone = surMarque
    ? 'p-2 rounded-xl text-[var(--brand-text)] hover:text-white hover:bg-white/10 transition-colors'
    : 'p-2 rounded-xl text-[var(--brand-surface)] hover:bg-warm-100 transition-colors dark:text-[var(--brand-accent)]'
  return (
    <div className="flex items-center gap-3">
      <BasculeTheme surMarque={surMarque} />
      <Oblique surMarque={surMarque} />
      <Tooltip content="Notifications" position="bottom">
        <button type="button" aria-label="Notifications" className={clsx('relative', icone)}>
          <Bell className="w-5 h-5" />
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full px-1">3</span>
        </button>
      </Tooltip>
      <Oblique surMarque={surMarque} />
      <Tooltip content="Déconnexion" position="bottom">
        <button type="button" aria-label="Déconnexion" className={icone}>
          <Power className="w-5 h-5" />
        </button>
      </Tooltip>
      <Oblique surMarque={surMarque} />
      <div className="flex items-center gap-3">
        <div className="hidden md:block text-right">
          <p className={clsx('text-sm font-semibold leading-tight', surMarque ? 'text-white' : 'text-secondary-800')}>MOREAU Laurent</p>
          <p className={clsx('text-xs leading-tight mt-0.5', surMarque ? 'text-[var(--brand-text)]' : 'text-warm-700')}>Direction</p>
        </div>
        <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm text-white bg-[var(--brand-surface)] ring-2 ring-[var(--brand-accent)]">ML</div>
      </div>
    </div>
  )
}

function EnTete() {
  return (
    <section className="space-y-3">
      <h2 className="section-title">En-tête</h2>
      {/* Zone coupee en biais, aux couleurs de marque (proposition B retenue). */}
      <div className="flex items-stretch justify-between h-[61px] rounded-lg overflow-hidden bg-[var(--surface-card)] border border-[var(--card-border)]">
        <span className="self-center pl-6 text-xl font-bold text-secondary-800">Apprenants</span>
        <div className="flex items-center pl-14 pr-6 bg-[linear-gradient(110deg,var(--brand-surface)_0%,var(--brand-surface-2)_100%)] [clip-path:polygon(36px_0,100%_0,100%_100%,0_100%)]">
          <ZoneCompte surMarque />
        </div>
      </div>
    </section>
  )
}

// ─── Champ de recherche (nouvelle charte) ─────────────────────────────────────
//
// Champ clair arrondi, prolonge a droite par un bouton CARRE a la couleur de
// marque qui porte la loupe. La recherche reste « a la frappe » (comme
// SearchField) : le bouton remet le focus dans le champ. Une croix efface.

function Recherche({ value, onChange, ariaLabel }: { value: string; onChange: (v: string) => void; ariaLabel: string }) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div className="flex items-stretch w-64 h-9 rounded-lg bg-[var(--surface-card)] border border-[var(--line-strong)] overflow-hidden focus-within:border-primary-400 focus-within:ring-2 focus-within:ring-primary-400/20 transition-colors">
      <div className="relative flex-1 min-w-0">
        <input
          ref={ref}
          type="search"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="Rechercher..."
          aria-label={ariaLabel}
          className="w-full h-full pl-3 pr-7 bg-transparent text-sm text-[var(--ink)] placeholder:text-warm-700 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
        />
        {value && (
          <button type="button" aria-label="Effacer la recherche" onClick={() => { onChange(''); ref.current?.focus() }}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-warm-700 hover:text-secondary-800">
            <X size={14} />
          </button>
        )}
      </div>
      <button type="button" aria-label="Rechercher" onClick={() => ref.current?.focus()}
        className="flex items-center justify-center w-9 flex-shrink-0 text-white bg-[var(--brand-surface)] hover:bg-[var(--brand-surface-2)] dark:bg-[var(--brand-accent)] dark:text-[var(--brand-surface-2)] dark:hover:opacity-90 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-300">
        <Search size={16} />
      </button>
    </div>
  )
}

// ─── Liste ────────────────────────────────────────────────────────────────────

function Avatar({ e, taille = 'petit' }: { e: Eleve; taille?: 'petit' | 'grand' }) {
  // Liste : avatar CARRE, sans liseré de genre. Fiche : presentation actuelle
  // conservee (carre arrondi + liseré).
  const ring = e.genre === 'male' ? 'ring-2 ring-blue-500' : 'ring-2 ring-pink-500'
  return (
    <div className={clsx(
      'flex items-center justify-center font-bold flex-shrink-0 select-none bg-warm-100 text-warm-700',
      taille === 'petit' ? 'w-6 h-6 my-0.5 text-[9px] rounded-md' : clsx('w-11 h-11 text-sm rounded-xl', ring),
    )}>
      {e.nom[0]}{e.prenom[0]}
    </div>
  )
}

type Filtre = 'tous' | 'actifs' | 'inactifs' | 'non-affectes'

function Liste({ ouvrir }: { ouvrir: (e: Eleve) => void }) {
  const [q, setQ] = useState('')
  const [filtre, setFiltre] = useState<Filtre>('tous')

  const lignes = useMemo(() => ELEVES.filter(e => {
    if (filtre === 'actifs' && !e.actif) return false
    if (filtre === 'inactifs' && e.actif) return false
    if (filtre === 'non-affectes' && (e.classe || !e.actif)) return false
    if (q.length >= 2 && !`${e.nom} ${e.prenom}`.toLowerCase().includes(q.toLowerCase())) return false
    return true
  }), [q, filtre])

  const nb = {
    tous: ELEVES.length,
    actifs: ELEVES.filter(e => e.actif).length,
    inactifs: ELEVES.filter(e => !e.actif).length,
    nonAffectes: ELEVES.filter(e => e.actif && !e.classe).length,
  }

  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {/* Filtres en SWITCH (motif des bascules de l'EDT) : un segment par
            filtre, compteur + libelle. Le chiffre garde sa couleur hors selection. */}
        <div role="group" aria-label="Filtrer les apprenants" className="flex rounded-lg overflow-hidden text-xs font-medium border border-warm-200">
          {([
            { f: 'tous',         n: nb.tous,        libelle: 'Apprenants',   couleur: 'text-secondary-800' },
            { f: 'actifs',       n: nb.actifs,      libelle: 'Actifs',       couleur: 'text-primary-600' },
            { f: 'inactifs',     n: nb.inactifs,    libelle: 'Inactifs',     couleur: 'text-secondary-800' },
            { f: 'non-affectes', n: nb.nonAffectes, libelle: 'Non affectés', couleur: 'text-amber-700' },
          ] as { f: Filtre; n: number; libelle: string; couleur: string }[]).map((x, i) => {
            const actif = filtre === x.f
            return (
              <button
                key={x.f}
                type="button"
                aria-pressed={actif}
                onClick={() => setFiltre(x.f)}
                className={clsx(
                  'flex items-baseline gap-1.5 px-3 py-1.5 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-300',
                  i > 0 && 'border-l border-warm-200',
                  actif
                    ? 'bg-[var(--brand-surface)] text-white dark:bg-[var(--brand-accent)] dark:text-[var(--brand-surface-2)]'
                    : 'bg-white text-warm-700 hover:bg-warm-50',
                )}
              >
                <span className={clsx('text-sm font-bold tabular-nums', !actif && x.couleur)}>{x.n}</span>
                {x.libelle}
              </button>
            )
          })}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Recherche value={q} onChange={setQ} ariaLabel="Rechercher un apprenant" />
          <FloatButton type="button">Ajouter</FloatButton>
        </div>
      </div>

      {/* Liste SANS cadre complet : ni bord gauche, ni droit, ni bas.
          Seuls le trait du haut et les separateurs de lignes subsistent. */}
      <div className="border-t border-[var(--card-border)]">
        <table className="w-full text-xs" aria-label="Liste des apprenants">
          <thead>
            {/* En-tete teinte du teal de marque (variante 1, sans lisere), bordee a gauche et a droite. */}
            <tr className="border-b border-[var(--card-border)] bg-[color-mix(in_srgb,var(--brand-surface)_8%,var(--surface-card))] dark:bg-[color-mix(in_srgb,var(--brand-accent)_12%,var(--surface-card))] [&>th]:text-[var(--brand-surface)] dark:[&>th]:text-[var(--brand-accent)] [&>th]:border-[var(--card-border)] [&>th:first-child]:border-l [&>th:last-child]:border-r">
              <th scope="col" className="list-th w-3/12 pl-5">Élève</th>
              <th scope="col" className="list-th w-2/12">N° élève</th>
              <th scope="col" className="list-th w-2/12">Classe</th>
              <th scope="col" className="list-th w-2/12">Naissance</th>
              <th scope="col" className="list-th w-2/12">Absences</th>
              <th scope="col" className="list-th w-1/12" />
            </tr>
          </thead>
          <tbody className="divide-y divide-warm-100">
            {lignes.map(e => (
              <tr
                key={e.id}
                onClick={() => ouvrir(e)}
                className={clsx(
                  'cursor-pointer transition-colors',
                  e.actif ? 'bg-[var(--surface-card)] hover:bg-warm-100' : 'bg-warm-50 hover:bg-warm-100',
                )}
              >
                <td className="list-td relative pl-5">
                  {/* Barre des ACTIFS : vive, collee au bord gauche. */}
                  {e.actif && <span aria-hidden className="absolute left-0 top-1 bottom-1 w-1 rounded-r-full bg-primary-500" />}
                  <div className="flex items-center gap-2.5">
                    <Avatar e={e} />
                    <span className={clsx('list-name', e.actif ? 'text-secondary-800' : 'text-warm-400')}>{e.nom} {e.prenom}</span>
                    {!e.actif && <span className="text-xs bg-warm-200 text-warm-700 px-1.5 py-0.5 rounded font-medium">inactif</span>}
                  </div>
                </td>
                <td className="list-td"><span className={clsx('font-mono', e.actif ? 'text-warm-700' : 'text-warm-400')}>{e.numero}</span></td>
                <td className="list-td">
                  {e.classe
                    ? <span className={clsx('font-medium', e.actif ? 'text-secondary-700' : 'text-warm-400')}>{e.classe}</span>
                    : <span className={clsx('italic', e.actif ? 'text-warm-700' : 'text-warm-400')}>Non affecté</span>}
                </td>
                <td className="list-td"><span className={e.actif ? 'text-secondary-700' : 'text-warm-400'}>{e.naissance} ({e.age} ans)</span></td>
                <td className="list-td">
                  {e.absences > 0
                    ? <span className="font-semibold text-red-600">{e.absences} absence{e.absences > 1 ? 's' : ''}</span>
                    : <span className="text-warm-700">·</span>}
                </td>
                <td className="list-td" onClick={ev => ev.stopPropagation()}>
                  <div className="flex items-center justify-end gap-1">
                    <Tooltip content="Modifier">
                      <button type="button" aria-label="Modifier l'élève" onClick={() => ouvrir(e)} className="p-1.5 text-warm-700 hover:text-secondary-700 hover:bg-warm-100 rounded-lg">
                        <Pencil size={14} />
                      </button>
                    </Tooltip>
                    <Tooltip content="Supprimer">
                      <button type="button" aria-label="Supprimer l'élève" className="p-1.5 text-warm-700 hover:text-red-600 hover:bg-red-50 rounded-lg">
                        <Trash2 size={14} />
                      </button>
                    </Tooltip>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {lignes.length === 0 && <p className="py-6 text-center text-sm text-warm-700">Aucun apprenant ne correspond.</p>}
      </div>
    </section>
  )
}

// ─── Fiche a onglets intercalaires ───────────────────────────────────────────

const ONGLETS = [
  { cle: 'identite',   libelle: 'Identité' },
  { cle: 'scolarite',  libelle: 'Scolarité' },
  { cle: 'discipline', libelle: 'Discipline' },
  { cle: 'documents',  libelle: 'Documents' },
] as const
type Onglet = typeof ONGLETS[number]['cle']

// Cinq styles d'onglets a comparer (selecteur au-dessus de la fiche).
type StyleOnglet = 0 | 1 | 2 | 3 | 4

const FOCUS_ONGLET = 'outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-300'

function Onglets({ actif, choisir, style }: { actif: Onglet; choisir: (o: Onglet) => void; style: StyleOnglet }) {
  // Style 2 : la barre glisse sous l'onglet actif — position MESUREE.
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const [barre, setBarre] = useState({ left: 0, width: 0 })
  useLayoutEffect(() => {
    const el = refs.current[ONGLETS.findIndex(o => o.cle === actif)]
    if (el) setBarre({ left: el.offsetLeft, width: el.offsetWidth })
  }, [actif, style])

  const conteneur = {
    0: 'flex items-end gap-1 pl-3 border-b-[3px] border-[var(--brand-surface)]',
    1: 'inline-flex gap-1 p-1 rounded-xl bg-warm-100 border border-[var(--card-border)]',
    2: 'relative flex gap-6 border-b border-[var(--card-border)]',
    3: 'flex items-end pl-2 border-b-2 border-[var(--brand-surface)] dark:border-[var(--brand-accent)]',
    4: 'flex items-end gap-1',
  }[style]

  const onglet = (estActif: boolean, i: number) => {
    switch (style) {
      case 0: return clsx('min-w-[7.5rem] px-5 rounded-t-xl text-sm transition-all duration-200', estActif
        ? 'pt-2.5 pb-2 font-semibold text-white bg-[var(--brand-surface)] shadow-[0_-2px_8px_rgba(12,91,81,0.25)]'
        : 'pt-1.5 pb-1.5 font-medium text-warm-700 bg-[linear-gradient(to_bottom,var(--surface-card),var(--surface-sunken))] border border-b-0 border-[var(--card-border)] hover:text-[var(--brand-surface)] dark:hover:text-[var(--brand-accent)] hover:pt-2')
      case 1: return clsx('px-4 py-1.5 rounded-lg text-sm transition-all duration-200', estActif
        ? 'font-semibold bg-[var(--surface-card)] text-[var(--brand-surface)] dark:text-[var(--brand-accent)] shadow-[0_1px_3px_rgba(47,69,80,0.18)]'
        : 'font-medium text-warm-700 hover:text-secondary-800')
      case 2: return clsx('py-2 text-sm transition-colors duration-200', estActif
        ? 'font-semibold text-[var(--brand-surface)] dark:text-[var(--brand-accent)]'
        : 'font-medium text-warm-700 hover:text-secondary-800')
      case 3: return clsx('relative px-7 text-sm transition-colors [clip-path:polygon(10px_0,calc(100%-10px)_0,100%_100%,0_100%)]', i > 0 && '-ml-2', estActif
        ? 'z-10 -mb-[2px] pt-2 pb-[10px] font-semibold text-[var(--brand-surface)] dark:text-[var(--brand-accent)] bg-[var(--surface-card)]'
        : 'pt-1.5 pb-1.5 font-medium text-warm-700 bg-warm-100 hover:text-secondary-800 hover:bg-warm-200')
      case 4: return clsx('relative px-5 rounded-t-lg text-sm border border-[var(--card-border)] transition-colors', estActif
        ? 'z-10 -mb-px pt-2.5 pb-2 font-semibold text-[var(--brand-surface)] dark:text-[var(--brand-accent)] bg-[var(--surface-card)] border-b-[var(--surface-card)] shadow-[inset_0_3px_0_var(--brand-surface)] dark:shadow-[inset_0_3px_0_var(--brand-accent)]'
        : 'pt-1.5 pb-1.5 font-medium text-warm-700 bg-warm-100 hover:text-secondary-800')
    }
  }

  return (
    <div role="tablist" aria-label="Sections de la fiche élève" className={conteneur}>
      {ONGLETS.map((o, i) => {
        const estActif = o.cle === actif
        return (
          <button
            key={o.cle}
            ref={el => { refs.current[i] = el }}
            role="tab"
            type="button"
            aria-selected={estActif}
            tabIndex={estActif ? 0 : -1}
            onClick={() => choisir(o.cle)}
            className={clsx(onglet(estActif, i), FOCUS_ONGLET)}
          >
            {o.libelle}
          </button>
        )
      })}
      {style === 2 && (
        <span aria-hidden className="absolute -bottom-px h-[3px] rounded-full bg-[var(--brand-surface)] dark:bg-[var(--brand-accent)] transition-all duration-300 ease-out motion-reduce:transition-none" style={{ left: barre.left, width: barre.width }} />
      )}
    </div>
  )
}

// ─── Intitules d'encadres : 3 variantes a comparer ───────────────────────────

type VarianteTitre = 1 | 2 | 3
// Classes ecrites EN ENTIER : Tailwind ne voit pas une classe construite par
// interpolation de chaine.
function titreCls(v: VarianteTitre): string {
  const base = '-mx-3 -mt-3 px-3 py-1.5 rounded-t-lg text-xs font-bold uppercase tracking-widest text-[var(--brand-surface)] dark:text-[var(--brand-accent)]'
  if (v === 1) return clsx(base, 'bg-[color-mix(in_srgb,var(--brand-surface)_8%,var(--surface-card))] dark:bg-[color-mix(in_srgb,var(--brand-accent)_12%,var(--surface-card))] border-l-[3px] border-[var(--brand-surface)] dark:border-[var(--brand-accent)] rounded-tl-none')
  if (v === 2) return clsx(base, 'bg-[var(--surface-sunken)] border-b-2 border-[var(--brand-surface)] dark:border-[var(--brand-accent)]')
  return clsx(base, 'bg-[linear-gradient(to_right,color-mix(in_srgb,var(--brand-surface)_12%,var(--surface-card)),var(--surface-card))] dark:bg-[linear-gradient(to_right,color-mix(in_srgb,var(--brand-accent)_12%,var(--surface-card)),var(--surface-card))]')
}

function Fiche({ eleve, retour }: { eleve: Eleve; retour: () => void }) {
  const [onglet, setOnglet] = useState<Onglet>('identite')
  const variante: VarianteTitre = 3
  const styleOnglet = 2 as StyleOnglet
  const [modale, setModale] = useState(false)
  const [f, setF] = useState({
    nom: eleve.nom, prenom: eleve.prenom, naissance: '2018-03-14', genre: eleve.genre === 'male' ? 'Masculin' : 'Féminin',
    lieu: 'Lyon', adresse: '12 rue des Tilleuls', ville: 'Villeurbanne', cp: '69100',
    medical: 'Allergie aux arachides.', urgence: 'COSTA Ana · 06 12 34 56 78',
  })
  const maj = (k: keyof typeof f) => (v: string) => setF(p => ({ ...p, [k]: v }))
  const [av, setAv] = useState({ date: '2026-10-10', type: 'Avertissement', motif: '' })

  return (
    <section className="space-y-3">
      <button type="button" onClick={retour} className="inline-flex items-center gap-1 text-sm font-medium text-warm-700 hover:text-secondary-800">
        <ChevronLeft size={16} /> Retour à la liste
      </button>

      <div className="flex items-center gap-3">
        <Avatar e={eleve} taille="grand" />
        <div className="min-w-0">
          <h1 className="text-lg font-bold text-secondary-800 leading-tight truncate">{eleve.nom} {eleve.prenom}</h1>
          <div className="flex items-center gap-2 text-xs text-warm-700 mt-0.5">
            <span className="font-mono">{eleve.numero}</span>
            <span>· {eleve.classe ?? 'Non affecté'}</span>
            {!eleve.actif && <span className="bg-warm-200 text-warm-700 px-1.5 py-0.5 rounded font-medium">Inactif</span>}
          </div>
        </div>
      </div>

      <div>
      <Onglets actif={onglet} choisir={setOnglet} style={styleOnglet} />

      {/* Contenu : presentation ACTUELLE de la fiche (encadres p-3, titres),
          seuls les champs passent en « bordure ». Style 4 : le contenu vit dans
          un panneau soude a l'onglet actif. */}
      <div role="tabpanel" className={clsx(
        styleOnglet === 4 ? 'p-3 bg-[var(--surface-card)] border border-[var(--card-border)] rounded-b-lg rounded-tr-lg'
          : 'pt-3',
      )}>
        {onglet === 'identite' && (
          <div className="space-y-2">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
              <div className="card p-3 space-y-3">
                <h2 className={titreCls(variante)}>Identité</h2>
                <div className="grid grid-cols-2 gap-x-2 gap-y-3.5 pt-1">
                  <ChampB label="N° élève" value={eleve.numero} verrou />
                  <ChampB label="Classe" value={eleve.classe ?? 'Non affecté'} verrou />
                  <ChampB label="Nom" value={f.nom} onChange={maj('nom')} requis />
                  <ChampB label="Prénom" value={f.prenom} onChange={maj('prenom')} requis />
                  <ChampB label="Date de naissance" type="date" value={f.naissance} onChange={maj('naissance')} requis />
                  <SelectB label="Genre" value={f.genre} onChange={maj('genre')} options={['Masculin', 'Féminin']} requis />
                  <ChampB label="Lieu de naissance" value={f.lieu} onChange={maj('lieu')} />
                </div>
              </div>
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div className="card p-3 space-y-3">
                    <h2 className={titreCls(variante)}>Adresse</h2>
                    <div className="space-y-3.5 pt-1">
                      <ChampB label="Adresse" value={f.adresse} onChange={maj('adresse')} />
                      <div className="grid grid-cols-[1fr_6rem] gap-2">
                        <ChampB label="Ville" value={f.ville} onChange={maj('ville')} />
                        <ChampB label="Code postal" value={f.cp} onChange={maj('cp')} />
                      </div>
                    </div>
                  </div>
                  <div className="card p-3 space-y-3">
                    <h2 className={titreCls(variante)}>Contact d&apos;urgence</h2>
                    <div className="pt-1">
                      <ChampB label="Nom et téléphone" value={f.urgence} onChange={maj('urgence')} />
                    </div>
                  </div>
                </div>
                <div className="card p-3 space-y-3">
                  <h2 className={titreCls(variante)}>Santé</h2>
                  <div className="pt-1">
                    <TexteB label="Notes médicales" value={f.medical} onChange={maj('medical')} />
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <FloatButton type="button" variant="secondary" onClick={retour}>Annuler</FloatButton>
              <FloatButton type="button" variant="edit">Modifier</FloatButton>
            </div>
          </div>
        )}

        {onglet === 'discipline' && (
          <div className="card p-3 space-y-2">
            <div className={clsx(titreCls(variante), 'flex items-center justify-between !py-1')}>
              <h2>Avertissements</h2>
              <FloatButton type="button" variant="secondary" size="mini" onClick={() => setModale(true)}>Ajouter un avertissement</FloatButton>
            </div>
            <p className="text-sm text-warm-700">Aucun avertissement cette année.</p>
          </div>
        )}

        {(onglet === 'scolarite' || onglet === 'documents') && (
          <div className="card p-3">
            <p className="text-sm text-warm-700">Contenu de l&apos;onglet (non reproduit dans le modèle).</p>
          </div>
        )}
      </div>
      </div>

      {modale && (
        <FormModal
          title="Ajouter un avertissement"
          onClose={() => setModale(false)}
          maxWidth="max-w-lg"
          footer={
            <>
              <FloatButton type="button" variant="secondary" onClick={() => setModale(false)}>Annuler</FloatButton>
              <FloatButton type="button" onClick={() => setModale(false)}>Valider</FloatButton>
            </>
          }
        >
          <div className="space-y-4 pt-1">
            <div className="grid grid-cols-2 gap-3">
              <ChampB label="Date" type="date" value={av.date} onChange={v => setAv(p => ({ ...p, date: v }))} requis />
              <SelectB label="Type" value={av.type} onChange={v => setAv(p => ({ ...p, type: v }))} options={['Avertissement', 'Punition', 'Exclusion']} requis />
            </div>
            <ChampB label="Élève" value={`${eleve.nom} ${eleve.prenom}`} verrou />
            <TexteB label="Motif" value={av.motif} onChange={v => setAv(p => ({ ...p, motif: v }))} lignes={4} />
          </div>
        </FormModal>
      )}
    </section>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ModeleClient() {
  const [eleve, setEleve] = useState<Eleve | null>(null)

  return (
    <div className="space-y-6 pb-8">

      <EnTete />

      <div className="h-px bg-[var(--card-border)]" />

      {eleve
        ? <Fiche eleve={eleve} retour={() => setEleve(null)} />
        : <Liste ouvrir={setEleve} />}
    </div>
  )
}
