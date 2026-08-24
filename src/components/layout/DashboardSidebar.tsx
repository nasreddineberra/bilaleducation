'use client'

import Link from 'next/link'
import { APP_VERSION } from '@/lib/app-version'
import { usePathname } from 'next/navigation'
import { useState, useRef, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useSidebar } from './SidebarContext'

import {
  Upload,
  LifeBuoy,
  LayoutDashboard,
  Users,
  Contact,
  GraduationCap,
  BookOpen,
  Calendar,
  FileText,
  MessageSquare,
  DollarSign,
  ClipboardList,
  Building2,
  UserCog,
  CalendarDays,
  CalendarClock,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  School,
  UserCheck,
  Wallet,
  Send,
  Inbox,
  UsersRound,
  Bell,
  Clock,
  Eye,
  BookOpenText,
  Boxes,
  ScrollText,
  CalendarCheck,
} from 'lucide-react'
import Image from 'next/image'
import type { UserRole } from '@/types/database'
import { clsx } from 'clsx'

// ─── Types ────────────────────────────────────────────────────────────────────

interface LeafNavItem {
  name:  string
  href:  string
  icon:  any
  roles: UserRole[]
}

interface SubNavItem {
  name:     string
  href?:    string
  icon:     any
  roles:    UserRole[]
  children?: LeafNavItem[]
}

interface NavItem {
  name:      string
  href?:     string
  icon:      any
  roles:     UserRole[]
  children?: SubNavItem[]
}

// ─── SidebarTooltip ───────────────────────────────────────────────────────────
// Tooltip positionné à droite — même style visuel que components/ui/Tooltip.tsx

function SidebarTooltip({ children, label, className = 'w-full' }: { children: React.ReactNode; label: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  const show = useCallback(() => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setPos({ top: r.top + r.height / 2, left: r.right + 6 })
  }, [])

  const hide = useCallback(() => setPos(null), [])

  return (
    <span ref={ref} className={clsx('inline-flex', className)} onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}>
      {children}
      {pos && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed z-[9999] pointer-events-none flex items-center"
          style={{ top: pos.top, left: pos.left, transform: 'translateY(-50%)' }}
        >
          <span className="relative w-[5px] h-[12px] -mr-px flex-shrink-0">
            <span className="hidden dark:block absolute right-0 top-1/2 -translate-y-1/2 border-y-[6px] border-r-[6px] border-y-transparent border-r-[var(--brand-accent)]" />
            <span className="absolute right-0 top-1/2 -translate-y-1/2 border-y-[5px] border-r-[5px] border-y-transparent border-r-[var(--brand-surface)]" />
          </span>
          <div className="bg-[var(--brand-surface)] text-white rounded-xl shadow-xl px-3 py-2 text-xs whitespace-nowrap dark:border dark:border-[var(--brand-accent)]">
            {label}
          </div>
        </div>,
        document.body,
      )}
    </span>
  )
}

// ─── Structure de navigation ──────────────────────────────────────────────────

