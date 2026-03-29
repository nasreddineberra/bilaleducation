'use client'

import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { LogOut, Bell, ChevronRight } from 'lucide-react'

import { useSidebar } from './SidebarContext'
import { authRepository } from '@/lib/database/auth'
import { useInactivityLogout } from '@/hooks/useInactivityLogout'
import type { Profile } from '@/types/database'
import type { User as SupabaseUser } from '@supabase/supabase-js'

// ─── Mapping route → titre ─────────────────────────────────────────────────

const EXACT_TITLES: Record<string, string> = {
  '/dashboard':                   'Tableau de bord',
  '/dashboard/students':          'Apprenants',
  '/dashboard/students/new':      'Nouvel apprenant',
  '/dashboard/parents':           'Parents & Responsables',
  '/dashboard/parents/new':       'Nouveau parent',
  '/dashboard/teachers':          'Enseignants',
  '/dashboard/teachers/new':      'Nouvel enseignant',
  '/dashboard/classes':           'Paramétrage des classes',
  '/dashboard/affectation':         'Affectations pédagogiques apprenants',
  '/dashboard/affectation/adultes': 'Affectations pédagogiques adultes',
  '/dashboard/classes/new':       'Nouvelle classe',
  '/dashboard/grades':            'Saisie notes',
  '/dashboard/bulletins':          'Bulletins',
  '/dashboard/absences':          'Feuille d\'appel',
  '/dashboard/evaluations':       'Gabarits des évaluations',
  '/dashboard/communications':        'Messages envoyés',
  '/dashboard/communications/new':    'Nouveau message',
  '/dashboard/communications/staff':  'Communication interne',
  '/dashboard/notifications':      'Notifications',
  '/dashboard/temps-presence':     'Temps de presence',
  '/dashboard/financements':              'Situation financière actuelle',
  '/dashboard/financements/reglements':  'Règlements',
  '/dashboard/financements/vue-globale': 'Stats règlements',
  '/dashboard/etablissement':     'Établissement',
  '/dashboard/utilisateurs':      'Utilisateurs',
  '/dashboard/annee-scolaire':    'Année scolaire',
  '/dashboard/annee-scolaire/new':'Nouvelle année scolaire',
  '/dashboard/cours':             'Référentiel des cours',
  '/dashboard/cotisations':       'Financiers',
  '/dashboard/ressources':        'Ressources',
  '/dashboard/logs':              'Journal d\'activité',
  '/dashboard/emploi-du-temps':   'Emploi du temps',
  '/dashboard/cahier-texte':      'Cahier de texte',
  '/dashboard/cahier-texte/new':  'Nouvelle séance',
}

// Couleur dérivée du nom (stable pour une même personne)
const AVATAR_COLORS: [string, string][] = [
  ['#3b6cb7', '#1a3a6b'], // bleu
  ['#18aa99', '#0e6b60'], // teal
  ['#e85d04', '#b84a03'], // orange
  ['#7c3aed', '#4c1d95'], // violet
  ['#0891b2', '#0e4f6b'], // cyan
  ['#16a34a', '#14532d'], // vert
  ['#dc2626', '#7f1d1d'], // rouge
  ['#d97706', '#78350f'], // ambre
]

