'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
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
  ChevronDown,
  School,
  UserCheck,
  Wallet,
  Send,
  Inbox,
  UsersRound,
  Bell,
  Clock,
} from 'lucide-react'
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
    name:  'Feuille d\'appel',
    href:  '/dashboard/absences',
    icon:  Calendar,
    roles: ['admin', 'direction', 'enseignant', 'secretaire', 'parent'],
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
        name:  'Nouveau message',
        href:  '/dashboard/communications/new',
        icon:  Send,
        roles: ['admin', 'direction', 'responsable_pedagogique', 'enseignant', 'secretaire', 'comptable'],
      },
      {
        name:  'Messages envoyés',
        href:  '/dashboard/communications',
        icon:  Inbox,
        roles: ['admin', 'direction', 'responsable_pedagogique', 'enseignant', 'secretaire', 'comptable'],
      },
      {
        name:  'Staff interne',
        href:  '/dashboard/communications/staff',
        icon:  UsersRound,
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
        name:  'Vue globale',
        href:  '/dashboard/financements',
        icon:  DollarSign,
        roles: ['admin', 'direction', 'comptable'],
      },
      {
        name:  'Reglements',
        href:  '/dashboard/financements/reglements',
        icon:  Wallet,
        roles: ['admin', 'direction', 'comptable', 'parent'],
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
  role?:             UserRole
  etablissementNom?: string | null
  anneeCourante?:    string | null
}

export default function DashboardSidebar({ role, etablissementNom, anneeCourante }: DashboardSidebarProps) {
  const pathname = usePathname()

  // Groupe de niveau 1 actuellement ouvert
  const activeGroup = navItems.find(
    item => item.children?.some(c =>
      (c.href && pathname.startsWith(c.href)) ||
      c.children?.some(gc => pathname.startsWith(gc.href))
    )
  )?.name ?? null

  // Sous-groupe de niveau 2 actuellement ouvert
  const activeSubGroup = navItems
    .flatMap(item => item.children ?? [])
    .find(child => child.children?.some(gc => pathname.startsWith(gc.href)))
    ?.name ?? null

  const [openGroup,    setOpenGroup]    = useState<string | null>(activeGroup)
  const [openSubGroup, setOpenSubGroup] = useState<string | null>(activeSubGroup)

  const collapseAll = () => {
    setOpenGroup(null)
    setOpenSubGroup(null)
  }

  const toggleGroup = (groupName: string) => {
    setOpenSubGroup(null)
    setOpenGroup(prev => (prev === groupName ? null : groupName))
  }

  const toggleSubGroup = (subGroupName: string) =>
    setOpenSubGroup(prev => (prev === subGroupName ? null : subGroupName))

  const filteredItems = navItems.filter(
    (item) => role && item.roles.includes(role)
  )

  return (
    <aside
      className="w-64 h-full flex flex-col shadow-sidebar flex-shrink-0 overflow-x-hidden"
      style={{ background: 'linear-gradient(180deg, #2e4550 0%, #1f2e35 100%)' }}
    >
      {/* En-tête */}
      <div className="px-5 py-3 border-b border-white/10 text-center">
        <p className="text-white font-bold text-base leading-tight tracking-wide">
          BILAL <span className="text-amber-400">EDUCATION</span>
        </p>
        {etablissementNom && (
          <p className="text-secondary-200 text-xs leading-tight mt-2 font-medium truncate">
            {etablissementNom}
          </p>
        )}
        {anneeCourante && (
          <p className="text-secondary-400 text-xs leading-tight mt-0.5">
            {anneeCourante}
          </p>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-2 overflow-y-auto">
        <div className="space-y-0.5">
          {filteredItems.map((item) => {
            const Icon = item.icon

            // ── Item avec sous-menu de niveau 1 ────────────────────────────
            if (item.children) {
              const visibleChildren = item.children.filter(
                c => role && c.roles.includes(role)
              )
              if (visibleChildren.length === 0) return null

              const isOpen = openGroup === item.name

              return (
                <div key={item.name}>
                  {/* Bouton groupe niveau 1 */}
                  <button
                    onClick={() => toggleGroup(item.name)}
                    className="sidebar-item sidebar-item-default"
                  >
                    <Icon size={18} className="flex-shrink-0 text-secondary-300" />
                    <span className="flex-1 text-left">{item.name}</span>
                    <ChevronDown
                      size={14}
                      className={clsx(
                        'transition-transform duration-200 flex-shrink-0 text-secondary-400',
                        isOpen && 'rotate-180'
                      )}
                    />
                  </button>

                  {/* Sous-items niveau 1 */}
                  {isOpen && (
                    <div className="mt-0.5 ml-3 pl-3 border-l border-white/10 space-y-0.5">
                      {visibleChildren.map(child => {
                        const ChildIcon = child.icon

                        // ── Sous-groupe de niveau 2 (ex: Pédagogie) ────────
                        if (child.children) {
                          const visibleLeaves = child.children.filter(
                            gc => role && gc.roles.includes(role)
                          )
                          if (visibleLeaves.length === 0) return null

                          const isSubOpen = openSubGroup === child.name

                          return (
                            <div key={child.name}>
                              {/* Bouton sous-groupe niveau 2 */}
                              <button
                                onClick={() => toggleSubGroup(child.name)}
                                className="sidebar-item sidebar-item-default"
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

                              {/* Feuilles niveau 3 */}
                              {isSubOpen && (
                                <div className="mt-0.5 ml-3 pl-3 border-l border-white/10 space-y-0.5">
                                  {visibleLeaves.map(leaf => {
                                    const LeafIcon = leaf.icon
                                    const isActive  = pathname === leaf.href
                                    return (
                                      <Link
                                        key={leaf.href}
                                        href={leaf.href}
                                        className={clsx(
                                          'sidebar-item',
                                          isActive ? 'sidebar-item-active' : 'sidebar-item-default'
                                        )}
                                      >
                                        <LeafIcon
                                          size={14}
                                          className={clsx(
                                            'flex-shrink-0',
                                            isActive ? 'text-primary-400' : 'text-secondary-300'
                                          )}
                                        />
                                        <span className="text-sm">{leaf.name}</span>
                                      </Link>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                          )
                        }

                        // ── Lien simple niveau 2 ────────────────────────────
                        const isActive = pathname === child.href
                        return (
                          <Link
                            key={child.href}
                            href={child.href!}
                            onClick={() => setOpenSubGroup(null)}
                            className={clsx(
                              'sidebar-item',
                              isActive ? 'sidebar-item-active' : 'sidebar-item-default'
                            )}
                          >
                            <ChildIcon
                              size={16}
                              className={clsx(
                                'flex-shrink-0',
                                isActive ? 'text-primary-400' : 'text-secondary-300'
                              )}
                            />
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
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href!}
                onClick={() => setOpenGroup(null)}
                className={clsx(
                  'sidebar-item',
                  isActive ? 'sidebar-item-active' : 'sidebar-item-default'
                )}
              >
                <Icon
                  size={18}
                  className={clsx(
                    'flex-shrink-0',
                    isActive ? 'text-primary-400' : 'text-secondary-300'
                  )}
                />
                <span>{item.name}</span>
              </Link>
            )
          })}
        </div>
      </nav>

      {/* Pied de sidebar */}
      <div className="px-4 py-2 border-t border-white/10">
        <p className="text-secondary-400 text-xs text-center">Bilal Education © 2026</p>
      </div>
    </aside>
  )
}