const navItems: NavItem[] = [
  {
    name:  'Tableau de bord',
    href:  '/dashboard',
    icon:  LayoutDashboard,
    roles: ['admin', 'direction', 'comptable', 'responsable_pedagogique', 'enseignant', 'secretaire', 'parent'],
  },
  {
    name:  'Notifications',
    href:  '/dashboard/notifications',
    icon:  Bell,
    roles: ['admin', 'direction', 'comptable', 'responsable_pedagogique', 'enseignant', 'secretaire', 'parent'],
  },
  {
    name:  'Temps de presence',
    href:  '/dashboard/temps-presence',
    icon:  Clock,
    roles: ['admin', 'direction', 'comptable', 'responsable_pedagogique', 'enseignant', 'secretaire'],
  },
  {
    name:  'Apprenants',
    href:  '/dashboard/students',
    icon:  Users,
    roles: ['admin', 'direction', 'responsable_pedagogique', 'enseignant', 'secretaire'],
  },
  {
    name:  'Parents',
    href:  '/dashboard/parents',
    icon:  Contact,
    roles: ['admin', 'direction', 'responsable_pedagogique', 'secretaire'],
  },
  {
    // La secrétaire crée l'élève et le parent : lui refuser l'affectation
    // coupait l'inscription en deux (décision du 5 août, cf. RLS enrollments).
    name:  'Affectations',
    icon:  UserCheck,
    roles: ['admin', 'direction', 'responsable_pedagogique', 'secretaire'],
    children: [
      {
        name:  'Apprenants',
        href:  '/dashboard/affectation',
        icon:  Users,
        roles: ['admin', 'direction', 'responsable_pedagogique', 'secretaire'],
      },
      {
        name:  'Adultes',
        href:  '/dashboard/affectation/adultes',
        icon:  UserCheck,
        roles: ['admin', 'direction', 'responsable_pedagogique', 'secretaire'],
      },
    ],
  },
  {
    name:  'Évaluations',
    icon:  ClipboardList,
    roles: ['admin', 'direction', 'responsable_pedagogique', 'enseignant', 'parent'],
    children: [
      {
        name:  'Gabarits',
        href:  '/dashboard/evaluations',
        icon:  ClipboardList,
        roles: ['admin', 'direction', 'responsable_pedagogique', 'enseignant', 'secretaire'],
      },
      {
        name:  'Saisie notes',
        href:  '/dashboard/grades',
        icon:  FileText,
        roles: ['admin', 'direction', 'responsable_pedagogique', 'enseignant', 'secretaire', 'parent'],
      },
      {
        name:  'Bulletins',
        href:  '/dashboard/bulletins',
        icon:  FileText,
        roles: ['admin', 'direction', 'responsable_pedagogique', 'enseignant', 'parent'],
      },
    ],
  },
  {
    name:  'Emploi du temps',
    href:  '/dashboard/emploi-du-temps',
    icon:  CalendarClock,
    roles: ['admin', 'direction', 'responsable_pedagogique', 'enseignant', 'parent'],
  },
  {
    // Deux entrées comme les Affectations : les cours adultes ont leurs propres
    // participants (des tuteurs) et leur propre table d'assiduité.
    name:  'Feuille d\'appel',
    icon:  Calendar,
    roles: ['admin', 'direction', 'enseignant', 'secretaire', 'parent'],
    children: [
      {
        name:  'Apprenants',
        href:  '/dashboard/absences',
        icon:  Users,
        roles: ['admin', 'direction', 'enseignant', 'secretaire', 'parent'],
      },
      {
        name:  'Adultes',
        href:  '/dashboard/absences/adultes',
        icon:  UserCheck,
        roles: ['admin', 'direction', 'responsable_pedagogique', 'enseignant', 'secretaire'],
      },
    ],
  },
  {
    // Reserve a la direction : la secretaire saisit les fiches une a une, elle
    // n'importe pas de fichier. Garde repetee sur la PAGE — un ecran reste
    // atteignable par son adresse meme quand le lien est masque.
    name:  'Importation',
    href:  '/dashboard/import',
    icon:  Upload,
    roles: ['admin', 'direction'],
  },
  {
    name:  'Cahier de texte',
    href:  '/dashboard/cahier-texte',
    icon:  BookOpenText,
    roles: ['admin', 'direction', 'responsable_pedagogique', 'enseignant', 'parent'],
  },
  {
    name:  'Communications',
    icon:  MessageSquare,
    roles: ['admin', 'direction', 'responsable_pedagogique', 'enseignant', 'secretaire', 'comptable'],
    children: [
      {
        // L'enseignant ne communique que les devoirs (cahier de texte) ;
        // le comptable ecrit aux familles depuis Financements (transactionnel).
        name:  'Parents',
        href:  '/dashboard/communications/new',
        icon:  Send,
        roles: ['admin', 'direction', 'responsable_pedagogique', 'secretaire'],
      },
      {
        // Communication interne = encadrement (tout staff sauf enseignant).
        // Le comptable ecrit (paie / sujets comptables) ; l'enseignant reste
        // destinataire mais n'ecrit pas au staff.
        name:  'Staff / Enseignants',
        href:  '/dashboard/communications/staff',
        icon:  UsersRound,
        roles: ['admin', 'direction', 'responsable_pedagogique', 'secretaire', 'comptable'],
      },
      {
        name:  'Messages envoyés',
        href:  '/dashboard/communications',
        icon:  Inbox,
        roles: ['admin', 'direction', 'responsable_pedagogique', 'enseignant', 'secretaire', 'comptable'],
      },
    ],
  },
  {
    name:  'Financements',
    icon:  DollarSign,
    roles: ['admin', 'direction', 'comptable', 'parent'],
    children: [
      {
        name:  'Règlements',
        href:  '/dashboard/financements/reglements',
        icon:  Wallet,
        roles: ['admin', 'direction', 'comptable', 'parent'],
      },
      {
        name:  'Stats règlements',
        href:  '/dashboard/financements/vue-globale',
        icon:  Eye,
        roles: ['admin', 'direction', 'comptable'],
      },
      {
        name:  'Situation financière',
        href:  '/dashboard/financements',
        icon:  DollarSign,
        roles: ['admin', 'direction', 'comptable'],
      },
    ],
  },
  // ── Section CLÔTURE ──
  // Sa propre section, juste au-dessus de Paramètres : le passage d'année n'est
  // ni une opération courante ni un réglage. Il était enfoui dans la fiche
  // Année scolaire, où rien n'annonçait sa portée.
  {
    name:  'Audits & Passage d\'année',
    href:  '/dashboard/passage-annee',
    icon:  CalendarCheck,
    roles: ['admin', 'direction'],
  },
  // ── Section PARAMÈTRES (entrées de 1er niveau ; visibilité admin/direction,
  //    identique à l'ancien groupe « Paramètres » qui les englobait) ──
  {
    name:  'Année scolaire',
    href:  '/dashboard/annee-scolaire',
    icon:  CalendarDays,
    roles: ['admin', 'direction'],
  },
  {
    // NB : item « Pédagogie » (sous Paramètres) — à ne pas confondre avec la SECTION Pédagogie.
    name:  'Pédagogie',
    icon:  School,
    roles: ['admin', 'direction', 'responsable_pedagogique', 'secretaire'],
    children: [
      {
        // Le responsable pédagogique gère les classes (décision du 5 août,
        // cf. RLS classes). Le référentiel des cours reste à admin/direction.
        name:  'Param. Classes',
        href:  '/dashboard/classes',
        icon:  BookOpen,
        roles: ['admin', 'direction', 'responsable_pedagogique', 'secretaire'],
      },
      {
        name:  'Référentiel Cours',
        href:  '/dashboard/cours',
        icon:  BookOpen,
        roles: ['admin', 'direction', 'responsable_pedagogique'],
      },
    ],
  },
  {
    name:  'Enseignants',
    href:  '/dashboard/teachers',
    icon:  GraduationCap,
    roles: ['admin', 'direction', 'secretaire'],
  },
  {
    name:  'Utilisateurs',
    href:  '/dashboard/utilisateurs',
    icon:  UserCog,
    roles: ['admin', 'direction'],
  },
  {
    name:  'Financiers',
    href:  '/dashboard/cotisations',
    icon:  Wallet,
    roles: ['admin', 'direction'],
  },
  {
    name:  'Types de présence',
    href:  '/dashboard/types-presence',
    icon:  Clock,
    roles: ['admin', 'direction'],
  },
  {
    name:  'Ressources',
    href:  '/dashboard/ressources',
    icon:  Boxes,
    roles: ['admin', 'direction'],
  },
  {
    name:  'Journal d\'activité',
    href:  '/dashboard/logs',
    icon:  ScrollText,
    roles: ['admin', 'direction'],
  },
  {
    name:  'Établissement',
    href:  '/dashboard/etablissement',
    icon:  Building2,
    roles: ['admin', 'direction'],
  },
]