function getAvatarColor(name: string): [string, string] {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function getInitiales(firstName?: string | null, lastName?: string | null): string {
  const f = firstName?.[0]?.toUpperCase() ?? ''
  const l = lastName?.[0]?.toUpperCase() ?? ''
  return f + l || '?'
}

// ─── Breadcrumb ───────────────────────────────────────────────────────────────

type Crumb = { label: string }

function getBreadcrumbs(pathname: string): Crumb[] {
  if (pathname === '/dashboard') return [{ label: 'Tableau de bord' }]

  // Sous-pages apprenants
  if (/^\/dashboard\/students\/new/.test(pathname))
    return [{ label: 'Apprenants' }, { label: 'Nouvel apprenant' }]
  if (/^\/dashboard\/students\//.test(pathname))
    return [{ label: 'Apprenants' }, { label: 'Fiche apprenant' }]

  // Sous-pages parents
  if (/^\/dashboard\/parents\/new/.test(pathname))
    return [{ label: 'Parents & Responsables' }, { label: 'Nouveau parent' }]
  if (/^\/dashboard\/parents\//.test(pathname))
    return [{ label: 'Parents & Responsables' }, { label: 'Fiche parent' }]

  // Sous-pages enseignants
  if (/^\/dashboard\/teachers\/new/.test(pathname))
    return [{ label: 'Paramètres' }, { label: 'Enseignants' }, { label: 'Nouvel enseignant' }]
  if (/^\/dashboard\/teachers\//.test(pathname))
    return [{ label: 'Paramètres' }, { label: 'Enseignants' }, { label: 'Fiche enseignant' }]

  // Sous-pages utilisateurs
  if (/^\/dashboard\/utilisateurs\/new/.test(pathname))
    return [{ label: 'Paramètres' }, { label: 'Utilisateurs' }, { label: 'Nouvel utilisateur' }]
  if (/^\/dashboard\/utilisateurs\//.test(pathname))
    return [{ label: 'Paramètres' }, { label: 'Utilisateurs' }, { label: 'Utilisateur' }]

  // Sous-pages classes (sous Paramètres > Pédagogie)
  if (/^\/dashboard\/classes\/new/.test(pathname))
    return [{ label: 'Paramètres' }, { label: 'Pédagogie' }, { label: 'Classes' }, { label: 'Nouvelle classe' }]
  if (/^\/dashboard\/classes\//.test(pathname))
    return [{ label: 'Paramètres' }, { label: 'Pédagogie' }, { label: 'Classes' }, { label: 'Fiche classe' }]

  // Sous-pages année scolaire
  if (/^\/dashboard\/annee-scolaire\/new/.test(pathname))
    return [{ label: 'Paramètres' }, { label: 'Année scolaire' }, { label: 'Nouvelle année' }]
  if (/^\/dashboard\/annee-scolaire\//.test(pathname))
    return [{ label: 'Paramètres' }, { label: 'Année scolaire' }, { label: 'Détail' }]

  // Sous-pages notifications
  if (/^\/dashboard\/notifications\//.test(pathname))
    return [{ label: 'Notifications' }, { label: 'Détail' }]

  // Sous-pages cahier de texte
  if (/^\/dashboard\/cahier-texte\/new/.test(pathname))
    return [{ label: 'Cahier de texte' }, { label: 'Nouvelle séance' }]
  if (/^\/dashboard\/cahier-texte\//.test(pathname))
    return [{ label: 'Cahier de texte' }, { label: 'Séance' }]

  // Communications
  if (/^\/dashboard\/communications\/new/.test(pathname))
    return [{ label: 'Communications' }, { label: 'Nouveau message' }]
  if (/^\/dashboard\/communications\/staff/.test(pathname))
    return [{ label: 'Communications' }, { label: 'Staff interne' }]
  if (/^\/dashboard\/communications\//.test(pathname))
    return [{ label: 'Communications' }, { label: 'Message' }]
  if (pathname === '/dashboard/communications')
    return [{ label: 'Communications' }, { label: 'Messages envoyés' }]

  // Financements
  if (/^\/dashboard\/financements\/reglements/.test(pathname))
    return [{ label: 'Financements' }, { label: 'Règlements' }]
  if (/^\/dashboard\/financements\/vue-globale/.test(pathname))
    return [{ label: 'Financements' }, { label: 'Stats règlements' }]
  if (pathname === '/dashboard/financements')
    return [{ label: 'Financements' }, { label: 'Situation financière' }]

  // Affectations
  if (/^\/dashboard\/affectation\/adultes/.test(pathname))
    return [{ label: 'Affectations' }, { label: 'Adultes' }]
  if (pathname === '/dashboard/affectation')
    return [{ label: 'Affectations' }, { label: 'Apprenants' }]

  // Évaluations
  if (pathname === '/dashboard/evaluations')
    return [{ label: 'Évaluations' }, { label: 'Gabarits' }]
  if (pathname === '/dashboard/grades')
    return [{ label: 'Évaluations' }, { label: 'Saisie notes' }]
  if (pathname === '/dashboard/bulletins')
    return [{ label: 'Évaluations' }, { label: 'Bulletins' }]

  // Pages sous Paramètres > Pédagogie (3 niveaux)
  if (pathname === '/dashboard/classes')
    return [{ label: 'Paramètres' }, { label: 'Pédagogie' }, { label: 'Param. Classes' }]
  if (pathname === '/dashboard/cours')
    return [{ label: 'Paramètres' }, { label: 'Pédagogie' }, { label: 'Référentiel Cours' }]

  // Pages Paramètres niveau 1 (2 niveaux)
  const paramsPages: Record<string, string> = {
    '/dashboard/teachers':       'Enseignants',
    '/dashboard/utilisateurs':   'Utilisateurs',
    '/dashboard/annee-scolaire': 'Année scolaire',
    '/dashboard/cotisations':    'Financiers',
    '/dashboard/ressources':     'Ressources',
    '/dashboard/logs':           'Journal d\'activité',
    '/dashboard/etablissement':  'Établissement',
  }
  if (paramsPages[pathname])
    return [{ label: 'Paramètres' }, { label: paramsPages[pathname] }]

  // Pages directes connues (menu direct, pas de groupe parent)
  const title = EXACT_TITLES[pathname]
  if (title) return [{ label: title }]

  return [{ label: 'Tableau de bord' }]
}

function getPageTitle(pathname: string): string {
  if (EXACT_TITLES[pathname]) return EXACT_TITLES[pathname]
  if (/^\/dashboard\/students\//.test(pathname))       return 'Fiche apprenant'
  if (/^\/dashboard\/parents\//.test(pathname))        return 'Fiche parent'
  if (/^\/dashboard\/teachers\//.test(pathname))       return 'Fiche enseignant'
  if (/^\/dashboard\/utilisateurs\//.test(pathname))   return 'Utilisateur'
  if (/^\/dashboard\/notifications\//.test(pathname))  return 'Notification'
  if (/^\/dashboard\/classes\//.test(pathname))        return 'Fiche classe'
  if (/^\/dashboard\/annee-scolaire\//.test(pathname)) return 'Année scolaire'
  return 'Tableau de bord'
}

// ─── Composant ────────────────────────────────────────────────────────────

interface DashboardNavProps {
  user: SupabaseUser
  profile: Profile | null
  unreadNotifCount?: number
}

export default function DashboardNav({ user, profile, unreadNotifCount = 0 }: DashboardNavProps) {
  const router    = useRouter()
  const pathname  = usePathname()
  const { collapsed } = useSidebar()

  const handleLogout = async () => {
    try {
      await authRepository.signOut()
    } catch (error) {
      console.error('Erreur de déconnexion:', error)
    }
    // Navigation dure pour purger tout le state React/Supabase en cache
    window.location.href = '/login'
  }

  useInactivityLogout(handleLogout)

  return (
    <nav className="bg-white shadow-nav px-6 py-3 sticky top-0 z-30">
      <div className="flex items-center justify-between">

        {/* Titre + Breadcrumb */}
        <div className="hidden md:flex flex-col justify-center">
          {collapsed ? (
            (() => {
              const crumbs = getBreadcrumbs(pathname)
              return crumbs.length > 1 ? (
                <>
                  <nav className="flex items-center gap-1 mb-0.5">
                    {crumbs.map((crumb, i) => (
                      <span key={i} className="flex items-center gap-1">
                        {i > 0 && <ChevronRight size={11} className="text-warm-300 flex-shrink-0" />}
                        <span className={i === crumbs.length - 1 ? 'text-xs text-warm-500' : 'text-xs text-warm-400'}>
                          {crumb.label}
                        </span>
                      </span>
                    ))}
                  </nav>
                  <h1 className="text-lg font-bold text-secondary-800 leading-tight">{getPageTitle(pathname)}</h1>
                </>
              ) : (
                <h1 className="text-xl font-bold text-secondary-800">{getPageTitle(pathname)}</h1>
              )
            })()
          ) : (
            <h1 className="text-xl font-bold text-secondary-800">{getPageTitle(pathname)}</h1>
          )}
        </div>

        <div className="flex items-center gap-3 ml-auto">
          {/* Notifications */}
          <Link
            href="/dashboard/notifications"
            className="relative p-2 text-secondary-400 hover:text-secondary-600 hover:bg-warm-100 rounded-xl transition-all duration-200"
            title="Notifications"
            aria-label={unreadNotifCount > 0 ? `Notifications (${unreadNotifCount} non lues)` : 'Notifications'}
          >
            <Bell className="w-5 h-5" />
            {unreadNotifCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-danger-500 text-white text-[10px] font-bold rounded-full ring-2 ring-white px-1">
                {unreadNotifCount > 99 ? '99+' : unreadNotifCount}
              </span>
            )}
          </Link>

          {/* Séparateur */}
          <div className="w-px h-6 bg-warm-200" />

          {/* Profil utilisateur */}
          <Link
            href={profile?.id ? `/dashboard/utilisateurs/${profile.id}` : '#'}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
          >
            <div className="hidden md:block text-right">
              <p className="text-sm font-semibold text-secondary-800 leading-tight">
                {profile?.first_name} {profile?.last_name}
              </p>
              <p className="text-xs text-warm-500 capitalize leading-tight mt-0.5">
                {profile?.role?.replace('_', ' ')}
              </p>
            </div>
            {(() => {
              const initiales = getInitiales(profile?.first_name, profile?.last_name)
              const fullName  = `${profile?.first_name ?? ''}${profile?.last_name ?? ''}`
              const [bg, ring] = getAvatarColor(fullName)
              return (
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center shadow-sm font-bold text-sm text-white select-none flex-shrink-0"
                  style={{ background: bg, boxShadow: `0 0 0 2px ${ring}40` }}
                >
                  {initiales}
                </div>
              )
            })()}
          </Link>

          {/* Déconnexion */}
          <button
            onClick={handleLogout}
            className="p-2 text-warm-500 hover:text-danger-500 hover:bg-danger-50 rounded-xl transition-all duration-200"
            title="Déconnexion"
            aria-label="Déconnexion"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </nav>
  )
}
