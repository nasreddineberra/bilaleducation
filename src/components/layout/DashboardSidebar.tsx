'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useSidebar } from './SidebarContext'
import {
  LayoutDashboard,
  Users,
  Contact,
  GraduationCap,
  BookOpen,
  Calendar,
  FileText,
  MessageSquare,
  DollarSign,
  Settings,
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

function SidebarTooltip({ children, label }: { children: React.ReactNode; label: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  const show = useCallback(() => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setPos({ top: r.top + r.height / 2, left: r.right + 6 })
  }, [])

  const hide = useCallback(() => setPos(null), [])

  return (
    <div ref={ref} className="w-full" onMouseEnter={show} onMouseLeave={hide}>
      {children}
      {pos && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed z-[9999] pointer-events-none flex items-center"
          style={{ top: pos.top, left: pos.left, transform: 'translateY(-50%)' }}
        >
          <span className="border-[5px] border-transparent border-r-secondary-800 -mr-px" />
          <div className="bg-secondary-800 text-white rounded-xl shadow-xl px-3 py-1.5 text-xs font-medium whitespace-nowrap">
            {label}
          </div>
        </div>,
        document.body,
      )}
    </div>
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
    roles: ['admin', 'direction', 'enseignant', 'secretaire'],
  },
  {
    name:  'Parents',
    href:  '/dashboard/parents',
    icon:  Contact,
    roles: ['admin', 'direction', 'secretaire'],
  },
  {
    name:  'Emploi du temps',
    href:  '/dashboard/emploi-du-temps',
    icon:  CalendarClock,
    roles: ['admin', 'direction', 'responsable_pedagogique', 'enseignant', 'parent'],
  },
  {
    name:  'Feuille d\'appel',
    href:  '/dashboard/absences',
    icon:  Calendar,
    roles: ['admin', 'direction', 'enseignant', 'secretaire', 'parent'],
  },
  {
    name:  'Cahier de texte',
    href:  '/dashboard/cahier-texte',
    icon:  BookOpenText,
    roles: ['admin', 'direction', 'responsable_pedagogique', 'enseignant', 'parent'],
  },
  {
    name:  'Affectations',
    icon:  UserCheck,
    roles: ['admin', 'direction', 'responsable_pedagogique'],
    children: [
      {
        name:  'Apprenants',
        href:  '/dashboard/affectation',
        icon:  Users,
        roles: ['admin', 'direction', 'responsable_pedagogique'],
      },
      {
        name:  'Adultes',
        href:  '/dashboard/affectation/adultes',
        icon:  UserCheck,
        roles: ['admin', 'direction', 'responsable_pedagogique'],
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
        roles: ['admin', 'direction', 'responsable_pedagogique', 'enseignant'],
      },
      {
        name:  'Saisie notes',
        href:  '/dashboard/grades',
        icon:  FileText,
        roles: ['admin', 'direction', 'responsable_pedagogique', 'enseignant', 'parent'],
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
    name:  'Communications',
    icon:  MessageSquare,
    roles: ['admin', 'direction', 'responsable_pedagogique', 'enseignant', 'secretaire', 'comptable'],
    children: [
      {
        name:  'Parents',
        href:  '/dashboard/communications/new',
        icon:  Send,
        roles: ['admin', 'direction', 'responsable_pedagogique', 'enseignant', 'secretaire', 'comptable'],
      },
      {
        name:  'Staff / Enseignants',
        href:  '/dashboard/communications/staff',
        icon:  UsersRound,
        roles: ['admin', 'direction', 'responsable_pedagogique', 'enseignant', 'secretaire', 'comptable'],
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
  {
    name:  'Paramètres',
    icon:  Settings,
    roles: ['admin', 'direction'],
    children: [
      {
        name:  'Année scolaire',
        href:  '/dashboard/annee-scolaire',
        icon:  CalendarDays,
        roles: ['admin', 'direction'],
      },
      {
        name:  'Pédagogie',
        icon:  School,
        roles: ['admin', 'direction', 'responsable_pedagogique'],
        children: [
          {
            name:  'Param. Classes',
            href:  '/dashboard/classes',
            icon:  BookOpen,
            roles: ['admin', 'direction', 'responsable_pedagogique'],
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
        roles: ['admin', 'direction'],
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
        roles: ['admin', 'direction', 'comptable'],
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
        roles: ['admin', 'direction', 'secretaire'],
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
    ],
  },
]

// ─── Composant ────────────────────────────────────────────────────────────────

interface DashboardSidebarProps {
  role?:              UserRole
  etablissementNom?:  string | null
  etablissementLogo?: string | null
  anneeCourante?:     string | null
}

// Initiales de tous les mots, majuscules, sans accents
function getInitiales(nom: string): string {
  return nom
    .split(' ')
    .filter(w => w.length > 0)
    .map(w => w[0].normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase())
    .join('') || 'BE'
}

export default function DashboardSidebar({ role, etablissementNom, etablissementLogo, anneeCourante }: DashboardSidebarProps) {
  const pathname   = usePathname()

  const { collapsed, setCollapsed } = useSidebar()
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
  const initiales     = getInitiales(etablissementNom ?? 'Bilal Education')

  return (
    <aside
      className={clsx(
        'h-full flex flex-col shadow-sidebar flex-shrink-0 overflow-x-hidden',
        'transition-all duration-200 ease-in-out',
        collapsed ? 'w-16' : 'w-64'
      )}
      style={{ background: 'linear-gradient(180deg, #2e4550 0%, #1f2e35 100%)' }}
    >

      {/* ── En-tête ──────────────────────────────────────────────────────────── */}
      <div className={clsx(
        'border-b border-white/10 flex-shrink-0 flex',
        collapsed
          ? 'flex-col items-center gap-2 py-3 px-2'
          : 'items-start gap-3 px-4 py-4'
      )}>

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
          <div className="flex-1 min-w-0 pt-0.5">
            <p className="text-white font-bold text-sm leading-tight truncate">
              {etablissementNom ?? 'Bilal Education'}
            </p>
            {anneeCourante && (
              <p className="text-secondary-400 text-xs leading-tight mt-0.5 truncate">
                {anneeCourante}
              </p>
            )}
          </div>
        )}

        {/* Bouton toggle */}
        <button
          onClick={handleToggle}
          title={collapsed ? 'Développer' : 'Réduire'}
          aria-label={collapsed ? 'Développer la navigation' : 'Réduire la navigation'}
          className={clsx(
            'flex-shrink-0 rounded-lg p-1 text-secondary-400 hover:text-white hover:bg-white/10 transition-colors',
            collapsed ? 'mt-0' : 'mt-0.5'
          )}
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>

      {/* ── Navigation ───────────────────────────────────────────────────────── */}
      <nav className="flex-1 py-2 overflow-y-auto overflow-x-hidden scrollbar-hide">
        <div className="space-y-0.5">
          {filteredItems.map((item) => {
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
                    collapsed && isGroupActive ? 'sidebar-item-active' : 'sidebar-item-default',
                    collapsed && 'justify-center'
                  )}
                >
                  <Icon size={18} className={clsx('flex-shrink-0', isGroupActive && collapsed ? 'text-primary-400' : 'text-secondary-300')} />
                  {!collapsed && (
                    <>
                      <span className="flex-1 text-left">{item.name}</span>
                      <ChevronDown
                        size={14}
                        className={clsx(
                          'transition-transform duration-200 flex-shrink-0 text-secondary-400',
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

                  {isOpen && (
                    <div className="mt-0.5 ml-3 pl-3 border-l border-white/10 space-y-0.5">
                      {visibleChildren.map(child => {
                        const ChildIcon = child.icon

                        // Sous-groupe niveau 2
                        if (child.children) {
                          const visibleLeaves = child.children.filter(gc => role && gc.roles.includes(role))
                          if (visibleLeaves.length === 0) return null
                          const isSubOpen = openSubGroup === child.name

                          return (
                            <div key={child.name}>
                              <button
                                onClick={() => toggleSubGroup(child.name)}
                                aria-label={child.name}
                                aria-expanded={isSubOpen}
                                className="sidebar-item sidebar-item-default w-full"
                              >
                                <ChildIcon size={16} className="flex-shrink-0 text-secondary-300" />
                                <span className="flex-1 text-left text-sm">{child.name}</span>
                                <ChevronDown
                                  size={12}
                                  className={clsx(
                                    'transition-transform duration-200 flex-shrink-0 text-secondary-400',
                                    isSubOpen && 'rotate-180'
                                  )}
                                />
                              </button>

                              {isSubOpen && (
                                <div className="mt-0.5 ml-3 pl-3 border-l border-white/10 space-y-0.5">
                                  {visibleLeaves.map(leaf => {
                                    const LeafIcon = leaf.icon
                                    const isActive  = isRouteActive(leaf.href)
                                    return (
                                      <Link
                                        key={leaf.href}
                                        href={leaf.href}
                                        onClick={handleLeafClick}
                                        aria-current={isActive ? 'page' : undefined}
                                        className={clsx('sidebar-item', isActive ? 'sidebar-item-active' : 'sidebar-item-default')}
                                      >
                                        <LeafIcon size={14} className={clsx('flex-shrink-0', isActive ? 'text-primary-400' : 'text-secondary-300')} />
                                        <span className="text-sm">{leaf.name}</span>
                                      </Link>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                          )
                        }

                        // Lien simple niveau 2
                        const isActive = child.href ? isRouteActive(child.href) : false
                        return (
                          <Link
                            key={child.href}
                            href={child.href!}
                            onClick={handleLeafClick}
                            aria-current={isActive ? 'page' : undefined}
                            className={clsx('sidebar-item', isActive ? 'sidebar-item-active' : 'sidebar-item-default')}
                          >
                            <ChildIcon size={16} className={clsx('flex-shrink-0', isActive ? 'text-primary-400' : 'text-secondary-300')} />
                            <span className="text-sm">{child.name}</span>
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            }

            // ── Item simple ─────────────────────────────────────────────────
            const isActive = item.href ? isRouteActive(item.href) : false
            const link = (
              <Link
                href={item.href!}
                onClick={() => { setOpenGroup(null); handleLeafClick() }}
                aria-current={isActive ? 'page' : undefined}
                className={clsx(
                  'sidebar-item',
                  isActive ? 'sidebar-item-active' : 'sidebar-item-default',
                  collapsed && 'justify-center'
                )}
              >
                <Icon size={18} className={clsx('flex-shrink-0', isActive ? 'text-primary-400' : 'text-secondary-300')} />
                {!collapsed && <span>{item.name}</span>}
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
      </nav>

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <div className={clsx(
        'border-t border-white/10 flex-shrink-0',
        collapsed ? 'py-2 flex justify-center items-center' : 'px-4 py-2.5'
      )}>
        {collapsed ? (
          <SidebarTooltip label="© 2026 Bilal Education — v1.0">
            <div className="flex justify-center cursor-default">
              <span className="text-secondary-500 text-sm font-medium leading-none">©</span>
            </div>
          </SidebarTooltip>
        ) : (
          <div className="space-y-0.5">
            <div className="flex items-center justify-between">
              <p className="text-secondary-500 text-xs">© 2026 Bilal Education</p>
              <span className="text-[10px] text-secondary-600 font-mono bg-white/5 px-1.5 py-0.5 rounded">v1.0</span>
            </div>
            <p className="text-secondary-600 text-[10px]">Tous droits réservés</p>
          </div>
        )}
      </div>

    </aside>
  )
}