// ─── Sections repliables (regroupement des items, mapping validé) ──────────────

const SECTION_ORDER = ['Principal', 'Vie scolaire', 'Pédagogie', 'Gestion', 'Clôture', 'Paramètres'] as const

const SECTION_OF: Record<string, string> = {
  'Tableau de bord':    'Principal',
  'Notifications':      'Principal',
  'Temps de presence':  'Principal',
  'Apprenants':         'Vie scolaire',
  'Parents':            'Vie scolaire',
  'Affectations':       'Vie scolaire',
  "Feuille d'appel":    'Vie scolaire',
  'Importation':        'Vie scolaire',
  'Évaluations':        'Pédagogie',
  'Emploi du temps':    'Pédagogie',
  'Cahier de texte':    'Pédagogie',
  'Communications':     'Gestion',
  'Financements':       'Gestion',
  'Audits & Passage d\'année': 'Clôture',
  // Section Paramètres
  'Année scolaire':     'Paramètres',
  'Pédagogie':          'Paramètres',   // item (Param. Classes / Référentiel Cours)
  'Enseignants':        'Paramètres',
  'Utilisateurs':       'Paramètres',
  'Financiers':         'Paramètres',
  'Types de présence':  'Paramètres',
  'Ressources':         'Paramètres',
  "Journal d'activité": 'Paramètres',
  'Établissement':      'Paramètres',
}

// ─── Composant ────────────────────────────────────────────────────────────────

interface DashboardSidebarProps {
  role?:              UserRole
  etablissementNom?:  string | null
  etablissementLogo?: string | null
  anneeCourante?:     string | null
  /** Auteur affiché dans « informations jointes » de la demande de support.
   *  Pour l'AFFICHAGE seulement : la server action relit l'identité en session. */
  auteur?:            { nom: string; email: string; role: string } | null
}

/**
 * Qui peut écrire à l'éditeur.
 *
 * La direction — et l'admin, par la règle du projet : tout contrôle qui
 * autorise `direction` autorise `admin`. Masqué pour les autres : un
 * enseignant s'adresse à sa direction, pas au fournisseur du logiciel, et un
 * canal ouvert à tous transformerait la boîte du support en second niveau
 * d'assistance interne.
 */
const ROLES_SUPPORT: UserRole[] = ['admin', 'direction']

// Initiales de tous les mots, majuscules, sans accents
function getInitiales(nom: string): string {
  return nom
    .split(' ')
    .filter(w => w.length > 0)
    .map(w => w[0].normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase())
    .join('') || 'BE'
}

export default function DashboardSidebar({ role, etablissementNom, etablissementLogo, anneeCourante, auteur }: DashboardSidebarProps) {
  const pathname   = usePathname()

  const { collapsed, setCollapsed } = useSidebar()
  const peutContacterSupport = Boolean(role && ROLES_SUPPORT.includes(role))
  const [tempExpanded,  setTempExpanded]  = useState(false)  // expand temporaire depuis état réduit

  // Collecter tous les hrefs pour déterminer le match le plus spécifique
  const allHrefs: string[] = navItems.flatMap(item =>
    item.href ? [item.href] : (item.children ?? []).flatMap(c =>
      c.href ? [c.href] : (c.children ?? []).map(gc => gc.href)
    )
  )
  const bestMatch = allHrefs
    .filter(h => pathname === h || (h !== '/dashboard' && pathname.startsWith(h + '/')))
    .sort((a, b) => b.length - a.length)[0] ?? null

  const isRouteActive = (href: string) => href === bestMatch

  const activeGroup = navItems.find(
    item => item.children?.some(c =>
      (c.href && (pathname === c.href || pathname.startsWith(c.href + '/'))) ||
      c.children?.some(gc => pathname === gc.href || pathname.startsWith(gc.href + '/'))
    )
  )?.name ?? null

  const activeSubGroup = navItems
    .flatMap(item => item.children ?? [])
    .find(child => child.children?.some(gc => pathname === gc.href || pathname.startsWith(gc.href + '/')))
    ?.name ?? null

  const [openGroup,    setOpenGroup]    = useState<string | null>(activeGroup)
  const [openSubGroup, setOpenSubGroup] = useState<string | null>(activeSubGroup)

  // Section de la route courante (après login → 'Principal').
  const activeTopName =
    activeGroup ??
    navItems.find(i => !!i.href && isRouteActive(i.href))?.name ??
    null
  const activeSection = (activeTopName && SECTION_OF[activeTopName]) || 'Principal'

  // Accordéon de sections : UNE SEULE ouverte à la fois. Par défaut = section de la
  // route ; se met à jour à la navigation ; le clic sur un en-tête bascule (les
  // autres se referment).
  const [openSection, setOpenSection] = useState<string | null>(activeSection)
  useEffect(() => { setOpenSection(activeSection) }, [activeSection])
  // Clic sur une section : elle s'ouvre (les autres se ferment) et tous les
  // menus / sous-menus déroulés se replient. La SÉLECTION n'est jamais effacée :
  // elle correspond toujours à la page affichée (route).
  const toggleSection = (label: string) => {
    // En revenant sur la section de la page affichée, on rouvre le chemin qui y
    // mène (menu + sous-menu) ; sur une autre section, tout est replié.
    const onActive = label === activeSection
    setOpenGroup(onActive ? activeGroup : null)
    setOpenSubGroup(onActive ? activeSubGroup : null)
    setOpenSection(prev => (prev === label ? null : label))
  }

  const toggleGroup = (groupName: string) => {
    setOpenSubGroup(null)
    setOpenGroup(prev => (prev === groupName ? null : groupName))
  }

  const toggleSubGroup = (subGroupName: string) =>
    setOpenSubGroup(prev => (prev === subGroupName ? null : subGroupName))

  // Toggle manuel : annule le tempExpanded
  const handleToggle = () => {
    setCollapsed(v => !v)
    setTempExpanded(false)
    setOpenGroup(null)
    setOpenSubGroup(null)
  }

  // Quand réduit : expand temporaire + ouvre le groupe
  // Quand étendu : toggle normal
  const handleGroupClick = (item: NavItem) => {
    if (collapsed) {
      setCollapsed(false)
      setTempExpanded(true)
      setOpenGroup(item.name)
      setOpenSubGroup(null)
    } else {
      toggleGroup(item.name)
    }
  }

  // Appelé quand on clique sur un lien feuille (niveau 2 ou 3)
  const handleLeafClick = () => {
    if (tempExpanded) {
      setCollapsed(true)
      setTempExpanded(false)
      setOpenGroup(null)
      setOpenSubGroup(null)
    }
  }

  const filteredItems = navItems.filter(item => role && item.roles.includes(role))

  // Mode RÉDUIT : toutes les destinations d'une section, à plat, en icônes.
  // L'icône d'un sous-menu = celle de SON MENU (le libellé vit dans le tooltip).
  type Dest = { href: string; label: string; icon: any }
  const destsOfSection = (sectionLabel: string): Dest[] =>
    filteredItems
      .filter(it => SECTION_OF[it.name] === sectionLabel)
      .flatMap<Dest>(it => {
        if (!it.children) return it.href ? [{ href: it.href, label: it.name, icon: it.icon }] : []
        return it.children
          .filter(c => role && c.roles.includes(role))
          .flatMap<Dest>(c => {
            // Libellé du tooltip : « menu - sous-menu »
            if (!c.children) return c.href ? [{ href: c.href, label: `${it.name} - ${c.name}`, icon: it.icon }] : []
            return c.children
              .filter(gc => role && gc.roles.includes(role))
              .map(gc => ({ href: gc.href, label: `${c.name} - ${gc.name}`, icon: c.icon }))
          })
      })
  const initiales     = getInitiales(etablissementNom ?? 'Bilal Education')

  return (
    <aside
      className={clsx(
        'h-full flex flex-col shadow-sidebar flex-shrink-0 overflow-x-hidden',
        'transition-[width] duration-200 ease-in-out motion-reduce:transition-none',
        collapsed ? 'w-[92px]' : 'w-64'
      )}
      style={{ background: 'linear-gradient(180deg, var(--brand-surface) 0%, var(--brand-surface-2) 100%)' }}
    >

      {/* ── En-tête ──────────────────────────────────────────────────────────── */}
      <div className={clsx(
        'border-b border-white/10 flex-shrink-0 flex',
        collapsed
          ? 'items-center justify-center gap-1 px-1.5 h-[61px]'
          : 'items-center gap-3 px-4 h-[61px]'
      )}>

        <Link
          href="/dashboard"
          className={clsx(
            'flex min-w-0 rounded-lg outline-none transition-opacity hover:opacity-90 motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-400/70',
            collapsed ? 'justify-center' : 'items-start gap-3 flex-1'
          )}
        >
        {/* Avatar / Logo établissement */}
        {etablissementLogo ? (
          <div
            className="flex-shrink-0 w-9 h-9 rounded-lg overflow-hidden select-none"
            style={{
              boxShadow: '0 4px 10px rgba(0,0,0,0.4), 0 1px 3px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.15)',
            }}
          >
            <Image src={etablissementLogo} alt={etablissementNom ?? ''} width={36} height={36} className="w-full h-full object-contain bg-white" unoptimized />
          </div>
        ) : (
          <div
            className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center font-bold select-none"
            style={{
              fontSize: initiales.length <= 2 ? '14px' : initiales.length <= 4 ? '10px' : '8px',
              background: 'linear-gradient(145deg, #5d8a9a 0%, #18aa99 60%, #0e8070 100%)',
              boxShadow: '0 4px 10px rgba(0,0,0,0.4), 0 1px 3px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.2)',
            }}
          >
            <span className="text-white drop-shadow-sm leading-none">{initiales}</span>
          </div>
        )}

        {/* Textes (cachés en mode réduit) */}
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-sm leading-tight whitespace-nowrap overflow-hidden text-ellipsis">
              {etablissementNom ?? 'Bilal Education'}
            </p>
            {anneeCourante && (
              <p className="text-[var(--brand-muted)] text-xs leading-tight mt-0.5 truncate">
                {anneeCourante}
              </p>
            )}
          </div>
        )}
        </Link>

        {/* Bouton toggle — tooltip standard (jamais de title= natif) */}
        <SidebarTooltip label={collapsed ? 'Développer' : 'Réduire'} className="w-auto flex-shrink-0">
          <button
            onClick={handleToggle}
            aria-label={collapsed ? 'Développer la navigation' : 'Réduire la navigation'}
            className="rounded-lg flex items-center justify-center w-5 min-h-[32px] text-[var(--brand-muted)] hover:text-white hover:bg-white/10 transition-colors motion-reduce:transition-none outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-400/70"
          >
            {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
          </button>
        </SidebarTooltip>
      </div>

      {/* ── Navigation ───────────────────────────────────────────────────────── */}
      <nav aria-label="Navigation principale" className="flex-1 py-2 overflow-y-auto overflow-x-hidden sidebar-scroll">
        {/* ── Mode RÉDUIT : icônes groupées par section, sur 2 colonnes ───────── */}
        {collapsed && SECTION_ORDER.map((sectionLabel, si) => {
          const dests = destsOfSection(sectionLabel)
          if (dests.length === 0) return null
          return (
            <div key={sectionLabel} className={clsx('mx-2', si > 0 && 'mt-1.5 pt-1.5 border-t border-white/10')}>
              {/* Rappel du titre de section sous le filet */}
              <p className="pb-1 text-[9px] font-bold uppercase tracking-wide text-center text-[var(--brand-label)] truncate">
                {sectionLabel}
              </p>
              <div className="grid grid-cols-2 gap-1 justify-items-center">
                {dests.map(d => {
                  const DIcon = d.icon
                  const isActive = isRouteActive(d.href)
                  return (
                    <SidebarTooltip key={d.href} label={d.label} className="w-auto">
                      <Link
                        href={d.href}
                        aria-label={d.label}
                        aria-current={isActive ? 'page' : undefined}
                        className={clsx(
                          'w-9 h-9 rounded-[9px] flex items-center justify-center transition-colors duration-200 motion-reduce:transition-none outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-400/70',
                          isActive
                            ? 'bg-white/12 ring-1 ring-[var(--brand-accent)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
                            : 'hover:bg-white/[0.08]',
                        )}
                      >
                        <DIcon size={18} className="flex-shrink-0 text-[var(--brand-icon)]" />
                      </Link>
                    </SidebarTooltip>
                  )
                })}
              </div>
            </div>
          )
        })}

        {/* ── Mode DÉPLOYÉ : sections repliables ─────────────────────────────── */}
        {!collapsed && SECTION_ORDER.map(sectionLabel => {
          const sectionItems = filteredItems.filter(i => SECTION_OF[i.name] === sectionLabel)
          if (sectionItems.length === 0) return null
          const isSecOpen = openSection === sectionLabel
          return (
          <div key={sectionLabel}>
            {!collapsed && (
              <button
                type="button"
                onClick={() => toggleSection(sectionLabel)}
                aria-expanded={isSecOpen}
                className="sidebar-section"
              >
                <span>{sectionLabel}</span>
              </button>
            )}
            <div className={clsx('grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none', (collapsed || isSecOpen) ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
              <div className="overflow-hidden" inert={!collapsed && !isSecOpen}>
                <div className="space-y-0.5 pb-0.5">
          {sectionItems.map((item) => {
            const Icon = item.icon

            // ── Item avec sous-menu ─────────────────────────────────────────
            if (item.children) {
              const visibleChildren = item.children.filter(c => role && c.roles.includes(role))
              if (visibleChildren.length === 0) return null
              const isOpen = !collapsed && openGroup === item.name

              // Groupe actif si un de ses enfants (niv 2 ou 3) est la route courante
              const isGroupActive = item.children.some(c =>
                (c.href && (pathname === c.href || pathname.startsWith(c.href + '/'))) ||
                c.children?.some(gc => pathname === gc.href || pathname.startsWith(gc.href + '/'))
              )

              const btn = (
                <button
                  onClick={() => handleGroupClick(item)}
                  aria-label={item.name}
                  aria-expanded={isOpen}
                  className={clsx(
                    'sidebar-item',
                    isGroupActive ? 'sidebar-item-active' : isOpen ? 'sidebar-item-open' : 'sidebar-item-default',
                    collapsed && 'justify-center'
                  )}
                >
                  {collapsed
                    ? <Icon size={18} className={clsx('flex-shrink-0', isGroupActive ? 'text-[var(--brand-accent)]' : 'text-[var(--brand-icon)]')} />
                    : <SidebarTooltip label={item.name} className="w-auto">
                        <Icon size={18} className={clsx('flex-shrink-0', isGroupActive ? 'text-[var(--brand-accent)]' : 'text-[var(--brand-icon)]')} />
                      </SidebarTooltip>}
                  {!collapsed && (
                    <>
                      <span className="flex-1 text-left">{item.name}</span>
                      <ChevronDown
                        size={14}
                        className={clsx(
                          'transition-transform duration-200 motion-reduce:transition-none flex-shrink-0 text-[var(--brand-muted)]',
                          isOpen && 'rotate-180'
                        )}
                      />
                    </>
                  )}
                </button>
              )

              return (
                <div key={item.name}>
                  {collapsed
                    ? <SidebarTooltip label={item.name}>{btn}</SidebarTooltip>
                    : btn
                  }

                  <div className={clsx('grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none', isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
                    <div className="overflow-hidden" inert={!isOpen}>
                    <div className="mt-0.5 ml-[26px] pl-3 border-l border-white/10 space-y-0.5">
                      {visibleChildren.map(child => {
                        // Sous-groupe niveau 2
                        if (child.children) {
                          const visibleLeaves = child.children.filter(gc => role && gc.roles.includes(role))
                          if (visibleLeaves.length === 0) return null
                          const isSubOpen = openSubGroup === child.name
                          // Le sous-groupe est actif si une de ses feuilles est la route courante.
                          const isSubActive = visibleLeaves.some(gc => isRouteActive(gc.href))

                          return (
                            <div key={child.name}>
                              <button
                                onClick={() => toggleSubGroup(child.name)}
                                aria-label={child.name}
                                aria-expanded={isSubOpen}
                                className={clsx('sidebar-item w-full', isSubActive ? 'sidebar-item-active sidebar-item-active-sub' : isSubOpen ? 'sidebar-item-open' : 'sidebar-item-default')}
                              >
                                {/* Icône du MENU parent (les sous-menus partagent son symbole) */}
                                <SidebarTooltip label={`${item.name} - ${child.name}`} className="w-auto">
                                  <Icon size={16} className={clsx('flex-shrink-0', isSubActive ? 'text-[var(--brand-accent)]' : 'text-[var(--brand-icon)]')} />
                                </SidebarTooltip>
                                <span className="flex-1 text-left text-sm">{child.name}</span>
                                <ChevronDown
                                  size={12}
                                  className={clsx(
                                    'transition-transform duration-200 motion-reduce:transition-none flex-shrink-0 text-[var(--brand-muted)]',
                                    isSubOpen && 'rotate-180'
                                  )}
                                />
                              </button>

                              <div className={clsx('grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none', isSubOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
                                <div className="overflow-hidden" inert={!isSubOpen}>
                                <div className="mt-0.5 ml-[26px] pl-3 border-l border-white/10 space-y-0.5">
                                  {visibleLeaves.map(leaf => {
                                    const isActive  = isRouteActive(leaf.href)
                                    const SubIcon   = child.icon   // icône du sous-menu parent
                                    return (
                                      <Link
                                        key={leaf.href}
                                        href={leaf.href}
                                        onClick={handleLeafClick}
                                        aria-current={isActive ? 'page' : undefined}
                                        className={clsx('sidebar-item', isActive ? 'sidebar-item-active sidebar-item-active-sub' : 'sidebar-item-default')}
                                      >
                                        <SidebarTooltip label={`${child.name} - ${leaf.name}`} className="w-auto">
                                          <SubIcon size={14} className={clsx('flex-shrink-0', isActive ? 'text-[var(--brand-accent)]' : 'text-[var(--brand-icon)]')} />
                                        </SidebarTooltip>
                                        <span className="text-sm">{leaf.name}</span>
                                      </Link>
                                    )
                                  })}
                                </div>
                                </div>
                              </div>
                            </div>
                          )
                        }

                        // Lien simple niveau 2
                        const isActive = child.href ? isRouteActive(child.href) : false
                        return (
                          <Link
                            key={child.href}
                            href={child.href!}
                            onClick={() => { setOpenSubGroup(null); handleLeafClick() }}
                            aria-current={isActive ? 'page' : undefined}
                            className={clsx('sidebar-item', isActive ? 'sidebar-item-active sidebar-item-active-sub' : 'sidebar-item-default')}
                          >
                            {/* Icône du MENU parent */}
                            <SidebarTooltip label={`${item.name} - ${child.name}`} className="w-auto">
                              <Icon size={14} className={clsx('flex-shrink-0', isActive ? 'text-[var(--brand-accent)]' : 'text-[var(--brand-icon)]')} />
                            </SidebarTooltip>
                            <span className="text-sm">{child.name}</span>
                          </Link>
                        )
                      })}
                    </div>
                    </div>
                  </div>
                </div>
              )
            }

            // ── Item simple ─────────────────────────────────────────────────
            const isActive = item.href ? isRouteActive(item.href) : false
            const link = (
              <Link
                href={item.href!}
                onClick={() => { setOpenGroup(null); setOpenSubGroup(null); handleLeafClick() }}
                aria-current={isActive ? 'page' : undefined}
                className={clsx(
                  'sidebar-item',
                  isActive ? 'sidebar-item-active' : 'sidebar-item-default',
                  collapsed && 'justify-center'
                )}
              >
                <SidebarTooltip label={item.name} className="w-auto">
                  <Icon size={18} className={clsx('flex-shrink-0', isActive ? 'text-[var(--brand-accent)]' : 'text-[var(--brand-icon)]')} />
                </SidebarTooltip>
                <span>{item.name}</span>
              </Link>
            )

            return (
              <div key={item.href}>
                {collapsed
                  ? <SidebarTooltip label={item.name}>{link}</SidebarTooltip>
                  : link
                }
              </div>
            )
          })}
                </div>
              </div>
            </div>
          </div>
          )
        })}
      </nav>

      {/* ── Contacter le support ─────────────────────────────────────────────
          Placé JUSTE AU-DESSUS des informations d'application : c'est le bas de
          page, là où l'on cherche un contact — et non dans la navigation, où il
          se lirait comme une rubrique de travail. */}
      {peutContacterSupport && (
        <div className={clsx(
          'border-t border-white/10 flex-shrink-0',
          collapsed ? 'py-2 flex justify-center' : 'px-3 py-2'
        )}>
          <SidebarTooltip
            label="Support technique"
            className={collapsed ? 'w-auto' : 'w-full'}
          >
            {/* Mène à l'HISTORIQUE, d'où l'on écrit — et non directement à une
                modale de saisie. « Ai-je déjà signalé ce problème ? » se pose
                avant « comment le signaler », et c'est ce qui évite les
                demandes en double. */}
            <Link
              href="/dashboard/support"
              aria-current={pathname === '/dashboard/support' ? 'page' : undefined}
              className={clsx(
                'sidebar-item flex items-center rounded-lg transition-colors',
                pathname === '/dashboard/support'
                  ? 'bg-white/10 text-white'
                  : 'text-[var(--brand-muted)] hover:bg-white/10 hover:text-white',
                collapsed ? 'justify-center p-2' : 'w-full gap-3 px-3 py-2'
              )}
            >
              <LifeBuoy size={collapsed ? 20 : 18} className="flex-shrink-0" aria-hidden="true" />
              {!collapsed && <span className="text-sm truncate">Support technique</span>}
            </Link>
          </SidebarTooltip>
        </div>
      )}

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <div className={clsx(
        'border-t border-white/10 flex-shrink-0',
        collapsed ? 'py-2 flex justify-center items-center' : 'px-4 py-2.5'
      )}>
        {collapsed ? (
          <SidebarTooltip label={`© 2026 Bilal Education · ${APP_VERSION}`} className="w-full justify-center">
            {/* Réduite, la sidebar n'a place que pour la marque : le logo
                remplace le sigle © et reste le repère visuel. */}
            <Image
              src="/icon.png"
              alt="Bilal Education"
              width={28}
              height={28}
              className="opacity-80"
              unoptimized
            />
          </SidebarTooltip>
        ) : (
          <div className="flex items-center gap-2.5">
            <Image
              src="/icon.png"
              alt="Bilal Education"
              width={32}
              height={32}
              className="flex-shrink-0 opacity-90"
              unoptimized
            />
            {/* Le texte occupe l'espace RESTANT et s'y centre : le logo et le
                badge de version tiennent les deux bords, la mention flotte
                entre eux. */}
            <div className="flex-1 min-w-0 text-center space-y-0.5">
              <p className="text-[var(--brand-muted)] text-xs truncate">© 2026 Bilal Education</p>
              <p className="text-[var(--brand-muted)] text-[11px]">Tous droits réservés</p>
            </div>
            {/* `inline-flex items-center` + `leading-none` : sans cela le
                texte se cale sur sa ligne de base et flotte haut dans la
                pastille. La rangée, elle, est déjà en `items-center`. */}
            <span className="inline-flex items-center leading-none text-[11px] text-[var(--brand-icon)] font-mono bg-white/10 px-1.5 py-1 rounded flex-shrink-0 self-center">{APP_VERSION}</span>
          </div>
        )}
      </div>

    </aside>
  )
}
